import React, { useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  BusinessConfig,
  RestaurantTable,
  Product,
  Category,
  OrderItem,
  RestaurantOrder
} from '../../types';
import { DEFAULT_BUSINESS_ID, db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  subscribeTables,
  submitWaiterOrder
} from '../../lib/orderService';
import {
  getLocalCachedProducts,
  cacheLocalProducts,
  getLocalCachedCategories,
  cacheLocalCategories
} from '../../lib/offlineManager';
import { formatCurrency } from '../../lib/utils';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  Printer,
  FileText,
  User,
  CheckCircle2,
  AlertCircle,
  Wine,
  MessageSquare
} from 'lucide-react';
import { KotModal } from '../common/KotModal';

interface WaiterOrderScreenProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  initialTable?: RestaurantTable | null;
  onOrderSubmitted?: (order: RestaurantOrder) => void;
}

export function WaiterOrderScreen({
  user,
  businessConfig,
  initialTable,
  onOrderSubmitted
}: WaiterOrderScreenProps) {
  const tenantId = user.businessId || DEFAULT_BUSINESS_ID;
  const currency = businessConfig?.currency || 'KSh';

  // Data States
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Selection States
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(initialTable || null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Cart / Items
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [activeItemNoteModal, setActiveItemNoteModal] = useState<{ index: number; note: string } | null>(null);

  // Status & Modals
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<RestaurantOrder | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Keep selectedTable in sync with initialTable if changed externally
  useEffect(() => {
    if (initialTable) {
      setSelectedTable(initialTable);
    }
  }, [initialTable]);

  // Load products, categories, tables
  useEffect(() => {
    // 1. Initial fast load from offline cache
    const loadedProducts = getLocalCachedProducts(tenantId).filter(p => p.status === 'active');
    setProducts(loadedProducts);
    setCategories(getLocalCachedCategories() as Category[]);

    // 2. Fetch fresh catalog from Firestore if online
    if (typeof navigator === 'undefined' || navigator.onLine) {
      const prodRef = collection(db, 'businesses', tenantId, 'products');
      getDocs(prodRef).then(snap => {
        const prods: Product[] = [];
        snap.forEach(d => {
          prods.push({ id: d.id, ...d.data() } as Product);
        });
        if (prods.length > 0) {
          const activeProds = prods.filter(p => p.status === 'active');
          setProducts(activeProds);
          cacheLocalProducts(prods, tenantId);
        }
      }).catch(err => console.warn('Using local products:', err));

      const catRef = collection(db, 'businesses', tenantId, 'categories');
      getDocs(catRef).then(snap => {
        const cats: { id: string; name: string }[] = [];
        snap.forEach(d => {
          cats.push({ id: d.id, name: d.data().name });
        });
        if (cats.length > 0) {
          setCategories(cats as Category[]);
          cacheLocalCategories(cats);
        }
      }).catch(err => console.warn('Using local categories:', err));
    }

    // 3. Realtime table subscription
    const unsubTables = subscribeTables(tenantId, (loaded) => {
      setTables(loaded);
      // Auto-select table if none selected yet
      setSelectedTable(prev => {
        if (prev) {
          return loaded.find(t => t.id === prev.id) || prev;
        }
        if (initialTable) {
          return loaded.find(t => t.id === initialTable.id) || initialTable;
        }
        // Default to first available table or first table
        return loaded.find(t => t.status === 'available') || loaded[0] || null;
      });
    });

    return () => unsubTables();
  }, [tenantId, initialTable]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
      const matchesSearch =
        searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery.trim()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Cart calculations
  const totalAmount = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + item.totalAmount, 0);
  }, [orderItems]);

  const totalItemCount = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [orderItems]);

  // Cart Actions
  const handleAddToCart = (product: Product) => {
    setOrderItems((prev) => {
      const existingIdx = prev.findIndex(item => item.productId === product.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        const updatedQty = next[existingIdx].quantity + 1;
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: updatedQty,
          totalAmount: updatedQty * next[existingIdx].unitPrice
        };
        return next;
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: product.sellingPrice,
            totalAmount: product.sellingPrice
          }
        ];
      }
    });
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    setOrderItems((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index] = {
        ...next[index],
        quantity: newQty,
        totalAmount: newQty * next[index].unitPrice
      };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveItemNote = () => {
    if (!activeItemNoteModal) return;
    setOrderItems((prev) => {
      const next = [...prev];
      if (next[activeItemNoteModal.index]) {
        next[activeItemNoteModal.index] = {
          ...next[activeItemNoteModal.index],
          notes: activeItemNoteModal.note.trim() || undefined
        };
      }
      return next;
    });
    setActiveItemNoteModal(null);
  };

  const handleClearCart = () => {
    setOrderItems([]);
    setOrderNotes('');
    setCustomerName('');
    setErrorMessage('');
  };

  // Submit Order to Cashier
  const handleSubmitOrder = async () => {
    if (!selectedTable) {
      setErrorMessage('Please select a Table or Bar Counter first (Step 1 above).');
      return;
    }
    if (orderItems.length === 0) {
      setErrorMessage('Your order is empty. Please tap items from the menu on the left to add them to this order.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const order = await submitWaiterOrder(
        {
          table: selectedTable,
          waiter: user,
          items: orderItems,
          customerName: customerName.trim() || undefined,
          notes: orderNotes.trim() || undefined
        },
        tenantId
      );

      setSubmittedOrder(order);
      setSuccessMessage(`Order #${order.orderNumber} sent to Cashier successfully!`);
      // Reset form
      setOrderItems([]);
      setOrderNotes('');
      setCustomerName('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full">
      {/* LEFT/MAIN: Table Selector, Categories & Products */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Table Selection Bar */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
              1. Select Table / Spot
            </h3>
            {selectedTable && (
              <span className="text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Selected: {selectedTable.name}
              </span>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {tables.map((table) => {
              const isSelected = selectedTable?.id === table.id;
              const isOccupied = table.status !== 'available';
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 scale-102 ring-2 ring-amber-400'
                      : isOccupied
                      ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                      : 'bg-gray-50 text-gray-800 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSelected
                        ? 'bg-white'
                        : table.status === 'available'
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <span>{table.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories Bar & Search */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search food, beer, cocktails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-amber-600 focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategoryId === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Menu
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                    selectedCategoryId === cat.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto max-h-[60vh] p-1">
          {filteredProducts.map((product) => {
            const inCart = orderItems.find(i => i.productId === product.id);
            return (
              <button
                key={product.id}
                onClick={() => handleAddToCart(product)}
                className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer active:scale-97 select-none relative ${
                  inCart
                    ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-xs'
                }`}
              >
                {inCart && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                    {inCart.quantity}
                  </span>
                )}

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    {product.categoryName || 'Item'}
                  </span>
                  <h4 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">
                    {product.name}
                  </h4>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-sm font-black text-amber-700">
                    {formatCurrency(product.sellingPrice, currency)}
                  </span>
                  <span className="p-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-amber-600 hover:text-white transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-gray-200">
              <Wine className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 font-medium">No menu items match your search</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Current Order / Cart Panel */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm p-4 h-full">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
          <div>
            <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
              <span>Current Order</span>
              {totalItemCount > 0 && (
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  {totalItemCount} items
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500">
              {selectedTable ? (
                <span className="text-amber-700 font-bold uppercase">{selectedTable.name}</span>
              ) : (
                <span className="text-red-500 font-medium">⚠️ No table selected</span>
              )}
            </p>
          </div>

          {orderItems.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-xs font-semibold text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Clear Cart"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Customer & Table details */}
        <div className="space-y-2 mb-3">
          <div className="relative">
            <User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Guest/Customer Name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div className="relative">
            <FileText className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Order Note (e.g. VIP, quick service)"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:border-amber-600 focus:outline-none"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[360px] min-h-[160px]">
          {orderItems.map((item, index) => (
            <div
              key={index}
              className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-1.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-gray-900 flex-1 leading-snug">
                  {item.productName}
                </span>
                <span className="font-black text-gray-900 shrink-0">
                  {formatCurrency(item.totalAmount, currency)}
                </span>
              </div>

              {item.notes && (
                <div className="text-[11px] text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                  <span className="font-semibold">Note:</span> {item.notes}
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                <button
                  type="button"
                  onClick={() =>
                    setActiveItemNoteModal({ index, note: item.notes || '' })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-amber-700 font-medium cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>{item.notes ? 'Edit Note' : 'Add Note'}</span>
                </button>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleUpdateQuantity(index, -1)}
                    className="w-6 h-6 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-bold text-gray-900 text-xs">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleUpdateQuantity(index, 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="w-6 h-6 rounded-lg text-gray-400 hover:text-red-600 flex items-center justify-center ml-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {orderItems.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No items added yet</p>
              <p className="text-[11px] text-gray-400 mt-1">Tap products on the left to add</p>
            </div>
          )}
        </div>

        {/* Total & Action Buttons */}
        <div className="pt-3 border-t border-gray-100 space-y-3 mt-auto">
          <div className="flex items-center justify-between text-base font-black text-gray-900">
            <span>Total Value:</span>
            <span className="text-xl text-amber-700">{formatCurrency(totalAmount, currency)}</span>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            * Submitting sends this order to Cashier POS for payment collection
          </p>

          {/* Validation Feedback Messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmitOrder}
            disabled={submitting}
            className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer ${
              submitting
                ? 'bg-amber-400 text-white cursor-wait'
                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Submitting Order...' : 'Take Customer Order (Submit to Cashier)'}</span>
          </button>
        </div>
      </div>

      {/* Item Note Modal */}
      {activeItemNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h4 className="font-bold text-gray-900 text-sm mb-1">
              Item Special Instruction
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              {orderItems[activeItemNoteModal.index]?.productName}
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Chicken - no chili, extra cold, no ice"
              value={activeItemNoteModal.note}
              onChange={(e) =>
                setActiveItemNoteModal({ ...activeItemNoteModal, note: e.target.value })
              }
              className="w-full p-2.5 rounded-xl border border-gray-300 text-xs focus:border-amber-600 focus:outline-none mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveItemNoteModal(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveItemNote}
                className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow-sm"
              >
                Save Instruction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Submit KOT Modal */}
      {submittedOrder && (
        <KotModal
          order={submittedOrder}
          businessConfig={businessConfig}
          isNewSubmission={true}
          onClose={() => {
            const ord = submittedOrder;
            setSubmittedOrder(null);
            if (onOrderSubmitted) onOrderSubmitted(ord);
          }}
          onSentToCashier={() => {
            const ord = submittedOrder;
            setSubmittedOrder(null);
            if (onOrderSubmitted) onOrderSubmitted(ord);
          }}
        />
      )}
    </div>
  );
}
