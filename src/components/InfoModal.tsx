import { CheckCircle2, CloudOff, ShieldCheck } from 'lucide-react';
import type { InfoTopic } from './ProfileScreen';
import { Modal } from './Modal';

const titles: Record<InfoTopic, string> = {
  privacy: 'Gizlilik ve veriler',
  help: 'Yardım merkezi',
  about: 'My Vision hakkında',
  language: 'Dil tercihi',
  credits: 'Açık kaynak notları',
};

export function InfoModal({ topic, onClose }: { topic: InfoTopic; onClose: () => void }) {
  return (
    <Modal title={titles[topic]} onClose={onClose} className="info-modal">
      {topic === 'privacy' && <div className="info-copy"><div className="info-hero-icon"><ShieldCheck size={28} /></div><h3>Fotoğrafların sana aittir.</h3><p>My Vision, seçtiğin fotoğrafları düzenlemek için cihazında işler. Orijinal fotoğrafların ve projelerin herhangi bir sunucuya yüklenmez.</p><ul><li><CloudOff size={17} /> Çevrimdışı fotoğraf işleme</li><li><CheckCircle2 size={17} /> Reklam takipçisi yok</li><li><CheckCircle2 size={17} /> Proje verilerini istediğin zaman silebilirsin</li></ul><p>Ayrıntılar için <a href="/privacy.html" target="_blank">Gizlilik Politikası</a> sayfasını incele.</p></div>}
      {topic === 'help' && <div className="info-copy"><div className="faq"><h3>Nasıl fotoğraf düzenlerim?</h3><p>Ana sayfadan galerinden bir fotoğraf seç. Görünümler, Ayarlar, Kırp, Renk ve Metin sekmelerini kullan.</p><h3>Düzenlememi kaybeder miyim?</h3><p>Editörde “Kaydet” dediğinde projen cihazındaki IndexedDB alanına kaydedilir. Orijinal dosyan değiştirilmez.</p><h3>Metni nasıl değiştiririm?</h3><p>Metin sekmesinde listeden bir katman seç. İçeriğini, yazı tipini, boyutunu, rengini ve hizasını değiştirebilir; fotoğraf üzerinde sürükleyebilirsin.</p><h3>Önce / sonra nasıl kullanılır?</h3><p>Editördeki karşılaştır simgesine dokun ve fotoğraf üzerindeki çizgiyi sürükle.</p></div></div>}
      {topic === 'about' && <div className="info-copy"><div className="about-version"><strong>My Vision<span>.</span></strong><small>Sürüm 1.4.0 (5)</small></div><p>My Vision, fotoğraflarını cihazında düzenlemek için sade ve ücretsiz bir mobil stüdyodur.</p><div className="legal-links"><a href="/privacy.html" target="_blank">Gizlilik politikası</a><a href="/terms.html" target="_blank">Kullanım koşulları</a></div><small>© 2026 My Vision. Tüm hakları saklıdır.</small></div>}
      {topic === 'language' && <div className="info-copy"><h3>Uygulama dili</h3><p>Türkçe ve English arasında geçiş yapmak için Profil → Görünüm ve uygulama → Dil / Language bölümünü aç.</p><div className="language-choice active">Türkçe / English <CheckCircle2 size={19} /></div></div>}
      {topic === 'credits' && <div className="info-copy"><p>Uygulama simgeleri Lucide açık kaynak projesinden sağlanır. Görüntü işleme tarayıcının Canvas ve Web Worker API’leriyle cihazda gerçekleştirilir. Teknik video doğrulamasında FFmpeg.wasm kullanılır; Aşama 1’de video düzenleme arayüzü bulunmaz.</p></div>}
    </Modal>
  );
}
