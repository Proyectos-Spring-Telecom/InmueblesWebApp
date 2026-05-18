import { Injectable, signal } from '@angular/core';

const BRIDGE_CLASS = 'auth-login-bridge';

/**
 * Transición login → app: fondo de marca y un solo fade al revelar la aplicación.
 */
@Injectable({ providedIn: 'root' })
export class AuthTransitionService {
  readonly revealActive = signal(false);
  readonly revealFade = signal(false);

  private bridgeDepth = 0;

  /** Al iniciar la salida del login (mismo tono que la pantalla de acceso). */
  beginLoginExit(): void {
    if (typeof document === 'undefined') {
      return;
    }
    this.bridgeDepth += 1;
    document.documentElement.classList.add(BRIDGE_CLASS);
  }

  finishLoginExit(): void {
    if (typeof document === 'undefined' || this.bridgeDepth === 0) {
      return;
    }
    this.bridgeDepth -= 1;
    if (this.bridgeDepth === 0) {
      document.documentElement.classList.remove(BRIDGE_CLASS);
    }
  }

  /** Tras navegar: cortina oscura que se desvanece y deja ver la app de una vez. */
  startAppReveal(): void {
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.finishLoginExit();
      return;
    }

    this.revealActive.set(true);
    this.revealFade.set(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.revealFade.set(true);
        window.setTimeout(() => {
          this.revealActive.set(false);
          this.revealFade.set(false);
          this.finishLoginExit();
        }, 540);
      });
    });
  }
}
