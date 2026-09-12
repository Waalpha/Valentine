/**
 * Professional Barcode Utilities for Davetech ERP POS
 * Supports Code 128, EAN-13, UPC-A, and in-store internal barcodes.
 */

import { Product } from '../types';

/**
 * Calculate EAN-13 check digit using standard GS1 Modulo 10 algorithm
 */
export function calculateEan13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(twelveDigits[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validate EAN-13 barcode with checksum
 */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const twelve = code.slice(0, 12);
  const expectedCheck = calculateEan13CheckDigit(twelve);
  return parseInt(code[12], 10) === expectedCheck;
}

/**
 * Calculate UPC-A check digit
 */
export function calculateUpcACheckDigit(elevenDigits: string): number {
  if (!/^\d{11}$/.test(elevenDigits)) return 0;
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < 11; i++) {
    const d = parseInt(elevenDigits[i], 10);
    if (i % 2 === 0) oddSum += d;
    else evenSum += d;
  }
  const total = oddSum * 3 + evenSum;
  const rem = total % 10;
  return rem === 0 ? 0 : 10 - rem;
}

/**
 * Validate UPC-A barcode
 */
export function isValidUpcA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  const eleven = code.slice(0, 11);
  const check = calculateUpcACheckDigit(eleven);
  return parseInt(code[11], 10) === check;
}

/**
 * Generate a unique internal barcode.
 * Uses GS1 in-store prefix 200-299 for EAN-13 or Code 128 format.
 */
