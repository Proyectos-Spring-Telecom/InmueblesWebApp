import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {

  constructor(private http: HttpClient) { }

  obtenerUsuarios(): Observable<any> {
    return this.http.get<any>(`${environment.API_SECURITY}/usuarios/list`);
  }

  obtenerUsuariosData(page: number, limit: number): Observable<any> {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    return this.http.get(
      `${environment.API_SECURITY}/usuarios/${pageNum}/${limitNum}`
    );
  }

  obtenerUsuariosRolOperador(): Observable <any>{
    return this.http.get<any>(`${environment.API_SECURITY}/usuarios/list/rol/operador`)
  }

  agregarUsuario(data: FormData) {
    return this.http.post(environment.API_SECURITY + '/usuarios', data);
  }

  eliminarUsuario(idUsuario: Number) {
		return this.http.delete(environment.API_SECURITY + '/usuarios/' + idUsuario);
	}

  obtenerUsuario(idUsuario: number): Observable<any> {
		return this.http.get<any>(environment.API_SECURITY + '/usuarios/' + idUsuario);
	}

  actualizarUsuario(idUsuario: number, saveForm: any): Observable<any> {
    return this.http.put(`${environment.API_SECURITY}/usuarios/` + idUsuario, saveForm);
  }
  
  uploadFile(data: FormData): Observable<any> {
    return this.http.post<any>(`${environment.API_SECURITY}/s3/upload`, data);
  }

  actualizarContrasena(idUsuario: number, data: any): Observable<any> {
    return this.http.put(`${environment.API_SECURITY}/usuarios/actualizar/contrasena/` + idUsuario, data);
  }

  private apiUrl = `${environment.API_SECURITY}/usuarios`;
  updateEstatus(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/estatus/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  solicitarCambioContrasena(data: any) {
    return this.http.post(
      environment.API_SECURITY + '/login/usuario/recuperar/acceso',
      data,
      { responseType: 'text' as const }
    );
  }

  /**
   * PATCH /login/cambiar/accesso — restablecer contraseña desde enlace (token en URL).
   * Body: { userName, password }. Si se pasa token, se envía Authorization: Bearer <token>.
   */
  cambiarAccesso(userName: string, password: string, token?: string | null): Observable<any> {
    const options: { headers?: HttpHeaders; responseType: 'text' } = {
      responseType: 'text' as const,
    };
    if (token && typeof token === 'string' && token.trim().length > 0) {
      options.headers = new HttpHeaders().set('Authorization', `Bearer ${token.trim()}`);
    }
    return this.http.patch(
      environment.API_SECURITY + '/login/cambiar/accesso',
      { userName, password },
      options
    );
  }

  cambioContrasena(data: any, token: string) {
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post(
      environment.API_SECURITY + '/login/cambiar/accesso',
      data,
      {
        headers,
        responseType: 'text' as const
      }
    );
  }
}