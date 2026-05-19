import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConstanciaFiscalOcrResponse } from '../../shared/constancia-fiscal-ocr.mapper';

@Injectable({
  providedIn: 'root',
})
export class PdfOcrService {
  private readonly base = `${environment.API_SECURITY}/pdf-ocr`;

  constructor(private http: HttpClient) {}

  /** POST multipart `file`: PDF de constancia de situación fiscal (SAT). */
  extraerConstanciaFiscal(file: File): Observable<ConstanciaFiscalOcrResponse> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<ConstanciaFiscalOcrResponse>(`${this.base}/constancia-fiscal`, fd);
  }
}
