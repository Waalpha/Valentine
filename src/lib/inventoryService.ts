import { db, DEFAULT_BUSINESS_ID } from './firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Product, Category, StockMovement } from '../types';
import { cacheLocalProducts, getLocalCachedProducts } from './offlineManager';
import { logAuditAction } from './utils';

export const STANDARD_CATEGORIES: Category[] = [
  { id: 'cat-beer', name: 'Beer', description: 'Local & imported beers' },
  { id: 'cat-cider', name: 'Ciders', description: 'Crisp & refreshing ciders' },
  { id: 'cat-spirits', name: 'Spirits', description: 'Whiskies, vodkas, gins, rums & cognacs' },
  { id: 'cat-soft', name: 'Soft Drinks', description: 'Sodas, energy drinks, juices & mineral water' },
  { id: 'cat-wine', name: 'Wine', description: 'House wines, sparkling & fine wines' },
  { id: 'cat-snacks', name: 'Snacks', description: 'Bar bites, nuts & quick snacks' }
];

export const STANDARD_INVENTORY_PRODUCTS: Omit<Product, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>[] = [
  // --- BEERS ---
  {
    name: 'Tusker Lager (500ml)',
    barcode: '6161101234567',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 180,
    sellingPrice: 250,
    openingStock: 120,
    currentStock: 120,
    stockAdded: 0,
    minStockLevel: 15,
    status: 'active'
  },
  {
    name: 'Tusker Malt (330ml)',
    barcode: '6161101234574',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 190,
    sellingPrice: 260,
    openingStock: 90,
    currentStock: 90,
    stockAdded: 0,
    minStockLevel: 12,
    status: 'active'
  },
  {
    name: 'Tusker Lite (330ml)',
    barcode: '6161101234581',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 190,
    sellingPrice: 260,
    openingStock: 80,
    currentStock: 80,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active'
  },
  {
    name: 'White Cap Lager (500ml)',
    barcode: '6161101234598',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 180,
    sellingPrice: 250,
    openingStock: 90,
    currentStock: 90,
    stockAdded: 0,
    minStockLevel: 12,
    status: 'active'
  },
  {
    name: 'Guinness Foreign Extra Stout (500ml)',
    barcode: '6161101234604',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 220,
    sellingPrice: 300,
    openingStock: 75,
    currentStock: 75,
    stockAdded: 0,
    minStockLevel: 12,
    status: 'active'
  },
  {
    name: 'Heineken Lager (330ml)',
    barcode: '8712000024018',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 250,
    sellingPrice: 350,
    openingStock: 60,
    currentStock: 60,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active'
  },
  {
    name: 'Balozi Lager (500ml)',
    barcode: '6161101234611',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 170,
    sellingPrice: 240,
    openingStock: 60,
    currentStock: 60,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active'
  },

  // --- CIDERS ---
  {
    name: 'Tusker Premium Cider (500ml)',
    barcode: '6161101234628',
    categoryId: 'cat-cider',
    categoryName: 'Ciders',
    unitType: 'Bottle',
    buyingPrice: 200,
    sellingPrice: 280,
    openingStock: 80,
    currentStock: 80,
    stockAdded: 0,
    minStockLevel: 12,
    status: 'active'
  },
  {
    name: 'Savanna Dry Cider (330ml)',
    barcode: '6001108000021',
    categoryId: 'cat-cider',
    categoryName: 'Ciders',
    unitType: 'Bottle',
    buyingPrice: 230,
    sellingPrice: 320,
    openingStock: 60,
    currentStock: 60,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active'
  },
  {
    name: 'Hunters Gold Cider (330ml)',
    barcode: '6001108000038',
    categoryId: 'cat-cider',
    categoryName: 'Ciders',
    unitType: 'Bottle',
    buyingPrice: 220,
    sellingPrice: 300,
    openingStock: 50,
    currentStock: 50,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active'
  },

  // --- SPIRITS & WHISKIES ---
  {
    name: 'Johnnie Walker Black Label (750ml)',
    barcode: '5000267014013',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 2800,
    sellingPrice: 4000,
    openingStock: 20,
    currentStock: 20,
    stockAdded: 0,
    minStockLevel: 4,
    status: 'active'
  },
  {
    name: 'Johnnie Walker Red Label (750ml)',
    barcode: '5000267014020',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 1800,
    sellingPrice: 2600,
    openingStock: 25,
    currentStock: 25,
    stockAdded: 0,
    minStockLevel: 5,
    status: 'active'
  },
  {
    name: 'Jameson Irish Whiskey (750ml)',
    barcode: '5011007003004',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 2200,
    sellingPrice: 3200,
    openingStock: 25,
    currentStock: 25,
    stockAdded: 0,
    minStockLevel: 5,
    status: 'active'
  },
  {
    name: 'Smirnoff Red Vodka (750ml)',
    barcode: '5410316971510',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 1200,
    sellingPrice: 1800,
    openingStock: 30,
    currentStock: 30,
    stockAdded: 0,
    minStockLevel: 6,
    status: 'active'
  },
  {
    name: 'Chrome Vodka (250ml)',
    barcode: '6161101234635',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 350,
    sellingPrice: 500,
    openingStock: 60,
    currentStock: 60,
    stockAdded: 0,
    minStockLevel: 15,
    status: 'active'
  },
  {
    name: 'Gilbeys Special Dry Gin (750ml)',
    barcode: '5000281001013',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 1300,
    sellingPrice: 1900,
    openingStock: 35,
    currentStock: 35,
    stockAdded: 0,
    minStockLevel: 6,
    status: 'active'
  },
  {
    name: 'Captain Morgan Spiced Gold (750ml)',
    barcode: '5000267024012',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 1400,
    sellingPrice: 2100,
    openingStock: 25,
    currentStock: 25,
    stockAdded: 0,
    minStockLevel: 5,
    status: 'active'
  },
  {
    name: 'Hennessy VS Cognac (750ml)',
    barcode: '3245990001218',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 4600,
    sellingPrice: 6500,
    openingStock: 12,
    currentStock: 12,
    stockAdded: 0,
    minStockLevel: 3,
    status: 'active'
  },
  {
    name: 'Tequila Jose Cuervo (Shot)',
    barcode: '7501035010103',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Shot',
    buyingPrice: 120,
    sellingPrice: 250,
    openingStock: 100,
    currentStock: 100,
    stockAdded: 0,
    minStockLevel: 20,
    status: 'active'
  },

  // --- SOFT DRINKS & MIXERS ---
  {
    name: 'Coca Cola (Soda 300ml)',
    barcode: '5449000000996',
    categoryId: 'cat-soft',
    categoryName: 'Soft Drinks',
    unitType: 'Bottle',
    buyingPrice: 60,
    sellingPrice: 100,
    openingStock: 140,
    currentStock: 140,
    stockAdded: 0,
    minStockLevel: 25,
    status: 'active'
  },
  {
    name: 'Fanta Orange (Soda 300ml)',
    barcode: '5449000011527',
    categoryId: 'cat-soft',
    categoryName: 'Soft Drinks',
    unitType: 'Bottle',
    buyingPrice: 60,
    sellingPrice: 100,
    openingStock: 90,
    currentStock: 90,
    stockAdded: 0,
    minStockLevel: 20,
    status: 'active'
  },
  {
    name: 'Sprite (Soda 300ml)',
    barcode: '5449000027528',
    categoryId: 'cat-soft',
    categoryName: 'Soft Drinks',
    unitType: 'Bottle',
    buyingPrice: 60,
    sellingPrice: 100,
    openingStock: 90,
    currentStock: 90,
    stockAdded: 0,
    minStockLevel: 20,
    status: 'active'
  },
  {
    name: 'Keringet Drinking Water (500ml)',
    barcode: '6161101234642',
    categoryId: 'cat-soft',
    categoryName: 'Soft Drinks',
    unitType: 'Bottle',
    buyingPrice: 40,
    sellingPrice: 80,
    openingStock: 120,
    currentStock: 120,
    stockAdded: 0,
    minStockLevel: 25,
    status: 'active'
  },
  {
    name: 'Red Bull Energy Drink (250ml)',
    barcode: '9002490100070',
    categoryId: 'cat-soft',
    categoryName: 'Soft Drinks',
    unitType: 'Can',
    buyingPrice: 180,
    sellingPrice: 300,
    openingStock: 70,
    currentStock: 70,
    stockAdded: 0,
    minStockLevel: 15,
    status: 'active'
  },
  {
    name: 'Schweppes Tonic Water (300ml)',
    barcode: '5449000054227',
    categoryId: 'cat-soft',
    categoryName: 'Soft Drinks',
    unitType: 'Bottle',
    buyingPrice: 70,
    sellingPrice: 120,
    openingStock: 80,
    currentStock: 80,
    stockAdded: 0,
    minStockLevel: 15,
    status: 'active'
  },

  // --- WINES & SNACKS ---
  {
    name: 'House Red Wine (Glass)',
    barcode: '6161101234659',
    categoryId: 'cat-wine',
    categoryName: 'Wine',
    unitType: 'Glass',
    buyingPrice: 180,
    sellingPrice: 350,
    openingStock: 50,
    currentStock: 50,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active'
  },
  {
    name: 'House White Wine (Glass)',
    barcode: '6161101234666',
    categoryId: 'cat-wine',
    categoryName: 'Wine',
    unitType: 'Glass',
    buyingPrice: 180,
    sellingPrice: 350,
    openingStock: 50,
    currentStock: 50,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active'
  },
  {
    name: 'Roasted Peanuts (Packet)',
    barcode: '6161101234673',
    categoryId: 'cat-snacks',
    categoryName: 'Snacks',
    unitType: 'Packet',
    buyingPrice: 35,
    sellingPrice: 70,
    openingStock: 100,
    currentStock: 100,
    stockAdded: 0,
    minStockLevel: 25,
    status: 'active'
  }
];

