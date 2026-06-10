import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

/** Cuerpo de POST /formulas/evaluar/preview (modal de renta del mes). */
export interface RentaFormulaPreviewRequest {
  idFormula: number;
  idContrato: number;
  idArrendatario: number;
}

export interface RentaFormulaPreviewResponse {
  idFormula: number;
  nombreFormula: string;
  expresionOriginal: string;
  expresionSustituida: string;
  variables: Record<string, number>;
  resultado: number;
  tipoResultado: 'MONTO' | 'PORCENTAJE';
}

/**
 * Preview de fórmula para el modal de rentas actuales.
 * No modifica FormulasService; solo llama a evaluar/preview sin auditoría.
 */
@Injectable({ providedIn: 'root' })
export class RentaFormulaPreviewService {
  private readonly url = `${environment.API_SECURITY}/formulas/evaluar`;

  constructor(private readonly http: HttpClient) {}

  preview(body: RentaFormulaPreviewRequest): Observable<RentaFormulaPreviewResponse> {
    return this.http.post<RentaFormulaPreviewResponse>(`${this.url}/preview`, body);
  }
}
