import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, DEFAULT_BUSINESS_ID } from './firebase';
import { Product, Category } from '../types';
import { 
  getLocalCachedProducts, 
  cacheLocalProducts, 
  getLocalCachedCategories, 
  cacheLocalCategories 
} from './offlineManager';
import { STANDARD_CATEGORIES } from './inventoryService';

/**
 * Fast race-timeout wrapper to ensure Firestore network queries never hang the UI.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2500, fallbackValue: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallbackValue);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    return fallbackValue;
  }
}

/**
 * Loads products with zero UI latency:
 * 1. Synchronously returns local cached products immediately (0ms delay).
 * 2. Background-refreshes from Firestore without blocking the caller.
 */
export async function loadProductsFast(
  tenantId: string = DEFAULT_BUSINESS_ID,
  onRemoteUpdate?: (prods: Product[]) => void
): Promise<Product[]> {
  const cached = getLocalCachedProducts(tenantId);

  // If offline, return cached catalog right away
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return cached;
  }

  // Fetch from Firestore with a 2-second timeout guard
  const fetchPromise = (async () => {
    const prodRef = collection(db, 'businesses', tenantId, 'products');
    const snap = await getDocs(prodRef);
    const prods: Product[] = [];
    snap.forEach(d => {
      prods.push({ id: d.id, ...d.data() } as Product);
    });
    if (prods.length > 0) {
      cacheLocalProducts(prods, tenantId);
      if (onRemoteUpdate) {
        onRemoteUpdate(prods);
      }
      return prods;
    }
    return cached;
  })();

  const fresh = await withTimeout(fetchPromise, 2200, cached);
  return fresh.length > 0 ? fresh : cached;
}

/**
 * Loads categories with zero UI latency:
 * 1. Returns local cached categories immediately.
 * 2. Background-refreshes from Firestore without blocking.
 */
export async function loadCategoriesFast(
  tenantId: string = DEFAULT_BUSINESS_ID,
  onRemoteUpdate?: (cats: Category[]) => void
): Promise<Category[]> {
  const cached = getLocalCachedCategories();
  const initialCats: Category[] = cached.length > 0 ? (cached as Category[]) : STANDARD_CATEGORIES;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return initialCats;
  }

  const fetchPromise = (async () => {
    const catRef = collection(db, 'businesses', tenantId, 'categories');
    const snap = await getDocs(catRef);
    const cats: Category[] = [];
    snap.forEach(d => {
      cats.push({ id: d.id, ...d.data() } as Category);
    });
    if (cats.length > 0) {
      cacheLocalCategories(cats);
      if (onRemoteUpdate) {
        onRemoteUpdate(cats);
      }
      return cats;
    }
    return initialCats;
  })();

  const fresh = await withTimeout(fetchPromise, 2200, initialCats);
  return fresh.length > 0 ? fresh : initialCats;
}
