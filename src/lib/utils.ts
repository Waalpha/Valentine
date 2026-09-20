import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { db, DEFAULT_BUSINESS_ID } from "./firebase";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { AuditLog } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if the app is currently running inside an iframe.
 */
export function isAppInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function formatCurrency(amount: number, currencyCode: string = 'KSh'): string {
  return `${currencyCode} ${amount.toLocaleString()}`;
}

/**
 * Recursively strips undefined keys and nested undefined properties
 * so Firestore setDoc/updateDoc never throws "Unsupported field value: undefined".
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

export async function logAuditAction(
  userId: string,
  userName: string,
  action: string,
  description: string,
  recordId?: string
) {
  const now = new Date();
  const logEntry: Omit<AuditLog, 'id'> = {
    userId,
    userName,
    action,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    recordId: recordId || '',
    description,
    createdAt: now.getTime()
  };

  try {
    const auditColRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'auditLogs');
    await addDoc(auditColRef, logEntry);
  } catch (err) {
    // Gracefully catch and store locally if permission denied or offline
    try {
      const localLogs = JSON.parse(localStorage.getItem('bar_pos_audit_logs') || '[]');
      localLogs.unshift({
        id: 'log-' + Date.now(),
        ...logEntry
      });
      localStorage.setItem('bar_pos_audit_logs', JSON.stringify(localLogs.slice(0, 100)));
    } catch (e) {}
  }
}
