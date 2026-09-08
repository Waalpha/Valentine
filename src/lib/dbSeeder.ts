import { db, DEFAULT_BUSINESS_ID } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { BusinessConfig, Category, Product, BusinessDay, UserProfile } from '../types';

export async function initializeDatabase(currentUser?: { uid: string; email?: string; displayName?: string }) {
  try {
    // 1. Check/Create Business Config
    const bizRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID);
    const bizSnap = await getDoc(bizRef);
    if (!bizSnap.exists()) {
      const defaultBiz: BusinessConfig = {
        id: DEFAULT_BUSINESS_ID,
        name: "Savanna Lounge & Pub",
        phone: "+254 712 345 678",
        location: "Nairobi CBD",
        address: "Tom Mboya Street, Nairobi",
        currency: "KSh",
        openingTime: "10:00",
        closingTime: "23:59",
        lowStockThreshold: 10,
        receiptHeader: "SAVANNA LOUNGE & PUB\nOfficial Bar & Restaurant",
        receiptFooter: "Thank you! Please drink responsibly."
      };
      await setDoc(bizRef, defaultBiz);
    }

    // 2. Check/Create Categories
    const catColRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'categories');
    const catSnap = await getDocs(catColRef);
    if (catSnap.empty) {
      const defaultCategories: Category[] = [
        { id: 'cat-beer', name: 'Beer', description: 'Local & imported beers' },
        { id: 'cat-spirits', name: 'Spirits', description: 'Whiskies, vodkas, gins & rums' },
        { id: 'cat-soft', name: 'Soft Drinks', description: 'Sodas, juices & water' },
        { id: 'cat-cider', name: 'Ciders', description: 'Refreshing ciders' }
      ];
      for (const cat of defaultCategories) {
        await setDoc(doc(catColRef, cat.id), cat);
      }
    }

    // 3. Check/Create Products
    const prodColRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'products');
    const prodSnap = await getDocs(prodColRef);
    if (prodSnap.empty) {
      const defaultProducts: Product[] = [
        {
          id: 'prod-tusker',
          name: 'Tusker Lager (500ml)',
          categoryId: 'cat-beer',
          categoryName: 'Beer',
          unitType: 'Bottle',
          buyingPrice: 180,
          sellingPrice: 250,
          openingStock: 120,
          currentStock: 120,
          stockAdded: 0,
          minStockLevel: 15,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-whitecap',
          name: 'White Cap Lager',
          categoryId: 'cat-beer',
          categoryName: 'Beer',
          unitType: 'Bottle',
          buyingPrice: 180,
          sellingPrice: 250,
          openingStock: 80,
          currentStock: 80,
          stockAdded: 0,
          minStockLevel: 10,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-guinness',
          name: 'Guinness Stout',
          categoryId: 'cat-beer',
          categoryName: 'Beer',
          unitType: 'Bottle',
          buyingPrice: 220,
          sellingPrice: 300,
          openingStock: 60,
          currentStock: 60,
          stockAdded: 0,
          minStockLevel: 10,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-heineken',
          name: 'Heineken',
          categoryId: 'cat-beer',
          categoryName: 'Beer',
          unitType: 'Bottle',
          buyingPrice: 250,
          sellingPrice: 350,
          openingStock: 40,
          currentStock: 40,
          stockAdded: 0,
          minStockLevel: 8,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-smirnoff',
          name: 'Smirnoff Vodka (750ml)',
          categoryId: 'cat-spirits',
          categoryName: 'Spirits',
          unitType: 'Bottle',
          buyingPrice: 1200,
          sellingPrice: 1800,
          openingStock: 25,
          currentStock: 25,
          stockAdded: 0,
          minStockLevel: 5,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-chrome',
          name: 'Chrome Vodka (250ml)',
          categoryId: 'cat-spirits',
          categoryName: 'Spirits',
          unitType: 'Bottle',
          buyingPrice: 350,
          sellingPrice: 500,
          openingStock: 50,
          currentStock: 50,
          stockAdded: 0,
          minStockLevel: 10,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-jw-black',
          name: 'Johnnie Walker Black Label',
          categoryId: 'cat-spirits',
          categoryName: 'Spirits',
          unitType: 'Bottle',
          buyingPrice: 2800,
          sellingPrice: 4000,
          openingStock: 15,
          currentStock: 15,
          stockAdded: 0,
          minStockLevel: 3,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-coke',
          name: 'Coca Cola (Soda 300ml)',
          categoryId: 'cat-soft',
          categoryName: 'Soft Drinks',
          unitType: 'Bottle',
          buyingPrice: 60,
          sellingPrice: 100,
          openingStock: 100,
          currentStock: 100,
          stockAdded: 0,
          minStockLevel: 20,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'prod-water',
          name: 'Keringet Drinking Water (500ml)',
          categoryId: 'cat-soft',
          categoryName: 'Soft Drinks',
          unitType: 'Bottle',
          buyingPrice: 40,
          sellingPrice: 80,
          openingStock: 90,
          currentStock: 90,
          stockAdded: 0,
          minStockLevel: 20,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      for (const prod of defaultProducts) {
        await setDoc(doc(prodColRef, prod.id), prod);
      }
    }

    // 4. Check/Create Current Business Day
    const todayStr = new Date().toISOString().split('T')[0];
    const dayRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'businessDays', todayStr);
    const daySnap = await getDoc(dayRef);
    if (!daySnap.exists()) {
      const todayDay: BusinessDay = {
        id: todayStr,
        date: todayStr,
        openingTime: "10:00",
        closingTime: "23:59",
        openedBy: currentUser?.email || 'admin@barpos.com',
        status: 'open',
        createdAt: Date.now()
      };
      await setDoc(dayRef, todayDay);
    }

    // 5. Ensure current user profile exists in Firestore users collection
    if (currentUser && currentUser.uid) {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const email = currentUser.email || '';
        const role = email.includes('cashier') ? 'cashier' : 'admin';
        const profile: UserProfile = {
          uid: currentUser.uid,
          email: email,
          name: currentUser.displayName || (role === 'admin' ? 'Master Admin' : 'Lead Cashier'),
          role: role,
          businessId: DEFAULT_BUSINESS_ID,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, profile);
      }
    }

  } catch (err) {
    console.error("Error initializing database seed:", err);
  }
}
