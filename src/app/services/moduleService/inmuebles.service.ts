import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { conAvisoArchivosPesados } from 'src/app/shared/swal-archivos-pesados';

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
    return conAvisoArchivosPesados(this.http.post(this.base, data));
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
    return conAvisoArchivosPesados(this.http.put(`${this.base}/${id}`, data));
  }

  /** Soft-delete del inmueble. */
  eliminarInmueble(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }

  updateEstatus(id: number, estatus: number): Observable<string> {
    return this.http.patch(`${this.base}/estatus/${id}`, { estatus }, {
      responseType: 'text',
    });
  }

  eliminarServicioInmueble(idServicio: number): Observable<unknown> {
    return this.http.delete(`${this.base}/servicios/${idServicio}`);
  }

  eliminarZonaInmueble(idZona: number): Observable<unknown> {
    return this.http.delete(`${this.base}/zonas/${idZona}`);
  }

  eliminarArchivoInmueble(idArchivo: number): Observable<unknown> {
    return this.http.delete(`${this.base}/archivos/${idArchivo}`);
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
