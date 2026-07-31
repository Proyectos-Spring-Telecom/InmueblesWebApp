import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClientesInmueblesService {

  constructor(private http: HttpClient) { }

  private readonly apiUrl = `${environment.API_SECURITY}/clientes`;

  obtenerClientesData(page: number, pageSize: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${page}/${pageSize}`);
  }

  obtenerClientes(): Observable<any> {
    return this.http.get(`${this.apiUrl}/list`);
  }

  agregarCliente(data: any) {
    return this.http.post(this.apiUrl, data);
  }

  eliminarCliente(idCliente: number) {
    return this.http.delete(`${this.apiUrl}/${idCliente}`);
  }

  obtenerCliente(idCliente: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${idCliente}`);
  }

  actualizarCliente(idCliente: number, saveForm: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${idCliente}`, saveForm);
  }

  updateEstatus(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/estatus/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }

}
