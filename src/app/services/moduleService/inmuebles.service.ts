import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class InmueblesService {
  private readonly base = `${environment.API_SECURITY}/inmuebles`;

  constructor(private http: HttpClient) {}

  obtenerInmueblesData(page: number, limit: number): Observable<any> {
    return this.http.get(`${this.base}/paginated?page=${page}&limit=${limit}`);
  }

  obtenerInmueblesPorArrendador(idArrendador: number): Observable<unknown> {
    return this.http.get(`${this.base}/arrendador/${idArrendador}`);
  }

  crearInmueble(data: FormData): Observable<unknown> {
    return this.http.post(this.base, data);
  }

  obtenerInmueble(id: number): Observable<unknown> {
    return this.http.get(`${this.base}/${id}`);
  }

  obtenerLocalesPorInmueble(idInmueble: number): Observable<unknown> {
    return this.http.get(`${this.base}/locales/${idInmueble}`);
  }

  obtenerLocalesLibres(idInmueble: number): Observable<unknown> {
    return this.http.get(`${this.base}/locales-libres/${idInmueble}`);
  }

  actualizarEstatusLocal(idLocal: number, estatus: number): Observable<unknown> {
    return this.http.patch(`${this.base}/locales/${idLocal}/estatus`, {
      estatus,
    });
  }

  actualizarMapaInmueble(
    idInmueble: number,
    mapaInmueble: Record<string, unknown>,
  ): Observable<unknown> {
    return this.http.patch(`${this.base}/mapa/${idInmueble}`, {
      mapaInmueble,
    });
  }

  actualizarInmueble(id: number, data: FormData): Observable<unknown> {
    return this.http.put(`${this.base}/${id}`, data);
  }

  obtenerMetrosInmueble(idInmueble: number): Observable<unknown> {
    return this.http.get(`${this.base}/area-ocupada/${idInmueble}`);
  }

  obtenerDashboardInmueble(
    idInmueble: number,
    fechaInicio: string,
    fechaFin: string,
  ): Observable<unknown> {
    const params = new HttpParams()
      .set('fechaInicio', fechaInicio)
      .set('fechaFin', fechaFin);
    return this.http.get(`${this.base}/dashboard/${idInmueble}`, { params });
  }
}
