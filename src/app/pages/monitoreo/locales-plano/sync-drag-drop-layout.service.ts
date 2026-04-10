import { Injectable, NgZone } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import {
  AsignacionMesaZonaBody,
  PlanoLayoutJson,
} from './pos-locales.models';
import { LayoutRepositoryService } from './layout-repository.service';

export interface SyncLayoutCallbacks {
  onSuccess?: () => void;
  onRollback?: () => void;
  onError?: (e: unknown) => void;
}

/**
 * Debounce (~1500 ms), un guardado en vuelo, reintentos con backoff, rollback visual.
 */
@Injectable({ providedIn: 'root' })
export class SyncDragDropLayoutService {
  private debounceMs = 1500;
  private maxRetries = 3;
  private pendingTimer?: Subscription;
  private flying = false;
  private queuedPayload: AsignacionMesaZonaBody | null = null;

  lastGoodState: PlanoLayoutJson | null = null;

  constructor(
    private repo: LayoutRepositoryService,
    private zone: NgZone,
  ) {}

  setLastGoodState(layout: PlanoLayoutJson): void {
    this.lastGoodState = this.cloneLayout(layout);
  }

  scheduleSave(
    idSucursal: number,
    json: PlanoLayoutJson,
    cb?: SyncLayoutCallbacks,
  ): void {
    this.pendingTimer?.unsubscribe();
    const payload: AsignacionMesaZonaBody = {
      idSucursal,
      json: this.cloneLayout(json),
    };

    this.pendingTimer = timer(this.debounceMs).subscribe(() => {
      this.zone.run(() => this.trySave(payload, cb));
    });
  }

  private trySave(
    payload: AsignacionMesaZonaBody,
    cb?: SyncLayoutCallbacks,
  ): void {
    if (this.flying) {
      this.queuedPayload = payload;
      return;
    }
    this.executeWithRetry(payload, 0, cb);
  }

  private executeWithRetry(
    payload: AsignacionMesaZonaBody,
    attempt: number,
    cb?: SyncLayoutCallbacks,
  ): void {
    this.flying = true;
    this.repo.postAsignacion(payload).subscribe({
      next: () => {
        this.flying = false;
        this.lastGoodState = this.cloneLayout(payload.json);
        cb?.onSuccess?.();
        if (this.queuedPayload) {
          const q = this.queuedPayload;
          this.queuedPayload = null;
          this.trySave(q, cb);
        }
      },
      error: (err) => {
        if (attempt + 1 < this.maxRetries) {
          const delay = 400 * Math.pow(2, attempt);
          setTimeout(() => {
            this.zone.run(() =>
              this.executeWithRetry(payload, attempt + 1, cb),
            );
          }, delay);
        } else {
          this.flying = false;
          cb?.onRollback?.();
          cb?.onError?.(err);
          this.queuedPayload = null;
        }
      },
    });
  }

  cancelPending(): void {
    this.pendingTimer?.unsubscribe();
    this.pendingTimer = undefined;
  }

  private cloneLayout(j: PlanoLayoutJson): PlanoLayoutJson {
    return JSON.parse(JSON.stringify(j)) as PlanoLayoutJson;
  }
}
