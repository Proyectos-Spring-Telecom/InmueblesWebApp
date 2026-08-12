import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Respuesta GET `/notificaciones`. */
export interface NotificacionesResponse {
  vencimientosRenovacionesContrato?: VencimientoRenovacionContratoDto[] | null;
  pagoServiciosInmuebles?: PagoServicioInmuebleDto[] | null;
  pagosSeguimiento?: PagoSeguimientoDto[] | null;
}

export interface VencimientoRenovacionContratoDto {
  id: number;
  idInmueble?: number;
  idArrendatario?: number;
  fechaTerminoContrato?: string;
  inmueble?: string;
  arrendatario?: string;
  diasFaltantes?: number;
  color?: string;
}

export interface PagoServicioInmuebleDto {
  id: number;
  idInmueble?: number;
  idTipoServicio?: number;
  numeroContrato?: string;
  fechaPago?: string;
  inmueble?: string;
  tipoServicio?: string;
  diasFaltantes?: number;
  color?: string;
}

export interface PagoSeguimientoDto {
  id: number;
  idArrendatario?: number;
  idTipoServicio?: number;
  numeroContrato?: string;
  fechaPago?: string;
  arrendatario?: string;
  tipoServicio?: string;
  diasFaltantes?: number;
  color?: string;
}

/** Semáforo compartido: ≤2 rojo, ≤6 amarillo, ≤15 naranja, resto verde. */
export type ToneDiasFaltantes = 'success' | 'warning' | 'amber' | 'danger' | 'expired';

/**
 * Semáforo de días faltantes (vencimientos, pagos, seguimiento e UI de vigencia).
 * <0 → expired (vencido), ≤2 → danger, ≤6 → amber, ≤15 → warning, resto → success.
 */
export function tonePorDiasFaltantesNotificacion(
  dias: number | undefined | null,
): ToneDiasFaltantes {
  const d = Number(dias);
  if (!Number.isFinite(d)) return 'success';
  if (d < 0) return 'expired';
  if (d <= 2) return 'danger';
  if (d <= 6) return 'amber';
  if (d <= 15) return 'warning';
  return 'success';
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly url = `${environment.API_SECURITY}/notificaciones`;
  private readonly refrescarSubject = new Subject<void>();

  /** El header se suscribe para volver a consultar GET `/notificaciones`. */
  readonly refrescar$ = this.refrescarSubject.asObservable();

  constructor(private http: HttpClient) {}

  obtenerNotificaciones(): Observable<NotificacionesResponse> {
    return this.http.get<NotificacionesResponse>(this.url);
  }

  /** Disparar recarga del centro de notificaciones (p. ej. tras alta/edición). */
  refrescar(): void {
    this.refrescarSubject.next();
  }
}
