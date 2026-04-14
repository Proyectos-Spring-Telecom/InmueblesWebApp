import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ContratosService {
  private readonly base = `${environment.API_SECURITY}/contratos`;

  constructor(private http: HttpClient) {}

  obtenerContratosData(page: number, limit: number): Observable<any> {
    return this.http.get(`${this.base}/paginated?page=${page}&limit=${limit}`);
  }

  obtenerContrato(id: number): Observable<any> {
    return this.http.get(`${this.base}/${id}`);
  }

  agregarContrato(data: FormData): Observable<any> {
    return this.http.post(this.base, data);
  }

  actualizarContrato(id: number, data: FormData): Observable<any> {
    return this.http.patch(`${this.base}/${id}`, data);
  }
}
