import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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
  arrendatario?: string;
  fechaFin?: string;
  diasFaltantes?: number;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly url = `${environment.API_SECURITY}/notificaciones`;

  constructor(private http: HttpClient) {}

  obtenerNotificaciones(): Observable<NotificacionesResponse> {
    return this.http.get<NotificacionesResponse>(this.url);
  }
}
