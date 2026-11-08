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
import SettingsScreen from './components/SettingsScreen';
import { CollageStudio } from './components/CollageStudio';
import { BatchStudio } from './components/BatchStudio';
import { Onboarding } from './components/Onboarding';
import { PhotoEditor } from './components/PhotoEditor';
import { Paywall } from './components/Paywall';
import { InfoModal } from './components/InfoModal';
import { MyVisionLogo } from './components/MyVisionLogo';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { preparePhoto } from './lib/imageEngine';
import { applyPreferences, getDynamicAccent, loadPreferences, persistPreferences, watchSystemTheme, type AppPreferences } from './lib/preferences';
import { setLocalizationLanguage } from './lib/localization';
import { hasOnboarded, loadProjects, persistProjects, setOnboarded } from './lib/storage';
import { hasNativePro, isNativeBillingAvailable, listenForProUpdates, purchaseNativePlan, restoreNativePurchases } from './lib/billing';
import type { DiscoverPhoto } from './lib/discoverService';
import type { AppView, EditorSession, PhotoProject, PlanInterval } from './types';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [projects, setProjects] = useState<PhotoProject[]>(() => loadProjects());
  const [session, setSession] = useState<EditorSession | null>(null);
  const [studio, setStudio] = useState<'collage' | 'batch' | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasOnboarded());
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  const [importing, setImporting] = useState(false);
  const [discoverOverlayOpen, setDiscoverOverlayOpen] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [showSplash, setShowSplash] = useState(() => loadPreferences().splashAnimation);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importTaskRef = useRef<{ generation: number; controller: AbortController | null }>({ generation: 0, controller: null });
  const discoverCloseHandler = useRef<(() => void) | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'info' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, type });
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const cancelImport = useCallback(() => {
    importTaskRef.current.generation += 1;
    importTaskRef.current.controller?.abort();
    importTaskRef.current.controller = null;
    setImporting(false);
  }, []);

  const beginImport = () => {
    importTaskRef.current.generation += 1;
    const task = { id: importTaskRef.current.generation, controller: new AbortController() };
    importTaskRef.current.controller = task.controller;
    setImporting(true);
    return task;
  };

  const finishImport = (task: { id: number; controller: AbortController }) => {
    if (importTaskRef.current.generation !== task.id) return;
    importTaskRef.current.controller = null;
    setImporting(false);
  };

  const registerDiscoverClose = useCallback((handler: (() => void) | null) => {
    discoverCloseHandler.current = handler;
  }, []);

  useEffect(() => {
    const importTask = importTaskRef.current;
    const animationEnabled = loadPreferences().splashAnimation;
    let splashTimer = 0;
    let cancelled = false;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return;
      if (Capacitor.isNativePlatform()) void SplashScreen.hide().catch(() => undefined);
      if (animationEnabled) splashTimer = window.setTimeout(() => setShowSplash(false), 360);
    }));
    let removeBillingListener: () => void = () => undefined;
    if (isNativeBillingAvailable()) {
      void hasNativePro().then(setIsPro).catch(() => undefined);
      void listenForProUpdates(setIsPro).then(remove => { if (!cancelled) removeBillingListener = remove; else remove(); }).catch(() => undefined);
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(splashTimer);
      importTask.generation += 1;
      importTask.controller?.abort();
      removeBillingListener();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    persistPreferences(preferences);
    setLocalizationLanguage(preferences.language);
    const sync = () => {
      if (!active) return;
      applyPreferences(preferences);
      if (preferences.accent === 'dynamic') {
        void getDynamicAccent().then((color) => { if (active) applyPreferences(preferences, color); });
      }
    };
    sync();
    const unwatch = watchSystemTheme(sync);
    return () => { active = false; unwatch(); };
  }, [preferences]);

  const updatePreferences = (next: AppPreferences) => setPreferences(next);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', () => {
      if (showSplash) setShowSplash(false);
      else if (onboardingOpen) { setOnboarded(); setOnboardingOpen(false); }
      else if (paywallOpen) setPaywallOpen(false);
      else if (infoTopic) setInfoTopic(null);
      else if (discoverOverlayOpen) discoverCloseHandler.current?.();
      else if (importing) cancelImport();
      else if (studio) setStudio(null);
      else if (session) setSession(null);
      else if (view === 'settings') setView('profile');
      else if (view !== 'home') setView('home');
      else void CapacitorApp.exitApp();
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [showSplash, onboardingOpen, paywallOpen, infoTopic, discoverOverlayOpen, importing, studio, session, view, cancelImport]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!session && !discoverOverlayOpen && !importing && !studio) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [session, discoverOverlayOpen, importing, studio]);

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
    const task = beginImport();
    try {
      const source = await preparePhoto(file);
      if (task.controller.signal.aborted || importTaskRef.current.generation !== task.id) return;
      setSession({ source, name: file.name.replace(/\.[^.]+$/, '') || 'Yeni vizyon' });
    } catch (reason) {
      if (!task.controller.signal.aborted && importTaskRef.current.generation === task.id) {
        showToast(reason instanceof Error ? reason.message : 'Fotoğraf içe aktarılamadı.', 'info');
      }
    } finally { finishImport(task); }
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
    if (!file) return;
    const task = beginImport();
    void preparePhoto(file).then((source) => {
      if (task.controller.signal.aborted || importTaskRef.current.generation !== task.id) return;
      setSession({ source, name: file.name.replace(/\.[^.]+$/, '') || 'Yeni vizyon', applyAutoEnhance: auto });
    }).catch((reason) => {
      if (!task.controller.signal.aborted && importTaskRef.current.generation === task.id) {
        showToast(reason instanceof Error ? reason.message : 'Fotoğraf içe aktarılamadı.', 'info');
      }
    }).finally(() => finishImport(task));
  };

  const saveProject = async (draft: PhotoProject) => {
    const existing = projects.find((project) => project.id === draft.id);
    const saved: PhotoProject = {
      ...draft,
      id: existing?.id || crypto.randomUUID(),
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      favorite: existing?.favorite,
      album: existing?.album,
      tags: existing?.tags,
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

  const updateProject = (id: string, patch: Partial<PhotoProject>) => {
    const next = projects.map(project => project.id === id ? { ...project, ...patch, updatedAt: Date.now() } : project);
    if (persistProjects(next)) setProjects(next);
    else showToast('Proje bilgileri kaydedilemedi; depolama alanını kontrol et.', 'info');
  };

  const openProject = (project: PhotoProject) => {
    setSession({
      source: project.source,
      name: project.name,
      projectId: project.id,
      initialSettings: project.settings,
    });
  };

  const importDiscoverPhoto = async (photo: DiscoverPhoto): Promise<void> => {
    const task = beginImport();
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; task.controller.abort(); }, 20000);
    try {
      const response = await fetch(photo.fullUrl, { signal: task.controller.signal });
      if (!response.ok) throw new Error('Fotoğraf servisi yanıt vermedi. Bağlantını kontrol et.');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Servis geçerli bir görsel döndürmedi.');
      const safeName = photo.author.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+/g, '-').slice(0, 40);
      const file = new File([blob], `Lorem-Picsum-${safeName}-${photo.id}.jpg`, { type: blob.type || 'image/jpeg' });
      const source = await preparePhoto(file);
      if (task.controller.signal.aborted || importTaskRef.current.generation !== task.id) throw new DOMException('İçe aktarma iptal edildi.', 'AbortError');
      setSession({ source, name: `${photo.author} · Keşif` });
    } catch (reason) {
      if (timedOut) throw new Error('Fotoğraf 20 saniyede indirilemedi. Bağlantını kontrol edip tekrar dene.', { cause: reason });
      if (task.controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        throw new DOMException('İçe aktarma iptal edildi.', 'AbortError');
      }
      throw new Error(reason instanceof Error ? reason.message : 'Fotoğraf stüdyoya aktarılamadı. Tekrar dene.', { cause: reason });
    } finally { window.clearTimeout(timeout); finishImport(task); }
  };

  const purchase = async (interval: PlanInterval) => {
    if (!isNativeBillingAvailable()) throw new Error('Satın alma yalnızca yapılandırılmış Android ve Google Play sürümünde kullanılabilir.');
    const active = await purchaseNativePlan(interval);
    if (!active) throw new Error('Satın alma tamamlandı ancak Pro erişimi henüz doğrulanamadı. Satın alımları geri yüklemeyi deneyin.');
    setIsPro(true);
    setPaywallOpen(false);
    showToast('My Vision Pro’ya hoş geldin!');
  };

  const restore = async () => {
    if (!isNativeBillingAvailable()) throw new Error('Geri yükleme yalnızca yapılandırılmış Android ve Google Play sürümünde kullanılabilir.');
    const active = await restoreNativePurchases();
    setIsPro(active);
    if (!active) throw new Error('Bu Google Play hesabında aktif abonelik bulunamadı.');
    showToast('Pro aboneliğin geri yüklendi.');
    setPaywallOpen(false);
  };

  return (
    <div className="app-shell">
      {showSplash && <button type="button" className="app-splash" onClick={() => setShowSplash(false)} aria-label="Açılışı geç">
        <div className="splash-aura" aria-hidden="true" />
        <div className="splash-brand"><MyVisionLogo variant="symbol" size={78} /><span className="splash-word">My Vision<span>.</span></span></div>
        <span className="splash-caption">GÖRÜŞÜNÜ YARAT</span>
        <span className="splash-progress" aria-hidden="true"><i /></span>
      </button>}
      {!session && view !== 'settings' && <Navigation view={view} onNavigate={setView} onCreate={openPicker} />}
      {!session && <main className={`app-content ${view === 'settings' ? 'app-content--settings' : ''}`}>
        {view === 'home' && <HomeScreen projects={projects} isPro={isPro} onOpen={openProject} onCreate={openPicker} onCamera={openCamera} onAuto={openAutoEnhance} onPro={() => setPaywallOpen(true)} onProjects={() => setView('projects')} onDiscover={() => setView('discover')} onCollage={() => setStudio('collage')} onBatch={() => setStudio('batch')} />}
        {view === 'discover' && <DiscoverScreen isPro={isPro} onUsePhoto={importDiscoverPhoto} onCancelImport={cancelImport} onOverlayChange={setDiscoverOverlayOpen} registerCloseHandler={registerDiscoverClose} busy={importing} onPro={() => setPaywallOpen(true)} onNotifications={() => showToast('Karıştır düğmesi her dokunuşta yeni ve gerçek bir seçki getirir.', 'info')} />}
        {view === 'projects' && <ProjectsScreen projects={projects} isPro={isPro} onOpen={openProject} onCreate={openPicker} onDelete={deleteProject} onUpdate={updateProject} onPro={() => setPaywallOpen(true)} onNotifications={() => showToast('Projelerin cihazında güvende.', 'info')} />}
        {view === 'profile' && <ProfileScreen projects={projects} isPro={isPro} onPro={() => setPaywallOpen(true)} onInfo={setInfoTopic} onNotifications={() => showToast('Bildirim tercihlerini profil ayarlarından yönetebilirsin.', 'info')} onRestore={() => { void restore().catch(() => undefined); }} onSettings={() => setView('settings')} />}
        {view === 'settings' && <SettingsScreen preferences={preferences} onChange={updatePreferences} onBack={() => setView('profile')} />}
      </main>}
      {session && <PhotoEditor session={session} isPro={isPro} onClose={() => setSession(null)} onSave={saveProject} onRequirePro={() => setPaywallOpen(true)} onToast={showToast} />}

      <input ref={fileInput} className="visually-hidden" type="file" aria-label="Galeriden fotoğraf seç" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && handleFileInput(event.target.files[0], event.target)} />
      <input ref={cameraInput} className="visually-hidden" type="file" aria-label="Kamera ile fotoğraf çek" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void importFile(file); }} />

      {onboardingOpen && <Onboarding onComplete={() => { setOnboarded(); setOnboardingOpen(false); }} />}
      {studio === 'collage' && <CollageStudio onClose={() => setStudio(null)} onToast={showToast} />}
      {studio === 'batch' && <BatchStudio isPro={isPro} onClose={() => setStudio(null)} onToast={showToast} />}
      {paywallOpen && <Paywall onClose={() => setPaywallOpen(false)} onPurchase={purchase} onRestore={restore} />}
      {infoTopic && <InfoModal topic={infoTopic} onClose={() => setInfoTopic(null)} />}
      {importing && <div className="importing-overlay glass-modal" role="dialog" aria-modal="true" aria-label="Fotoğraf hazırlanıyor"><MyVisionLogo size={58} /><span><LoaderCircle className="spin" size={25} /></span><strong>Fotoğrafın hazırlanıyor</strong><small>Vizyonun birazdan başlıyor…</small><button className="button button--outline import-cancel" onClick={cancelImport}>İptal</button></div>}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

