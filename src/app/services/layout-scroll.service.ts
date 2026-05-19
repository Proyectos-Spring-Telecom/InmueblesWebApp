import { Injectable } from '@angular/core';

/**
 * Referencia al contenedor `.layout-content-scroll` del shell principal.
 * Lo registra `FullComponent` al iniciar.
 */
@Injectable({
  providedIn: 'root',
})
export class LayoutScrollService {
  private host: HTMLElement | null = null;

  register(host: HTMLElement): void {
    this.host = host;
  }

  private resolveHost(): HTMLElement | null {
    return (
      this.host ??
      (document.querySelector('.layout-content-scroll') as HTMLElement | null)
    );
  }

  scrollToTop(behavior: ScrollBehavior = 'auto'): void {
    const el = this.resolveHost();
    if (!el || el.scrollHeight <= el.clientHeight) return;
    if (behavior === 'auto') {
      el.scrollTop = 0;
    }
    el.scrollTo({ top: 0, left: 0, behavior });
  }

  scrollToElement(
    target: HTMLElement | null | undefined,
    margin = 16,
    behavior: ScrollBehavior = 'smooth',
  ): void {
    const el = this.resolveHost();
    if (!el) return;

    if (!target) {
      this.scrollToTop(behavior);
      return;
    }

    if (el.scrollHeight <= el.clientHeight) return;

    const destino = Math.max(
      0,
      el.scrollTop +
        target.getBoundingClientRect().top -
        el.getBoundingClientRect().top -
        margin,
    );

    if (behavior === 'auto') {
      el.scrollTop = destino;
      return;
    }

    el.scrollTo({ top: destino, left: 0, behavior: 'smooth' });
  }
}
