import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Filtros de `GET /contratos/costos-actuales/paginated` (Rent Rol). */
export interface CostosActualesParams {
  page: number;
  limit: number;
  idInmueble?: number | null;
  idArrendatario?: number | null;
  idContrato?: number | null;
  busqueda?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ContratosService {
  private readonly base = `${environment.API_SECURITY}/contratos`;

  constructor(private http: HttpClient) {}

  obtenerContratosData(page: number, limit: number): Observable<any> {
    return this.http.get(`${this.base}/paginated?page=${page}&limit=${limit}`);
  }

  /**
   * Costos vigentes por relación inmueble ↔ arrendatario (contrato activo).
   * No trae estado de pago ni cargos; eso sigue en `/renta-actual` e histórico.
   */
  obtenerCostosActualesPaginated(params: CostosActualesParams): Observable<unknown> {
    let httpParams = new HttpParams()
      .set('page', String(Math.max(1, Math.floor(params.page) || 1)))
      .set('limit', String(Math.min(500, Math.max(1, Math.floor(params.limit) || 20))));
    const idInmueble = Number(params.idInmueble);
    if (Number.isFinite(idInmueble) && idInmueble > 0) {
      httpParams = httpParams.set('idInmueble', String(Math.floor(idInmueble)));
    }
    const idArrendatario = Number(params.idArrendatario);
    if (Number.isFinite(idArrendatario) && idArrendatario > 0) {
      httpParams = httpParams.set('idArrendatario', String(Math.floor(idArrendatario)));
    }
    const idContrato = Number(params.idContrato);
    if (Number.isFinite(idContrato) && idContrato > 0) {
      httpParams = httpParams.set('idContrato', String(Math.floor(idContrato)));
    }
    const busqueda = String(params.busqueda ?? '').trim().slice(0, 100);
    if (busqueda) {
      httpParams = httpParams.set('busqueda', busqueda);
    }
    return this.http.get(`${this.base}/costos-actuales/paginated`, { params: httpParams });
  }

  obtenerContrato(id: number): Observable<any> {
    return this.http.get(`${this.base}/${id}`);
  }

  agregarContrato(data: FormData): Observable<any> {
    return this.http.post(this.base, data);
  }

  actualizarContrato(id: number, data: FormData): Observable<any> {
    return this.http.patch(`${this.base}/${id}`, data);
  }

  cancelarContrato(id: number): Observable<unknown> {
    return this.http.patch(`${this.base}/${id}/cancelar`, {});
  }

  /** Cancela la asignación de un local en contrato (`ContratoLocales`). */
  cancelarContratoLocal(idContratoLocal: number): Observable<unknown> {
    return this.http.patch(`${this.base}/locales/${idContratoLocal}/cancelar`, {});
  }
}
