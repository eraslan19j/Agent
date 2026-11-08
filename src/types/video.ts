import type { CreativeEffectSettings } from './index';

export type VideoAspectRatio = '9:16' | '1:1' | '4:5' | '16:9';
export type VideoResolution = 720 | 1080;
export type VideoTransition = 'none' | 'fade';

export interface VideoClip {
  id: string;
  name: string;
  source: string;
  blob: Blob;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  muted: boolean;
  rotation: 0 | 90 | 180 | 270;
  transition: VideoTransition;
}

export interface VideoTextLayer {
  id: string;
  kind: 'text' | 'sticker';
  text: string;
  start: number;
  end: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface VideoMusic {
  name: string;
  source: string;
  blob: Blob;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface VideoDraft {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  clips: VideoClip[];
  creative: CreativeEffectSettings;
  texts: VideoTextLayer[];
  music?: VideoMusic;
}

export interface VideoDraftSummary {
  id: string;
  name: string;
  updatedAt: number;
  duration: number;
  clipCount: number;
}
