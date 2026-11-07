import type { EditSettings, PhotoPreset, Tone } from '../types';

const tone = (values: Partial<Tone>): Tone => ({
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sepia: 0,
  grayscale: 0,
  hueRotate: 0,
  ...values,
});

export const PRESETS: PhotoPreset[] = [
  { id: 'original', name: 'Orijinal', category: 'Portre', image: '/images/portrait.jpg', pro: false, accent: '#a8a8a8', tone: tone({}) },
  { id: 'portrait', name: 'Doğal Portre', category: 'Portre', image: '/images/portrait.jpg', pro: false, accent: '#e6aa83', tone: tone({ brightness: 1.06, contrast: 1.04, saturation: 0.92, sepia: 0.08 }) },
  { id: 'golden', name: 'Altın Saat', category: 'Portre', image: '/images/beach.jpg', pro: true, accent: '#e6a45c', tone: tone({ brightness: 1.05, contrast: 1.08, saturation: 1.12, sepia: 0.18, hueRotate: -5 }) },
  { id: 'cinema', name: 'Sinematik', category: 'Sinema', image: '/images/city.jpg', pro: false, accent: '#64a6a0', tone: tone({ brightness: 0.94, contrast: 1.2, saturation: 0.78, hueRotate: -10 }) },
  { id: 'noir', name: 'Noir', category: 'Siyah Beyaz', image: '/images/monochrome.jpg', pro: false, accent: '#b4b4b4', tone: tone({ brightness: 0.96, contrast: 1.28, saturation: 0, grayscale: 1 }) },
  { id: 'film', name: 'Analog 35', category: 'Sinema', image: '/images/santorini.jpg', pro: true, accent: '#c4a875', tone: tone({ brightness: 1.04, contrast: 0.92, saturation: 0.78, sepia: 0.15, hueRotate: -4 }) },
  { id: 'aegean', name: 'Ege Mavisi', category: 'Seyahat', image: '/images/coast.jpg', pro: false, accent: '#63b8ce', tone: tone({ brightness: 1.03, contrast: 1.08, saturation: 1.16, hueRotate: 5 }) },
  { id: 'soft', name: 'Yumuşak Işık', category: 'Portre', image: '/images/portrait.jpg', pro: true, accent: '#d9b9a7', tone: tone({ brightness: 1.1, contrast: 0.86, saturation: 0.86, sepia: 0.06 }) },
  { id: 'urban', name: 'Gece Yarısı', category: 'Sinema', image: '/images/city.jpg', pro: true, accent: '#5c75a8', tone: tone({ brightness: 0.88, contrast: 1.24, saturation: 0.7, hueRotate: 9 }) },
  { id: 'wild', name: 'Doğada', category: 'Seyahat', image: '/images/beach.jpg', pro: false, accent: '#8da66a', tone: tone({ brightness: 1.02, contrast: 1.06, saturation: 1.08, hueRotate: -3 }) },
  { id: 'silver', name: 'Gümüş', category: 'Siyah Beyaz', image: '/images/monochrome.jpg', pro: true, accent: '#a7abb3', tone: tone({ brightness: 1.08, contrast: 1.08, saturation: 0, grayscale: 1 }) },
  { id: 'postcard', name: 'Kartpostal', category: 'Seyahat', image: '/images/santorini.jpg', pro: true, accent: '#e4a877', tone: tone({ brightness: 1.05, contrast: 1.12, saturation: 1.2, sepia: 0.04 }) },
];

export const DEFAULT_SETTINGS: EditSettings = {
  presetId: 'original',
  intensity: 100,
  exposure: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  temperature: 0,
  highlights: 0,
  shadows: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  aspectRatio: 'original',
};

export const AUTO_ENHANCE_SETTINGS: Partial<EditSettings> = {
  presetId: 'portrait',
  intensity: 65,
  exposure: 8,
  brightness: 103,
  contrast: 108,
  saturation: 106,
  highlights: -12,
  shadows: 18,
  vignette: 6,
};

export const getPreset = (id: string) => PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
