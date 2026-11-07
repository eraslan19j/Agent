import { CheckCircle2, CloudOff, Mail, ShieldCheck } from 'lucide-react';
import type { InfoTopic } from './ProfileScreen';
import { Modal } from './Modal';

const titles: Record<InfoTopic, string> = {
  privacy: 'Gizlilik ve veriler',
  help: 'Yardım merkezi',
  about: 'My Vision hakkında',
  language: 'Dil tercihi',
  notifications: 'Bildirimler',
  credits: 'Fotoğraf kredileri',
};

export function InfoModal({ topic, onClose }: { topic: InfoTopic; onClose: () => void }) {
  return (
    <Modal title={titles[topic]} onClose={onClose} className="info-modal">
      {topic === 'privacy' && <div className="info-copy"><div className="info-hero-icon"><ShieldCheck size={28} /></div><h3>Fotoğrafların sana aittir.</h3><p>My Vision, seçtiğin fotoğrafları düzenlemek için cihazında işler. Orijinal fotoğrafların ve projelerin herhangi bir sunucuya yüklenmez.</p><ul><li><CloudOff size={17} /> Çevrimdışı fotoğraf işleme</li><li><CheckCircle2 size={17} /> Reklam takipçisi yok</li><li><CheckCircle2 size={17} /> Proje verilerini istediğin zaman silebilirsin</li></ul><p>Abonelik doğrulaması için Android’de RevenueCat ve Google Play, satın alma durumunu işler. Ayrıntılar için <a href="/privacy.html" target="_blank">Gizlilik Politikası</a> sayfasını incele.</p></div>}
      {topic === 'help' && <div className="info-copy"><div className="faq"><h3>Nasıl fotoğraf düzenlerim?</h3><p>Ana sayfadaki “Fotoğrafını dönüştür” düğmesine dokun, galerinden bir fotoğraf seç. Görünümler, Ayarlar ve Kırp sekmelerini kullan.</p><h3>Düzenlememi kaybeder miyim?</h3><p>Editörde “Kaydet” dediğinde projen cihazına kaydedilir. Orijinal dosyan değiştirilmez.</p><h3>Önce / sonra nasıl kullanılır?</h3><p>Editördeki karşılaştır simgesine dokun ve fotoğraf üzerindeki çizgiyi sürükle.</p><h3>Çıktı neden küçük?</h3><p>Dışa aktarma penceresinden 4K veya orijinal boyutu seçebilirsin. Çok büyük görseller cihaz belleğine göre sınırlandırılabilir.</p></div><a className="button button--outline" href="mailto:support@myvision.app"><Mail size={17} /> Destek ekibine yaz</a></div>}
      {topic === 'about' && <div className="info-copy"><div className="about-version"><strong>My Vision<span>.</span></strong><small>Sürüm 1.2.0 (3)</small></div><p>Görüşünü yarat. My Vision; fotoğrafçılar, içerik üreticileri ve hikâyesini görsellerle anlatmak isteyen herkes için tasarlanmış bağımsız bir mobil stüdyodur.</p><div className="legal-links"><a href="/privacy.html" target="_blank">Gizlilik politikası</a><a href="/terms.html" target="_blank">Kullanım koşulları</a></div><small>© 2026 My Vision. Tüm hakları saklıdır.</small></div>}
      {topic === 'language' && <div className="info-copy"><h3>Uygulama dili</h3><p>My Vision şu anda Türkçe olarak kullanılabilir. İngilizce dil desteği sonraki sürüm için hazırlanıyor.</p><button className="language-choice active">Türkçe <CheckCircle2 size={19} /></button><button className="language-choice" disabled>English <small>Yakında</small></button></div>}
      {topic === 'notifications' && <div className="info-copy"><h3>Yaratıcı ipuçları</h3><p>Bu önizleme sürümünde sistem bildirimi gönderilmez. Uygulama içi duyurular ana sayfada gösterilir.</p><p>Yeni görünüm paketleri ve düzenleme rehberleri hazır olduğunda buradan haber vereceğiz.</p></div>}
      {topic === 'credits' && <div className="info-copy"><p>Keşfet seçkisindeki fotoğraflar Lorem Picsum servisinden anlık olarak yüklenir. Her fotoğraf kartında fotoğrafçı adı ve kaynak bağlantısı gösterilir; uygulama sabit örnek proje içermez.</p><div className="credit-list"><a href="https://picsum.photos/" target="_blank" rel="noreferrer">Lorem Picsum · picsum.photos</a></div><p>Fotoğrafları kullanmadan önce kaynak sayfasındaki güncel kullanım koşullarını kontrol et. Arayüz simgeleri Lucide, yazı tipleri Manrope ve Instrument Serif açık kaynak projelerinden sağlanır.</p></div>}
    </Modal>
  );
}
