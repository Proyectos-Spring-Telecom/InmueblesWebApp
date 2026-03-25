import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class EquipoService {

    constructor(private http: HttpClient) { }

    obtenerEquiposData(page: number, pageSize: number): Observable<any> {
        return this.http.get(`${environment.API_SECURITY}/equipos/${page}/${pageSize}`);
    }

    obtenerEquipos(): Observable<any> {
        return this.http.get(`${environment.API_SECURITY}/equipos`);
    }

    obtenerEquiposDisponibles(): Observable<any> {
        return this.http.get(`${environment.API_SECURITY}/equipos/disponibles`);
    }

    agregarEquipo(data: FormData) {
        return this.http.post(environment.API_SECURITY + '/equipos', data);
    }

    eliminarEquipo(idMarca: number) {
        return this.http.delete(environment.API_SECURITY + '/equipos/' + idMarca);
    }

    obtenerEquipo(idMarca: number): Observable<any> {
        return this.http.get<any>(environment.API_SECURITY + '/equipos/' + idMarca);
    }

    actualizarEquipo(idMarca: number, saveForm: {
        nombre: string;
    }) {
        return this.http.patch<any>(`${environment.API_SECURITY}/equipos/${idMarca}`, saveForm);
    }

    activar(id: number): Observable<string> {
        const url = `${environment.API_SECURITY}/equipos/activar/${id}`;
        return this.http.patch(url, {}, { responseType: 'text' }).pipe(
            catchError(error => throwError(() => error))
        );
    }

    desactivar(id: number): Observable<string> {
        const url = `${environment.API_SECURITY}/equipos/desactivar/${id}`;
        return this.http.patch(url, {}, { responseType: 'text' }).pipe(
            catchError(error => throwError(() => error))
        );
    }
}