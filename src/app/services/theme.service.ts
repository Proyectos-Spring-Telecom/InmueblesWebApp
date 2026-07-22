import { Injectable } from '@angular/core';
import { CoreService } from './core.service';

export type AppThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'inmuebles-app-theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  constructor(private core: CoreService) {
    // La app SIEMPRE inicia en oscuro. El tema claro solo se activa si el
    // usuario presiona el botón durante la sesión (no se hereda de visitas
    // anteriores), por eso aquí se ignora lo guardado en localStorage.
    this.core.setOptions({ theme: 'dark' });
    this.persist('dark');
    this.applyToDocument('dark');
  }

  getTheme(): AppThemeMode {
    return this.core.getOptions().theme === 'light' ? 'light' : 'dark';
  }

  setTheme(theme: AppThemeMode): void {
    this.core.setOptions({ theme });
    this.persist(theme);
    this.applyToDocument(theme);
  }

  toggle(): AppThemeMode {
    const next: AppThemeMode = this.getTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(next);
    return next;
  }

  /** Aplica clases en <html> (dark-theme | light-theme). */
  applyToDocument(theme: AppThemeMode = this.getTheme()): void {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark-theme');
      html.classList.remove('light-theme');
    } else {
      html.classList.remove('dark-theme');
      html.classList.add('light-theme');
    }
  }

  private persist(theme: AppThemeMode): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore quota / private mode */
    }
  }

  private readStoredTheme(): AppThemeMode | null {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch {
      /* ignore */
    }
    return null;
  }
}
