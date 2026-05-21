import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EntradasSalidasPaginatedQuery {
  idInmueble: number;
  page?: number;
  limit?: number;
  fechaInicio?: string;
  fechaFin?: string;
}

@Injectable({ providedIn: 'root' })
export class EntradasSalidasEstacionamientoService {
  private readonly base = `${environment.API_SECURITY}/entradas-salidas-estacionamiento`;

  constructor(private http: HttpClient) {}

  /**
   * GET `/entradas-salidas-estacionamiento/paginated`
   * — listado por `idInmueble` y rango opcional de fechas de entrada.
   */
  listarPaginado(query: EntradasSalidasPaginatedQuery): Observable<unknown> {
    let params = new HttpParams()
      .set('idInmueble', String(Math.floor(query.idInmueble)))
      .set('page', String(query.page ?? 1))
      .set('limit', String(query.limit ?? 50));
    const ini = (query.fechaInicio ?? '').trim();
    const fin = (query.fechaFin ?? '').trim();
    if (ini) params = params.set('fechaInicio', ini);
    if (fin) params = params.set('fechaFin', fin);
    return this.http.get<unknown>(`${this.base}/paginated`, { params });
  }

  /** POST `/entradas-salidas-estacionamiento/importar` — multipart. */
  importarExcel(idInmueble: number, archivo: File): Observable<unknown> {
    const fd = new FormData();
    fd.append('idInmueble', String(Math.floor(idInmueble)));
    fd.append('archivo', archivo, archivo.name);
    return this.http.post<unknown>(`${this.base}/importar`, fd);
  }
}
