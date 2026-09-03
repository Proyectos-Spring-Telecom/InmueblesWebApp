import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { conAvisoArchivosPesados } from 'src/app/shared/swal-archivos-pesados';

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
    return conAvisoArchivosPesados(this.http.post(this.base, data));
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
    return conAvisoArchivosPesados(this.http.put(`${this.base}/${id}`, data));
  }

  /** Soft-delete del arrendatario. */
  eliminarArrendatario(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }

  /**
   * Reactivar arrendatario dado de baja (`PATCH /arrendatarios/{id}/alta`).
   * - `conDependientes: true` → reactiva todo (contratos, servicios, docs…) y marca locales ocupados.
   * - `conDependientes: false` → solo reactiva el arrendatario; el resto queda histórico.
   */
  darAltaArrendatario(
    id: number,
    conDependientes: boolean,
  ): Observable<unknown> {
    return this.http.patch(`${this.base}/${id}/alta`, { conDependientes });
  }

  /** Soft-delete: contrato de arrendatario. */
  eliminarContratoArrendatario(idContrato: number): Observable<unknown> {
    return this.http.delete(`${this.base}/contratos/${idContrato}`);
  }

  /** Soft-delete: servicio de arrendatario. */
  eliminarServicioArrendatario(idServicio: number): Observable<unknown> {
    return this.http.delete(`${this.base}/servicios/${idServicio}`);
  }

  /** Soft-delete: socio de arrendatario. */
  eliminarSocioArrendatario(idSocio: number): Observable<unknown> {
    return this.http.delete(`${this.base}/socios/${idSocio}`);
  }

  /** Soft-delete: archivo de arrendatario. */
  eliminarArchivoArrendatario(idArchivo: number): Observable<unknown> {
    return this.http.delete(`${this.base}/archivos/${idArchivo}`);
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