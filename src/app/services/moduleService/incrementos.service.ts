import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Cuerpo de POST/PATCH `/inpc`. */
export interface IncrementoPayload {
  anio: number;
  mes: number;
  inpc: number;
  porcentajeAnual?: number | null;
}

/** Elemento de `data[]` en GET `/inpc/paginated`. */
export interface InpcPaginatedItem {
  isBanxico: boolean;
  id?: number;
  anio: number;
  mes: number;
  inpc: string | number;
  porcentajeAnual?: string | number | null;
  porcAcumAnual?: string | number | null;
  fhRegistro?: string;
  estatus?: number;
}

/** Respuesta de GET `/inpc/paginated`. */
export interface InpcPaginatedResponse {
  data: InpcPaginatedItem[];
  paginated: {
    total: number;
    page: number;
    lastPage: number;
  };
}

/** Elemento de `data[]` en GET `/inpc/listado`. */
export interface InpcListadoItem {
  id: number;
  anio: number;
  mes: number;
  inpc: string | number;
  porcentajeAnual?: string | number | null;
  fhRegistro?: string;
  estatus?: number;
}

/** Respuesta de GET `/inpc/listado`. */
export interface InpcListadoResponse {
  data: InpcListadoItem[];
}

@Injectable({
  providedIn: 'root',
})
export class IncrementosService {
  private readonly base = `${environment.API_SECURITY}/inpc`;

  constructor(private http: HttpClient) {}

  obtenerIncrementosData(
    page: number,
    limit: number,
    fechaInicio?: string,
    fechaFin?: string,
  ): Observable<InpcPaginatedResponse> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    if (fechaInicio?.trim()) {
      params = params.set('fechaInicio', fechaInicio.trim());
    }
    if (fechaFin?.trim()) {
      params = params.set('fechaFin', fechaFin.trim());
    }
    return this.http.get<InpcPaginatedResponse>(`${this.base}/paginated`, { params });
  }

  obtenerInpcListado(fechaInicio: string, fechaFin: string): Observable<InpcListadoResponse> {
    const params = new HttpParams()
      .set('fechaInicio', fechaInicio.trim())
      .set('fechaFin', fechaFin.trim());
    return this.http.get<InpcListadoResponse>(`${this.base}/listado`, { params });
  }

  obtenerIncremento(id: number): Observable<any> {
    return this.http.get(`${this.base}/${id}`);
  }

  agregarIncremento(data: IncrementoPayload): Observable<any> {
    return this.http.post(this.base, data);
  }

  actualizarIncremento(id: number, data: IncrementoPayload): Observable<any> {
    return this.http.patch(`${this.base}/${id}`, data);
  }

  updateEstatusActivar(id: number, estatus: number): Observable<string> {
    const url = `${this.base}/activar/${id}`;
    return this.http
      .patch(url, { estatus }, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }

  updateEstatusDesactivar(id: number, estatus: number): Observable<string> {
    const url = `${this.base}/desactivar/${id}`;
    return this.http
      .patch(url, { estatus }, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }
}
