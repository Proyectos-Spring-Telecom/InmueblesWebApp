import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class InstalacionCentral {
  constructor(private http: HttpClient) {}

  obtenerEquiposData(page: number, pageSize: number): Observable<any> {
    return this.http.get(
      `${environment.API_SECURITY}/equipos/${page}/${pageSize}`
    );
  }

  obtenerInstalacionCentral(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/instalacion-central`);
  }

  hoy(numeroSerie: string): Observable<any> {
    return this.http.get(
      `${environment.API_SECURITY}/incidencias/hoy/${encodeURIComponent(
        numeroSerie
      )}`
    );
  }

  ultimoHit(numeroSerie: string): Observable<any> {
    return this.http.get(
      `${environment.API_SECURITY}/incidencias/ultimo-hit/${encodeURIComponent(
        numeroSerie
      )}`
    );
  }

  rangoPaginado(
    numeroSerie: string,
    fechaInicio: string,
    fechaFin: string,
    page: number,
    limit: number
  ): Observable<any> {
    const params = new HttpParams()
      .set('fechaInicio', fechaInicio) // nombre correcto
      .set('fechaFin', fechaFin)
      .set('page', String(page))
      .set('limit', String(limit));

    return this.http.get(
      `${
        environment.API_SECURITY
      }/incidencias/rango-paginado/${encodeURIComponent(numeroSerie)}`,
      { params }
    );
  }
}
