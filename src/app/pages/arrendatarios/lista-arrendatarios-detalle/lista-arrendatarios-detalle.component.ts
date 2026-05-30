import { HttpClient } from '@angular/common/http';
import { Component, Input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { take } from 'rxjs';
import Swal from 'sweetalert2';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import { ArrendatarioGridRow } from '../arrendatarios-list.mapper';
import {
  claseChipEstatusLocal,
  esImagenArchivo,
  esPdfArchivo,
  etiquetaEstatusLocal,
  formatearFecha,
  formatearMoneda,
  nombreArrendador,
  urlPdfMiniatura,
} from '../../inmuebles/inmuebles-list.mapper';

export interface MetricaContratoVista {
  label: string;
  value: string;
}

export interface GrupoMetricasContrato {
  titulo: string;
  metricas: MetricaContratoVista[];
}

@Component({
  selector: 'app-lista-arrendatarios-detalle',
  templateUrl: './lista-arrendatarios-detalle.component.html',
  styleUrl: './lista-arrendatarios-detalle.component.scss',
  standalone: false,
})
export class ListaArrendatariosDetalleComponent {
  @Input({ required: true }) row!: ArrendatarioGridRow;

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
  formatearFecha = formatearFecha;
  formatearMoneda = formatearMoneda;
  nombreArrendador = nombreArrendador;
  etiquetaEstatusLocal = etiquetaEstatusLocal;
  claseChipEstatusLocal = claseChipEstatusLocal;

  constructor(
    private sanitizer: DomSanitizer,
    private http: HttpClient,
  ) {}

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
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return decodeURIComponent(last);
    } catch {
      const seg = url.split('/').pop()?.split('?')[0]?.split('#')[0] ?? '';
      if (seg && seg.includes('.')) return decodeURIComponent(seg);
    }
    const ext = url.match(/\.(pdf|png|jpe?g|gif|webp|jfif)(\?|$|#)/i);
    if (ext) return `${fallback}.${ext[1].toLowerCase()}`;
    return fallback;
  }

  private valorMetricaContrato(c: Record<string, unknown>, k: string): string {
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
  }

  private metricasContratoKeys(
    c: Record<string, unknown>,
    keys: { label: string; key: string }[],
  ): MetricaContratoVista[] {
    return keys.map(({ label, key }) => ({
      label,
      value: this.valorMetricaContrato(c, key),
    }));
  }

  gruposMetricasContrato(c: Record<string, unknown>): GrupoMetricasContrato[] {
    const grupos: GrupoMetricasContrato[] = [
      {
        titulo: 'Superficie y tarifa',
        metricas: this.metricasContratoKeys(c, [
          { label: 'Metros rentados', key: 'metrosRentados' },
          { label: 'Costo m²', key: 'costoM2' },
          { label: '% mantenimiento', key: 'porcentajeMantenimiento' },
        ]),
      },
      {
        titulo: 'Depósito y adelanto',
        metricas: this.metricasContratoKeys(c, [
          { label: 'Meses depósito', key: 'mesesDeposito' },
          { label: 'Monto depósito', key: 'montoDeposito' },
          { label: 'Meses adelanto', key: 'mesesAdelanto' },
          { label: 'Monto adelanto', key: 'montoAdelanto' },
        ]),
      },
      {
        titulo: 'Plazo forzoso',
        metricas: this.metricasContratoKeys(c, [
          { label: 'Arrendador (años)', key: 'aniosForzososArrendador' },
          { label: 'Arrendatario (años)', key: 'aniosForzososArrendatario' },
        ]),
      },
      {
        titulo: 'Desglose de renta',
        metricas: this.metricasContratoKeys(c, [
          { label: 'Subtotal renta', key: 'subTotalRenta' },
          { label: 'IVA renta', key: 'ivaRenta' },
          { label: 'Renta total', key: 'rentaTotal' },
        ]),
      },
      {
        titulo: 'Desglose de mantenimiento',
        metricas: this.metricasContratoKeys(c, [
          { label: 'Subtotal mant.', key: 'subTotalMantenimiento' },
          { label: 'IVA mant.', key: 'ivaMantenimiento' },
          { label: 'Mantenimiento total', key: 'mantenimientoTotal' },
        ]),
      },
    ];
    return grupos
      .map((g) => ({
        ...g,
        metricas: g.metricas.filter((m) => m.value !== '—'),
      }))
      .filter((g) => g.metricas.length > 0);
  }

  localesDesdeContrato(c: Record<string, unknown>): Record<string, unknown>[] {
    const filas = c['contratoLocales'];
    if (!Array.isArray(filas)) return [];
    const out: Record<string, unknown>[] = [];
    for (const raw of filas) {
      if (raw == null || typeof raw !== 'object') continue;
      const fila = raw as Record<string, unknown>;
      const loc = fila['local'];
      if (loc != null && typeof loc === 'object') {
        out.push({
          ...(loc as Record<string, unknown>),
          idContratoLocal: fila['id'],
          idLocalContrato: fila['idLocal'],
        });
        continue;
      }
      out.push(fila);
    }
    return out.sort((a, b) =>
      String(a['nombre'] ?? '').localeCompare(String(b['nombre'] ?? ''), 'es'),
    );
  }

  cantidadLocalesContrato(c: Record<string, unknown>): number {
    return this.localesDesdeContrato(c).length;
  }

  areaTotalLocalesContrato(c: Record<string, unknown>): number | null {
    const locales = this.localesDesdeContrato(c);
    if (!locales.length) return null;
    let sum = 0;
    let tiene = false;
    for (const loc of locales) {
      const n = Number(loc['areaM2']);
      if (Number.isFinite(n)) {
        sum += n;
        tiene = true;
      }
    }
    return tiene ? sum : null;
  }

  urlFachadaLocal(loc: Record<string, unknown>): string {
    const direct = String(
      loc['fachadaUrl'] ?? loc['urlFachada'] ?? loc['imagenFachada'] ?? '',
    ).trim();
    if (direct) return direct;
    const fachada = loc['fachada'];
    if (fachada != null && typeof fachada === 'object' && !Array.isArray(fachada)) {
      return String((fachada as Record<string, unknown>)['url'] ?? '').trim();
    }
    if (typeof fachada === 'string' && fachada.trim()) return fachada.trim();
    return '';
  }

  inmuebleDesdeContrato(c: Record<string, unknown>): Record<string, unknown> | null {
    const inm = c['inmueble'];
    if (inm != null && typeof inm === 'object') return inm as Record<string, unknown>;
    return null;
  }

}
