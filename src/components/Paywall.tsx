import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ArrowRight, Check, Infinity as InfinityIcon, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { getNativePlans, isNativeBillingAvailable, type NativePlan } from '../lib/billing';
import type { PlanInterval } from '../types';
import { Modal } from './Modal';
import { MyVisionLogo } from './MyVisionLogo';

interface PaywallProps { onClose: () => void; onPurchase: (interval: PlanInterval) => Promise<void>; onRestore: () => Promise<void>; }
export function Paywall({ onClose, onPurchase, onRestore }: PaywallProps) {
  const [interval, setInterval] = useState<PlanInterval>('yearly'); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [plans, setPlans] = useState<NativePlan[]>([]); const [plansLoading, setPlansLoading] = useState(isNativeBillingAvailable());
  const native = isNativeBillingAvailable(); const android = Capacitor.getPlatform() === 'android';
  useEffect(() => {
    if (!native) return;
    let active = true;
    void getNativePlans().then(value => { if (active) setPlans(value); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Paketler yüklenemedi.'); }).finally(() => { if (active) setPlansLoading(false); });
    return () => { active = false; };
  }, [native]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'İşlem tamamlanamadı. Lütfen tekrar dene.'); }
    finally { setBusy(false); }
  };
  const plan = (key: PlanInterval) => plans.find(item => item.interval === key);
  const selected = plan(interval);
  return <Modal onClose={busy ? () => undefined : onClose} className="paywall-modal">
    <div className="paywall-visual paywall-brand-visual"><div className="paywall-visual__overlay" /><MyVisionLogo variant="wordmark" size={38} className="paywall-logo" /><div className="paywall-aperture" aria-hidden="true"><MyVisionLogo size={170} /></div><div><span className="eyebrow">YARATICILIĞIN TAM SÜRÜMÜ</span><h2>Vizyonun için<br /><em>her detay.</em></h2><p>Daha fazlasını yarat. Daha azına razı olma.</p></div></div>
    <div className="paywall-content"><div className="paywall-features"><div><span><Sparkles size={19} /></span><p><strong>Tüm imza görünümler</strong><small>Tüm premium filtrelere sınırsız erişim</small></p><Check size={17} /></div><div><span><WandSparkles size={19} /></span><p><strong>Gelişmiş düzenleme araçları</strong><small>Ton, doku, vinyet ve tüm oranlar</small></p><Check size={17} /></div><div><span><InfinityIcon size={19} /></span><p><strong>4K yüksek çözünürlüklü çıktı</strong><small>Tüm kırpma oranları ve maksimum kalite</small></p><Check size={17} /></div></div>
      <div className="plan-options">{(['yearly', 'monthly'] as PlanInterval[]).map(key => { const item = plan(key); return <button key={key} className={interval === key ? 'plan-card active' : 'plan-card'} onClick={() => setInterval(key)}><span className="plan-card__radio">{interval === key && <i />}</span><span><strong>{key === 'yearly' ? 'Yıllık' : 'Aylık'}</strong><small>{item?.trialDays ? `${item.trialDays} gün ücretsiz deneme` : key === 'yearly' ? 'Öne çıkan plan' : 'Esnek abonelik'}</small></span><span className="plan-card__price"><strong>{native ? item?.priceString ?? '—' : 'Google Play'}</strong><small>{native ? key === 'yearly' ? '/ yıl' : '/ ay' : 'fiyatı mağazada'}</small></span>{key === 'yearly' && <b className="plan-card__save">ÖNE ÇIKAN</b>}</button>; })}</div>
      {plansLoading && <p className="demo-disclosure"><LoaderCircle className="spin" size={13} /> Gerçek Google Play paketleri yükleniyor…</p>}
      <button className="button button--lime paywall-cta" disabled={busy || !native || plansLoading || !selected} onClick={() => run(() => onPurchase(interval))}>{busy ? <LoaderCircle className="spin" size={19} /> : <LockKeyhole size={18} />}{busy ? 'İşlem sürüyor…' : native ? selected?.trialDays ? `${selected.trialDays} gün ücretsiz başla` : `${selected?.priceString ?? ''} ile başla` : android ? 'Satın alma yapılandırılmadı' : 'Satın alma Android’de kullanılabilir'}<ArrowRight size={18} /></button>
      {!native && <p className="demo-disclosure">{android ? 'RevenueCat anahtarı ve gerçek Play ürünleri yapılandırılmadan satın alma başlatılmaz. Ürün kimlikleri geliştirici tarafından eklenmelidir.' : 'Bu web sürümünde ödeme alınmaz ve Pro satın alınmış gibi etkinleştirilmez. Satın alma Android’de gerçek Play ürünleriyle yapılır.'}</p>}
      {native && <p className="payment-copy"><ShieldCheck size={13} /> Fiyat ve deneme bilgisi gerçek Google Play paketinden okunur. Ödeme Google Play hesabından alınır.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="paywall-links"><button disabled={busy || !native} onClick={() => run(onRestore)}><RotateCcw size={13} /> Satın alımları geri yükle</button><span>·</span><a href="/terms.html" target="_blank" rel="noreferrer">Koşullar</a><span>·</span><a href="/privacy.html" target="_blank" rel="noreferrer">Gizlilik</a></div>
    </div>
  </Modal>;
}
