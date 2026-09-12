import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, BusinessConfig, Product, SaleItem, Sale, PaymentMethod } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { formatCurrency, logAuditAction } from '../../lib/utils';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Smartphone,
  CircleDollarSign,
  ArrowLeft,
  X,
  Barcode,
  Camera,
  ScanLine,
  Zap,
  Check,
  RotateCcw
} from 'lucide-react';
import { ReceiptModal } from '../common/ReceiptModal';
import { CameraBarcodeScanner } from '../common/CameraBarcodeScanner';
import { UnknownBarcodeModal } from '../common/UnknownBarcodeModal';
import { posAudio } from '../../lib/barcodeUtils';
import {
  saveSaleLocallyAndQueue,
  cacheLocalProducts,
  getLocalCachedProducts,
  cacheLocalCategories,
  getLocalCachedCategories,
  syncOfflineQueue
} from '../../lib/offlineManager';

interface RecordSaleViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  onNavigateToProducts?: (prefillBarcode?: string) => void;
}

export function RecordSaleView({ user, businessConfig, onNavigateToProducts }: RecordSaleViewProps) {
  const tenantId = user.businessId || DEFAULT_BUSINESS_ID;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  
  // Barcode scanner states
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showUnknownBarcodeModal, setShowUnknownBarcodeModal] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; text: string; sub?: string } | null>(null);
  const scannerBufferRef = useRef<{ buffer: string; lastTime: number }>({ buffer: '', lastTime: 0 });

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [isCustomTendered, setIsCustomTendered] = useState<boolean>(false);
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [mobileView, setMobileView] = useState<'catalog' | 'payment'>('catalog');
  
  // Custom item modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successSale, setSuccessSale] = useState<Sale | null>(null);

  useEffect(() => {
    fetchProductsAndCategories();
  }, []);

  // Autofocus barcode input on mount and recover focus when clicking blank POS areas
  useEffect(() => {
    barcodeInputRef.current?.focus();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName);
      if (!isInteractive) {
        barcodeInputRef.current?.focus();
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Global hardware scanner listener: captures rapid keystroke bursts from USB / Bluetooth scanners
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      // Do not intercept if user is purposefully typing in another form field
      const isOtherInput = activeEl && activeEl !== barcodeInputRef.current && (
        activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT'
      );
      if (isOtherInput) return;

      const now = Date.now();
      const timeDiff = now - scannerBufferRef.current.lastTime;
      scannerBufferRef.current.lastTime = now;

      if (e.key === 'Enter') {
        if (scannerBufferRef.current.buffer.length >= 3) {
          e.preventDefault();
          const code = scannerBufferRef.current.buffer;
          scannerBufferRef.current.buffer = '';
          processBarcode(code);
        }
        return;
      }

      if (e.key.length === 1) {
        // Hardware scanners burst keystrokes < 50ms apart
        if (timeDiff < 60 || scannerBufferRef.current.buffer.length === 0) {
          scannerBufferRef.current.buffer += e.key;
        } else {
          scannerBufferRef.current.buffer = e.key;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [products, cart, businessConfig]);

  async function fetchProductsAndCategories() {
    // 1. Instant load from offline cache scoped to tenant
    const cachedProds = getLocalCachedProducts(tenantId);
    if (cachedProds.length > 0) {
      setProducts(cachedProds);
    }
    const cachedCats = getLocalCachedCategories();
    if (cachedCats.length > 0) {
      setCategories(cachedCats);
    }

    // 2. Only fetch fresh from Firestore if actively online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    try {
      const prodRef = collection(db, 'businesses', tenantId, 'products');
      const prodSnap = await getDocs(prodRef);
      const prods: Product[] = [];
      prodSnap.forEach(d => {
        prods.push({ id: d.id, ...d.data() } as Product);
      });
      if (prods.length > 0) {
        setProducts(prods);
        cacheLocalProducts(prods, tenantId);
      }

      const catRef = collection(db, 'businesses', tenantId, 'categories');
      const catSnap = await getDocs(catRef);
      const cats: { id: string; name: string }[] = [];
      catSnap.forEach(d => {
        cats.push({ id: d.id, name: d.data().name });
      });
      if (cats.length > 0) {
        setCategories(cats);
        cacheLocalCategories(cats);
      }
    } catch (err) {
      console.warn("Using local cached catalog:", err);
    }
  }

  const addToCart = (product: Product, delta: number = 1): boolean => {
    setError('');
    const existingIndex = cart.findIndex(item => item.productId === product.id);
    const currentQtyInCart = existingIndex >= 0 ? cart[existingIndex].quantity : 0;
    const requestedQty = currentQtyInCart + delta;

    // Check available stock
    const allowNegative = businessConfig?.allowNegativeStock ?? false;
    if (delta > 0 && !allowNegative) {
      if (product.currentStock !== undefined && requestedQty > product.currentStock) {
        const msg = `Insufficient Stock: Only ${product.currentStock} ${product.unitType || 'unit'}(s) available for "${product.name}". Cannot add more.`;
        setError(msg);
        posAudio.playError();
        return false;
      }
    }

    if (requestedQty <= 0) {
      if (existingIndex >= 0) {
        const newCart = [...cart];
        newCart.splice(existingIndex, 1);
        setCart(newCart);
      }
      return true;
    }

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity = requestedQty;
      newCart[existingIndex].totalAmount = requestedQty * product.sellingPrice;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity: 1,
          unitPrice: product.sellingPrice,
          totalAmount: product.sellingPrice
        }
      ]);
    }
    return true;
  };

  /**
   * Core barcode scanner processor:
   * Handles USB / Bluetooth / Camera / Manual barcode entries.
   */
  const processBarcode = (rawBarcode: string) => {
    const clean = String(rawBarcode ?? '').trim();
    if (!clean) return;

    // Reset input immediately for rapid successive scans
    setBarcodeInput('');
    if (barcodeInputRef.current) {
      barcodeInputRef.current.value = '';
      barcodeInputRef.current.focus();
    }

    // Search current tenant's products: match barcode first, or match exact ID
    let found = products.find(p =>
      p.barcode != null && String(p.barcode).trim().toLowerCase() === clean.toLowerCase()
    );

    if (!found) {
      found = products.find(p => p.id.toLowerCase() === clean.toLowerCase());
    }

    if (found) {
      // Stock check
      const inCart = cart.find(item => item.productId === found!.id);
      const currentInCart = inCart?.quantity || 0;
      const allowNegative = businessConfig?.allowNegativeStock ?? false;

      if (!allowNegative && (found.currentStock <= 0 || (found.currentStock - currentInCart <= 0))) {
        posAudio.playError();
        const msg = `Out of Stock: "${found.name}" has 0 units available. Negative stock sales are disabled in Settings.`;
        setError(msg);
        setScanFeedback({
          type: 'error',
          text: `Out of Stock: ${found.name}`,
          sub: '0 units remaining — cannot sell'
        });
        setTimeout(() => setScanFeedback(null), 4000);
        return;
      }

      // Add to cart / increment quantity
      const added = addToCart(found, 1);
      if (added) {
        posAudio.playSuccess();
        const newQty = currentInCart + 1;
        setScanFeedback({
          type: 'success',
          text: `Added: ${found.name} (+1)`,
          sub: `Price: ${formatCurrency(found.sellingPrice, currency)} | Cart Qty: ${newQty}`
        });
        setTimeout(() => setScanFeedback(null), 3500);
      }
    } else {
      // Barcode not found
      posAudio.playError();
      setUnknownBarcode(clean);
      setShowUnknownBarcodeModal(true);
      setScanFeedback({
        type: 'error',
        text: `Barcode Not Found: "${clean}"`,
        sub: 'Product not in current business catalog'
      });
      setTimeout(() => setScanFeedback(null), 4500);
    }
  };

  const updateCartQty = (productId: string, newQty: number) => {
    setError('');
    if (newQty <= 0) {
      setCart(cart.filter(item => item.productId !== productId));
      return;
    }

    setCart(cart.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          quantity: newQty,
          totalAmount: newQty * item.unitPrice
        };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(customPrice);
    if (!customName.trim() || isNaN(price) || price <= 0) {
      setError('Please provide a valid item name and price.');
      return;
    }

    const qty = customQty > 0 ? customQty : 1;
    const customItem: SaleItem = {
      productId: 'custom-' + Date.now(),
      productName: customName.trim(),
      quantity: qty,
      unitPrice: price,
      totalAmount: qty * price
    };

    setCart([...cart, customItem]);
    setShowCustomModal(false);
    setCustomName('');
    setCustomPrice('');
    setCustomQty(1);
    setError('');
  };

  const totalCartAmount = cart.reduce((sum, item) => sum + item.totalAmount, 0);

  // Keep amountTendered synchronized with totalCartAmount for Cash
  useEffect(() => {
    if (paymentMethod === 'Cash') {
      const currentTendered = parseFloat(amountTendered) || 0;
      // If the user hasn't explicitly entered a higher custom cash amount (or if current tendered is less than the total bill),
      // keep it exactly equal to the total bill so it never lags behind (e.g. sticking at 300 when total is 1500).
      if (!isCustomTendered || currentTendered < totalCartAmount || !amountTendered || amountTendered === '0') {
        if (totalCartAmount > 0) {
          setAmountTendered(totalCartAmount.toString());
        } else {
          setAmountTendered('');
        }
        setIsCustomTendered(false);
      }
    }
  }, [totalCartAmount, paymentMethod]);

  const handleRecordSale = () => {
    if (cart.length === 0) {
      setError('Cart is empty. Please select products to record sale.');
      return;
    }

    // Cash validation: prevent underpayment / recording less than customer is supposed to pay
    if (paymentMethod === 'Cash') {
      const tenderedNum = amountTendered ? parseFloat(amountTendered) : totalCartAmount;
      if (isNaN(tenderedNum) || tenderedNum < totalCartAmount) {
        setError(`Cannot record sale: Amount received (${formatCurrency(isNaN(tenderedNum) ? 0 : tenderedNum, currency)}) is less than total bill (${formatCurrency(totalCartAmount, currency)}). Customer is supposed to pay ${formatCurrency(totalCartAmount, currency)}.`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const saleId = 'sale-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const parsedTendered = paymentMethod === 'Cash' && amountTendered ? parseFloat(amountTendered) : totalCartAmount;
      const changeDue = Math.max(0, parsedTendered - totalCartAmount);

      const completedSale: Sale = {
        id: saleId,
        businessId: tenantId,
        items: [...cart],
        totalAmount: totalCartAmount,
        paymentMethod,
        amountTendered: parsedTendered,
        change: changeDue,
        referenceCode: referenceCode.trim() || undefined,
        cashierId: user.uid,
        cashierName: user.name,
        businessDayId: todayStr,
        date: todayStr,
        time: now.toTimeString().split(' ')[0],
        createdAt: now.getTime()
      };

      // 1. Instantly persist locally & queue for sync (ensures 100% offline-first reliability)
      saveSaleLocallyAndQueue(completedSale, tenantId);

      // 2. Immediately update in-memory products state with deducted stock so UI reflects sold units
      const updatedLocalProds = getLocalCachedProducts(tenantId);
      if (updatedLocalProds.length > 0) {
        setProducts(updatedLocalProds);
      }

      // 3. Immediately display receipt modal & reset cart - zero delay for customer!
      setSuccessSale(completedSale);
      setCart([]);
      setAmountTendered('');
      setIsCustomTendered(false);
      setReferenceCode('');
      setMobileView('catalog');

      // 4. Background non-blocking audit log & Firestore sync if online
      logAuditAction(
        user.uid,
        user.name,
        'SALE_RECORDED',
        `Recorded sale of ${formatCurrency(totalCartAmount, currency)} via ${paymentMethod} (${cart.length} items)`,
        saleId
      ).catch(() => {});

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        syncOfflineQueue(tenantId).catch((syncErr) => {
          console.warn('Background sync deferred:', syncErr);
        });
      }
    } catch (err: any) {
      console.error("Sale recording failed:", err);
      setError(err.message || 'Failed to complete transaction.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.categoryName.toLowerCase().includes(q) ||
      (p.barcode != null && String(p.barcode).toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const currency = businessConfig?.currency || 'KSh';
  const cartItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const parsedTendered = amountTendered ? (parseFloat(amountTendered) || 0) : totalCartAmount;
  const changeDue = Math.max(0, parsedTendered - totalCartAmount);
  const isUnderpaid = paymentMethod === 'Cash' && totalCartAmount > 0 && parsedTendered < totalCartAmount;
  const shortfall = Math.max(0, totalCartAmount - parsedTendered);

  // Dynamic smart cash note presets based on total bill (avoids confusing notes smaller than bill)
  const getSmartCashPresets = () => {
    if (totalCartAmount <= 0) return [500, 1000, 2000];
    const presets: number[] = [];
    const denominations = [500, 1000, 1500, 2000, 3000, 4000, 5000, 10000];
    for (const d of denominations) {
      if (d > totalCartAmount && !presets.includes(d)) {
        presets.push(d);
        if (presets.length >= 3) break;
      }
    }
    if (presets.length === 0) {
      const nextRound = Math.ceil((totalCartAmount + 1) / 1000) * 1000;
      presets.push(nextRound, nextRound + 1000);
    }
    return presets;
  };

  return (
    <div className="space-y-4 pb-28 lg:pb-6">
      {/* ================= PROMINENT BARCODE SCANNER TOP BAR ================= */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-3 sm:p-4 text-white shadow-lg border border-slate-700">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Left: Hardware Scanner Status */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Barcode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white tracking-wide">Barcode Scanner</span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>USB / BT Ready</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Auto-focused • Supports laser scanners, keyboard & camera
              </p>
            </div>
          </div>

          {/* Center: Prominent Barcode Search & Scan Input */}
          <div className="flex-1 max-w-2xl relative">
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400">
                <ScanLine className="w-5 h-5 animate-pulse" />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    processBarcode(barcodeInput);
                  }
                }}
                placeholder="Scan barcode with handheld scanner or type barcode/SKU & hit Enter..."
                className="w-full rounded-xl bg-slate-950/90 border-2 border-amber-500/80 focus:border-amber-400 py-2.5 sm:py-3 pl-11 pr-24 text-sm font-mono text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all shadow-inner"
              />
              <div className="absolute right-1.5 flex items-center space-x-1">
                {barcodeInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeInput('');
                      barcodeInputRef.current?.focus();
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 text-xs"
                    title="Clear input"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => processBarcode(barcodeInput)}
                  disabled={!barcodeInput.trim()}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-lg transition-all shadow-sm"
                >
                  Scan
                </button>
              </div>
            </div>
          </div>

          {/* Right: Camera Scanner Trigger */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-sm"
              title="Open camera to scan barcode"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>Camera Scan</span>
            </button>
          </div>

        </div>

        {/* Real-time Scan Feedback Toast */}
        {scanFeedback && (
          <div
            className={`mt-3 p-2.5 rounded-xl flex items-center justify-between transition-all ${
              scanFeedback.type === 'success'
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-200'
                : 'bg-red-500/20 border border-red-500/50 text-red-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {scanFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <div className="text-xs">
                <span className="font-bold">{scanFeedback.text}</span>
                {scanFeedback.sub && <span className="ml-2 opacity-80 font-normal">({scanFeedback.sub})</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScanFeedback(null)}
              className="text-slate-400 hover:text-white p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile Top Segment Switcher (Catalog vs Cart & Payment) */}
      <div className="lg:hidden flex rounded-2xl bg-slate-900 p-1.5 shadow-md sticky top-16 z-30">
        <button
          onClick={() => setMobileView('catalog')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition-all ${
            mobileView === 'catalog'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span>📋 Catalog ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileView('payment')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all ${
            mobileView === 'payment'
              ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
              : 'text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30'
          }`}
        >
          <CreditCard className="w-4 h-4 text-amber-300 shrink-0" />
          <span>Payment & Cart</span>
          <span className="ml-1 bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
            {cartItemCount} | {formatCurrency(totalCartAmount, currency)}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Catalog & Search (Visible on desktop or when mobileView === 'catalog') */}
        <div className={`lg:col-span-7 space-y-4 ${mobileView === 'payment' ? 'hidden lg:block' : 'block'}`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drinks or cigarettes..."
                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 shadow-xs"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none items-center">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Items
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              <button
                onClick={() => setShowCustomModal(true)}
                className="px-3 py-2.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 whitespace-nowrap transition-all flex items-center space-x-1"
                title="Add custom item not in catalog"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Custom</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center space-x-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
            {filteredProducts.map(product => {
              const inCart = cart.find(i => i.productId === product.id);
              const isOutOfStock = product.currentStock <= 0;

              return (
                <div
                  key={product.id}
                  className={`rounded-2xl border p-4 bg-white shadow-xs flex flex-col justify-between transition-all ${
                    isOutOfStock ? 'border-amber-200/80 bg-amber-50/10' : 'border-gray-200 hover:border-amber-500 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-1 mb-1">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                            {product.categoryName}
                          </span>
                          {product.barcode && (
                            <span className="inline-flex items-center space-x-0.5 font-mono text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              <Barcode className="w-2.5 h-2.5 inline" />
                              <span>{product.barcode}</span>
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-900 text-base">{product.name}</h4>
                      </div>
                      <span className="text-sm font-extrabold text-amber-700">
                        {formatCurrency(product.sellingPrice, currency)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className={`font-semibold ${isOutOfStock ? 'text-amber-700' : product.currentStock <= product.minStockLevel ? 'text-amber-600' : 'text-emerald-600'}`}>
                        Available: {product.currentStock} {product.unitType}s
                        {isOutOfStock && <span className="ml-1 text-[10px] text-amber-600 font-normal">(Tap to sell)</span>}
                      </span>
                      {inCart && (
                        <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                          In Cart: {inCart.quantity}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => addToCart(product, -1)}
                        disabled={!inCart}
                        className="w-9 h-9 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 disabled:opacity-30 active:scale-95 transition-all font-bold"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold text-sm text-gray-900">
                        {inCart ? inCart.quantity : 0}
                      </span>
                      <button
                        onClick={() => addToCart(product, 1)}
                        className="w-9 h-9 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-95 transition-all font-bold"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => addToCart(product, 1)}
                      className="rounded-xl bg-slate-900 hover:bg-amber-600 text-white px-4 py-2 text-xs font-bold shadow-xs active:scale-95 transition-all"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Cart AND Prominent "WHERE TO PUT PAYMENT" (Visible on desktop or when mobileView === 'payment') */}
        <div className={`lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 shadow-md border border-gray-200 flex flex-col justify-between space-y-4 ${mobileView === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                {mobileView === 'payment' && (
                  <button
                    onClick={() => setMobileView('catalog')}
                    className="lg:hidden p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all flex items-center"
                    title="Back to Catalog"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="text-xs font-bold">Catalog</span>
                  </button>
                )}
                <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-amber-600" />
                  <span>Current Cart</span>
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCustomModal(true)}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-xl border border-amber-200 transition-all flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Custom Item</span>
                </button>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                  {cartItemCount} items
                </span>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="my-3 max-h-52 overflow-y-auto space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30 text-gray-400" />
                  <p className="text-xs font-bold text-gray-600">Cart is empty</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Select drinks from the catalog or add a custom item</p>
                  <button
                    onClick={() => setMobileView('catalog')}
                    className="lg:hidden mt-2 text-xs font-bold text-amber-600 underline"
                  >
                    Open Drinks Catalog
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="flex-1 pr-2">
                      <div className="flex items-center space-x-1.5">
                        <h5 className="font-semibold text-gray-900 text-xs sm:text-sm">{item.productName}</h5>
                        {item.barcode && (
                          <span className="font-mono text-[9px] text-gray-500 bg-gray-200/80 px-1.5 py-0.5 rounded border border-gray-300">
                            #{item.barcode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500">{formatCurrency(item.unitPrice, currency)} each</p>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <div className="flex items-center space-x-1 border border-gray-300 rounded-lg bg-white px-1 py-0.5">
                        <button
                          onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                          className="p-1 text-gray-600 hover:text-red-600"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateCartQty(item.productId, parseInt(e.target.value) || 0)}
                          className="w-8 text-center font-bold text-xs focus:outline-none"
                        />
                        <button
                          onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                          className="p-1 text-gray-600 hover:text-emerald-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-extrabold text-xs sm:text-sm text-gray-900 w-16 text-right">
                        {formatCurrency(item.totalAmount, currency)}
                      </span>

                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ================= PAYMENT SECTION (WHERE TO PUT PAYMENT) ================= */}
          <div className="border-t-2 border-amber-300 bg-slate-900 text-white -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:p-5 rounded-b-3xl space-y-4 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Where to Put Payment
                  </h4>
                  <p className="text-[11px] text-slate-400">Select payment method & enter amount</p>
                </div>
              </div>
              <span className="text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                Step 2
              </span>
            </div>

            {/* Total Bill Card */}
            <div className="bg-slate-800 border border-slate-700 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Bill to Collect</p>
                <p className="text-2xl font-black text-amber-400">{formatCurrency(totalCartAmount, currency)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-300">{cartItemCount} item{cartItemCount === 1 ? '' : 's'}</p>
                <p className="text-[10px] text-emerald-400 font-semibold">Ready for Tender</p>
              </div>
            </div>

            {/* Error Banner inside Payment Section (Always visible on mobile & desktop) */}
            {error && (
              <div className="flex items-start space-x-3 rounded-2xl bg-red-950/95 border-2 border-red-500 p-3.5 text-sm text-white shadow-lg">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-red-300 uppercase tracking-wide text-xs">Payment Alert</p>
                  <p className="text-xs text-red-100">{error}</p>
                </div>
              </div>
            )}

            {/* 1. Payment Method Buttons */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                1. Select Payment Method:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'Cash', label: 'Cash', icon: Banknote },
                  { id: 'M-Pesa', label: 'M-Pesa', icon: Smartphone },
                  { id: 'Card', label: 'Card', icon: CreditCard },
                  { id: 'Other', label: 'Other', icon: CircleDollarSign }
                ].map(m => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id as PaymentMethod);
                        if (m.id === 'Cash') {
                          const currentTendered = parseFloat(amountTendered) || 0;
                          if (!isCustomTendered || currentTendered < totalCartAmount) {
                            setAmountTendered(totalCartAmount > 0 ? totalCartAmount.toString() : '');
                            setIsCustomTendered(false);
                          }
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/40 scale-102'
                          : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-0.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Amount Tendered / Reference Input (WHERE TO PUT PAYMENT) */}
            {paymentMethod === 'Cash' && (
              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-2xl space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-amber-300 flex items-center space-x-1">
                      <span>2. Cash Received from Customer:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAmountTendered(totalCartAmount > 0 ? totalCartAmount.toString() : '');
                        setIsCustomTendered(false);
                        setError('');
                      }}
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      Set Exact Bill ({formatCurrency(totalCartAmount, currency)})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-amber-400 text-sm">
                      {currency}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={amountTendered}
                      onChange={(e) => {
                        setAmountTendered(e.target.value);
                        setIsCustomTendered(true);
                        setError('');
                      }}
                      placeholder={totalCartAmount > 0 ? totalCartAmount.toString() : '0.00'}
                      className="w-full pl-13 pr-14 py-2.5 rounded-xl border-2 border-amber-500 bg-slate-900 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    {amountTendered && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmountTendered('');
                          setIsCustomTendered(true);
                          setError('');
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Cash Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAmountTendered(totalCartAmount.toString());
                      setIsCustomTendered(false);
                      setError('');
                    }}
                    className={`text-[11px] font-black px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      parsedTendered === totalCartAmount && !isUnderpaid
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-400/40 font-black'
                        : 'bg-slate-700 hover:bg-slate-600 text-amber-300 border-slate-600'
                    }`}
                  >
                    Exact ({formatCurrency(totalCartAmount, currency)})
                  </button>
                  {getSmartCashPresets().map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setAmountTendered(val.toString());
                        setIsCustomTendered(true);
                        setError('');
                      }}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 cursor-pointer"
                    >
                      {formatCurrency(val, currency)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseFloat(amountTendered) || totalCartAmount;
                      setAmountTendered((current + 100).toString());
                      setIsCustomTendered(true);
                      setError('');
                    }}
                    className="text-[11px] font-bold px-2 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 cursor-pointer"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseFloat(amountTendered) || totalCartAmount;
                      setAmountTendered((current + 500).toString());
                      setIsCustomTendered(true);
                      setError('');
                    }}
                    className="text-[11px] font-bold px-2 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 cursor-pointer"
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseFloat(amountTendered) || totalCartAmount;
                      setAmountTendered((current + 1000).toString());
                      setIsCustomTendered(true);
                      setError('');
                    }}
                    className="text-[11px] font-bold px-2 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 cursor-pointer"
                  >
                    +1,000
                  </button>
                </div>

                {/* Underpayment Warning Banner */}
                {isUnderpaid && (
                  <div className="p-3 rounded-2xl bg-red-950/90 border-2 border-red-500 text-white space-y-2.5">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-black uppercase tracking-wide text-red-300 text-xs">
                          Cannot Record Underpayment: Short by {formatCurrency(shortfall, currency)}
                        </p>
                        <p className="text-xs text-red-100">
                          Customer owes <strong className="text-white font-bold">{formatCurrency(totalCartAmount, currency)}</strong>, but cash received entered is only <strong className="text-amber-300 font-bold">{formatCurrency(parsedTendered, currency)}</strong>.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAmountTendered(totalCartAmount.toString());
                        setIsCustomTendered(false);
                        setError('');
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wide shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-slate-950" />
                      <span>Record Correct Full Bill ({formatCurrency(totalCartAmount, currency)})</span>
                    </button>
                  </div>
                )}

                {/* Exact Payment Confirmation */}
                {!isUnderpaid && parsedTendered === totalCartAmount && totalCartAmount > 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-300">Exact Payment (Full Bill)</span>
                    </div>
                    <span className="text-sm font-black text-emerald-400">
                      {formatCurrency(totalCartAmount, currency)} • No Change Needed
                    </span>
                  </div>
                )}

                {/* Overpayment Change Due */}
                {!isUnderpaid && parsedTendered > totalCartAmount && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide block">
                        Change to Return to Customer:
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Received {formatCurrency(parsedTendered, currency)} - Bill {formatCurrency(totalCartAmount, currency)}
                      </span>
                    </div>
                    <span className="text-xl font-black text-emerald-400">
                      {formatCurrency(changeDue, currency)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'M-Pesa' && (
              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-amber-300">
                  2. Enter M-Pesa Confirmation Code or Customer Phone:
                </label>
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="e.g. QBC91823 or 0712345678"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-emerald-500 bg-slate-900 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <p className="text-[10px] text-slate-400">
                  Customer confirms M-Pesa payment to your till/paybill.
                </p>
              </div>
            )}

            {(paymentMethod === 'Card' || paymentMethod === 'Other') && (
              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-amber-300">
                  2. Reference / Slip Code (Optional):
                </label>
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="e.g. POS Slip Approval #4892"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Complete Payment Button */}
            <button
              onClick={handleRecordSale}
              disabled={loading || cart.length === 0 || isUnderpaid}
              className={`w-full rounded-2xl py-3.5 text-sm sm:text-base font-black shadow-xl transition-all uppercase tracking-wide flex items-center justify-center space-x-2 ${
                isUnderpaid
                  ? 'bg-red-950 text-red-300 border-2 border-red-500/60 cursor-not-allowed opacity-90'
                  : 'bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 shadow-amber-500/20 cursor-pointer'
              } disabled:opacity-50`}
            >
              {isUnderpaid ? (
                <>
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span>CANNOT RECORD: SHORT BY {formatCurrency(shortfall, currency)}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-slate-950" />
                  <span>
                    {loading
                      ? 'Recording Transaction...'
                      : parsedTendered > totalCartAmount
                      ? `RECORD FULL SALE (${formatCurrency(totalCartAmount, currency)} • CHANGE: ${formatCurrency(changeDue, currency)})`
                      : `RECORD FULL PAYMENT (${formatCurrency(totalCartAmount, currency)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Sticky Bar for Mobile (Always visible on mobile to jump directly to Payment) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-3 px-4 flex items-center justify-between shadow-2xl">
        <div>
          <p className="text-[11px] text-slate-400 font-medium">
            {cartItemCount} item{cartItemCount === 1 ? '' : 's'} in cart
          </p>
          <p className="text-lg font-black text-amber-400">
            {formatCurrency(totalCartAmount, currency)}
          </p>
        </div>
        <button
          onClick={() => setMobileView(mobileView === 'catalog' ? 'payment' : 'catalog')}
          className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black px-4 py-2.5 rounded-xl shadow-lg transition-all text-xs sm:text-sm uppercase tracking-wide"
        >
          <CreditCard className="w-4 h-4" />
          <span>{mobileView === 'catalog' ? 'PUT PAYMENT ➔' : 'BACK TO CATALOG'}</span>
        </button>
      </div>

      {/* Custom Item Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-base font-bold text-gray-900">Add Custom Drink / Item</h4>
              <button
                onClick={() => setShowCustomModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomItem} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Item Description</label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Cocktail, Special Shot, Snack"
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Price ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="250"
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={customQty}
                    onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 py-3 text-xs font-bold text-white shadow-md transition-all uppercase"
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-3 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {successSale && (
        <ReceiptModal
          sale={successSale}
          businessConfig={businessConfig}
          onClose={() => setSuccessSale(null)}
        />
      )}

      {/* Camera Barcode Scanner Modal */}
      {showCameraScanner && (
        <CameraBarcodeScanner
          onScanSuccess={(scannedCode) => {
            setShowCameraScanner(false);
            processBarcode(scannedCode);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {/* Unknown Barcode Alert Modal */}
      {showUnknownBarcodeModal && (
        <UnknownBarcodeModal
          barcode={unknownBarcode}
          onClose={() => setShowUnknownBarcodeModal(false)}
          onAddNewProduct={onNavigateToProducts ? () => {
            setShowUnknownBarcodeModal(false);
            onNavigateToProducts(unknownBarcode);
          } : undefined}
        />
      )}
    </div>
  );
}
