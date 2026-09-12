import React, { useState, useEffect, useRef } from 'react';
import {
  Tag,
  Plus,
  Search,
  X,
  Barcode as BarcodeIcon,
  Check,
  Sparkles,
  Link2,
  Package,
  ArrowRight,
  Layers,
  Camera
} from 'lucide-react';
import { Product, UserProfile } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { posAudio } from '../../lib/barcodeUtils';

interface UnknownBarcodeModalProps {
  isOpen?: boolean;
  barcode: string;
  currency?: string;
  categories?: { id: string; name: string }[];
  allProducts?: Product[];
  wasCameraOpen?: boolean;
  onClose: () => void;
  onSaveAndAddToCart: (params: {
    name: string;
    barcode: string;
    sellingPrice: number;
    buyingPrice?: number;
    categoryId: string;
    categoryName: string;
    unitType: Product['unitType'];
    openingStock: number;
    quantity: number;
    reopenCamera?: boolean;
  }) => Promise<void> | void;
  onQuickAddToCart: (params: {
    name: string;
    barcode: string;
    price: number;
    quantity: number;
    reopenCamera?: boolean;
  }) => void;
  onLinkToExistingProduct?: (
    product: Product,
    updatedPrice?: number,
    quantity?: number,
    reopenCamera?: boolean
  ) => Promise<void> | void;
  onNavigateToProducts?: (barcode: string) => void;
}

