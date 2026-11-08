import type { PhotoProject } from '../types';

const PROJECTS_KEY = 'myvision.projects.v1';
const ONBOARDING_KEY = 'myvision.onboarded.v1';

export function loadProjects(): PhotoProject[] {
  try {
    const value = localStorage.getItem(PROJECTS_KEY);
    if (!value) return [];
    const projects = JSON.parse(value) as PhotoProject[];
    return Array.isArray(projects) ? projects.filter((project) => project.source && project.settings && !project.isSample && !project.id.startsWith('sample-')) : [];
  } catch {
    return [];
  }
}

export function persistProjects(projects: PhotoProject[]): boolean {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    return true;
  } catch {
    return false;
  }
}

export function hasOnboarded() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export function setOnboarded() {
  localStorage.setItem(ONBOARDING_KEY, 'true');
}
