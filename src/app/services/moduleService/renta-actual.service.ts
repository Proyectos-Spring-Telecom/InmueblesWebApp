import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** POST `/renta-actual` */
export interface RentaActualPostPayload {
  idArrendatario: number;
  idContrato: number;
  total: number;
  idFormula: number;
  montoFinal: number;
  factorVariable: number;
  ocupoFormula: number;
}

/** PUT `/renta-actual/{id}` */
export interface RentaActualPutPayload {
  total: number;
  idFormula: number;
  montoFinal: number;
  factorVariable: number;
  ocupoFormula: number;
}

@Injectable({ providedIn: 'root' })
export class RentaActualService {
  private readonly url = `${environment.API_SECURITY}/renta-actual`;

  constructor(private http: HttpClient) {}

  registrarRenta(payload: RentaActualPostPayload): Observable<unknown> {
    return this.http.post<unknown>(this.url, payload);
  }

  actualizarRenta(id: number, payload: RentaActualPutPayload): Observable<unknown> {
    return this.http.put<unknown>(`${this.url}/${id}`, payload);
  }

  obtenerRentaPorId(id: number): Observable<unknown> {
    return this.http.get(`${this.url}/${id}`);
  }

  marcarComoPagada(id: number): Observable<string> {
    return this.http
      .patch(`${this.url}/${id}/pagada`, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }

  obtenerRentasPaginadas(page: number, limit: number): Observable<unknown> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http.get(`${this.url}/paginated`, { params });
  }
}