export const UnknownBarcodeModal: React.FC<UnknownBarcodeModalProps> = ({
  isOpen = true,
  barcode,
  currency = 'KSh',
  categories = [],
  allProducts = [],
  wasCameraOpen = false,
  onClose,
  onSaveAndAddToCart,
  onQuickAddToCart,
  onLinkToExistingProduct,
  onNavigateToProducts
}) => {
  const [activeTab, setActiveTab] = useState<'save_inventory' | 'quick_sale' | 'link_existing'>('save_inventory');

  // Form states
  const [price, setPrice] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [categoryId, setCategoryId] = useState<string>('');
  const [unitType, setUnitType] = useState<Product['unitType']>('Bottle');
  const [openingStock, setOpeningStock] = useState<number>(50);
  const [buyingPrice, setBuyingPrice] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Link existing product states
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [selectedProductToLink, setSelectedProductToLink] = useState<Product | null>(null);

  const priceInputRef = useRef<HTMLInputElement>(null);

  // Initialize defaults on mount or barcode change
  useEffect(() => {
    if (barcode) {
      // Suggest clean initial name
      const shortCode = barcode.length > 6 ? barcode.slice(-6) : barcode;
      setName(`Scanned Item #${shortCode}`);
      setPrice('');
      setQuantity(1);
      setFormError(null);
      setLinkSearchQuery('');
      setSelectedProductToLink(null);

      if (categories.length > 0) {
        setCategoryId(categories[0].id);
      }

      // Auto-focus price input immediately after render
      const timer = setTimeout(() => {
        priceInputRef.current?.focus();
        priceInputRef.current?.select();
      }, 80);

      return () => clearTimeout(timer);
    }
  }, [barcode, categories]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  // Preset quick-price increments / common retail amounts
  const quickPricePresets = [100, 150, 200, 250, 300, 400, 500, 1000];

  const handleApplyPresetPrice = (val: number) => {
    setPrice(val.toString());
    setFormError(null);
    priceInputRef.current?.focus();
  };

  const handleAddPriceDelta = (delta: number) => {
    const current = parseFloat(price) || 0;
    const next = Math.max(0, current + delta);
    setPrice(next.toString());
    setFormError(null);
    priceInputRef.current?.focus();
  };

  // Submit Save & Add to Cart
  const handleSubmitSaveAndAdd = async (e?: React.FormEvent, reopenCamera = false) => {
    if (e) e.preventDefault();
    const numPrice = parseFloat(price);

    if (isNaN(numPrice) || numPrice <= 0) {
      setFormError(`Please enter a valid selling price greater than 0 ${currency}.`);
      priceInputRef.current?.focus();
      return;
    }

    const trimmedName = name.trim() || `Item #${barcode.slice(-6)}`;
    const selectedCategory = categories.find((c) => c.id === categoryId);
    const catName = selectedCategory ? selectedCategory.name : 'General';
    const numBuyingPrice = buyingPrice ? parseFloat(buyingPrice) : Math.round(numPrice * 0.7);

    setIsSubmitting(true);
    setFormError(null);

    try {
      await onSaveAndAddToCart({
        name: trimmedName,
        barcode: barcode.trim(),
        sellingPrice: numPrice,
        buyingPrice: numBuyingPrice,
        categoryId: categoryId || 'cat-general',
        categoryName: catName,
        unitType,
        openingStock: openingStock > 0 ? openingStock : 50,
        quantity: quantity > 0 ? quantity : 1,
        reopenCamera
      });
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product and add to cart.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Quick Add (One-time item)
  const handleSubmitQuickAdd = (reopenCamera = false) => {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setFormError(`Please enter a valid price greater than 0 ${currency}.`);
      priceInputRef.current?.focus();
      return;
    }

    const trimmedName = name.trim() || `Scanned Item #${barcode.slice(-6)}`;
    onQuickAddToCart({
      name: trimmedName,
      barcode: barcode.trim(),
      price: numPrice,
      quantity: quantity > 0 ? quantity : 1,
      reopenCamera
    });
  };

  // Submit Link to Existing Product
  const handleSubmitLink = async (reopenCamera = false) => {
    if (!selectedProductToLink || !onLinkToExistingProduct) return;
    const numPrice = price ? parseFloat(price) : selectedProductToLink.sellingPrice;

    setIsSubmitting(true);
    setFormError(null);

    try {
      await onLinkToExistingProduct(selectedProductToLink, numPrice, quantity, reopenCamera);
    } catch (err: any) {
      setFormError(err.message || 'Failed to link barcode to existing product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter products for linking
  const filteredExistingProducts = allProducts
    .filter((p) => {
      if (!linkSearchQuery.trim()) return true;
      const q = linkSearchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.categoryName?.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    })
    .slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl p-5 sm:p-6 text-white space-y-5 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white">Product Not in Inventory</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Set Price
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Scanned barcode is not recognized. Enter price to ring up this item.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanned Barcode Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-amber-400">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Scanned Barcode
              </span>
              <span className="text-base sm:text-lg font-mono font-black text-amber-400 tracking-wider">
                {barcode}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            Unregistered
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('save_inventory');
              setFormError(null);
            }}
            className={`py-2 px-2 rounded-xl transition-all text-center flex items-center justify-center space-x-1.5 ${
              activeTab === 'save_inventory'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Save to Inventory</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('quick_sale');
              setFormError(null);
            }}
            className={`py-2 px-2 rounded-xl transition-all text-center flex items-center justify-center space-x-1.5 ${
              activeTab === 'quick_sale'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Quick Sale Only</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('link_existing');
              setFormError(null);
            }}
            className={`py-2 px-2 rounded-xl transition-all text-center flex items-center justify-center space-x-1.5 ${
              activeTab === 'link_existing'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Link Existing</span>
          </button>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs font-medium">
            {formError}
          </div>
        )}

        {/* TAB 1: SAVE TO INVENTORY & ADD TO CART */}
        {activeTab === 'save_inventory' && (
          <form onSubmit={(e) => handleSubmitSaveAndAdd(e, false)} className="space-y-4">
            {/* PRICE INPUT (Primary) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1">
                  <span>Selling Price ({currency})</span>
                  <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-emerald-400 font-semibold">Press Enter to Add</span>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400 font-bold text-lg">
                  {currency}
                </div>
                <input
                  ref={priceInputRef}
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full pl-16 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xl font-bold font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
                />
              </div>

              {/* Quick Preset Chips */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Quick Amounts</span>
                  <div className="space-x-1">
                    <button
                      type="button"
                      onClick={() => handleAddPriceDelta(50)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      +50
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPriceDelta(100)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      +100
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPriceDelta(200)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      +200
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickPricePresets.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleApplyPresetPrice(val)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        price === val.toString()
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Product Name & Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Product Name / Description
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tusker Malt 500ml, Red Bull Can"
                  className="w-full px-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity</label>
                <div className="flex items-center border border-slate-700 rounded-xl bg-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3 py-2.5 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-white text-sm">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="px-3 py-2.5 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Category & Unit & Stock */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-2.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {categories.length === 0 && <option value="cat-general">General</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Type</label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value as Product['unitType'])}
                  className="w-full px-2.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Bottle">Bottle</option>
                  <option value="Can">Can</option>
                  <option value="Piece">Piece</option>
                  <option value="Glass">Glass</option>
                  <option value="Shot">Shot</option>
                  <option value="Packet">Packet</option>
                  <option value="Crate">Crate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Stock
                </label>
                <input
                  type="number"
                  min="1"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
              >
                <Check className="w-5 h-5" />
                <span>
                  {isSubmitting ? 'Saving Product...' : `Add to Cart & Save to Inventory (${currency} ${price || '0'})`}
                </span>
              </button>

              {wasCameraOpen && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={(e) => handleSubmitSaveAndAdd(e, true)}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs uppercase tracking-wider border border-emerald-500/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Save, Add to Cart & Resume Camera Scanner</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* TAB 2: QUICK ONE-TIME SALE ONLY */}
        {activeTab === 'quick_sale' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <p className="font-semibold">Quick One-Time Sale:</p>
              <p className="text-slate-400 mt-0.5">
                Rings up the item in the current sale with the scanned barcode without saving it permanently to your catalog.
              </p>
            </div>

            {/* PRICE INPUT */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1">
                <span>Selling Price ({currency})</span>
                <span className="text-rose-400">*</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400 font-bold text-lg">
                  {currency}
                </div>
                <input
                  ref={priceInputRef}
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full pl-16 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xl font-bold font-mono text-amber-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                />
              </div>

              {/* Quick Preset Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {quickPricePresets.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleApplyPresetPrice(val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      price === val.toString()
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Name and Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Item Description
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Scanned Product, Guest Item"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity</label>
                <div className="flex items-center border border-slate-700 rounded-xl bg-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3 py-2.5 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-white text-sm">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="px-3 py-2.5 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleSubmitQuickAdd(false)}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
              >
                <Tag className="w-5 h-5" />
                <span>Add to Cart ({currency} {price || '0'})</span>
              </button>

              {wasCameraOpen && (
                <button
                  type="button"
                  onClick={() => handleSubmitQuickAdd(true)}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs uppercase tracking-wider border border-amber-500/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Add to Cart & Resume Camera Scanner</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LINK TO EXISTING INVENTORY ITEM */}
        {activeTab === 'link_existing' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs">
              <p className="font-semibold">Link Barcode to Existing Item:</p>
              <p className="text-slate-400 mt-0.5">
                Assign this scanned barcode ({barcode}) to an existing product in your catalog that didn't have a barcode.
              </p>
            </div>

            {/* Product Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={linkSearchQuery}
                onChange={(e) => setLinkSearchQuery(e.target.value)}
                placeholder="Search catalog by name or category..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Product list */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {filteredExistingProducts.map((p) => {
                const isSelected = selectedProductToLink?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductToLink(p);
                      setPrice(p.sellingPrice.toString());
                      setName(p.name);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{p.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {p.categoryName} • Stock: {p.currentStock} {p.unitType || 'units'}
                        {p.barcode ? ` • Has Barcode: ${p.barcode}` : ' • No barcode'}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-emerald-400">
                        {formatCurrency(p.sellingPrice, currency)}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredExistingProducts.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No existing products match your search.
                </div>
              )}
            </div>

            {/* Selected Product Confirmation */}
            {selectedProductToLink && (
              <div className="p-3 rounded-xl bg-slate-950 border border-blue-500/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Selected Product:</span>
                  <span className="font-bold text-blue-400">{selectedProductToLink.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">New Selling Price (Optional edit):</span>
                  <div className="flex items-center space-x-1.5 w-32">
                    <span className="text-xs text-slate-400 font-mono">{currency}</span>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 text-right"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={!selectedProductToLink || isSubmitting}
                onClick={() => handleSubmitLink(false)}
                className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
              >
                <Link2 className="w-5 h-5" />
                <span>
                  {isSubmitting
                    ? 'Linking Barcode...'
                    : `Link Barcode & Add to Cart (${currency} ${price || selectedProductToLink?.sellingPrice || '0'})`}
                </span>
              </button>

              {wasCameraOpen && (
                <button
                  type="button"
                  disabled={!selectedProductToLink || isSubmitting}
                  onClick={() => handleSubmitLink(true)}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs uppercase tracking-wider border border-blue-500/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Link Barcode, Add to Cart & Resume Camera</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer / Full Catalog Navigation Fallback */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          {onNavigateToProducts ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToProducts(barcode);
              }}
              className="text-slate-400 hover:text-amber-400 flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <span>Open full Admin Product Form</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-[11px] text-slate-500">Press ESC to dismiss</span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white px-3 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
