import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IncrementoPayload {
  nombre: string;
  porcentaje: number;
  /** Descripción del criterio de aplicación (contrato, cláusula, etc.) */
  descripcion?: string | null;
  /** Comercial, residencial, estacionamiento u otro */
  tipoInmueble?: string | null;
  /** Frecuencia del incremento pactada */
  periodicidad?: string | null;
  /** Mes del año en que aplica la renovación (1–12), si aplica */
  mesAplicacion?: number | null;
  /** Referencia legal o índice (p. ej. INPC, IPC) */
  indiceReferencia?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class IncrementosService {
  private readonly base = `${environment.API_SECURITY}/cat-incrementos`;

  constructor(private http: HttpClient) {}

  obtenerIncrementosData(page: number, limit: number): Observable<any> {
    return this.http.get(`${this.base}/paginated?page=${page}&limit=${limit}`);
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
