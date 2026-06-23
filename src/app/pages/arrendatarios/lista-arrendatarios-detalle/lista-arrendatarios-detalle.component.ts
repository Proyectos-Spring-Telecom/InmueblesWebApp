import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { take } from 'rxjs';
import Swal from 'sweetalert2';
import { ContratosService } from 'src/app/services/moduleService/contratos.service';
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
  @Output() contratoCancelado = new EventEmitter<void>();

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
    private contratosService: ContratosService,
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

  contratoEsCancelable(c: Record<string, unknown>): boolean {
    const id = Number(c['id']);
    if (!Number.isFinite(id) || id <= 0) return false;
    const estatus = Number(c['estatus']);
    return !Number.isFinite(estatus) || estatus !== 0;
  }

  confirmarCancelarContrato(c: Record<string, unknown>, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    const idContrato = Number(c['id']);
    if (!Number.isFinite(idContrato) || idContrato <= 0) return;

    const indice = this.contratos.indexOf(c);
    const etiquetaContrato =
      indice >= 0 ? `Contrato ${indice + 1}` : `Contrato #${idContrato}`;

    void Swal.fire({
      title: '¡Cancelación de contrato!',
      html: this.htmlModalCancelarContrato(c, etiquetaContrato, Math.trunc(idContrato)),
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      width: '36rem',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, cancelar contrato',
      cancelButtonText: 'No, volver',
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.contratosService
        .cancelarContrato(Math.trunc(idContrato))
        .pipe(take(1))
        .subscribe({
          next: () => {
            c['estatus'] = 0;
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Contrato cancelado!',
              html: `El ${etiquetaContrato} fue cancelado correctamente.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.contratoCancelado.emit();
          },
          error: (err: unknown) => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Ops!',
              html: this.mensajeErrorHttp(err),
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          },
        });
    });
  }

  private mensajeErrorHttp(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    return String(e?.error?.message ?? e?.message ?? 'No se pudo cancelar el contrato.');
  }

  private htmlModalCancelarContrato(
    c: Record<string, unknown>,
    etiquetaContrato: string,
    idContrato: number,
  ): string {
    const inmueble = this.inmuebleDesdeContrato(c);
    const locales = this.localesDesdeContrato(c);
    const nombresLocales = locales
      .map((loc) => String(loc['nombre'] ?? '').trim())
      .filter(Boolean);
    const fechaInicio = formatearFecha(
      String(c['fechaInicioContrato'] ?? c['fechaInicio'] ?? ''),
    );
    const fechaFin = formatearFecha(
      String(c['fechaTerminoContrato'] ?? c['fechaFin'] ?? ''),
    );
    const vigencia =
      fechaInicio && fechaFin && fechaInicio !== '—' && fechaFin !== '—'
        ? `${fechaInicio} – ${fechaFin}`
        : '';
    const renta =
      c['rentaTotal'] != null && c['rentaTotal'] !== ''
        ? formatearMoneda(c['rentaTotal'])
        : '';
    const moneda = String(c['moneda'] ?? '').trim();
    const metros = c['metrosRentados'];
    const metrosTxt =
      metros != null && metros !== '' && Number.isFinite(Number(metros))
        ? `${Number(metros)} m²`
        : '';

    const lineasArrendatario = [
      this.lineaResumenCancelacion('Nombre', this.item['arrendatario']),
      this.lineaResumenCancelacion('RFC', this.item['rfc']),
      this.lineaResumenCancelacion('Representante', this.item['representanteLegal']),
      this.lineaResumenCancelacion('Teléfono', this.item['telefonoRepresentante']),
      this.lineaResumenCancelacion('Correo', this.item['correoRepresentante']),
      this.lineaResumenCancelacion(
        'Arrendador',
        nombreArrendador(this.item['arrendador'] as Record<string, unknown> | undefined),
      ),
    ].filter(Boolean);

    const lineasContrato = [
      this.lineaResumenCancelacion('Referencia', etiquetaContrato),
      this.lineaResumenCancelacion('ID contrato', String(idContrato)),
      this.lineaResumenCancelacion('Inmueble', inmueble?.['inmueble']),
      this.lineaResumenCancelacion('Dirección', inmueble?.['direccionFiscal']),
      this.lineaResumenCancelacion('Vigencia', vigencia),
      this.lineaResumenCancelacion(
        'Renta mensual',
        renta && moneda ? `${renta} ${moneda}` : renta,
      ),
      this.lineaResumenCancelacion(
        'Mantenimiento',
        c['mantenimientoTotal'] != null && c['mantenimientoTotal'] !== ''
          ? formatearMoneda(c['mantenimientoTotal'])
          : '',
      ),
      this.lineaResumenCancelacion('Metros rentados', metrosTxt),
      this.lineaResumenCancelacion(
        'Locales vinculados',
        nombresLocales.length
          ? `${nombresLocales.length}: ${nombresLocales.join(', ')}`
          : '',
      ),
    ].filter(Boolean);

    const bloque = (titulo: string, lineas: string[]): string => {
      if (!lineas.length) return '';
      return [
        `<p style="margin:0 0 0.45rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:#8f9bc4;">${this.escapeHtmlSwal(titulo)}</p>`,
        `<ul style="margin:0 0 0.85rem;padding-left:1.1rem;font-size:0.86rem;color:#dce3ff;line-height:1.5;list-style:disc;">${lineas.join('')}</ul>`,
      ].join('');
    };

    return [
      '<p style="margin:0 0 0.85rem;font-size:0.92rem;line-height:1.5;color:#ecefff;">',
      'Está realizando una <strong>cancelación</strong>. Revise los datos antes de confirmar:',
      '</p>',
      '<div style="text-align:left;margin:0 0 0.85rem;padding:0.85rem;border-radius:10px;border:1px solid rgba(130,160,255,0.28);background:rgba(8,12,20,0.72);">',
      bloque('Arrendatario', lineasArrendatario),
      bloque('Contrato', lineasContrato),
      '</div>',
      '<p style="margin:0 0 0.75rem;font-size:0.86rem;line-height:1.45;color:#fcd34d;">',
      'Esta acción dará de baja el contrato, cancelará los locales vinculados y los marcará como disponibles.',
      '</p>',
      '<p style="margin:0;font-size:0.9rem;line-height:1.45;color:#ecefff;">',
      '¿Confirma que desea continuar con la cancelación?',
      '</p>',
    ].join('');
  }

  private lineaResumenCancelacion(label: string, valor: unknown): string {
    const v = String(valor ?? '').trim();
    if (!v || v === '—') return '';
    return `<li style="margin-bottom:0.2rem;"><span style="color:#9aa6c8;">${this.escapeHtmlSwal(label)}:</span> ${this.escapeHtmlSwal(v)}</li>`;
  }

  private escapeHtmlSwal(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

}
