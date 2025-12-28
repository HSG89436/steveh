
import { Project } from "../types";

const PROJECT_STORAGE_KEY = 'pinflow_projects';
const TOKEN_STORAGE_KEY = 'pinflow_pinterest_token';

// Projects
export const saveProject = (project: Project): void => {
  try {
    const existing = getProjects();
    const index = existing.findIndex(p => p.id === project.id);
    if (index >= 0) {
      existing[index] = project;
    } else {
      existing.unshift(project);
    }
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error("Failed to save project", e);
  }
};

export const getProjects = (): Project[] => {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const deleteProject = (id: string): void => {
  const existing = getProjects();
  const filtered = existing.filter(p => p.id !== id);
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(filtered));
};

// API Token Persistence
export const savePinterestToken = (token: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const getPinterestToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const clearPinterestToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};
