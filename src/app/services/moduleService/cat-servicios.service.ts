import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Cuerpo de POST/PATCH `/cat-servicios`. */
export interface CatServicioPayload {
  nombre: string;
}

export interface CatServicioItem {
  id: number;
  nombre?: string;
  servicio?: string;
  descripcion?: string;
  estatus?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CatServiciosService {
  private readonly base = `${environment.API_SECURITY}/cat-servicios`;

  constructor(private http: HttpClient) {}

  obtenerServiciosPaginados(page: number, limit: number): Observable<unknown> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http.get(`${this.base}/paginated`, { params });
  }

  obtenerServicio(id: number): Observable<unknown> {
    return this.http.get(`${this.base}/${id}`);
  }

  registrarServicio(data: CatServicioPayload): Observable<unknown> {
    return this.http.post(this.base, data);
  }

  actualizarServicio(id: number, data: CatServicioPayload): Observable<unknown> {
    return this.http.patch(`${this.base}/${id}`, data);
  }

  activarServicio(id: number): Observable<string> {
    const url = `${this.base}/activar/${id}`;
    return this.http
      .patch(url, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }

  desactivarServicio(id: number): Observable<string> {
    const url = `${this.base}/desactivar/${id}`;
    return this.http
      .patch(url, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }
}
