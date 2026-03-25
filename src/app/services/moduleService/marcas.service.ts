import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MarcaService {

  constructor(private http: HttpClient) { }

  obtenerMarcasData(page: number, pageSize: number): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/marcas/${page}/${pageSize}`);
  }

  obtenerMarcas(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/marcas`);
  }

  agregarMarca(data: FormData) {
    return this.http.post(environment.API_SECURITY + '/marcas', data);
  }

  eliminarMarca(idMarca: number) {
    return this.http.delete(environment.API_SECURITY + '/marcas/' + idMarca);
  }

  obtenerMarca(idMarca: number): Observable<any> {
    return this.http.get<any>(environment.API_SECURITY + '/marcas/' + idMarca);
  }

  actualizarMarca(idMarca: number, saveForm: {
          nombre: string;
        }) {
        return this.http.patch<any>(`${environment.API_SECURITY}/marcas/${idMarca}`, saveForm);
    }

  private apiUrl = `${environment.API_SECURITY}/marcas/activar`;
  private apiUrlDes = `${environment.API_SECURITY}/marcas/desactivar`;
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