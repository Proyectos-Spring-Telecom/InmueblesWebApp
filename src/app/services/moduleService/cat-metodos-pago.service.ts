import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Cuerpo de POST/PATCH `/cat-metodos-pago`. */
export interface CatMetodoPagoPayload {
  nombre: string;
}

export interface CatMetodoPagoItem {
  id: number;
  nombre?: string;
  estatus?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CatMetodosPagoService {
  private readonly base = `${environment.API_SECURITY}/cat-metodos-pago`;

  constructor(private http: HttpClient) {}

  obtenerMetodosPagoPaginados(page: number, limit: number): Observable<unknown> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http.get(`${this.base}/paginated`, { params });
  }

  obtenerMetodoPago(id: number): Observable<unknown> {
    return this.http.get(`${this.base}/${id}`);
  }

  registrarMetodoPago(data: CatMetodoPagoPayload): Observable<unknown> {
    return this.http.post(this.base, data);
  }

  actualizarMetodoPago(id: number, data: CatMetodoPagoPayload): Observable<unknown> {
    return this.http.patch(`${this.base}/${id}`, data);
  }

  activarMetodoPago(id: number): Observable<string> {
    const url = `${this.base}/activar/${id}`;
    return this.http
      .patch(url, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }

  desactivarMetodoPago(id: number): Observable<string> {
    const url = `${this.base}/desactivar/${id}`;
    return this.http
      .patch(url, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }
}
