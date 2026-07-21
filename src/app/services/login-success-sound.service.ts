import { Injectable, signal } from '@angular/core';

const LOGIN_SUCCESS_SOUND_PATH = 'assets/images/notificacion.mp3';
const DEFAULT_PEAK_VOLUME = 0.8;
const DEFAULT_FADE_START_MS = 9_000;
const DEFAULT_FADE_DURATION_MS = 1_000;

/** Sonido de bienvenida tras login. */
@Injectable({ providedIn: 'root' })
export class LoginSuccessSoundService {
  /** Activo ~10 s: solo pausa animaciones del hub (sin cambiar aspecto visual). */
  readonly highlightNotificaciones = signal(false);

  private audio: HTMLAudioElement | null = null;
  private fadeStartTimer: ReturnType<typeof setTimeout> | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeRafId: number | null = null;
  private peakVolume = DEFAULT_PEAK_VOLUME;

  /** Estado post-login: el sonido solo suena si hay notificaciones pendientes. */
  private loginSoundArmed = false;
  private loginSoundDurationMs = 10_000;
  private hayNotificaciones: boolean | null = null;

  /** Llamar antes de navegar tras un login exitoso (limpia estado previo). */
  beginLoginSequence(): void {
    this.loginSoundArmed = false;
    this.hayNotificaciones = null;
  }

  /** Arma el sonido post-login; sonará solo cuando se confirme que hay notificaciones. */
  armLoginSound(durationMs = 10_000): void {
    this.loginSoundArmed = true;
    this.loginSoundDurationMs = durationMs;
    this.tryPlayLoginSound();
  }

  /** El header reporta si la API trajo notificaciones (alguna lista con elementos). */
  notificacionesCargadas(hayNotificaciones: boolean): void {
    this.hayNotificaciones = hayNotificaciones;
    this.tryPlayLoginSound();
  }

  private tryPlayLoginSound(): void {
    if (!this.loginSoundArmed || this.hayNotificaciones === null) return;
    const hay = this.hayNotificaciones;
    this.loginSoundArmed = false;
    this.hayNotificaciones = null;
    if (hay) this.play(this.loginSoundDurationMs);
  }

  play(
    durationMs = 10_000,
    fadeStartMs = DEFAULT_FADE_START_MS,
    fadeDurationMs = DEFAULT_FADE_DURATION_MS,
  ): void {
    this.stopInternal();
    this.setHighlight(true);

    try {
      const audio = new Audio(LOGIN_SUCCESS_SOUND_PATH);
      this.peakVolume = DEFAULT_PEAK_VOLUME;
      audio.volume = this.peakVolume;
      audio.loop = true;
      this.audio = audio;
      void audio.play().catch(() => {});

      const fadeAt = Math.max(0, Math.min(fadeStartMs, durationMs - 50));
      this.fadeStartTimer = setTimeout(
        () => this.runVolumeFade(this.peakVolume, fadeDurationMs),
        fadeAt,
      );
      this.endTimer = setTimeout(() => this.finishPlay(), durationMs);
    } catch {
      this.setHighlight(false);
    }
  }

  stop(): void {
    this.setHighlight(false);
    this.stopInternal();
  }

  private finishPlay(): void {
    this.setHighlight(false);
    this.stopInternal();
  }

  private setHighlight(active: boolean): void {
    this.highlightNotificaciones.set(active);
  }

  private runVolumeFade(fromVolume: number, fadeMs: number): void {
    this.cancelFadeRaf();
    const audio = this.audio;
    if (!audio) return;

    const start = performance.now();
    const tick = (now: number) => {
      const a = this.audio;
      if (!a) return;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / fadeMs);
      const eased = 1 - (1 - t) * (1 - t);
      a.volume = Math.max(0, fromVolume * (1 - eased));
      if (t < 1) {
        this.fadeRafId = requestAnimationFrame(tick);
      }
    };
    this.fadeRafId = requestAnimationFrame(tick);
  }

  private cancelFadeRaf(): void {
    if (this.fadeRafId != null) {
      cancelAnimationFrame(this.fadeRafId);
      this.fadeRafId = null;
    }
  }

  private stopInternal(): void {
    if (this.fadeStartTimer != null) {
      clearTimeout(this.fadeStartTimer);
      this.fadeStartTimer = null;
    }
    if (this.endTimer != null) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    this.cancelFadeRaf();

    const audio = this.audio;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.loop = false;
    audio.volume = 0;
    this.audio = null;
  }
}