/**
 * Add all standard products into the business inventory.
 * mode: 'append' -> adds missing items while keeping existing products
 * mode: 'replace' -> clears all existing products first, then populates fresh
 */
export async function addAllProductsToInventory(params: {
  tenantId: string;
  user: { uid: string; name: string };
  mode?: 'append' | 'replace';
}): Promise<{ addedCount: number; updatedProducts: Product[] }> {
  const tenantId = params.tenantId || DEFAULT_BUSINESS_ID;
  const mode = params.mode || 'append';
  const now = new Date().toISOString();

  // 1. Ensure categories exist in Firestore
  try {
    for (const cat of STANDARD_CATEGORIES) {
      const catRef = doc(db, 'businesses', tenantId, 'categories', cat.id);
      await setDoc(catRef, cat, { merge: true });
    }
  } catch (e) {
    console.warn('Could not ensure categories online:', e);
  }

  // 2. Fetch current products
  let currentProducts: Product[] = [];
  try {
    const snap = await getDocs(collection(db, 'businesses', tenantId, 'products'));
    currentProducts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  } catch (e) {
    currentProducts = getLocalCachedProducts(tenantId);
  }

  // If replace mode, delete all existing products first
  if (mode === 'replace' && currentProducts.length > 0) {
    for (const p of currentProducts) {
      try {
        await deleteDoc(doc(db, 'businesses', tenantId, 'products', p.id));
      } catch (err) {
        console.warn(`Could not delete product ${p.id}:`, err);
      }
    }
    currentProducts = [];
  }

  // 3. Determine products to insert
  const existingNames = new Set(currentProducts.map(p => p.name.trim().toLowerCase()));
  const existingBarcodes = new Set(
    currentProducts.map(p => p.barcode ? String(p.barcode).trim().toLowerCase() : '').filter(Boolean)
  );

  const productsToAdd: Product[] = [];
  let index = 1;

  for (const template of STANDARD_INVENTORY_PRODUCTS) {
    const nameKey = template.name.trim().toLowerCase();
    const barcodeKey = template.barcode ? template.barcode.trim().toLowerCase() : '';

    if (mode === 'append' && (existingNames.has(nameKey) || (barcodeKey && existingBarcodes.has(barcodeKey)))) {
      // Already present
      continue;
    }

    const prodId = 'prod-' + Date.now() + '-' + index++;
    const newProd: Product = {
      id: prodId,
      ...template,
      businessId: tenantId,
      createdAt: now,
      updatedAt: now
    };
    productsToAdd.push(newProd);
  }

  // 4. Batch save to Firestore
  if (productsToAdd.length > 0) {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < productsToAdd.length; i += CHUNK_SIZE) {
      const chunk = productsToAdd.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const p of chunk) {
        const prodRef = doc(db, 'businesses', tenantId, 'products', p.id);
        batch.set(prodRef, p);
      }
      try {
        await batch.commit();
      } catch (e) {
        console.warn('Batch write failed, saving individually:', e);
        for (const p of chunk) {
          try {
            await setDoc(doc(db, 'businesses', tenantId, 'products', p.id), p);
          } catch (err) {
            // fallback
          }
        }
      }
    }
  }

  const mergedProducts = mode === 'replace' ? [...productsToAdd] : [...currentProducts, ...productsToAdd];
  cacheLocalProducts(mergedProducts, tenantId);

  await logAuditAction(
    params.user.uid,
    params.user.name,
    'INVENTORY_ADD_ALL',
    `Added ${productsToAdd.length} standard products to inventory catalog (mode: ${mode})`
  );

  return { addedCount: productsToAdd.length, updatedProducts: mergedProducts };
}

