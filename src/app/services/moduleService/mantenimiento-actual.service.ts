import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** POST `/mantenimiento-actual` */
export interface MantenimientoActualPostPayload {
  idArrendatario: number;
  idContrato: number;
  total: number;
  idFormula: number;
  montoFinal: number;
  factorVariable: number;
  ocupoFormula: number;
}

/** PUT `/mantenimiento-actual/{id}` */
export interface MantenimientoActualPutPayload {
  total: number;
  idFormula: number;
  montoFinal: number;
  factorVariable: number;
  ocupoFormula: number;
}

@Injectable({ providedIn: 'root' })
export class MantenimientoActualService {
  private readonly url = `${environment.API_SECURITY}/mantenimiento-actual`;

  constructor(private http: HttpClient) {}

  registrarMantenimiento(payload: MantenimientoActualPostPayload): Observable<unknown> {
    return this.http.post<unknown>(this.url, payload);
  }

  actualizarMantenimiento(id: number, payload: MantenimientoActualPutPayload): Observable<unknown> {
    return this.http.put<unknown>(`${this.url}/${id}`, payload);
  }

  obtenerMantenimientoPorId(id: number): Observable<unknown> {
    return this.http.get(`${this.url}/${id}`);
  }

  marcarComoPagada(id: number): Observable<string> {
    return this.http
      .patch(`${this.url}/${id}/pagada`, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }

  obtenerMantenimientosPaginados(page: number, limit: number): Observable<unknown> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http.get(`${this.url}/paginated`, { params });
  }
}
