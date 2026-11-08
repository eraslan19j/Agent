import { Capacitor } from '@capacitor/core';
import { LOG_LEVEL, Purchases } from '@revenuecat/purchases-capacitor';
import type { PlanInterval } from '../types';

const entitlementId = import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID || 'My Vision Pro';
const apiKey = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as string | undefined;
const packageIds: Record<PlanInterval, string | undefined> = {
  monthly: import.meta.env.VITE_REVENUECAT_MONTHLY_PACKAGE_ID,
  yearly: import.meta.env.VITE_REVENUECAT_YEARLY_PACKAGE_ID,
};
let configured = false;
export interface NativePlan { interval: PlanInterval; priceString: string; trialDays: number | null; }

export const isNativeBillingAvailable = () => Capacitor.getPlatform() === 'android' && Boolean(apiKey);
export async function configureBilling() {
  if (!isNativeBillingAvailable() || configured) return;
  await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });
  await Purchases.configure({ apiKey: apiKey! });
  configured = true;
}
async function selectedPackage(interval: PlanInterval) {
  await configureBilling();
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) throw new Error('Abonelik paketleri şu anda kullanılamıyor. RevenueCat offering yapılandırmasını kontrol edin.');
  const packageType = interval === 'yearly' ? 'ANNUAL' : 'MONTHLY';
  const selected = current.availablePackages.find(item => item.identifier === packageIds[interval])
    ?? current.availablePackages.find(item => item.packageType === packageType)
    ?? current.availablePackages.find(item => item.identifier.includes(interval));
  if (!selected) throw new Error(`Seçilen ${interval} paketi bulunamadı. Play Console ve RevenueCat ürün kimliklerini kontrol edin.`);
  return selected;
}
export async function getNativePlans(): Promise<NativePlan[]> {
  return Promise.all((['yearly', 'monthly'] as PlanInterval[]).map(async interval => {
    const selected = await selectedPackage(interval);
    const freePhase = selected.product.defaultOption?.pricingPhases.find(phase => phase.price.amountMicros === 0 && phase.offerPaymentMode === 'FREE_TRIAL');
    const days = freePhase ? freePhase.billingPeriod.unit === 'DAY' ? freePhase.billingPeriod.value : freePhase.billingPeriod.unit === 'WEEK' ? freePhase.billingPeriod.value * 7 : null : null;
    return { interval, priceString: selected.product.priceString, trialDays: days };
  }));
}
export async function hasNativePro(): Promise<boolean> {
  if (!isNativeBillingAvailable()) return false;
  await configureBilling();
  const { customerInfo } = await Purchases.getCustomerInfo();
  return Boolean(customerInfo.entitlements.active[entitlementId]);
}
export async function purchaseNativePlan(interval: PlanInterval): Promise<boolean> {
  const selected = await selectedPackage(interval);
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: selected });
  return Boolean(customerInfo.entitlements.active[entitlementId]);
}
export async function restoreNativePurchases(): Promise<boolean> {
  await configureBilling();
  const { customerInfo } = await Purchases.restorePurchases();
  return Boolean(customerInfo.entitlements.active[entitlementId]);
}
export async function listenForProUpdates(callback: (active: boolean) => void): Promise<() => void> {
  if (!isNativeBillingAvailable()) return () => undefined;
  await configureBilling();
  const listener = await Purchases.addCustomerInfoUpdateListener(info => callback(Boolean(info.entitlements.active[entitlementId])));
  return () => { void Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listener }); };
}
