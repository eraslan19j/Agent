import { DEFAULT_SETTINGS } from './presets';
import type { PhotoProject } from '../types';

export const SAMPLE_PROJECTS: PhotoProject[] = [
  {
    id: 'sample-santorini',
    name: 'Ege günlükleri',
    source: '/images/santorini.jpg',
    settings: { ...DEFAULT_SETTINGS, presetId: 'aegean', intensity: 55 },
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
    isSample: true,
  },
  {
    id: 'sample-portrait',
    name: 'Gün ışığı',
    source: '/images/portrait.jpg',
    settings: { ...DEFAULT_SETTINGS, presetId: 'cinema', intensity: 70 },
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 86400000,
    isSample: true,
  },
  {
    id: 'sample-city',
    name: 'Şehir uyanırken',
    source: '/images/city.jpg',
    settings: { ...DEFAULT_SETTINGS, presetId: 'aegean', intensity: 45 },
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 172800000,
    isSample: true,
  },
];

export const GALLERY = [
  { id: 'g1', image: '/images/santorini.jpg', title: 'Ege’nin dokusu', category: 'Seyahat', presetId: 'golden', size: 'tall' },
  { id: 'g2', image: '/images/portrait.jpg', title: 'Işık ve karakter', category: 'Portre', presetId: 'portrait', size: 'normal' },
  { id: 'g3', image: '/images/city.jpg', title: 'Mavi saat', category: 'Sinema', presetId: 'cinema', size: 'wide' },
  { id: 'g4', image: '/images/coast.jpg', title: 'Ufukta yaz', category: 'Seyahat', presetId: 'aegean', size: 'normal' },
  { id: 'g5', image: '/images/monochrome.jpg', title: 'Sessiz portre', category: 'Siyah Beyaz', presetId: 'noir', size: 'normal' },
  { id: 'g6', image: '/images/beach.jpg', title: 'Analog anılar', category: 'Sinema', presetId: 'film', size: 'wide' },
];

export const PHOTO_CREDITS = [
  { image: 'portrait.jpg', url: 'https://unsplash.com/photos/FCrhYgBCFac', label: 'Unsplash / FCrhYgBCFac' },
  { image: 'coast.jpg', url: 'https://unsplash.com/photos/L92eZmRPx0o', label: 'Unsplash / L92eZmRPx0o' },
  { image: 'santorini.jpg', url: 'https://unsplash.com/photos/TkGtv9YJM9U', label: 'Unsplash / TkGtv9YJM9U' },
  { image: 'beach.jpg', url: 'https://unsplash.com/photos/wkHsJN_AWXc', label: 'Unsplash / wkHsJN_AWXc' },
  { image: 'city.jpg', url: 'https://unsplash.com/collections/1378631/graphic-streets', label: 'Unsplash / Graphic Streets' },
  { image: 'monochrome.jpg', url: 'https://unsplash.com/collections/1039064/portrait', label: 'Unsplash / Portrait Collection' },
];
