import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Pagos asociados al arrendatario (multipart con comprobante S3).
 * Endpoints Swagger: `/pagos-arrendatarios`, `/pagos-arrendatarios/paginated`, etc.
 */
@Injectable({ providedIn: 'root' })
export class PagoArrendatarioService {
  private readonly url = `${environment.API_SECURITY}/pagos-arrendatarios`;

  constructor(private http: HttpClient) {}

  registrarPago(formData: FormData): Observable<unknown> {
    return this.http.post<unknown>(this.url, formData);
  }

  obtenerPagosPaginados(opts: {
    page: number;
    limit: number;
    fechaInicio: string;
    fechaFin: string;
    idArrendatario?: number | null;
  }): Observable<unknown> {
    let params = new HttpParams()
      .set('page', String(opts.page))
      .set('limit', String(opts.limit))
      .set('fechaInicio', opts.fechaInicio)
      .set('fechaFin', opts.fechaFin);
    const idArrendatario = Number(opts.idArrendatario);
    if (Number.isFinite(idArrendatario) && idArrendatario > 0) {
      params = params.set('idArrendatario', String(Math.floor(idArrendatario)));
    }
    return this.http.get(`${this.url}/paginated`, { params });
  }

  obtenerPagoPorId(id: number): Observable<unknown> {
    return this.http.get(`${this.url}/${id}`);
  }

  actualizarEstatus(id: number, payload: { estatus: number }): Observable<unknown> {
    return this.http.patch<unknown>(`${this.url}/${id}/estatus`, payload);
  }
}
