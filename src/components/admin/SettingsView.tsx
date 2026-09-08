import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { logAuditAction } from '../../lib/utils';
import { Settings, Save, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';

interface SettingsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  onConfigUpdated: (newConfig: BusinessConfig) => void;
}

export function SettingsView({ user, businessConfig, onConfigUpdated }: SettingsViewProps) {
  const [formData, setFormData] = useState<BusinessConfig>({
    id: DEFAULT_BUSINESS_ID,
    name: 'Savanna Lounge & Pub',
    phone: '+254 712 345 678',
    location: 'Nairobi CBD',
    address: 'Tom Mboya Street, Nairobi',
    currency: 'KSh',
    openingTime: '10:00',
    closingTime: '23:59',
    lowStockThreshold: 10,
    receiptHeader: 'SAVANNA LOUNGE & PUB',
    receiptFooter: 'Thank you! Please drink responsibly.'
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
            className="flex items-center space-x-2 rounded-2xl bg-amber-600 hover:bg-amber-700 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
