import { useState } from 'react';
import { ArrowRight, Check, ImagePlus, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { MyVisionLogo } from './MyVisionLogo';

const steps = [
  { icon: ImagePlus, eyebrow: 'KENDİ FOTOĞRAFIN', title: 'Bir fotoğrafla başla.', text: 'Galerinden seç veya yeni bir fotoğraf çek. Arşivinde yalnızca kendi kaydettiğin projeler görünür.' },
  { icon: SlidersHorizontal, eyebrow: 'CİHAZ İÇİ STÜDYO', title: 'Her ayar sende.', text: 'Kırp, renklendir, metin ekle ve kolaj oluştur. Geri al/yinele ve önce–sonra ile kontrolü kaybetme.' },
  { icon: ShieldCheck, eyebrow: 'GİZLİLİK ÖNCE', title: 'Fotoğraflar cihazında.', text: 'Düzenleme cihazında çalışır. Projeler IndexedDB içinde tutulur ve herhangi bir sunucuya gönderilmez.' },
];
export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0); const step = steps[index]; const Icon = step.icon;
  return <div className="onboarding-backdrop"><section className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><button className="onboarding-close" onClick={onComplete} aria-label="Tanıtımı kapat"><X size={19} /></button><MyVisionLogo size={58} /><div className="onboarding-icon"><Icon size={28} /></div><span className="eyebrow">{step.eyebrow}</span><h1 id="onboarding-title">{step.title}</h1><p>{step.text}</p><div className="onboarding-dots" aria-label={`${index + 1} / ${steps.length}`}>{steps.map((_, stepIndex) => <i key={stepIndex} className={stepIndex === index ? 'active' : ''} />)}</div><button className="button button--primary onboarding-next" onClick={() => index === steps.length - 1 ? onComplete() : setIndex(value => value + 1)}>{index === steps.length - 1 ? <Check size={18} /> : <ArrowRight size={18} />}{index === steps.length - 1 ? 'Stüdyoyu aç' : 'Devam'}</button>{index < steps.length - 1 && <button className="onboarding-skip" onClick={onComplete}>Tanıtımı geç</button>}</section></div>;
}
