import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** POST/PATCH `/formulas`. Las variables dentro de `formula` deben coincidir con `variable` en Factores cuando el motor evalúe la expresión. */
export interface FormulaPayload {
  nombre: string;
  formula: string;
}

@Injectable({
  providedIn: 'root',
})
export class FormulasService {
  private readonly base = `${environment.API_SECURITY}/formulas`;

  constructor(private http: HttpClient) {}

  obtenerFormulasData(page: number, limit: number): Observable<any> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http.get(`${this.base}/paginated`, { params });
  }

  obtenerFormula(id: number): Observable<any> {
    return this.http.get(`${this.base}/${id}`);
  }

  agregarFormula(data: FormulaPayload): Observable<any> {
    return this.http.post(this.base, data);
  }

  actualizarFormula(id: number, data: FormulaPayload): Observable<any> {
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
