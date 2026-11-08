import { freshSettings } from './imageEngine';
import type { EditSettings } from '../types';

export interface CustomRecipe { id: string; name: string; settings: EditSettings; }
const RECIPES_KEY = 'myvision.recipes.v1';
const CLIPBOARD_KEY = 'myvision.settings-clipboard.v1';

export function loadRecipes(): CustomRecipe[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECIPES_KEY) || '[]') as CustomRecipe[];
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.settings).slice(0, 30).map(item => ({ ...item, settings: freshSettings(item.settings) })) : [];
  } catch { return []; }
}
export function saveRecipe(name: string, settings: EditSettings): CustomRecipe[] {
  const recipe: CustomRecipe = { id: crypto.randomUUID(), name: name.trim().slice(0, 32) || 'Özel tarif', settings: freshSettings(settings) };
  const recipes = [recipe, ...loadRecipes()].slice(0, 30);
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
  return recipes;
}
export function deleteRecipe(id: string) {
  const recipes = loadRecipes().filter(item => item.id !== id);
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
  return recipes;
}
export function copySettings(settings: EditSettings) {
  localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(settings));
}
export function pasteSettings(): EditSettings | null {
  try {
    const value = localStorage.getItem(CLIPBOARD_KEY);
    return value ? freshSettings(JSON.parse(value) as Partial<EditSettings>) : null;
  } catch { return null; }
}
