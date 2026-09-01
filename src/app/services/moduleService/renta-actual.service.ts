import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Periodo que cubre el registro de renta (solo UI del modal). */
export type RentaActualPeriodoTipo = 'mes_actual' | 'rango';

/**
 * Body POST `/renta-actual` (swagger).
 * `fechaInicio` obligatorio; `fechaFin` opcional; incluye `idFormula`.
 */
export interface RentaActualPostPayload {
  idArrendatario: number;
  idContrato: number;
  fechaInicio: string;
  total: number;
  montoFinal: number;
  totalMantenimiento: number;
  montoFinalMantenimiento: number;
  fechaFin?: string | null;
  usaFormula: number;
  idFormula: number | null;
  factorVariable: number;
  ocupoFormula: number;
}

/**
 * Body PUT `/renta-actual/{id}` (swagger).
 * Sin `idArrendatario`, `idContrato`, `fechaInicio` ni `idFormula`.
 * Este es el único body permitido para actualizar una renta existente.
 */
export interface RentaActualPutPayload {
  total: number;
  montoFinal: number;
  totalMantenimiento: number;
  montoFinalMantenimiento: number;
  fechaFin: string | null;
  usaFormula: number;
  factorVariable: number;
  ocupoFormula: number;
}

@Injectable({ providedIn: 'root' })
export class RentaActualService {
  private readonly url = `${environment.API_SECURITY}/renta-actual`;
  private readonly base = `${environment.API_SECURITY}/formulas`;

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

  /**
   * POST `/renta-actual/{id}/siguiente-mes`
   * Duplica la renta actual al mes siguiente (+1 mes).
   * Falla si ya existe renta para el mismo arrendatario y contrato en el mes destino.
   */
  duplicarAlSiguienteMes(id: number): Observable<unknown> {
    return this.http
      .post<unknown>(`${this.url}/${id}/siguiente-mes`, {})
      .pipe(catchError((error) => throwError(() => error)));
  }

  obtenerRentasPaginadas(page: number, limit: number): Observable<unknown> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http.get(`${this.url}/paginated`, { params });
  }

  evaluar(body: { idFormula: number; idContrato?: number; idArrendatario?: number }): Observable<any> {
    return this.http.post<any>(`${this.base}/evaluar`, body);
  }
}