/**
 * Remove all products from inventory completely.
 */
export async function removeAllProductsFromInventory(params: {
  tenantId: string;
  user: { uid: string; name: string };
  productsToRemove?: Product[];
}): Promise<{ deletedCount: number }> {
  const tenantId = params.tenantId || DEFAULT_BUSINESS_ID;

  let targets = params.productsToRemove;
  if (!targets || targets.length === 0) {
    try {
      const snap = await getDocs(collection(db, 'businesses', tenantId, 'products'));
      targets = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
    } catch (e) {
      targets = getLocalCachedProducts(tenantId);
    }
  }

  let deletedCount = 0;
  for (const p of targets) {
    try {
      await deleteDoc(doc(db, 'businesses', tenantId, 'products', p.id));
      deletedCount++;
    } catch (e) {
      console.warn(`Failed to delete product ${p.id}:`, e);
      deletedCount++;
    }
  }

  // Clear local storage product cache
  cacheLocalProducts([], tenantId);

  await logAuditAction(
    params.user.uid,
    params.user.name,
    'INVENTORY_REMOVE_ALL',
    `Removed all ${deletedCount} products from inventory`
  );

  return { deletedCount };
}

/**
 * Bulk add stock to all products in inventory.
 */
export async function addStockToAllProducts(params: {
  tenantId: string;
  user: { uid: string; name: string };
  qtyToAdd: number;
  reason: string;
  targetProductIds?: string[];
}): Promise<{ updatedCount: number; updatedProducts: Product[] }> {
  const tenantId = params.tenantId || DEFAULT_BUSINESS_ID;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  // Fetch products
  let currentProducts: Product[] = [];
  try {
    const snap = await getDocs(collection(db, 'businesses', tenantId, 'products'));
    currentProducts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  } catch (e) {
    currentProducts = getLocalCachedProducts(tenantId);
  }

  const isFiltered = params.targetProductIds && params.targetProductIds.length > 0;
  const targetIdsSet = new Set(params.targetProductIds || []);

  const targets = isFiltered
    ? currentProducts.filter(p => targetIdsSet.has(p.id))
    : currentProducts;

  const updatedProducts = currentProducts.map(p => {
    if (!isFiltered || targetIdsSet.has(p.id)) {
      const prevStock = p.currentStock || 0;
      const newStock = prevStock + params.qtyToAdd;
      const totalAdded = (p.stockAdded || 0) + params.qtyToAdd;
      return {
        ...p,
        currentStock: newStock,
        stockAdded: totalAdded,
        updatedAt: now.toISOString()
      };
    }
    return p;
  });

  // Batch update Firestore products & log stock movements
  const batch = writeBatch(db);
  for (const p of targets) {
    const prevStock = p.currentStock || 0;
    const newStock = prevStock + params.qtyToAdd;
    const totalAdded = (p.stockAdded || 0) + params.qtyToAdd;

    const prodRef = doc(db, 'businesses', tenantId, 'products', p.id);
    batch.update(prodRef, {
      currentStock: newStock,
      stockAdded: totalAdded,
      updatedAt: now.toISOString()
    });

    const movId = 'mov-bulk-' + Date.now() + '-' + p.id.slice(-4);
    const movement: StockMovement = {
      id: movId,
      productId: p.id,
      productName: p.name,
      previousStock: prevStock,
      addedQty: params.qtyToAdd,
      newStock,
      date: dateStr,
      time: timeStr,
      adminId: params.user.uid,
      adminName: params.user.name,
      reason: params.reason || 'Bulk Stock Delivery to All Products',
      createdAt: now.getTime()
    };
    const movRef = doc(db, 'businesses', tenantId, 'stockMovements', movId);
    batch.set(movRef, movement);
  }

  try {
    await batch.commit();
  } catch (e) {
    console.warn('Batch write failed for bulk stock add:', e);
  }

  cacheLocalProducts(updatedProducts, tenantId);

  await logAuditAction(
    params.user.uid,
    params.user.name,
    'STOCK_BULK_ADD',
    `Added ${params.qtyToAdd} units to ${targets.length} products. Reason: ${params.reason}`
  );

  return { updatedCount: targets.length, updatedProducts };
}

