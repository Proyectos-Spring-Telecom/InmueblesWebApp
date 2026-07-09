import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * POST `/pago` — multipart (comprobante a S3).
 * Nombres de partes alineados con Swagger.
 */
@Injectable({ providedIn: 'root' })
export class PagoInmuebleService {
  private readonly url = `${environment.API_SECURITY}/pago`;

  constructor(private http: HttpClient) {}

  registrarPago(formData: FormData): Observable<unknown> {
    return this.http.post<unknown>(this.url, formData);
  }

  obtenerPagosPaginados(opts: {
    page: number;
    limit: number;
    fechaInicio: string;
    fechaFin: string;
    idInmueble?: number | null;
    estatus?: number | null;
  }): Observable<unknown> {
    let params = new HttpParams()
      .set('page', String(opts.page))
      .set('limit', String(opts.limit))
      .set('fechaInicio', opts.fechaInicio)
      .set('fechaFin', opts.fechaFin);
    const idInmueble = Number(opts.idInmueble);
    if (Number.isFinite(idInmueble) && idInmueble > 0) {
      params = params.set('idInmueble', String(Math.floor(idInmueble)));
    }
    const estatus = Number(opts.estatus);
    if (Number.isFinite(estatus) && (estatus === 0 || estatus === 1 || estatus === 2)) {
      params = params.set('estatus', String(Math.floor(estatus)));
    }
    return this.http.get(`${this.url}/paginated`, { params });
  }

  obtenerPagoPorId(id: number): Observable<unknown> {
    return this.http.get(`${this.url}/${id}`);
  }

  /** PATCH `/pago/{id}/estatus` — body JSON `{ estatus }`. */
  actualizarEstatus(id: number, payload: { estatus: number }): Observable<unknown> {
    return this.http.patch<unknown>(`${this.url}/${id}/estatus`, payload);
  }
}