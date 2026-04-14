import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FactorPayload {
  nombre: string;
  valor: number;
  /** Detalle del factor (ubicación, mercado, uso del suelo, etc.) */
  descripcion?: string | null;
  /** Categoría del factor en valuación o renta */
  categoria?: string | null;
  /** Zona, colonia, corredor o mercado de referencia */
  zonaReferencia?: string | null;
  /** Cómo se interpreta el valor numérico */
  unidad?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class FactoresService {
  private readonly base = `${environment.API_SECURITY}/cat-factores`;

  constructor(private http: HttpClient) {}

  obtenerFactoresData(page: number, limit: number): Observable<any> {
    return this.http.get(`${this.base}/paginated?page=${page}&limit=${limit}`);
  }

  obtenerFactor(id: number): Observable<any> {
    return this.http.get(`${this.base}/${id}`);
  }

  agregarFactor(data: FactorPayload): Observable<any> {
    return this.http.post(this.base, data);
  }

  actualizarFactor(id: number, data: FactorPayload): Observable<any> {
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
