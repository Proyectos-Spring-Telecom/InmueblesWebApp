import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ArrendatariosService {
  private readonly base = `${environment.API_SECURITY}/arrendatarios`;

  constructor(private http: HttpClient) {}

  obtenerArrendatariosPaginated(page: number, limit: number): Observable<unknown> {
    return this.http.get(`${this.base}/paginated?page=${page}&limit=${limit}`);
  }

  obtenerArrendatariosListado(): Observable<unknown> {
    return this.http.get(`${this.base}/listado`);
  }

  crearArrendatario(data: FormData): Observable<unknown> {
    return this.http.post(this.base, data);
  }

  obtenerArrendatario(id: number): Observable<unknown> {
    return this.http.get(`${this.base}/${id}`);
  }

  /** Servicios del arrendatario (Renta, Mantenimiento, etc.) — `id` = `idServicioArrendatario` para pagos. */
  obtenerServiciosArrendatario(idArrendatario: number): Observable<unknown> {
    return this.http.get(`${this.base}/servicios/${idArrendatario}`);
  }

  obtenerArrendatariosPorInmueble(idInmueble: number): Observable<unknown> {
    return this.http.get(`${this.base}/inmueble/${idInmueble}`);
  }

  actualizarArrendatario(id: number, data: FormData): Observable<unknown> {
    return this.http.put(`${this.base}/${id}`, data);
  }

  obtenerDashboardArrendatario(
    idArrendatario: number,
    fechaInicio: string,
    fechaFin: string,
  ): Observable<unknown> {
    const params = new HttpParams()
      .set('fechaInicio', fechaInicio)
      .set('fechaFin', fechaFin);
    return this.http.get(`${this.base}/dashboard/${idArrendatario}`, { params });
  }
}