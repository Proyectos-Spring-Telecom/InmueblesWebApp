import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HistoricoPagosRentaFiltros {
  page: number;
  limit: number;
  fechaInicio: string;
  fechaFin: string;
  idArrendatario?: number | null;
  idContrato?: number | null;
}

@Injectable({ providedIn: 'root' })
export class HistoricoPagosRentaService {
  private readonly url = `${environment.API_SECURITY}/historico-pagos-renta`;

  constructor(private http: HttpClient) {}

  obtenerHistoricoPaginado(filtros: HistoricoPagosRentaFiltros): Observable<unknown> {
    let params = new HttpParams()
      .set('page', String(filtros.page))
      .set('limit', String(filtros.limit))
      .set('fechaInicio', filtros.fechaInicio.trim())
      .set('fechaFin', filtros.fechaFin.trim());

    const idArr = Number(filtros.idArrendatario);
    if (Number.isFinite(idArr) && idArr > 0) {
      params = params.set('idArrendatario', String(Math.floor(idArr)));
    }

    const idCon = Number(filtros.idContrato);
    if (Number.isFinite(idCon) && idCon > 0) {
      params = params.set('idContrato', String(Math.floor(idCon)));
    }

    return this.http.get(`${this.url}/paginated`, { params });
  }

  obtenerHistoricoPorId(id: number): Observable<unknown> {
    return this.http.get(`${this.url}/${id}`);
  }

  obtenerUltimoPagoRenta(idArrendatario: number, idContrato: number): Observable<unknown> {
    const params = new HttpParams()
      .set('idArrendatario', String(Math.floor(idArrendatario)))
      .set('idContrato', String(Math.floor(idContrato)));
    return this.http.get(`${this.url}/ultimo`, { params });
  }
}
