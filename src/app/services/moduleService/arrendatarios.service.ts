import { HttpClient } from '@angular/common/http';
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

  crearArrendatario(data: FormData): Observable<unknown> {
    return this.http.post(this.base, data);
  }

  obtenerArrendatario(id: number): Observable<unknown> {
    return this.http.get(`${this.base}/${id}`);
  }

  obtenerArrendatariosPorInmueble(idInmueble: number): Observable<unknown> {
    return this.http.get(`${this.base}/inmueble/${idInmueble}`);
  }

  actualizarArrendatario(id: number, data: FormData): Observable<unknown> {
    return this.http.put(`${this.base}/${id}`, data);
  }
}
