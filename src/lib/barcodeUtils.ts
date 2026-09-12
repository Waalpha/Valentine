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
  existingBarcodes: string[] = []
): string {
  const existingSet = new Set(existingBarcodes.map(b => String(b ?? '').trim().toUpperCase()));
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
 * Web Audio API Retail POS Scanner Beeps
 * Real audio feedback without external asset files.
 */
class PosAudioFeedback {
  private ctx: AudioContext | null = null;

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

  /**
   * Crisp high-pitched retail scanner beep (like Zebra/Honeywell pos scanners)
   */
  playSuccessBeep() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1850, ctx.currentTime); // 1850Hz crystal scanner tone
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Ignore audio error
    }
  }

  playSuccess() {
    this.playSuccessBeep();
  }

  /**
   * Warning error buzz for out-of-stock or unknown barcode
   */
  playErrorBeep() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Ignore audio error
    }
  }

  playError() {
    this.playErrorBeep();
  }
}

export const posAudio = new PosAudioFeedback();
