import { Component, Input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import { ArrendatarioGridRow } from '../arrendatarios-list.mapper';
import {
  esImagenArchivo,
  esPdfArchivo,
  formatearFecha,
  formatearMoneda,
  nombreArrendador,
  urlPdfMiniatura,
} from '../../inmuebles/inmuebles-list.mapper';

@Component({
  selector: 'app-lista-arrendatarios-detalle',
  templateUrl: './lista-arrendatarios-detalle.component.html',
  styleUrl: './lista-arrendatarios-detalle.component.scss',
  standalone: false,
})
export class ListaArrendatariosDetalleComponent {
  @Input({ required: true }) row!: ArrendatarioGridRow;

  @ViewChild('docPreview') docPreview?: DocumentoPreviewComponent;

  detalleTab = 0;

  esImagenArchivo = esImagenArchivo;
  esPdfArchivo = esPdfArchivo;
  formatearFecha = formatearFecha;
  formatearMoneda = formatearMoneda;
  nombreArrendador = nombreArrendador;

  constructor(private sanitizer: DomSanitizer) {}

  get item(): Record<string, unknown> {
    return this.row?.detalle ?? {};
  }

  get servicios(): Record<string, unknown>[] {
    const s = this.item['servicios'];
    return Array.isArray(s) ? (s as Record<string, unknown>[]) : [];
  }

  get archivos(): Record<string, unknown>[] {
    const a = this.item['archivos'];
    return Array.isArray(a) ? (a as Record<string, unknown>[]) : [];
  }

  get socios(): Record<string, unknown>[] {
    const so = this.item['socios'];
    return Array.isArray(so) ? (so as Record<string, unknown>[]) : [];
  }

  get contratos(): Record<string, unknown>[] {
    const c = this.item['contratos'];
    return Array.isArray(c) ? (c as Record<string, unknown>[]) : [];
  }

  nombreTipoServicio(s: Record<string, unknown>): string {
    const ts = s['tipoServicio'];
    if (ts != null && typeof ts === 'object') {
      const o = ts as Record<string, unknown>;
      const nom = String(o['nombre'] ?? o['servicio'] ?? '').trim();
      if (nom) return nom;
    }
    return 'Servicio';
  }

  urlComprobanteServicio(s: Record<string, unknown>): string {
    return String(s['urlComprobante'] ?? '').trim();
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
    const titulo = String(this.item['arrendatario'] ?? 'Arrendatario');
    this.docPreview?.abrir(url, nombre, titulo);
  }

  textoSocioDoc(url: unknown): boolean {
    return typeof url === 'string' && url.trim().length > 0;
  }

  metricasContrato(c: Record<string, unknown>): { label: string; value: string }[] {
    const n = (k: string): string => {
      const v = c[k];
      if (v == null || v === '') return '—';
      const num = Number(v);
      if (Number.isFinite(num) && String(v).trim() !== '') {
        if (
          [
            'metrosRentados',
            'porcentajeMantenimiento',
            'mesesDeposito',
            'mesesAdelanto',
            'aniosForzososArrendador',
            'aniosForzososArrendatario',
          ].includes(k)
        ) {
          return k === 'porcentajeMantenimiento' ? `${num} %` : String(num);
        }
        if (
          [
            'montoDeposito',
            'montoAdelanto',
            'subTotalRenta',
            'ivaRenta',
            'rentaTotal',
            'subTotalMantenimiento',
            'ivaMantenimiento',
            'mantenimientoTotal',
            'costoM2',
          ].includes(k)
        ) {
          return formatearMoneda(v);
        }
      }
      return String(v).trim();
    };

    return [
      { label: 'Metros rentados', value: n('metrosRentados') },
      { label: 'Costo m²', value: n('costoM2') },
      { label: '% mantenimiento', value: n('porcentajeMantenimiento') },
      { label: 'Meses depósito', value: n('mesesDeposito') },
      { label: 'Monto depósito', value: n('montoDeposito') },
      { label: 'Meses adelanto', value: n('mesesAdelanto') },
      { label: 'Monto adelanto', value: n('montoAdelanto') },
      { label: 'Años forz. arrendador', value: n('aniosForzososArrendador') },
      { label: 'Años forz. arrendatario', value: n('aniosForzososArrendatario') },
      { label: 'Subtotal renta', value: n('subTotalRenta') },
      { label: 'IVA renta', value: n('ivaRenta') },
      { label: 'Renta total', value: n('rentaTotal') },
      { label: 'Subtotal mant.', value: n('subTotalMantenimiento') },
      { label: 'IVA mant.', value: n('ivaMantenimiento') },
      { label: 'Mantenimiento total', value: n('mantenimientoTotal') },
    ];
  }

  inmuebleDesdeContrato(c: Record<string, unknown>): Record<string, unknown> | null {
    const inm = c['inmueble'];
    if (inm != null && typeof inm === 'object') return inm as Record<string, unknown>;
    return null;
  }

  etiquetaEstatusInmuebleEmpresa(raw: unknown): string {
    const n = Number(raw);
    if (n === 1) return 'Rentado';
    if (n === 2) return 'Propio';
    return '—';
  }
}
