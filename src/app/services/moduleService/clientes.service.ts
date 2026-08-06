import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClientesService {

  constructor(private http: HttpClient) { }

  obtenerClientesData(page: number, pageSize: number): Observable<any> {
		return this.http.get(`${environment.API_SECURITY}/arrendadores/${page}/${pageSize}`);
	}

  obtenerClientes(): Observable<any> {
		return this.http.get(`${environment.API_SECURITY}/arrendadores/list`);
	}

  agregarCliente(data: any) {
    return this.http.post(environment.API_SECURITY + '/arrendadores', data);
  }

  eliminarCliente(idCliente: Number) {
        return this.http.delete(environment.API_SECURITY + '/arrendadores/' + idCliente);
    }

  obtenerCliente(idCliente: number): Observable<any> {
        return this.http.get<any>(environment.API_SECURITY + '/arrendadores/' + idCliente);
    }

  actualizarCliente(idCliente: number, saveForm: any): Observable<any> {
    return this.http.put(`${environment.API_SECURITY}/arrendadores/` + idCliente, saveForm);
  }

  /** Soft-delete: pone Estatus = 0 en SociosArrendadores. */
  eliminarSocioArrendador(idSocioArrendador: number): Observable<unknown> {
    return this.http.delete(
      `${environment.API_SECURITY}/arrendadores/socios/${idSocioArrendador}`,
    );
  }

  private apiUrl = `${environment.API_SECURITY}/arrendadores`;
  updateEstatus(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/estatus/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }
  
}