/**
 * Bulk clear / remove stock from all products in inventory (sets stock to 0).
 */
export async function removeStockFromAllProducts(params: {
  tenantId: string;
  user: { uid: string; name: string };
  reason: string;
  targetProductIds?: string[];
}): Promise<{ updatedCount: number; updatedProducts: Product[] }> {
  const tenantId = params.tenantId || DEFAULT_BUSINESS_ID;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  let currentProducts: Product[] = [];
  try {
    const snap = await getDocs(collection(db, 'businesses', tenantId, 'products'));
    currentProducts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  } catch (e) {
    currentProducts = getLocalCachedProducts(tenantId);
  }

  const isFiltered = params.targetProductIds && params.targetProductIds.length > 0;
  const targetIdsSet = new Set(params.targetProductIds || []);

  const targets = isFiltered
    ? currentProducts.filter(p => targetIdsSet.has(p.id))
    : currentProducts;

  const updatedProducts = currentProducts.map(p => {
    if (!isFiltered || targetIdsSet.has(p.id)) {
      return {
        ...p,
        currentStock: 0,
        updatedAt: now.toISOString()
      };
    }
    return p;
  });

  const batch = writeBatch(db);
  for (const p of targets) {
    const prevStock = p.currentStock || 0;
    const prodRef = doc(db, 'businesses', tenantId, 'products', p.id);
    batch.update(prodRef, {
      currentStock: 0,
      updatedAt: now.toISOString()
    });

    const movId = 'mov-zero-' + Date.now() + '-' + p.id.slice(-4);
    const movement: StockMovement = {
      id: movId,
      productId: p.id,
      productName: p.name,
      previousStock: prevStock,
      addedQty: -prevStock,
      newStock: 0,
      date: dateStr,
      time: timeStr,
      adminId: params.user.uid,
      adminName: params.user.name,
      reason: params.reason || 'Reset / Cleared Stock to 0',
      createdAt: now.getTime()
    };
    const movRef = doc(db, 'businesses', tenantId, 'stockMovements', movId);
    batch.set(movRef, movement);
  }

  try {
    await batch.commit();
  } catch (e) {
    console.warn('Batch write failed for clearing stock:', e);
  }

  cacheLocalProducts(updatedProducts, tenantId);

  await logAuditAction(
    params.user.uid,
    params.user.name,
    'STOCK_BULK_CLEAR',
    `Cleared stock to 0 for ${targets.length} products. Reason: ${params.reason}`
  );

  return { updatedCount: targets.length, updatedProducts };
}
