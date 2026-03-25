import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class InstalacionService {
  constructor(private http: HttpClient) {}

  obtenerInstalacionesData(page: number, limit: number): Observable<any> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    return this.http.get(
      `${environment.API_SECURITY}/instalacion-equipo/paginated`,
      { params }
    );
  }

  obtenerInstalaciones(): Observable<any> {
    return this.http.get(
      `${environment.API_SECURITY}/instalacion-equipo`
    );
  }

  agregarInstalacion(data: any) {
    return this.http.post(
      environment.API_SECURITY + '/instalacion-equipo',
      data
    );
  }

  eliminarInstalacion(idInstalacion: Number) {
    return this.http.delete(
      environment.API_SECURITY + '/instalacion-equipo/' + idInstalacion
    );
  }

  obtenerInstalacion(idInstalacion: number): Observable<any> {
    return this.http.get<any>(
      environment.API_SECURITY + '/instalacion-equipo/' + idInstalacion
    );
  }

  actualizarInstalacion(idInstalacion: number, saveForm: any): Observable<any> {
    return this.http.patch(
      `${environment.API_SECURITY}/instalacion-equipo/${idInstalacion}`,
      saveForm
    );
  }

  activar(id: number): Observable<string> {
    const url = `${environment.API_SECURITY}/instalacion-equipo/activar/${id}`;
    return this.http
      .patch(url, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }

  desactivar(id: number): Observable<string> {
    const url = `${environment.API_SECURITY}/instalacion-equipo/desactivar/${id}`;
    return this.http
      .patch(url, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }
}
