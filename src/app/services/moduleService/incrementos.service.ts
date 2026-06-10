import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Cuerpo de POST/PATCH `/inpc`. */
export interface IncrementoPayload {
  anio: number;
  mes: number;
  inpc: number;
}

/** Elemento de `datos[]` en GET `/inpc/banxico/datos`. */
export interface InpcBanxicoDatoItem {
  fecha: string;
  indice: string;
  porcAnual: string;
  porcAcumAnual: string;
}

/** Respuesta de GET `/inpc/banxico/datos`. */
export interface InpcBanxicoDatosResponse {
  idSerie: string;
  titulo: string;
  fechaInicial: string;
  fechaFinal: string;
  parametros: {
    decimales: string;
    incremento: string[];
  };
  datos: InpcBanxicoDatoItem[];
}

@Injectable({
  providedIn: 'root',
})
export class IncrementosService {
  private readonly base = `${environment.API_SECURITY}/inpc`;

  constructor(private http: HttpClient) {}

  obtenerIncrementosData(page: number, limit: number): Observable<any> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http.get(`${this.base}/paginated`, { params });
  }

  obtenerBanxicoDatos(
    fechaInicial: string,
    fechaFinal: string,
  ): Observable<InpcBanxicoDatosResponse> {
    const params = new HttpParams()
      .set('fechaInicial', fechaInicial)
      .set('fechaFinal', fechaFinal);
    return this.http.get<InpcBanxicoDatosResponse>(`${this.base}/banxico/datos`, {
      params,
    });
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
