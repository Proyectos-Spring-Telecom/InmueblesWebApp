import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * POST `/pago` — multipart (comprobante a S3).
 * Nombres de partes alineados con Swagger.
 */
@Injectable({ providedIn: 'root' })
export class PagoInmuebleService {
  private readonly url = `${environment.API_SECURITY}/pago`;

  constructor(private http: HttpClient) {}

  registrarPago(formData: FormData): Observable<unknown> {
    return this.http.post<unknown>(this.url, formData);
  }
}
