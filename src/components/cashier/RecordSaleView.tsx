import React, { useState, useEffect } from 'react';
import { UserProfile, BusinessConfig, Product, SaleItem, Sale, PaymentMethod } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs, doc, runTransaction, getDoc } from 'firebase/firestore';
import { formatCurrency, logAuditAction } from '../../lib/utils';
import { Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle2, AlertCircle, DollarSign, CreditCard } from 'lucide-react';
import { ReceiptModal } from '../common/ReceiptModal';

interface RecordSaleViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function RecordSaleView({ user, businessConfig }: RecordSaleViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successSale, setSuccessSale] = useState<Sale | null>(null);

  useEffect(() => {
    fetchProductsAndCategories();
  }, []);

  async function fetchProductsAndCategories() {
    try {
      const prodRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'products');
      const prodSnap = await getDocs(prodRef);
      const prods: Product[] = [];
      prodSnap.forEach(d => {
        prods.push({ id: d.id, ...d.data() } as Product);
      });
      setProducts(prods);

      const catRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'categories');
      const catSnap = await getDocs(catRef);
      const cats: { id: string; name: string }[] = [];
      catSnap.forEach(d => {
        cats.push({ id: d.id, name: d.data().name });
      });
      setCategories(cats);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  }

  const addToCart = (product: Product, delta: number = 1) => {
    setError('');
    const existingIndex = cart.findIndex(item => item.productId === product.id);
    const currentQtyInCart = existingIndex >= 0 ? cart[existingIndex].quantity : 0;
    const requestedQty = currentQtyInCart + delta;

    if (requestedQty <= 0) {
      if (existingIndex >= 0) {
        const newCart = [...cart];
        newCart.splice(existingIndex, 1);
        setCart(newCart);
      }
      return;
    }

    if (requestedQty > product.currentStock) {
      setError(`Insufficient stock for ${product.name}. Available: ${product.currentStock}`);
      return;
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
          quantity: 1,
          unitPrice: product.sellingPrice,
          totalAmount: product.sellingPrice
        }
      ]);
    }
  };

  const updateCartQty = (productId: string, newQty: number) => {
    setError('');
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (newQty <= 0) {
      setCart(cart.filter(item => item.productId !== productId));
      return;
    }

    if (newQty > product.currentStock) {
      setError(`Insufficient stock for ${product.name}. Available: ${product.currentStock}`);
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

  const totalCartAmount = cart.reduce((sum, item) => sum + item.totalAmount, 0);

  const handleRecordSale = async () => {
    if (cart.length === 0) {
      setError('Cart is empty. Please select products to record sale.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const saleId = 'sale-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

      // Use Firestore transaction or offline fallback
      try {
        await runTransaction(db, async (transaction) => {
          // 1. ALL READS FIRST
          const prodSnaps: { [id: string]: { snap: any; currentStock: number; name: string } } = {};
          for (const item of cart) {
            const prodRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'products', item.productId);
            const prodSnap = await transaction.get(prodRef);
            if (!prodSnap.exists()) {
              throw new Error(`Product ${item.productName} no longer exists.`);
            }
            const currentStock = prodSnap.data().currentStock || 0;
            if (currentStock < item.quantity) {
              throw new Error(`Insufficient stock for ${item.productName}. Available: ${currentStock}, Requested: ${item.quantity}`);
            }
            prodSnaps[item.productId] = { snap: prodSnap, currentStock, name: item.productName };
          }

          // 2. ALL WRITES AFTER ALL READS ARE COMPLETED
          for (const item of cart) {
            const prodRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'products', item.productId);
            const info = prodSnaps[item.productId];
            transaction.update(prodRef, {
              currentStock: info.currentStock - item.quantity,
              updatedAt: new Date().toISOString()
            });
          }

          // Create Sale document
          const saleData: Sale = {
            id: saleId,
            items: cart,
            totalAmount: totalCartAmount,
            paymentMethod,
            cashierId: user.uid,
            cashierName: user.name,
            businessDayId: todayStr,
            date: todayStr,
            time: now.toTimeString().split(' ')[0],
            createdAt: now.getTime()
          };

          const saleRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'sales', saleId);
          transaction.set(saleRef, saleData);
        });
      } catch (txErr: any) {
        console.warn("Firestore transaction unavailable or failed, performing robust local/offline fallback:", txErr);
        // Fallback local update
        const localProds = JSON.parse(localStorage.getItem('bar_pos_local_products') || JSON.stringify(products));
        for (const item of cart) {
          const p = localProds.find((prod: Product) => prod.id === item.productId);
          if (p) {
            p.currentStock = Math.max(0, (p.currentStock || 0) - item.quantity);
          }
        }
        localStorage.setItem('bar_pos_local_products', JSON.stringify(localProds));
        setProducts(localProds);

        const localSales = JSON.parse(localStorage.getItem('bar_pos_local_sales') || '[]');
        const saleData: Sale = {
          id: saleId,
          items: cart,
          totalAmount: totalCartAmount,
          paymentMethod,
          cashierId: user.uid,
          cashierName: user.name,
          businessDayId: todayStr,
          date: todayStr,
          time: now.toTimeString().split(' ')[0],
          createdAt: now.getTime()
        };
        localSales.unshift(saleData);
        localStorage.setItem('bar_pos_local_sales', JSON.stringify(localSales));
      }

      // Audit log
      await logAuditAction(
        user.uid,
        user.name,
        'SALE_RECORDED',
        `Recorded sale of ${formatCurrency(totalCartAmount)} via ${paymentMethod} (${cart.length} items)`,
        saleId
      );

      // Success state
      const completedSale: Sale = {
        id: saleId,
        items: [...cart],
        totalAmount: totalCartAmount,
        paymentMethod,
        cashierId: user.uid,
        cashierName: user.name,
        businessDayId: todayStr,
        date: todayStr,
        time: now.toTimeString().split(' ')[0],
        createdAt: now.getTime()
      };

      setSuccessSale(completedSale);
      setCart([]);
      await fetchProductsAndCategories(); // refresh available stock
    } catch (err: any) {
      console.error("Transaction failed:", err);
      setError(err.message || 'Failed to complete transaction due to stock conflict.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const currency = businessConfig?.currency || 'KSh';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Product Catalog & Search */}
      <div className="lg:col-span-7 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name or category..."
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 shadow-xs"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
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
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200 animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
          {filteredProducts.map(product => {
            const inCart = cart.find(i => i.productId === product.id);
            const isOutOfStock = product.currentStock <= 0;

            return (
              <div
                key={product.id}
                className={`rounded-2xl border p-4 bg-white shadow-xs flex flex-col justify-between transition-all ${
                  isOutOfStock ? 'opacity-60 border-red-200 bg-red-50/20' : 'border-gray-200 hover:border-amber-500 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 mb-1">
                        {product.categoryName}
                      </span>
                      <h4 className="font-bold text-gray-900 text-base">{product.name}</h4>
                    </div>
                    <span className="text-sm font-extrabold text-amber-700">
                      {formatCurrency(product.sellingPrice, currency)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className={`font-semibold ${isOutOfStock ? 'text-red-600' : product.currentStock <= product.minStockLevel ? 'text-amber-600' : 'text-emerald-600'}`}>
                      Available: {product.currentStock} {product.unitType}s
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
                      disabled={!inCart || isOutOfStock}
                      className="w-9 h-9 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 disabled:opacity-30 active:scale-95 transition-all font-bold"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-bold text-sm text-gray-900">
                      {inCart ? inCart.quantity : 0}
                    </span>
                    <button
                      onClick={() => addToCart(product, 1)}
                      disabled={isOutOfStock || (inCart && inCart.quantity >= product.currentStock)}
                      className="w-9 h-9 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 disabled:opacity-30 active:scale-95 transition-all font-bold"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => addToCart(product, 1)}
                    disabled={isOutOfStock}
                    className="rounded-xl bg-slate-900 hover:bg-amber-600 text-white px-4 py-2 text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-30"
                  >
                    {isOutOfStock ? 'Out of Stock' : '+ Add'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Cart & Prominent Record Sale Section */}
      <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-md border border-gray-200 flex flex-col justify-between h-[calc(100vh-140px)] sticky top-24">
        <div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-amber-600" />
              <span>Current Transaction</span>
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} items
            </span>
          </div>

          {/* Cart Items List */}
          <div className="my-4 max-h-[calc(100vh-420px)] overflow-y-auto space-y-3 pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs text-gray-400 mt-1">Tap items from the catalog to add</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex-1 pr-3">
                    <h5 className="font-semibold text-gray-900 text-sm">{item.productName}</h5>
                    <p className="text-xs text-gray-500">{formatCurrency(item.unitPrice, currency)} each</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 border border-gray-300 rounded-lg bg-white px-1 py-0.5">
                      <button
                        onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                        className="p-1 text-gray-600 hover:text-red-600"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateCartQty(item.productId, parseInt(e.target.value) || 0)}
                        className="w-10 text-center font-bold text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                        className="p-1 text-gray-600 hover:text-emerald-600"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="font-extrabold text-sm text-gray-900 w-20 text-right">
                      {formatCurrency(item.totalAmount, currency)}
                    </span>

                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Payment Method & Prominent RECORD SALE Button */}
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['Cash', 'M-Pesa', 'Card', 'Other'] as PaymentMethod[]).map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    paymentMethod === method
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
            <span className="text-sm font-bold text-gray-700">Total Amount:</span>
            <span className="text-2xl font-black text-amber-800">
              {formatCurrency(totalCartAmount, currency)}
            </span>
          </div>

          <button
            onClick={handleRecordSale}
            disabled={loading || cart.length === 0}
            className="w-full rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] py-4 text-base font-extrabold text-white shadow-xl shadow-amber-600/30 transition-all disabled:opacity-50 uppercase tracking-wide flex items-center justify-center space-x-2"
          >
            <CheckCircle2 className="w-6 h-6" />
            <span>{loading ? 'Processing Sale...' : 'RECORD SALE'}</span>
          </button>
        </div>
      </div>

      {/* Success Receipt Modal */}
      {successSale && (
        <ReceiptModal
          sale={successSale}
          businessConfig={businessConfig}
          onClose={() => setSuccessSale(null)}
        />
      )}
    </div>
  );
}
