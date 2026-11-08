export type AppView = 'home' | 'projects' | 'profile' | 'settings';
export type EditorTab = 'looks' | 'adjust' | 'crop' | 'color' | 'text';
export type AspectRatio = 'original' | 'free' | '1:1' | '4:5' | '3:4' | '16:9' | '9:16' | '2:3';
export type ExportFormat = 'jpeg' | 'png';

export interface Tone { brightness: number; contrast: number; saturation: number; sepia: number; grayscale: number; hueRotate: number; }
export interface PhotoPreset {
  id: string; name: string; category: 'Portre' | 'Manzara' | 'Yemek' | 'Gece' | 'Vintage' | 'Sinema' | 'Seyahat' | 'Siyah Beyaz' | 'Özel';
  tone: Tone; accent: string;
}
export interface NormalizedCrop { x: number; y: number; width: number; height: number; }
export interface HslChannel { hue: number; saturation: number; luminance: number; }
export type HslColor = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple';
export interface SelectiveMask {
  id: string; type: 'radial' | 'linear'; x: number; y: number; radius: number; angle: number; feather: number;
  exposure: number; saturation: number; temperature: number;
}
export interface TextLayer {
  id: string; text: string; x: number; y: number; size: number; color: string; font: 'sans' | 'serif' | 'mono';
  align: 'left' | 'center' | 'right'; rotation: number;
}
export interface FrameSettings { width: number; color: string; }

export interface EditSettings {
  presetId: string; intensity: number; exposure: number; brightness: number; contrast: number; saturation: number;
  clarity: number; blur: number; temperature: number; highlights: number; shadows: number; fade: number; vignette: number; grain: number;
  rotation: number; straighten: number; perspectiveX: number; perspectiveY: number;
  flipHorizontal: boolean; flipVertical: boolean; aspectRatio: AspectRatio; crop?: NormalizedCrop;
  noiseReduction: number; sharpen: number; curveShadows: number; curveMidtones: number; curveHighlights: number;
  hsl: Record<HslColor, HslChannel>;
  masks: SelectiveMask[]; texts: TextLayer[]; frame: FrameSettings;
}

export interface PhotoProject {
  id: string; name: string; source: string; previewSource?: string; thumbnail?: string; settings: EditSettings;
  width?: number; height?: number;
  createdAt: number; updatedAt: number; isSample?: boolean; favorite?: boolean; album?: string; tags?: string[];
}
export interface ExportOptions { format: ExportFormat; quality: number; maxDimension: number; signal?: AbortSignal; }
export interface EditorSession {
  source: string; previewSource?: string; width?: number; height?: number; name: string;
  projectId?: string; initialSettings?: EditSettings; applyAutoEnhance?: boolean; ownsSource?: boolean;
}
