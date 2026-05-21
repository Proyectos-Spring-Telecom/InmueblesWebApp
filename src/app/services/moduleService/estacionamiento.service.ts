import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EstacionamientoCrearActualizarPayload {
  idInmueble: number;
  nombrePensionado: string;
  numeroTarjeta: string;
  idArrendatario: number;
}

@Injectable({
  providedIn: 'root',
})
export class EstacionamientoService {
  private readonly base = `${environment.API_SECURITY}/estacionamientos`;

  constructor(private http: HttpClient) {}

  crear(payload: EstacionamientoCrearActualizarPayload): Observable<unknown> {
    return this.http.post<unknown>(this.base, payload);
  }

  actualizar(id: number, payload: EstacionamientoCrearActualizarPayload): Observable<unknown> {
    return this.http.patch<unknown>(`${this.base}/${id}`, payload);
  }

  obtenerPorId(id: number): Observable<unknown> {
    return this.http.get<unknown>(`${this.base}/${id}`);
  }

  listarPorInmueble(idInmueble: number): Observable<unknown> {
    return this.http.get<unknown>(`${this.base}/inmueble/${idInmueble}`);
  }

  /** PATCH `/estacionamientos/{id}/estatus` — body `{ estatus }` (0 baja, 1 activo). */
  actualizarEstatus(id: number, payload: { estatus: number }): Observable<unknown> {
    return this.http.patch<unknown>(`${this.base}/${id}/estatus`, payload);
  }

}
