import { Component, Input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import {
  esImagenArchivo,
  esPdfArchivo,
  formatearFecha,
  formatearMoneda,
  InmuebleApiItem,
  InmuebleGridRow,
  InmuebleZonaApi,
  contarLocalesInmueble,
  etiquetaEstatusLocal,
  localesDeZona,
  nombreArrendador,
  nombreServicio,
  urlPdfMiniatura,
} from '../inmuebles-list.mapper';

@Component({
  selector: 'app-lista-inmuebles-detalle',
  templateUrl: './lista-inmuebles-detalle.component.html',
  styleUrl: './lista-inmuebles-detalle.component.scss',
  standalone: false,
})
export class ListaInmueblesDetalleComponent {
  @Input({ required: true }) row!: InmuebleGridRow;

  @ViewChild('docPreview') docPreview?: DocumentoPreviewComponent;

  detalleTab = 0;

  esImagenArchivo = esImagenArchivo;
  esPdfArchivo = esPdfArchivo;

  constructor(private sanitizer: DomSanitizer) {}

  get item(): InmuebleApiItem {
    return this.row?.detalle ?? {};
  }

  get zonas() {
    return Array.isArray(this.item.zonas) ? this.item.zonas : [];
  }

  get servicios() {
    return Array.isArray(this.item.servicios) ? this.item.servicios : [];
  }

  get archivos() {
    return Array.isArray(this.item.archivos) ? this.item.archivos : [];
  }

  nombreArrendador = nombreArrendador;
  nombreServicio = nombreServicio;
  formatearFecha = formatearFecha;
  formatearMoneda = formatearMoneda;
  localesDeZona = localesDeZona;
  etiquetaEstatusLocal = etiquetaEstatusLocal;

  totalLocales(): number {
    return contarLocalesInmueble(this.item);
  }

  localesZona(z: InmuebleZonaApi) {
    return localesDeZona(z);
  }

  superficieTotalZonas(): number {
    return this.zonas.reduce((s, z) => s + (Number(z.superficieZonaM2) || 0), 0);
  }

  superficieDisponibleTotal(): number {
    return this.zonas.reduce((s, z) => s + (Number(z.superficieDisponibleM2) || 0), 0);
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
    this.docPreview?.abrir(url, nombre, this.row.inmueble);
  }
}
