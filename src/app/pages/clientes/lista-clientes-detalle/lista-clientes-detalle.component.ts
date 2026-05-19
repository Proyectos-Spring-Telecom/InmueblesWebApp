import { Component, Input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import {
  ClienteArchivoItem,
  ClienteGridRow,
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

  detalleTab = 0;

  esImagenArchivo = esImagenArchivo;
  esPdfArchivo = esPdfArchivo;

  constructor(private sanitizer: DomSanitizer) {}

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
}
