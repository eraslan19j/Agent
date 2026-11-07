import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { Navigation } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { DiscoverScreen } from './components/DiscoverScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import type { InfoTopic } from './components/ProfileScreen';
import { PhotoEditor } from './components/PhotoEditor';
import { Paywall } from './components/Paywall';
import { InfoModal } from './components/InfoModal';
import { MyVisionLogo } from './components/MyVisionLogo';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { preparePhoto } from './lib/imageEngine';
import { loadPreviewPro, loadProjects, persistProjects, savePreviewPro } from './lib/storage';
import { hasNativePro, isNativeBillingAvailable, purchaseNativePlan, restoreNativePurchases } from './lib/billing';
import type { DiscoverPhoto } from './lib/discoverService';
import type { AppView, EditorSession, PhotoProject, PlanInterval } from './types';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [projects, setProjects] = useState<PhotoProject[]>(() => loadProjects());
  const [session, setSession] = useState<EditorSession | null>(null);
  const [isPro, setIsPro] = useState(() => loadPreviewPro());
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  const [importing, setImporting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'info' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, type });
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) void SplashScreen.hide();
    const splashTimer = window.setTimeout(() => setShowSplash(false), 1200);
    if (isNativeBillingAvailable()) {
      void hasNativePro().then(setIsPro).catch(() => undefined);
    }
    return () => {
      window.clearTimeout(splashTimer);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', () => {
      if (paywallOpen) setPaywallOpen(false);
      else if (infoTopic) setInfoTopic(null);
      else if (session) setSession(null);
      else if (view !== 'home') setView('home');
      else void CapacitorApp.exitApp();
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [paywallOpen, infoTopic, session, view]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!session) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [session]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('resume', () => {
      window.scrollTo(0, 0);
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, []);

  const openPicker = useCallback(() => fileInput.current?.click(), []);
  const openCamera = useCallback(() => cameraInput.current?.click(), []);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const source = await preparePhoto(file);
      setSession({ source, name: file.name.replace(/\.[^.]+$/, '') || 'Yeni vizyon' });
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Fotoğraf içe aktarılamadı.', 'info');
    } finally { setImporting(false); }
  };

  const openAutoEnhance = () => {
    const input = fileInput.current;
    if (!input) return;
    input.dataset.auto = 'true';
    input.click();
  };

  const handleFileInput = (file: File | undefined, input: HTMLInputElement) => {
    const auto = input.dataset.auto === 'true';
    input.dataset.auto = 'false';
    input.value = '';
    setImporting(true);
    void preparePhoto(file!).then((source) => {
      setSession({ source, name: file!.name.replace(/\.[^.]+$/, '') || 'Yeni vizyon', applyAutoEnhance: auto });
    }).catch((reason) => showToast(reason instanceof Error ? reason.message : 'Fotoğraf içe aktarılamadı.', 'info')).finally(() => setImporting(false));
  };

  const saveProject = async (draft: PhotoProject) => {
    const existing = projects.find((project) => project.id === draft.id);
    const saved: PhotoProject = {
      ...draft,
      id: existing?.id || crypto.randomUUID(),
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isSample: false,
    };
    const next = [saved, ...projects.filter((project) => project.id !== saved.id)];
    if (!persistProjects(next)) throw new Error('Cihaz depolama alanı doldu. Eski projeleri silip tekrar deneyin.');
    setProjects(next);
    return saved;
  };

  const deleteProject = (id: string) => {
    const next = projects.filter((project) => project.id !== id);
    if (persistProjects(next)) {
      setProjects(next);
      showToast('Proje cihazından silindi.', 'info');
    } else showToast('Proje silinemedi.', 'info');
  };

  const openProject = (project: PhotoProject) => {
    setSession({
      source: project.source,
      name: project.name,
      projectId: project.id,
      initialSettings: project.settings,
    });
  };

  const importDiscoverPhoto = async (photo: DiscoverPhoto): Promise<boolean> => {
    setImporting(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(photo.fullUrl, { signal: controller.signal });
      if (!response.ok) throw new Error('Fotoğraf indirilemedi.');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Geçerli bir görsel alınamadı.');
      const safeName = photo.author.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+/g, '-').slice(0, 40);
      const file = new File([blob], `Lorem-Picsum-${safeName}-${photo.id}.jpg`, { type: blob.type || 'image/jpeg' });
      const source = await preparePhoto(file);
      setSession({ source, name: `${photo.author} · Keşif` });
      return true;
    } catch {
      showToast('Fotoğraf stüdyoya aktarılamadı. Bağlantını kontrol edip yeniden dene.', 'info');
      return false;
    } finally { window.clearTimeout(timeout); setImporting(false); }
  };

  const purchase = async (interval: PlanInterval) => {
    if (isNativeBillingAvailable()) {
      const active = await purchaseNativePlan(interval);
      if (!active) throw new Error('Satın alma tamamlandı ancak Pro erişimi henüz doğrulanamadı. Satın alımları geri yüklemeyi deneyin.');
      setIsPro(true);
    } else {
      savePreviewPro(true);
      setIsPro(true);
    }
    setPaywallOpen(false);
    showToast(isNativeBillingAvailable() ? 'My Vision Pro’ya hoş geldin!' : 'Pro önizleme etkin. Tüm araçları deneyebilirsin.');
  };

  const restore = async () => {
    if (isNativeBillingAvailable()) {
      const active = await restoreNativePurchases();
      setIsPro(active);
      showToast(active ? 'Pro aboneliğin geri yüklendi.' : 'Bu hesapta aktif abonelik bulunamadı.', active ? 'success' : 'info');
      if (!active) throw new Error('Bu Google Play hesabında aktif abonelik bulunamadı.');
    } else {
      const active = loadPreviewPro();
      setIsPro(active);
      showToast(active ? 'Pro önizleme zaten etkin.' : 'Bu tarayıcıda etkin Pro önizleme bulunamadı.', 'info');
      if (!active) throw new Error('Bu tarayıcıda geri yüklenecek önizleme aboneliği yok.');
    }
  };

  return (
    <div className="app-shell">
      {showSplash && <div className="app-splash" role="status" aria-label="My Vision yükleniyor">
        <div className="splash-aura" aria-hidden="true" />
        <div className="splash-brand"><MyVisionLogo variant="wordmark" size={54} /></div>
        <span className="splash-caption">GÖRÜŞÜNÜ YARAT</span>
        <span className="splash-progress" aria-hidden="true"><i /></span>
      </div>}
      {!session && <Navigation view={view} onNavigate={setView} onCreate={openPicker} />}
      {!session && <main className="app-content">
        {view === 'home' && <HomeScreen projects={projects} isPro={isPro} onOpen={openProject} onCreate={openPicker} onCamera={openCamera} onAuto={openAutoEnhance} onPro={() => setPaywallOpen(true)} onProjects={() => setView('projects')} onDiscover={() => setView('discover')} />}
        {view === 'discover' && <DiscoverScreen isPro={isPro} onUsePhoto={importDiscoverPhoto} busy={importing} onPro={() => setPaywallOpen(true)} onNotifications={() => showToast('Karıştır düğmesi her dokunuşta yeni ve gerçek bir seçki getirir.', 'info')} />}
        {view === 'projects' && <ProjectsScreen projects={projects} isPro={isPro} onOpen={openProject} onCreate={openPicker} onDelete={deleteProject} onPro={() => setPaywallOpen(true)} onNotifications={() => showToast('Projelerin cihazında güvende.', 'info')} />}
        {view === 'profile' && <ProfileScreen projects={projects} isPro={isPro} onPro={() => setPaywallOpen(true)} onInfo={setInfoTopic} onNotifications={() => showToast('Bildirim tercihlerini profil ayarlarından yönetebilirsin.', 'info')} onRestore={() => { void restore().catch(() => undefined); }} />}
      </main>}
      {session && <PhotoEditor session={session} isPro={isPro} onClose={() => setSession(null)} onSave={saveProject} onRequirePro={() => setPaywallOpen(true)} onToast={showToast} />}

      <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && handleFileInput(event.target.files[0], event.target)} />
      <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void importFile(file); }} />

      {paywallOpen && <Paywall onClose={() => setPaywallOpen(false)} onPurchase={purchase} onRestore={restore} />}
      {infoTopic && <InfoModal topic={infoTopic} onClose={() => setInfoTopic(null)} />}
      {importing && <div className="importing-overlay glass-modal"><MyVisionLogo size={58} /><span><LoaderCircle className="spin" size={25} /></span><strong>Fotoğrafın hazırlanıyor</strong><small>Vizyonun birazdan başlıyor…</small></div>}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

