import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class IncidenciasService {

    constructor(private http: HttpClient) { }

    hoy(): Observable<any> {
        return this.http.get(`${environment.API_SECURITY}/incidencias/hoy`);
    }

    ultimoHit(): Observable<any> {
        return this.http.get(`${environment.API_SECURITY}/incidencias/ultimo-hit`);
    }

    rangoPaginado(fechainicio: string, fechaFin: string, page: number, limit: number): Observable<any> {
        let params = new HttpParams()
            .set('fechainicio', fechainicio)
            .set('fechaInicio', fechainicio)
            .set('fechaFin', fechaFin)
            .set('page', String(page))
            .set('limit', String(limit));

        return this.http.get(`${environment.API_SECURITY}/incidencias/rango-paginado`, { params });
    }
}