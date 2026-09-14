import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig, Product, StockMovement } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { formatCurrency, logAuditAction } from '../../lib/utils';
import { Layers, Plus, History, Search, AlertCircle, CheckCircle2, PackagePlus, Trash2, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { 
  addAllProductsToInventory, 
  addStockToAllProducts, 
  removeStockFromAllProducts,
  STANDARD_INVENTORY_PRODUCTS 
} from '../../lib/inventoryService';

interface StockViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function StockView({ user, businessConfig }: StockViewProps) {
  const tenantId = user.businessId || DEFAULT_BUSINESS_ID;
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Add stock modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState<number>(20);
  const [reason, setReason] = useState<string>('New stock delivery from supplier');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Bulk Stock Modals
  const [isBulkAddAllModalOpen, setIsBulkAddAllModalOpen] = useState(false);
  const [bulkAddQty, setBulkAddQty] = useState<number>(20);
  const [bulkAddReason, setBulkAddReason] = useState<string>('Bulk shipment delivery');
  const [isProcessingBulkAdd, setIsProcessingBulkAdd] = useState(false);

  const [isResetAllStockModalOpen, setIsResetAllStockModalOpen] = useState(false);
  const [isProcessingResetStock, setIsProcessingResetStock] = useState(false);

  const [isAddAllCatalogModalOpen, setIsAddAllCatalogModalOpen] = useState(false);
  const [isProcessingAddAllCatalog, setIsProcessingAddAllCatalog] = useState(false);

  useEffect(() => {
    fetchStockAndMovements();
  }, []);

  async function fetchStockAndMovements() {
    try {
      // Fetch products
      const prodRef = collection(db, 'businesses', tenantId, 'products');
      const prodSnap = await getDocs(prodRef);
      const prods: Product[] = [];
      prodSnap.forEach(d => {
        prods.push({ id: d.id, ...d.data() } as Product);
      });
      setProducts(prods);
      if (prods.length > 0 && !selectedProduct) {
        setSelectedProduct(prods[0]);
      }

      // Fetch stock movements
      const movRef = collection(db, 'businesses', tenantId, 'stockMovements');
      const movSnap = await getDocs(movRef);
      const movs: StockMovement[] = [];
      movSnap.forEach(d => {
        movs.push({ id: d.id, ...d.data() } as StockMovement);
      });
      movs.sort((a, b) => b.createdAt - a.createdAt);
      setMovements(movs);
    } catch (err) {
      console.warn("Using local fallback stock movements due to permission error:", err);
      try {
        const localProds = JSON.parse(localStorage.getItem('bar_pos_local_products') || '[{"id":"p1","name":"Tusker Lager 500ml","categoryId":"cat-beer","unitType":"Bottle","buyingPrice":180,"sellingPrice":250,"openingStock":50,"stockAdded":0,"currentStock":45,"minStockLevel":10}]');
        const localMovs = JSON.parse(localStorage.getItem('bar_pos_local_movements') || '[]');
        setProducts(localProds);
        if (localProds.length > 0 && !selectedProduct) {
          setSelectedProduct(localProds[0]);
        }
        setMovements(localMovs);
      } catch (e) {
        setProducts([]);
        setMovements([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || addQty <= 0) {
      setError('Please select a product and enter a valid quantity to add.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const prevStock = selectedProduct.currentStock;
      const newStock = prevStock + addQty;
      const totalAdded = (selectedProduct.stockAdded || 0) + addQty;
      const now = new Date();
      const movementId = 'mov-' + Date.now();

      // Update product currentStock and stockAdded
      const prodRef = doc(db, 'businesses', tenantId, 'products', selectedProduct.id);
      await updateDoc(prodRef, {
        currentStock: newStock,
        stockAdded: totalAdded,
        updatedAt: now.toISOString()
      });

      // Record stock movement history
      const movement: StockMovement = {
        id: movementId,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        previousStock: prevStock,
        addedQty: Number(addQty),
        newStock,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        adminId: user.uid,
        adminName: user.name,
        reason: reason.trim() || 'Stock replenishment',
        createdAt: now.getTime()
      };

      const movRef = doc(db, 'businesses', tenantId, 'stockMovements', movementId);
      await setDoc(movRef, movement);

      await logAuditAction(
        user.uid,
        user.name,
        'STOCK_ADDED',
        `Added ${addQty} units to ${selectedProduct.name}. Previous: ${prevStock}, New: ${newStock}. Reason: ${reason}`,
        movementId
      );

      setSuccessMsg(`Successfully added ${addQty} units to ${selectedProduct.name}! New stock is ${newStock}.`);
      setAddQty(20);
      await fetchStockAndMovements();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAddStockToAll = async () => {
    if (bulkAddQty <= 0) return;
    setIsProcessingBulkAdd(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await addStockToAllProducts({
        tenantId,
        user: { uid: user.uid, name: user.name },
        qtyToAdd: bulkAddQty,
        reason: bulkAddReason.trim() || 'Bulk stock delivery',
      });
      setProducts(result.updatedProducts);
      setIsBulkAddAllModalOpen(false);
      setSuccessMsg(`Successfully added +${bulkAddQty} units to all ${result.updatedCount} products!`);
      await fetchStockAndMovements();
    } catch (err: any) {
      console.error(err);
      setError('Failed to add stock to all products: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingBulkAdd(false);
    }
  };

  const handleResetAllStock = async () => {
    setIsProcessingResetStock(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await removeStockFromAllProducts({
        tenantId,
        user: { uid: user.uid, name: user.name },
        reason: 'Reset all stock levels to 0'
      });
      setProducts(result.updatedProducts);
      setIsResetAllStockModalOpen(false);
      setSuccessMsg(`Successfully reset stock to zero for all ${result.updatedCount} products.`);
      await fetchStockAndMovements();
    } catch (err: any) {
      console.error(err);
      setError('Failed to reset all stock: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingResetStock(false);
    }
  };

  const handleAddAllCatalog = async (mode: 'append' | 'replace') => {
    setIsProcessingAddAllCatalog(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await addAllProductsToInventory({
        tenantId,
        user: { uid: user.uid, name: user.name },
        mode
      });
      setProducts(result.updatedProducts);
      if (result.updatedProducts.length > 0) {
        setSelectedProduct(result.updatedProducts[0]);
      }
      setIsAddAllCatalogModalOpen(false);
      setSuccessMsg(`Successfully added all ${result.addedCount} standard products with opening stock!`);
      await fetchStockAndMovements();
    } catch (err: any) {
      console.error(err);
      setError('Failed to add products: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingAddAllCatalog(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Management & Additions</h2>
          <p className="text-sm text-gray-500">Record stock deliveries and view complete stock movement history</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsAddAllCatalogModalOpen(true)}
            className="inline-flex items-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            title="Add all standard products to inventory"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Add All to Inventory</span>
          </button>
          <button
            type="button"
            onClick={() => setIsBulkAddAllModalOpen(true)}
            disabled={products.length === 0}
            className="inline-flex items-center space-x-2 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-amber-600/20 transition-all active:scale-95 cursor-pointer"
            title="Add stock quantity to all products"
          >
            <Layers className="w-4 h-4" />
            <span>Add Stock to All</span>
          </button>
          <button
            type="button"
            onClick={() => setIsResetAllStockModalOpen(true)}
            disabled={products.length === 0}
            className="inline-flex items-center space-x-2 rounded-2xl bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-xs font-bold text-red-600 shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Reset all product stock to 0"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Reset All Stock</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center space-x-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State or Add Stock Form Card */}
      {products.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-gray-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <PackagePlus className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">No Products in Inventory</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
              Your inventory is currently empty. Click below to add all 26 standard bar products (Beers, Ciders, Spirits, Soft Drinks) along with barcodes and initial stock.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleAddAllCatalog('replace')}
            disabled={isProcessingAddAllCatalog}
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>{isProcessingAddAllCatalog ? 'Adding All Products...' : 'Add All Products to Inventory'}</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-6">
          <div className="flex items-center space-x-3 border-b border-gray-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Record Stock Addition</h3>
              <p className="text-xs text-gray-500">Add received stock deliveries while keeping full audit trail history</p>
            </div>
          </div>

          <form onSubmit={handleAddStockSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Select Product
              </label>
              <select
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const found = products.find(p => p.id === e.target.value);
                  if (found) setSelectedProduct(found);
                }}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 bg-white"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.barcode ? `[#${p.barcode}]` : ''} (Current: {p.currentStock})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Quantity to Add
              </label>
              <input
                type="number"
                min="1"
                required
                value={addQty}
                onChange={(e) => setAddQty(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Reason / Supplier Ref
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Kenya Breweries Delivery"
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {loading ? 'Recording...' : 'Add Stock'}
              </button>
            </div>
          </form>

          {selectedProduct && (
            <div className="flex items-center space-x-6 bg-amber-50/50 p-4 rounded-2xl border border-amber-200 text-xs text-amber-900">
              <div>Previous Stock: <strong className="font-bold">{selectedProduct.currentStock}</strong></div>
              <div>+ Added: <strong className="font-bold text-emerald-700">{addQty}</strong></div>
              <div>= New Result Stock: <strong className="font-bold text-amber-800">{selectedProduct.currentStock + addQty}</strong></div>
            </div>
          )}
        </div>
      )}

      {/* Stock Movement History Table */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
          <History className="w-5 h-5 text-amber-600" />
          <span>Stock Movement History Log</span>
        </h3>

        {movements.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No stock additions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4 text-center">Previous</th>
                  <th className="p-4 text-center">Added</th>
                  <th className="p-4 text-center">New Stock</th>
                  <th className="p-4">Reason / Ref</th>
                  <th className="p-4">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50/60">
                    <td className="p-4 text-gray-500 text-xs font-mono">{m.date} {m.time}</td>
                    <td className="p-4 font-bold text-gray-900">{m.productName}</td>
                    <td className="p-4 text-center font-medium text-gray-700">{m.previousStock}</td>
                    <td className="p-4 text-center font-bold text-emerald-600">+{m.addedQty}</td>
                    <td className="p-4 text-center font-extrabold text-gray-900">{m.newStock}</td>
                    <td className="p-4 text-gray-700">{m.reason}</td>
                    <td className="p-4 text-gray-600 text-xs font-medium">{m.adminName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Stock Addition Modal */}
      {isBulkAddAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2.5 text-amber-700">
                <div className="rounded-2xl bg-amber-100 p-2.5">
                  <Layers className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add Stock to All Products</h3>
                  <p className="text-xs text-gray-500">Replenish {products.length} products simultaneously</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isProcessingBulkAdd) setIsBulkAddAllModalOpen(false);
                }}
                disabled={isProcessingBulkAdd}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Quantity to Add to Each Product
                </label>
                <input
                  type="number"
                  min="1"
                  value={bulkAddQty}
                  onChange={(e) => setBulkAddQty(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Delivery Reason / Note
                </label>
                <input
                  type="text"
                  value={bulkAddReason}
                  onChange={(e) => setBulkAddReason(e.target.value)}
                  placeholder="e.g. Bulk shipment delivery"
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
                />
              </div>
            </div>

            <div className="pt-2 flex space-x-3">
              <button
                type="button"
                onClick={handleBulkAddStockToAll}
                disabled={isProcessingBulkAdd || bulkAddQty <= 0}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-bold text-white shadow-md shadow-amber-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>{isProcessingBulkAdd ? 'Applying Stock...' : `Add +${bulkAddQty} to All (${products.length})`}</span>
              </button>
              <button
                type="button"
                disabled={isProcessingBulkAdd}
                onClick={() => setIsBulkAddAllModalOpen(false)}
                className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Stock Modal */}
      {isResetAllStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2.5 text-red-600">
                <div className="rounded-full bg-red-100 p-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Reset All Stock Levels</h3>
                  <p className="text-xs text-gray-500">Sets current stock of all products to 0</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isProcessingResetStock) setIsResetAllStockModalOpen(false);
                }}
                disabled={isProcessingResetStock}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-red-50 p-4 border border-red-200 text-xs text-red-800 space-y-1.5">
              <p className="font-bold flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Notice: All inventory counts will become 0</span>
              </p>
              <p>
                This will set current stock to <strong>0 units</strong> across all {products.length} products. Product details and barcodes will remain intact.
              </p>
            </div>

            <div className="pt-2 flex space-x-3">
              <button
                type="button"
                onClick={handleResetAllStock}
                disabled={isProcessingResetStock}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-bold text-white shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isProcessingResetStock ? 'Resetting...' : 'Yes, Reset All to 0'}</span>
              </button>
              <button
                type="button"
                disabled={isProcessingResetStock}
                onClick={() => setIsResetAllStockModalOpen(false)}
                className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add All Standard Products to Inventory Modal */}
      {isAddAllCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2.5 text-emerald-700">
                <div className="rounded-2xl bg-emerald-100 p-2.5">
                  <PackagePlus className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add All Products to Inventory</h3>
                  <p className="text-xs text-gray-500">Populate standard bar catalog with stock & barcodes</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isProcessingAddAllCatalog) setIsAddAllCatalogModalOpen(false);
                }}
                disabled={isProcessingAddAllCatalog}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-emerald-50/80 p-4 border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <div className="font-bold flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>26 Standard Bar Products</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-200 font-mono font-bold text-[10px]">
                  All with Barcodes & Stock
                </span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Includes Beers (Tusker, Heineken, Guinness, White Cap), Spirits (JW Black/Red, Jameson, Smirnoff, Chrome, Gilbeys), Ciders, Soft Drinks, and Wines with purchase & selling prices.
              </p>
            </div>

            <div className="pt-2 flex space-x-3">
              <button
                type="button"
                onClick={() => handleAddAllCatalog(products.length === 0 ? 'replace' : 'append')}
                disabled={isProcessingAddAllCatalog}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <PackagePlus className="w-4 h-4" />
                <span>
                  {isProcessingAddAllCatalog
                    ? 'Adding All Products...'
                    : `Add All Products to Inventory (${STANDARD_INVENTORY_PRODUCTS.length})`}
                </span>
              </button>
              <button
                type="button"
                disabled={isProcessingAddAllCatalog}
                onClick={() => setIsAddAllCatalogModalOpen(false)}
                className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
