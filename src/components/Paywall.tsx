import { useState } from 'react';
import { ArrowRight, Check, Infinity as InfinityIcon, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { isNativeBillingAvailable } from '../lib/billing';
import type { PlanInterval } from '../types';
import { Modal } from './Modal';
import { MyVisionLogo } from './MyVisionLogo';

interface PaywallProps {
  onClose: () => void;
  onPurchase: (interval: PlanInterval) => Promise<void>;
  onRestore: () => Promise<void>;
}

export function Paywall({ onClose, onPurchase, onRestore }: PaywallProps) {
  const [interval, setInterval] = useState<PlanInterval>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const native = isNativeBillingAvailable();

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'İşlem tamamlanamadı. Lütfen tekrar dene.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={busy ? () => undefined : onClose} className="paywall-modal">
      <div className="paywall-visual paywall-brand-visual">
        <div className="paywall-visual__overlay" />
        <MyVisionLogo variant="wordmark" size={38} className="paywall-logo" />
        <div className="paywall-aperture" aria-hidden="true"><MyVisionLogo size={170} /></div>
        <div><span className="eyebrow">YARATICILIĞIN TAM SÜRÜMÜ</span><h2>Vizyonun için<br /><em>her detay.</em></h2><p>Daha fazlasını yarat. Daha azına razı olma.</p></div>
      </div>
      <div className="paywall-content">
        <div className="paywall-features">
          <div><span><Sparkles size={19} /></span><p><strong>Tüm imza görünümler</strong><small>Tüm premium filtrelere sınırsız erişim</small></p><Check size={17} /></div>
          <div><span><WandSparkles size={19} /></span><p><strong>Gelişmiş düzenleme araçları</strong><small>Ton, doku, vinyet ve tüm oranlar</small></p><Check size={17} /></div>
          <div><span><InfinityIcon size={19} /></span><p><strong>4K yüksek çözünürlüklü çıktı</strong><small>Tüm kırpma oranları ve maksimum kalite</small></p><Check size={17} /></div>
        </div>
        <div className="plan-options">
          <button className={interval === 'yearly' ? 'plan-card active' : 'plan-card'} onClick={() => setInterval('yearly')}>
            <span className="plan-card__radio">{interval === 'yearly' && <i />}</span><span><strong>Yıllık</strong><small>7 gün ücretsiz dene</small></span><span className="plan-card__price"><strong>₺899,99</strong><small>/ yıl</small></span><b className="plan-card__save">%50 TASARRUF</b>
          </button>
          <button className={interval === 'monthly' ? 'plan-card active' : 'plan-card'} onClick={() => setInterval('monthly')}>
            <span className="plan-card__radio">{interval === 'monthly' && <i />}</span><span><strong>Aylık</strong><small>Esnek abonelik</small></span><span className="plan-card__price"><strong>₺149,99</strong><small>/ ay</small></span>
          </button>
        </div>
        <button className="button button--lime paywall-cta" disabled={busy} onClick={() => run(() => onPurchase(interval))}>{busy ? <LoaderCircle className="spin" size={19} /> : <LockKeyhole size={18} />}{busy ? 'İşlem sürüyor…' : native ? (interval === 'yearly' ? '7 gün ücretsiz başla' : 'Aylık aboneliği başlat') : 'Pro önizlemeyi etkinleştir'}<ArrowRight size={18} /></button>
        {!native && <p className="demo-disclosure">Web önizlemesidir; ödeme alınmaz. Google Play satın alımı Android sürümünde RevenueCat yapılandırmasıyla çalışır.</p>}
        {native && <p className="payment-copy"><ShieldCheck size={13} /> Ödeme Google Play hesabından güvenle alınır. İstediğin zaman iptal et.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="paywall-links"><button disabled={busy} onClick={() => run(onRestore)}><RotateCcw size={13} /> Satın alımları geri yükle</button><span>·</span><a href="/terms.html" target="_blank">Koşullar</a><span>·</span><a href="/privacy.html" target="_blank">Gizlilik</a></div>
      </div>
    </Modal>
  );
}
