import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Cuerpo de POST `/bitacora/paginated`. */
export interface BitacoraPaginatedRequest {
  page: number;
  limit: number;
  fechaInicio?: string;
  fechaFin?: string;
}

/** Elemento de `data[]` en POST `/bitacora/paginated` (joins a Usuarios y Modulos). */
export interface BitacoraPaginatedItem {
  id?: number;
  idBitacora?: number;
  fechaCreacion?: string;
  FechaCreacion?: string;
  accion?: string;
  descripcion?: string;
  detalle?: string;
  movimiento?: string;
  idUsuario?: number;
  idModulo?: number;
  usuario?: Record<string, unknown> | string | null;
  modulo?: Record<string, unknown> | string | null;
  idUsuario2?: Record<string, unknown> | null;
  idModulo2?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/** Respuesta de POST `/bitacora/paginated`. */
export interface BitacoraPaginatedResponse {
  data: BitacoraPaginatedItem[];
  paginated: {
    total: number;
    page: number;
    lastPage: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class BitacoraService {
  private readonly base = `${environment.API_SECURITY}/bitacora`;

  constructor(private http: HttpClient) {}

  obtenerBitacoraPaginada(
    page: number,
    limit: number,
    fechaInicio?: string,
    fechaFin?: string,
  ): Observable<BitacoraPaginatedResponse> {
    const body: BitacoraPaginatedRequest = { page, limit };
    if (fechaInicio?.trim()) {
      body.fechaInicio = fechaInicio.trim();
    }
    if (fechaFin?.trim()) {
      body.fechaFin = fechaFin.trim();
    }
    return this.http.post<BitacoraPaginatedResponse>(`${this.base}/paginated`, body);
  }
}