export function generateBarcode(
  type: 'EAN13' | 'CODE128' = 'CODE128',
  existingBarcodes: string[] | Set<string> = []
): string {
  const existingSet = existingBarcodes instanceof Set
    ? existingBarcodes
    : new Set(existingBarcodes.map(b => String(b ?? '').trim().toUpperCase()));
  let attempts = 0;

  while (attempts < 500) {
    attempts++;
    let candidate = '';

    if (type === 'EAN13') {
      // 200 prefix is GS1 restricted for internal retail store circulation
      const random9 = Math.floor(100000000 + Math.random() * 900000000).toString();
      const twelve = `200${random9}`;
      const checkDigit = calculateEan13CheckDigit(twelve);
      candidate = `${twelve}${checkDigit}`;
    } else {
      // Code 128 standard alphanumeric: DVT-XXXXXX or numeric 8-10 digits
      const randomPart = Math.floor(10000000 + Math.random() * 90000000).toString();
      candidate = `28${randomPart}`;
    }

    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  // Fallback timestamp based
  return `28${Date.now().toString().slice(-8)}`;
}

/**
 * Verify if barcode is unique within the given tenant's products.
 */
export function isBarcodeUniqueWithinTenant(
  barcode: string,
  currentProductId: string | null,
  tenantProducts: Product[]
): { isUnique: boolean; conflictProduct?: Product } {
  const cleanCode = String(barcode ?? '').trim().toUpperCase();
  if (!cleanCode) return { isUnique: true };

  const conflict = tenantProducts.find(
    p =>
      p.id !== currentProductId &&
      p.barcode != null &&
      String(p.barcode).trim().toUpperCase() === cleanCode
  );

  return {
    isUnique: !conflict,
    conflictProduct: conflict
  };
}

/**
 * Web Audio API Retail Supermarket POS Scanner Beeps
 * Generates authentic, high-tone supermarket laser scanner audio feedback
 * matching NCR, Datalogic Magellan, Zebra & Honeywell supermarket checkout registers.
 */
export type ScannerTonePreset =
  | 'high_frequency'
  | 'piercing_high'
  | 'extreme_high'
  | 'crisp_high'
  | 'supermarket'
  | 'laser_chirp'
  | 'supermarket_chirp'
  | 'supermarket_piercing'
  | 'classic_pos';

class PosAudioFeedback {
  private ctx: AudioContext | null = null;
  private lastPlayedSuccessTime = 0;
  private currentTone: ScannerTonePreset = 'high_frequency';
  private frequency = 3500; // Default 3500 Hz high frequency beep
  private volume = 0.88; // Default 88% loud & crisp on phone speakers
  private isMuted = false;
  private hasUnlocked = false;

  constructor() {
    // Read persisted tone, frequency & volume preferences if available in browser
    if (typeof window !== 'undefined') {
      try {
        const savedTone = localStorage.getItem('pos_scanner_tone') as ScannerTonePreset | null;
        if (
          savedTone &&
          [
            'high_frequency',
            'piercing_high',
            'extreme_high',
            'crisp_high',
            'supermarket',
            'laser_chirp',
            'supermarket_chirp',
            'supermarket_piercing',
            'classic_pos'
          ].includes(savedTone)
        ) {
          this.currentTone = savedTone;
        } else {
          this.currentTone = 'high_frequency';
        }

        const savedFreq = localStorage.getItem('pos_scanner_frequency');
        if (savedFreq != null) {
          const parsed = parseInt(savedFreq, 10);
          if (!isNaN(parsed) && parsed >= 1500 && parsed <= 6000) {
            this.frequency = parsed;
          }
        } else {
          this.frequency = 3500;
        }

        const savedVol = localStorage.getItem('pos_scanner_volume');
        if (savedVol != null) {
          const parsed = parseFloat(savedVol);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            this.volume = parsed;
          }
        }
        const savedMute = localStorage.getItem('pos_scanner_muted');
        if (savedMute === 'true') {
          this.isMuted = true;
        }

        // Auto-unlock Web Audio on first user interaction (touch/click/key)
        const unlockHandler = () => {
          this.unlock();
          window.removeEventListener('pointerdown', unlockHandler);
          window.removeEventListener('touchstart', unlockHandler);
          window.removeEventListener('click', unlockHandler);
          window.removeEventListener('keydown', unlockHandler);
        };
        window.addEventListener('pointerdown', unlockHandler, { once: true, passive: true });
        window.addEventListener('touchstart', unlockHandler, { once: true, passive: true });
        window.addEventListener('click', unlockHandler, { once: true, passive: true });
        window.addEventListener('keydown', unlockHandler, { once: true, passive: true });
      } catch {
        // ignore localStorage access errors
      }
    }
  }

  /**
   * Unlock AudioContext on mobile Safari / Chrome on iOS & Android
   */
  public unlock(): void {
    if (typeof window === 'undefined') return;
    try {
      const ctx = this.getContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      this.hasUnlocked = true;
    } catch {
      // ignore
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.ctx && AudioCtx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public getTone(): ScannerTonePreset {
    return this.currentTone;
  }

  public setTone(tone: ScannerTonePreset, updateFrequency = true): void {
    this.currentTone = tone;
    if (updateFrequency) {
      if (tone === 'high_frequency') this.frequency = 3500;
      else if (tone === 'piercing_high' || tone === 'supermarket_piercing') this.frequency = 3800;
      else if (tone === 'extreme_high') this.frequency = 4200;
      else if (tone === 'crisp_high') this.frequency = 3200;
      else if (tone === 'supermarket') this.frequency = 2800;
      else if (tone === 'classic_pos') this.frequency = 2400;
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pos_scanner_tone', tone);
        localStorage.setItem('pos_scanner_frequency', String(this.frequency));
      } catch {}
    }
  }

  public getFrequency(): number {
    return this.frequency;
  }

  public setFrequency(freq: number): void {
    this.frequency = Math.max(1500, Math.min(6000, Math.round(freq)));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pos_scanner_frequency', String(this.frequency));
      } catch {}
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pos_scanner_volume', String(this.volume));
      } catch {}
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pos_scanner_muted', String(muted));
      } catch {}
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Authentic High-Frequency Retail Barcode Scanner Beep
   * Synthesizes sharp, piercing, crystal-clear high frequency audio (3200Hz - 4200Hz, default 3500 Hz)
   * matching real laser supermarket registers and high-end handheld barcode scanners.
   */
  playSuccessBeep(overrideTone?: ScannerTonePreset, overrideFreq?: number) {
    if (this.isMuted) return;

    const nowMs = Date.now();
    // Prevent double-stutter if two events fire simultaneously within 90ms
    if (nowMs - this.lastPlayedSuccessTime < 90) {
      return;
    }
    this.lastPlayedSuccessTime = nowMs;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const t0 = ctx.currentTime;
      const tone = overrideTone || this.currentTone;
      const masterVol = this.volume;

      // Dynamics Compressor to maximize loudness without clipping phone speakers
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-10, t0);
      compressor.knee.setValueAtTime(3, t0);
      compressor.ratio.setValueAtTime(8, t0);
      compressor.attack.setValueAtTime(0.001, t0);
      compressor.release.setValueAtTime(0.04, t0);
      compressor.connect(ctx.destination);

      if (tone === 'laser_chirp' || tone === 'supermarket_chirp') {
        // High-frequency fast laser sweep chirp (3000Hz -> 3800Hz in 52ms)
        const duration = 0.052;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(3000, t0);
        osc.frequency.exponentialRampToValueAtTime(3800, t0 + duration * 0.75);

        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.9 * masterVol, t0 + 0.0015);
        gain.gain.setValueAtTime(0.9 * masterVol, t0 + duration * 0.65);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

        osc.connect(gain);
        gain.connect(compressor);
        osc.start(t0);
        osc.stop(t0 + duration);
      } else {
        // High Frequency Beep
        let baseFreq = overrideFreq || this.frequency;
        if (overrideTone && !overrideFreq) {
          if (overrideTone === 'high_frequency') baseFreq = 3500;
          else if (overrideTone === 'piercing_high' || overrideTone === 'supermarket_piercing') baseFreq = 3800;
          else if (overrideTone === 'extreme_high') baseFreq = 4200;
          else if (overrideTone === 'crisp_high') baseFreq = 3200;
          else if (overrideTone === 'supermarket') baseFreq = 2800;
          else if (overrideTone === 'classic_pos') baseFreq = 2400;
        }

        // Snappy, laser-crisp duration: 52 milliseconds (0.052s)
        const duration = 0.052;

        // Primary High Frequency Oscillator
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq, t0);

        // Instant 1.2ms clean attack, sustained body, razor-sharp exponential decay
        gain1.gain.setValueAtTime(0.001, t0);
        gain1.gain.linearRampToValueAtTime(0.92 * masterVol, t0 + 0.0015);
        gain1.gain.setValueAtTime(0.92 * masterVol, t0 + 0.038);
        gain1.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

        osc1.connect(gain1);
        gain1.connect(compressor);
        osc1.start(t0);
        osc1.stop(t0 + duration);

        // Secondary Upper Harmonic overtone (2x base frequency, capped at 9500 Hz)
        // Provides the distinct acoustic "sheen" of supermarket laser scanner piezo transducers
        if (baseFreq * 2 <= 9500) {
          try {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(baseFreq * 2, t0);

            gain2.gain.setValueAtTime(0.001, t0);
            gain2.gain.linearRampToValueAtTime(0.12 * masterVol, t0 + 0.0015);
            gain2.gain.setValueAtTime(0.12 * masterVol, t0 + 0.034);
            gain2.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

            osc2.connect(gain2);
            gain2.connect(compressor);
            osc2.start(t0);
            osc2.stop(t0 + duration);
          } catch {
            // harmonic optional
          }
        }
      }
    } catch {
      // Ignore audio error
    }
  }

  playSuccess(overrideTone?: ScannerTonePreset, overrideFreq?: number) {
    this.playSuccessBeep(overrideTone, overrideFreq);
  }

  /**
   * Helper to test or preview high-frequency beep immediately
   */
  testSupermarketBeep(tone?: ScannerTonePreset, freq?: number): void {
    this.unlock();
    this.playSuccessBeep(tone, freq);
  }

  /**
   * Dedicated shortcut to play the crisp high frequency beep
   */
  playHighBeep(freq?: number): void {
    this.unlock();
    this.playSuccessBeep('high_frequency', freq || this.frequency || 3500);
  }

  /**
   * Warning error buzz for out-of-stock or unknown barcode
   * Authentic dual-buzz low pitch warning (260 Hz)
   */
  playErrorBeep() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const t0 = ctx.currentTime;
      const duration = 0.16;
      const masterVol = this.volume;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, t0);
      osc.frequency.setValueAtTime(210, t0 + 0.08);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.35 * masterVol, t0 + 0.004);
      gain.gain.setValueAtTime(0.35 * masterVol, t0 + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration);
    } catch {
      // Ignore audio error
    }
  }

  playError() {
    this.playErrorBeep();
  }
}

export const posAudio = new PosAudioFeedback();
