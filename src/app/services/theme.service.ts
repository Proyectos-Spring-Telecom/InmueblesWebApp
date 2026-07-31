import { Injectable, NgZone } from '@angular/core';
import { CoreService } from './core.service';

export type AppThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'inmuebles-app-theme';
const THEME_TRANSITION_MS = 620;

type ViewTransitionLike = {
  finished: Promise<void>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransitionLike;
};

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private transitioning = false;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private core: CoreService,
    private zone: NgZone,
  ) {
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

  /**
   * Cambia el tema. Resuelve cuando el tema ya está aplicado en CoreService + <html>
   * (la animación visual puede seguir un instante).
   */
  setTheme(theme: AppThemeMode, options?: { animate?: boolean }): Promise<void> {
    if (theme === this.getTheme()) {
      return Promise.resolve();
    }

    // Si quedó trabado un cambio anterior, forzar limpieza
    if (this.transitioning) {
      this.cleanupTransition();
    }

    const animate = options?.animate !== false && !this.prefersReducedMotion();

    const apply = () => {
      this.zone.run(() => {
        this.core.setOptions({ theme });
        this.persist(theme);
        this.applyToDocument(theme);
      });
    };

    if (!animate) {
      apply();
      return Promise.resolve();
    }

    return this.runThemeTransition(theme, apply);
  }

  toggle(): Promise<AppThemeMode> {
    const next: AppThemeMode = this.getTheme() === 'light' ? 'dark' : 'light';
    return this.setTheme(next).then(() => next);
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

  private runThemeTransition(theme: AppThemeMode, apply: () => void): Promise<void> {
    const html = document.documentElement;
    const doc = document as DocumentWithViewTransition;
    const toClass = theme === 'light' ? 'theme-to-light' : 'theme-to-dark';

    this.transitioning = true;
    html.classList.add('theme-switching', toClass);
    html.dataset['themeTo'] = theme;

    const finish = () => {
      this.cleanupTransition();
    };

    // Safety: nunca dejar transitioning trabado
    this.transitionTimer = setTimeout(finish, THEME_TRANSITION_MS + 400);

    if (typeof doc.startViewTransition === 'function') {
      try {
        return new Promise<void>((resolve, reject) => {
          try {
            const transition = doc.startViewTransition(() => {
              apply();
              // Tema ya aplicado: el icono puede actualizarse sin esperar la animación
              this.zone.run(() => resolve());
            });
            transition.finished.finally(finish);
          } catch (err) {
            reject(err);
          }
        }).catch(() => {
          apply();
          finish();
        });
      } catch {
        /* fallback abajo */
      }
    }

    // Fallback: velo + aplicar al siguiente frame
    html.classList.add('theme-veil');
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        apply();
        this.zone.run(() => resolve());
        window.setTimeout(finish, THEME_TRANSITION_MS);
      });
    });
  }

  private cleanupTransition(): void {
    const html = document.documentElement;
    html.classList.remove('theme-switching', 'theme-veil', 'theme-to-light', 'theme-to-dark');
    delete html.dataset['themeTo'];
    this.transitioning = false;
    if (this.transitionTimer != null) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
  }

  private prefersReducedMotion(): boolean {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  private persist(theme: AppThemeMode): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore quota / private mode */
    }
  }
}
