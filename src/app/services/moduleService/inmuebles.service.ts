import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class InmueblesService {
  private readonly base = `${environment.API_SECURITY}/inmuebles`;

  constructor(private http: HttpClient) {}

  crearInmueble(data: FormData): Observable<unknown> {
    return this.http.post(this.base, data);
  }
}
