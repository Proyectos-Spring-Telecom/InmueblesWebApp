import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FormulaPayload {
  nombre: string;
  formula: string;
  descripcion?: string;
  tipoResultado: 'MONTO' | 'PORCENTAJE';
}

export interface PreviewFormulaRequest {
  idFormula: number;
  idContrato?: number;
  idArrendatario?: number;
}

export interface PreviewFormulaResponse {
  idFormula: number;
  nombreFormula: string;
  expresionOriginal: string;
  expresionSustituida: string;
  variables: Record<string, number>;
  resultado: number;
  tipoResultado: 'MONTO' | 'PORCENTAJE';
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

  previewFormula(body: PreviewFormulaRequest): Observable<PreviewFormulaResponse> {
    return this.http.post<PreviewFormulaResponse>(`${this.base}/evaluar/preview`, body);
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