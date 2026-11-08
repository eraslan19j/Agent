import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { Navigation } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import type { InfoTopic } from './components/ProfileScreen';
import SettingsScreen from './components/SettingsScreen';
import { CollageStudio } from './components/CollageStudio';
import { BatchStudio } from './components/BatchStudio';
import { Onboarding } from './components/Onboarding';
import { PhotoEditor } from './components/PhotoEditor';
import { InfoModal } from './components/InfoModal';
import { MyVisionLogo } from './components/MyVisionLogo';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { preparePhoto } from './lib/imageEngine';
import { applyPreferences, loadPreferences, persistPreferences, watchSystemTheme, type AppPreferences } from './lib/preferences';
import { setLocalizationLanguage } from './lib/localization';
import { hasOnboarded, loadProjects, persistProjects, setOnboarded } from './lib/storage';
import type { AppView, EditorSession, PhotoProject } from './types';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [projects, setProjects] = useState<PhotoProject[]>(() => loadProjects());
  const [session, setSession] = useState<EditorSession | null>(null);
  const [studio, setStudio] = useState<'collage' | 'batch' | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasOnboarded());
  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  const [importing, setImporting] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importTaskRef = useRef<{ generation: number; controller: AbortController | null }>({ generation: 0, controller: null });

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

  useEffect(() => {
    const importTask = importTaskRef.current;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (Capacitor.isNativePlatform()) void SplashScreen.hide().catch(() => undefined);
    }));
    return () => {
      cancelAnimationFrame(frame);
      importTask.generation += 1;
      importTask.controller?.abort();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    persistPreferences(preferences);
    setLocalizationLanguage(preferences.language);
    const sync = () => { if (active) applyPreferences(preferences); };
    sync();
    const unwatch = watchSystemTheme(sync);
    return () => { active = false; unwatch(); };
  }, [preferences]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', () => {
      if (onboardingOpen) { setOnboarded(); setOnboardingOpen(false); }
      else if (infoTopic) setInfoTopic(null);
      else if (importing) cancelImport();
      else if (studio) setStudio(null);
      else if (session) setSession(null);
      else if (view === 'settings') setView('profile');
      else if (view !== 'home') setView('home');
      else void CapacitorApp.exitApp();
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [onboardingOpen, infoTopic, importing, studio, session, view, cancelImport]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!session && !importing && !studio) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [session, importing, studio]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('resume', () => window.scrollTo(0, 0));
    return () => { void listener.then((handle) => handle.remove()); };
  }, []);

  const openPicker = useCallback(() => fileInput.current?.click(), []);
  const openCamera = useCallback(() => cameraInput.current?.click(), []);

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
      setSession({ source, name: file.name.replace(/\.[^.]+$/, '') || 'Yeni proje', applyAutoEnhance: auto });
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
    setSession({ source: project.source, name: project.name, projectId: project.id, initialSettings: project.settings });
  };

  return (
    <div className="app-shell">
      {!session && view !== 'settings' && <Navigation view={view} onNavigate={setView} onCreate={openPicker} />}
      {!session && <main className={`app-content ${view === 'settings' ? 'app-content--settings' : ''}`}>
        {view === 'home' && <HomeScreen projects={projects} onOpen={openProject} onCreate={openPicker} onCamera={openCamera} onAuto={openAutoEnhance} onProjects={() => setView('projects')} onCollage={() => setStudio('collage')} onBatch={() => setStudio('batch')} />}
        {view === 'projects' && <ProjectsScreen projects={projects} onOpen={openProject} onCreate={openPicker} onDelete={deleteProject} onUpdate={updateProject} />}
        {view === 'profile' && <ProfileScreen projects={projects} onInfo={setInfoTopic} onSettings={() => setView('settings')} />}
        {view === 'settings' && <SettingsScreen preferences={preferences} onChange={setPreferences} onBack={() => setView('profile')} />}
      </main>}
      {session && <PhotoEditor session={session} onClose={() => setSession(null)} onSave={saveProject} onToast={showToast} />}

      <input ref={fileInput} className="visually-hidden" type="file" aria-label="Galeriden fotoğraf seç" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleFileInput(event.target.files?.[0], event.target)} />
      <input ref={cameraInput} className="visually-hidden" type="file" aria-label="Kamera ile fotoğraf çek" accept="image/*" capture="environment" onChange={(event) => handleFileInput(event.target.files?.[0], event.target)} />

      {onboardingOpen && <Onboarding onComplete={() => { setOnboarded(); setOnboardingOpen(false); }} />}
      {studio === 'collage' && <CollageStudio onClose={() => setStudio(null)} onToast={showToast} />}
      {studio === 'batch' && <BatchStudio onClose={() => setStudio(null)} onToast={showToast} />}
      {infoTopic && <InfoModal topic={infoTopic} onClose={() => setInfoTopic(null)} />}
      {importing && <div className="importing-overlay" role="dialog" aria-modal="true" aria-label="Fotoğraf hazırlanıyor"><MyVisionLogo size={58} /><span><LoaderCircle className="spin" size={25} /></span><strong>Fotoğrafın hazırlanıyor</strong><small>Büyük dosyalar cihazında güvenli boyuta getirilir.</small><button className="button button--outline import-cancel" onClick={cancelImport}>İptal</button></div>}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
