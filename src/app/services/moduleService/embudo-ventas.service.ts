import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CrearEventoEmbudoDto {
  fhProximoEvento: string;
  medioComunicacion: number;
  comentario: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class EmbudoVentasService {

  constructor(private http: HttpClient) { }

  private readonly apiUrl = `${environment.API_SECURITY}/embudo-ventas`;

  obtenerEmbudos(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  obtenerEmbudo(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  obtenerMediosComunicacion(): Observable<any> {
    return this.http.get(`${this.apiUrl}/medios-comunicacion`);
  }

  agregarEvento(idEmbudoVentas: number, data: CrearEventoEmbudoDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/${idEmbudoVentas}/eventos`, data).pipe(
      catchError(error => throwError(() => error))
    );
  }

  registrarConclusionEvento(idEvento: number, conclusionEvento: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/eventos/${idEvento}`, { conclusionEvento }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  updateEstatus(id: number, estatus: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/estatus/${id}`, { estatus }).pipe(
      catchError(error => throwError(() => error))
    );
  }

}
