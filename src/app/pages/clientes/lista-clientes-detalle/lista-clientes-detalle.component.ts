import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, Input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { take } from 'rxjs';
import Swal from 'sweetalert2';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
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
  eliminandoSocioId: number | null = null;

  esImagenArchivo = esImagenArchivo;
  esPdfArchivo = esPdfArchivo;

  constructor(
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private clieService: ClientesService,
    private cdr: ChangeDetectorRef,
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
    if (!Array.isArray(so)) return [];
    return (so as Record<string, unknown>[]).filter((s) => {
      const est = s['estatus'];
      if (est == null || String(est).trim() === '') return true;
      return Number(est) !== 0;
    });
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

  idSocioArrendador(so: Record<string, unknown>): number | null {
    const raw = so['idSocioArrendador'] ?? so['id'];
    if (raw == null || String(raw).trim() === '' || !Number.isFinite(Number(raw))) {
      return null;
    }
    return Math.trunc(Number(raw));
  }

  eliminarSocio(so: Record<string, unknown>, ev?: Event): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    const idSocio = this.idSocioArrendador(so);
    if (idSocio == null || this.eliminandoSocioId != null) return;

    const nombre = String(so['nombre'] ?? '').trim() || `Socio ${idSocio}`;

    void Swal.fire({
      title: '¡Eliminar Socio!',
      html: `¿Está seguro que requiere eliminar el socio: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed && !result.value) return;

      this.eliminandoSocioId = idSocio;
      this.cdr.markForCheck();

      this.clieService.eliminarSocioArrendador(idSocio).subscribe({
        next: () => {
          this.quitarSocioDelDetalle(idSocio);
          this.eliminandoSocioId = null;
          this.cdr.detectChanges();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Eliminado!',
            html: 'El socio ha sido eliminado de forma exitosa.',
            icon: 'success',
            showCancelButton: false,
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
        },
        error: () => {
          this.eliminandoSocioId = null;
          this.cdr.markForCheck();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Ops!',
            html: 'Error al intentar eliminar el socio.',
            icon: 'error',
            showCancelButton: false,
          });
        },
      });
    });
  }

  private quitarSocioDelDetalle(idSocio: number): void {
    const detalle = this.row?.detalle;
    if (!detalle) return;

    const lista = detalle['sociosArrendadores'];
    if (!Array.isArray(lista)) return;

    detalle['sociosArrendadores'] = lista.filter((raw) => {
      if (raw == null || typeof raw !== 'object') return true;
      const o = raw as Record<string, unknown>;
      const id = o['idSocioArrendador'] ?? o['id'];
      return !(
        id != null &&
        Number.isFinite(Number(id)) &&
        Math.trunc(Number(id)) === idSocio
      );
    });

    const restantes = detalle['sociosArrendadores'] as unknown[];
    this.row.numSocios = restantes.length;
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
