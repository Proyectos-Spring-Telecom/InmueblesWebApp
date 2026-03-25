import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class InstalacionCentralSede {
  constructor(private http: HttpClient) { }

  obtenerInstalacionesData(page: number, limit: number): Observable<any> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    return this.http.get(
      `${environment.API_SECURITY}/instalacion-central/paginated`,
      { params }
    );
  }

  obtenerInstalaciones(): Observable<any> {
    return this.http.get(
      `${environment.API_SECURITY}/instalacion-central`
    );
  }

  agregarInstalacion(data: FormData) {
    return this.http.post(
      environment.API_SECURITY + '/instalacion-central',
      data
    );
  }

  eliminarInstalacion(idCliente: Number) {
    return this.http.delete(
      environment.API_SECURITY + '/instalacion-central/' + idCliente
    );
  }

  obtenerInstalacion(idCliente: number): Observable<any> {
    return this.http.get<any>(
      environment.API_SECURITY + '/instalacion-central/' + idCliente
    );
  }

  actualizarInstalacion(idSedeCentral: number, saveForm: any): Observable<any> {
    return this.http.patch(
      `${environment.API_SECURITY}/instalacion-central/${idSedeCentral}`,
      saveForm
    );
  }

  activar(id: number): Observable<string> {
    const url = `${environment.API_SECURITY}/instalacion-central/activar/${id}`;
    return this.http
      .patch(url, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }

  desactivar(id: number): Observable<string> {
    const url = `${environment.API_SECURITY}/instalacion-central/desactivar/${id}`;
    return this.http
      .patch(url, {}, { responseType: 'text' })
      .pipe(catchError((error) => throwError(() => error)));
  }

  obtenerPisos(idInstalacionCentral: number): Observable<any> {
    return this.http.get<any>(
      `${environment.API_SECURITY}/instalacion-central/pisos/${idInstalacionCentral}`
    );
  }
}
