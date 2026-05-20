import { HttpClient } from '@angular/common/http';
import { Component, Input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { take } from 'rxjs';
import Swal from 'sweetalert2';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import {
  ClienteArchivoItem,
  ClienteGridRow,
  nombreDeArchivoApi,
} from '../clientes-list.mapper';
import {
  esImagenArchivo,
  esPdfArchivo,
  urlPdfMiniatura,
} from '../../inmuebles/inmuebles-list.mapper';

@Component({
  selector: 'app-lista-clientes-detalle',
  templateUrl: './lista-clientes-detalle.component.html',
  styleUrl: './lista-clientes-detalle.component.scss',
  standalone: false,
})
export class ListaClientesDetalleComponent {
  @Input({ required: true }) row!: ClienteGridRow;

  @ViewChild('docPreview') docPreview?: DocumentoPreviewComponent;

  private readonly swalToastDescargaError = Swal.mixin({
    toast: true,
    position: 'top-end',
    icon: 'error',
    showConfirmButton: false,
    timer: 5200,
    timerProgressBar: true,
    background: '#141a21',
    color: '#ffffff',
  });

  detalleTab = 0;

  esImagenArchivo = esImagenArchivo;
  esPdfArchivo = esPdfArchivo;

  constructor(
    private sanitizer: DomSanitizer,
    private http: HttpClient,
  ) {}

  get item(): Record<string, unknown> {
    return this.row?.detalle ?? {};
  }

  get archivos(): ClienteArchivoItem[] {
    const a = this.item['archivos'];
    return Array.isArray(a) ? (a as ClienteArchivoItem[]) : [];
  }

  get socios(): Record<string, unknown>[] {
    const so = this.item['sociosArrendadores'];
    return Array.isArray(so) ? (so as Record<string, unknown>[]) : [];
  }

  urlVistaPreviaPdf(url?: string): SafeResourceUrl | null {
    if (!url?.trim() || !esPdfArchivo(url)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(urlPdfMiniatura(url));
  }

  iconoArchivo(url: string, nombre: string): string {
    if (esImagenArchivo(url, nombre)) return 'fa-file-image-o';
    if (esPdfArchivo(url, nombre)) return 'fa-file-pdf-o';
    return 'fa-file-o';
  }

  abrirDocumento(url: string | undefined, nombre: string): void {
    if (!url?.trim()) return;
    const titulo = String(this.row?.NombreCompleto ?? 'Arrendador');
    this.docPreview?.abrir(url, nombre, titulo);
  }

  textoSocioDoc(url: unknown): boolean {
    return typeof url === 'string' && url.trim().length > 0;
  }

  descargarDocumento(
    url: string | undefined,
    nombreFallback: string,
    ev?: Event,
  ): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    const urlTrim = url?.trim();
    if (!urlTrim) return;
    const nombre = this.nombreParaDescarga(urlTrim, nombreFallback);
    this.http
      .get(urlTrim, { responseType: 'blob' })
      .pipe(take(1))
      .subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = nombre;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objectUrl);
        },
        error: () => {
          void this.swalToastDescargaError.fire({
            title: 'No se pudo descargar',
            text: 'No se obtuvo el archivo. Verifica la URL o el acceso al almacenamiento.',
          });
        },
      });
  }

  private nombreParaDescarga(url: string, fallback: string): string {
    const desdeUrl = nombreDeArchivoApi(url, '');
    if (desdeUrl && desdeUrl !== url) return desdeUrl;
    const ext = url.match(/\.(pdf|png|jpe?g|gif|webp|jfif)(\?|$|#)/i);
    if (ext) return `${fallback}.${ext[1].toLowerCase()}`;
    return fallback;
  }
}
