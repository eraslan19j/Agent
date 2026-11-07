import { Capacitor } from '@capacitor/core';
import { LOG_LEVEL, Purchases } from '@revenuecat/purchases-capacitor';
import type { PlanInterval } from '../types';

const entitlementId = import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID || 'My Vision Pro';
const apiKey = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as string | undefined;
let configured = false;

export const isNativeBillingAvailable = () => Capacitor.getPlatform() === 'android' && Boolean(apiKey);

export async function configureBilling() {
  if (!isNativeBillingAvailable() || configured) return;
  await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });
  await Purchases.configure({ apiKey: apiKey! });
  configured = true;
}

export async function hasNativePro(): Promise<boolean> {
  if (!isNativeBillingAvailable()) return false;
  await configureBilling();
  const { customerInfo } = await Purchases.getCustomerInfo();
  return Boolean(customerInfo.entitlements.active[entitlementId]);
}

export async function purchaseNativePlan(interval: PlanInterval): Promise<boolean> {
  await configureBilling();
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) throw new Error('Abonelik paketleri şu anda kullanılamıyor.');
  const packageType = interval === 'yearly' ? 'ANNUAL' : 'MONTHLY';
  const selected = current.availablePackages.find((item) => item.packageType === packageType) ?? current.availablePackages.find((item) => item.identifier.includes(interval));
  if (!selected) throw new Error('Seçilen abonelik paketi bulunamadı.');
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: selected });
  return Boolean(customerInfo.entitlements.active[entitlementId]);
}

export async function restoreNativePurchases(): Promise<boolean> {
  await configureBilling();
  const { customerInfo } = await Purchases.restorePurchases();
  return Boolean(customerInfo.entitlements.active[entitlementId]);
}
