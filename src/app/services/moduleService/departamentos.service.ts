import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DepartamentosService {

  constructor(private http: HttpClient) { }

  obtenerDepartamentos(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/cat-departamentos`);
  }

  obtenerDepartamentosData(page: number, limit: number): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/cat-departamentos/paginated?page=${page}&limit=${limit}`);
  }

  obtenerDepartamento(idDepartamento: number): Observable<any> {
    return this.http.get<any>(`${environment.API_SECURITY}/cat-departamentos/${idDepartamento}`);
  }

  agregarDepartamento(data: { nombre: string }): Observable<any> {
    return this.http.post(`${environment.API_SECURITY}/cat-departamentos`, data);
  }

  actualizarDepartamento(idDepartamento: number, data: { nombre: string }): Observable<any> {
    return this.http.patch<any>(`${environment.API_SECURITY}/cat-departamentos/${idDepartamento}`, data);
  }

  private apiUrl = `${environment.API_SECURITY}/cat-departamentos/activar`;
  private apiUrlDes = `${environment.API_SECURITY}/cat-departamentos/desactivar`;
  
  updateEstatusActivar(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  updateEstatusDesactivar(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrlDes}/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }
}

