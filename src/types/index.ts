export type AppView = 'home' | 'discover' | 'projects' | 'profile' | 'settings';
export type EditorTab = 'looks' | 'adjust' | 'crop';
export type AspectRatio = 'original' | '1:1' | '4:5' | '3:4' | '16:9';
export type ExportFormat = 'jpeg' | 'png';
export type PlanInterval = 'monthly' | 'yearly';

export interface Tone {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  grayscale: number;
  hueRotate: number;
}

export interface PhotoPreset {
  id: string;
  name: string;
  category: 'Portre' | 'Sinema' | 'Seyahat' | 'Siyah Beyaz';
  pro: boolean;
  tone: Tone;
  accent: string;
}

export interface EditSettings {
  presetId: string;
  intensity: number;
  exposure: number;
  brightness: number;
  contrast: number;
  saturation: number;
  clarity: number;
  blur: number;
  temperature: number;
  highlights: number;
  shadows: number;
  fade: number;
  vignette: number;
  grain: number;
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  aspectRatio: AspectRatio;
}

export interface PhotoProject {
  id: string;
  name: string;
  source: string;
  thumbnail?: string;
  settings: EditSettings;
  createdAt: number;
  updatedAt: number;
  isSample?: boolean;
}

export interface ExportOptions {
  format: ExportFormat;
  quality: number;
  maxDimension: number;
}

export interface EditorSession {
  source: string;
  name: string;
  projectId?: string;
  initialSettings?: EditSettings;
  applyAutoEnhance?: boolean;
}
