import { HttpClient } from '@angular/common/http';
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

  crearInmueble(data: FormData): Observable<unknown> {
    return this.http.post(this.base, data);
  }

  obtenerInmueble(id: number): Observable<unknown> {
    return this.http.get(`${this.base}/${id}`);
  }

  actualizarInmueble(id: number, data: FormData): Observable<unknown> {
    return this.http.put(`${this.base}/${id}`, data);
  }
}
