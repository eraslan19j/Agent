import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { Navigation } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { SharedPhotosScreen } from './components/SharedPhotosScreen';
import { ProfileScreen } from './components/ProfileScreen';
import type { InfoTopic } from './components/ProfileScreen';
import SettingsScreen from './components/SettingsScreen';
import { CollageStudio } from './components/CollageStudio';
import { BatchStudio } from './components/BatchStudio';
import { Onboarding } from './components/Onboarding';
import { PhotoEditor } from './components/PhotoEditor';
import { VideoEditor } from './components/VideoEditor';
import { InfoModal } from './components/InfoModal';
import { MyVisionLogo } from './components/MyVisionLogo';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { preparePhotoAsset, releasePreparedPhoto } from './lib/imageEngine';
import { applyPreferences, loadPreferences, persistPreferences, watchSystemTheme, type AppPreferences } from './lib/preferences';
import { setLocalizationLanguage } from './lib/localization';
import { uploadSharedPhoto } from './lib/sharedPhotos';
import { deleteStoredProject, hasOnboarded, initializeStorage, releaseProjectUrls, saveStoredProject, setOnboarded, updateStoredProject } from './lib/storage';
import type { AppView, EditorSession, PhotoProject } from './types';

export default function App() {
  const [view, setView] = useState<AppView>(() => window.location.pathname.startsWith('/share/') ? 'shared' : 'home');
  const [projects, setProjects] = useState<PhotoProject[]>([]);
  const projectsRef = useRef<PhotoProject[]>([]);
  const sessionRef = useRef<EditorSession | null>(null);
  const [storageStatus, setStorageStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [session, setSession] = useState<EditorSession | null>(null);
  const [studio, setStudio] = useState<'collage' | 'batch' | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasOnboarded());
  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  const [importing, setImporting] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importTaskRef = useRef<{ generation: number; controller: AbortController | null }>({ generation: 0, controller: null });

  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const showToast = useCallback((text: string, type: 'success' | 'info' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, type });
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    let active = true;
    void initializeStorage().then(result => {
      if (!active) return;
      setProjects(result.projects);
      setStorageStatus('ready');
      if (result.migratedCount > 0) showToast(`${result.migratedCount} proje güvenli biçimde yeni yerel depolamaya taşındı.`);
      if (result.warning) showToast(result.warning, 'info');
    }).catch(() => { if (active) setStorageStatus('error'); });
    return () => { active = false; };
  }, [showToast]);

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

  const closeEditor = useCallback(() => {
    if (session?.ownsSource) {
      releasePreparedPhoto({
        source: session.source,
        previewSource: session.previewSource ?? session.source,
        width: session.width ?? 0,
        height: session.height ?? 0,
      });
    }
    setSession(null);
  }, [session]);

  useEffect(() => () => {
    releaseProjectUrls(projectsRef.current);
    const activeSession = sessionRef.current;
    if (activeSession?.ownsSource) {
      releasePreparedPhoto({
        source: activeSession.source,
        previewSource: activeSession.previewSource ?? activeSession.source,
        width: activeSession.width ?? 0,
        height: activeSession.height ?? 0,
      });
    }
  }, []);

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
      else if (session) { /* PhotoEditor owns the dirty-close confirmation flow. */ }
      else if (videoOpen) { /* VideoEditor owns the dirty-close confirmation flow. */ }
      else if (view === 'settings') setView('profile');
      else if (view !== 'home') setView('home');
      else void CapacitorApp.exitApp();
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [onboardingOpen, infoTopic, importing, studio, session, videoOpen, view, cancelImport]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!session && !importing && !studio && !videoOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [session, importing, studio, videoOpen]);

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

  const importPhoto = (file: File, auto = false) => {
    const task = beginImport();
    void preparePhotoAsset(file).then((prepared) => {
      if (task.controller.signal.aborted || importTaskRef.current.generation !== task.id) {
        releasePreparedPhoto(prepared);
        return;
      }
      setSession({ ...prepared, name: file.name.replace(/\.[^.]+$/, '') || 'Yeni proje', applyAutoEnhance: auto, ownsSource: true });
    }).catch((reason) => {
      if (!task.controller.signal.aborted && importTaskRef.current.generation === task.id) {
        showToast(reason instanceof Error ? reason.message : 'Fotoğraf içe aktarılamadı.', 'info');
      }
    }).finally(() => finishImport(task));
  };

  const handleFileInput = (file: File | undefined, input: HTMLInputElement) => {
    const auto = input.dataset.auto === 'true';
    input.dataset.auto = 'false'; input.value = '';
    if (file) importPhoto(file, auto);
  };

  const publishPhoto = async (blob: Blob, name: string) => {
    const extension = blob.type === 'image/png' ? 'png' : 'jpg';
    await uploadSharedPhoto(new File([blob], `${name.slice(0, 60)}.${extension}`, { type: blob.type }), 'My Vision ile düzenlendi');
    setView('shared'); showToast('Düzenlenen fotoğraf paylaşım alanına yüklendi.');
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
    let persisted: PhotoProject;
    try { persisted = await saveStoredProject(saved); }
    catch { throw new Error('Proje kaydedilemedi. Cihaz depolama alanını kontrol edip tekrar deneyin.'); }
    setProjects(current => [persisted, ...current.filter((project) => project.id !== persisted.id)]);
    return persisted;
  };

  const deleteProject = (id: string) => {
    void deleteStoredProject(id).then(() => {
      const removed = projects.find(project => project.id === id);
      if (removed) releaseProjectUrls([removed]);
      setProjects(current => current.filter((project) => project.id !== id));
      showToast('Proje cihazından silindi.', 'info');
    }).catch(reason => showToast(reason instanceof Error ? reason.message : 'Proje silinemedi.', 'info'));
  };

  const updateProject = (id: string, patch: Partial<PhotoProject>) => {
    const updatedAt = Date.now();
    void updateStoredProject(id, { ...patch, updatedAt }).then(() => {
      setProjects(current => current.map(project => project.id === id ? { ...project, ...patch, updatedAt } : project));
    }).catch(reason => showToast(reason instanceof Error ? reason.message : 'Proje bilgileri kaydedilemedi.', 'info'));
  };

  const openProject = (project: PhotoProject) => {
    setSession({ source: project.source, previewSource: project.previewSource, width: project.width, height: project.height, name: project.name, projectId: project.id, initialSettings: project.settings });
  };

  if (storageStatus !== 'ready') {
    return <main className="storage-gate" aria-live="polite"><MyVisionLogo size={64} />{storageStatus === 'loading' ? <><LoaderCircle className="spin" size={24} /><h1>Projelerin hazırlanıyor</h1><p>Yerel çalışmaların doğrulanıyor.</p></> : <><h1>Projeler açılamadı</h1><p>Eski verilerin silinmedi. Tarayıcı depolama iznini kontrol edip tekrar dene.</p><button className="button button--primary" onClick={() => window.location.reload()}>Tekrar dene</button></>}</main>;
  }

  return (
    <div className="app-shell">
      {!session && !videoOpen && !studio && view !== 'settings' && <Navigation view={view} onNavigate={setView} onCreate={openPicker} />}
      {!session && !videoOpen && !studio && <main className={`app-content ${view === 'settings' ? 'app-content--settings' : ''}`}>
        {view === 'home' && <HomeScreen projects={projects} onOpen={openProject} onCreate={openPicker} onCamera={openCamera} onAuto={openAutoEnhance} onProjects={() => setView('projects')} onCollage={() => setStudio('collage')} onBatch={() => setStudio('batch')} onVideo={() => setVideoOpen(true)} onShared={() => setView('shared')} />}
        {view === 'shared' && <SharedPhotosScreen onEdit={file => importPhoto(file)} onToast={showToast} />}
        {view === 'projects' && <ProjectsScreen projects={projects} onOpen={openProject} onCreate={openPicker} onDelete={deleteProject} onUpdate={updateProject} />}
        {view === 'profile' && <ProfileScreen projects={projects} onInfo={setInfoTopic} onSettings={() => setView('settings')} />}
        {view === 'settings' && <SettingsScreen preferences={preferences} onChange={setPreferences} onBack={() => setView('profile')} />}
      </main>}
      {session && <PhotoEditor session={session} onClose={closeEditor} onSave={saveProject} onPublish={publishPhoto} onToast={showToast} />}
      {videoOpen && <VideoEditor onClose={() => setVideoOpen(false)} onToast={showToast} />}

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
