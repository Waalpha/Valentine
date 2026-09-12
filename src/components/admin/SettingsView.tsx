import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { logAuditAction } from '../../lib/utils';
import { Settings, Save, CheckCircle2, AlertCircle, Building2, Trash2, AlertTriangle, RotateCcw, Volume2, VolumeX, Barcode } from 'lucide-react';
import { clearAllPaymentRecords } from '../../lib/offlineManager';
import { posAudio, ScannerTonePreset } from '../../lib/barcodeUtils';

interface SettingsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  onConfigUpdated: (newConfig: BusinessConfig) => void;
}

export function SettingsView({ user, businessConfig, onConfigUpdated }: SettingsViewProps) {
  const [formData, setFormData] = useState<BusinessConfig>({
    id: DEFAULT_BUSINESS_ID,
    name: 'Club Valentine',
    phone: '+254 712 345 678',
    location: 'Nairobi CBD',
    address: 'Tom Mboya Street, Nairobi',
    currency: 'KSh',
    openingTime: '10:00',
    closingTime: '23:59',
    lowStockThreshold: 10,
    receiptHeader: 'CLUB VALENTINE',
    receiptFooter: 'Thank you! Please drink responsibly.'
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear Payment / Sales Records State
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState('');
  const [confirmText, setConfirmText] = useState('');

  // Barcode Scanner Supermarket Audio Settings State
  const [scannerTone, setScannerTone] = useState<ScannerTonePreset>(() => posAudio.getTone());
  const [scannerFreq, setScannerFreq] = useState<number>(() => posAudio.getFrequency());
  const [scannerVolume, setScannerVolume] = useState<number>(() => posAudio.getVolume());
  const [isScannerMuted, setIsScannerMuted] = useState<boolean>(() => posAudio.getIsMuted());

  useEffect(() => {
    if (businessConfig) {
      setFormData(businessConfig);
    }
  }, [businessConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const bizRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID);
      await setDoc(bizRef, formData, { merge: true });
      await logAuditAction(user.uid, user.name, 'SETTINGS_UPDATED', 'Updated business settings config');
      onConfigUpdated(formData);
      setSuccess('Business settings updated successfully!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Business Settings & Configuration</h2>
        <p className="text-sm text-gray-500">Configure bar name, contact info, currency, operating hours, and receipt branding</p>
      </div>

      {success && (
        <div className="flex items-center space-x-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Bar / Business Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Currency Symbol</label>
            <input
              type="text"
              required
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Phone Number</label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Location / City</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Physical Address</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Opening Time</label>
            <input
              type="text"
              required
              value={formData.openingTime}
              onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Closing Time</label>
            <input
              type="text"
              required
              value={formData.closingTime}
              onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Low Stock Threshold Alert</label>
            <input
              type="number"
              min="1"
              required
              value={formData.lowStockThreshold}
              onChange={(e) => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Receipt Footer Message</label>
            <input
              type="text"
              value={formData.receiptFooter || ''}
              onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 rounded-2xl bg-amber-600 hover:bg-amber-700 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Barcode Scanner Audio Settings Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0">
              <Volume2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-gray-900">High Frequency Barcode Scanner Sound</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 font-mono">
                  {scannerFreq} Hz
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Authentic high-frequency supermarket checkout register beep for phone camera and physical laser barcode scanners.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                posAudio.unlock();
                posAudio.testSupermarketBeep(scannerTone, scannerFreq);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>Test High Beep ({scannerFreq}Hz)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                posAudio.unlock();
                posAudio.playErrorBeep();
              }}
              className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
              title="Test warning buzzer (out of stock / not found)"
            >
              Test Warning Buzz
            </button>
          </div>
        </div>

        {/* Pitch Frequency Slider */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Scanner Frequency Pitch</span>
              <span className="text-emerald-400 font-mono font-bold text-sm bg-emerald-950 px-2.5 py-0.5 rounded-lg border border-emerald-800">
                {scannerFreq} Hz
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Adjust pitch to your exact hearing preference. 3500 Hz provides the optimal sharp supermarket scan beep.
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-80 shrink-0">
            <span className="text-xs text-slate-400 font-mono">2000Hz</span>
            <input
              type="range"
              min="2000"
              max="4800"
              step="50"
              value={scannerFreq}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setScannerFreq(val);
                posAudio.setFrequency(val);
              }}
              onMouseUp={() => posAudio.testSupermarketBeep(scannerTone, scannerFreq)}
              onTouchEnd={() => posAudio.testSupermarketBeep(scannerTone, scannerFreq)}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
            />
            <span className="text-xs text-slate-400 font-mono">4800Hz</span>
          </div>
        </div>

        {/* Tone Selector Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
          {[
            {
              id: 'high_frequency' as ScannerTonePreset,
              freq: 3500,
              title: 'High Frequency Beep (3500 Hz)',
              badge: 'Default',
              desc: 'Authentic 3500 Hz checkout pip with crystal 7000 Hz harmonic resonance, matching modern high-speed retail registers.'
            },
            {
              id: 'piercing_high' as ScannerTonePreset,
              freq: 3800,
              title: 'Piercing High Tone (3800 Hz)',
              badge: 'Ultra High',
              desc: 'High-decibel 3800 Hz piercing frequency designed to cut through loud background bar music, crowds, and ambient noise.'
            },
            {
              id: 'extreme_high' as ScannerTonePreset,
              freq: 4200,
              title: 'Extreme High Pitch (4200 Hz)',
              badge: 'Max Pitch',
              desc: 'Extra-high frequency sharp micro-pip for instantaneous audio feedback.'
            },
            {
              id: 'crisp_high' as ScannerTonePreset,
              freq: 3200,
              title: 'Crisp High Tone (3200 Hz)',
              badge: '3200 Hz',
              desc: 'Commercial laser scan confirmation used in Zebra, Symbol and Honeywell registers.'
            },
            {
              id: 'supermarket' as ScannerTonePreset,
              freq: 2800,
              title: 'Classic Supermarket (2800 Hz)',
              badge: 'Standard',
              desc: 'Traditional 2800 Hz supermarket register checkout beep.'
            },
            {
              id: 'laser_chirp' as ScannerTonePreset,
              freq: 3400,
              title: 'Laser Frequency Chirp',
              badge: 'Chirp',
              desc: 'Fast 3000-3800 Hz rising high-frequency sweep simulating omnidirectional laser scanners.'
            }
          ].map((item) => {
            const isSelected = scannerTone === item.id;
            return (
              <div
                key={item.id}
                onClick={() => {
                  setScannerTone(item.id);
                  setScannerFreq(item.freq);
                  posAudio.setTone(item.id);
                  posAudio.testSupermarketBeep(item.id, item.freq);
                }}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900">{item.title}</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {isSelected ? 'ACTIVE' : item.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                <div className="pt-2 flex items-center justify-between text-xs text-emerald-800 font-semibold">
                  <span>Click to select & listen</span>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Volume & Mute Controls */}
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                const next = posAudio.toggleMute();
                setIsScannerMuted(next);
                if (!next) posAudio.testSupermarketBeep(scannerTone, scannerFreq);
              }}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                isScannerMuted
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {isScannerMuted ? <VolumeX className="w-4 h-4 text-red-600" /> : <Volume2 className="w-4 h-4 text-gray-700" />}
              <span>{isScannerMuted ? 'Scanner Muted' : 'Sound Enabled'}</span>
            </button>

            <span className="text-xs text-gray-500">
              Volume: <strong className="text-gray-900">{Math.round(scannerVolume * 100)}%</strong>
            </span>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-64">
            <span className="text-xs text-gray-400">0%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={scannerVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setScannerVolume(val);
                posAudio.setVolume(val);
              }}
              onMouseUp={() => posAudio.testSupermarketBeep(scannerTone, scannerFreq)}
              onTouchEnd={() => posAudio.testSupermarketBeep(scannerTone, scannerFreq)}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <span className="text-xs text-gray-400">100%</span>
          </div>
        </div>
      </div>

      {/* Danger Zone: Fresh Start */}
      <div className="bg-red-50/50 rounded-3xl p-8 border border-red-200 shadow-xs space-y-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-red-100 rounded-2xl text-red-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-950">Data Reset & Fresh Start</h3>
            <p className="text-sm text-red-800 mt-1">
              Clear all sales records, payment transactions (Cash, M-Pesa, Card), and cashier daily shift closings.
              Use this when launching live, resetting test data, or starting fresh with 0.00 sales.
            </p>
            <p className="text-xs text-red-700 mt-2 font-medium">
              Note: All catalog products, inventory stock counts, prices, and staff user logins are safely preserved.
            </p>
          </div>
        </div>

        {clearSuccess && (
          <div className="flex items-center space-x-3 rounded-2xl bg-emerald-100 p-4 text-sm text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700" />
            <span>{clearSuccess}</span>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setConfirmText('');
              setShowClearModal(true);
            }}
            className="flex items-center space-x-2 rounded-2xl bg-red-600 hover:bg-red-700 px-6 py-3 text-sm font-bold text-white shadow-md shadow-red-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Clear All Payment Records</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Clear All Payment Records?</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              This action will permanently delete all sales transactions, payment histories, and cashier daily shift closings across both cloud Firestore and local storage.
            </p>

            <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">What will be preserved:</p>
              <p>• All 70 catalog products, categories & prices</p>
              <p>• Current stock inventory levels</p>
              <p>• Staff and cashier logins</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Type <span className="font-bold text-red-600">CLEAR</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type CLEAR"
                className="w-full rounded-xl border border-gray-300 p-3 text-sm font-mono uppercase focus:border-red-600 focus:outline-none"
              />
            </div>

            <div className="flex space-x-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setClearing(true);
                  setError('');
                  setClearSuccess('');
                  try {
                    const res = await clearAllPaymentRecords(user);
                    setShowClearModal(false);
                    setConfirmText('');
                    setClearSuccess(`Successfully cleared all payment records (${res.deletedSales} sales, ${res.deletedClosings} closings deleted).`);
                    setTimeout(() => {
                      window.location.reload();
                    }, 1400);
                  } catch (err: any) {
                    setError(err.message || 'Failed to clear payment records');
                  } finally {
                    setClearing(false);
                  }
                }}
                disabled={confirmText !== 'CLEAR' || clearing}
                className="flex items-center space-x-2 rounded-xl bg-red-600 hover:bg-red-700 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>{clearing ? 'Clearing...' : 'Permanently Clear'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
