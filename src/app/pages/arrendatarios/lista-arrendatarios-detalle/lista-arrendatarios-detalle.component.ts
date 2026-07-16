import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { take } from 'rxjs';
import Swal from 'sweetalert2';
import { ContratosService } from 'src/app/services/moduleService/contratos.service';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import { ArrendatarioGridRow, contratoArrendatarioEsActivo } from '../arrendatarios-list.mapper';
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
export class ListaArrendatariosDetalleComponent implements OnChanges {
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

  /** Ids de locales cuya URL de fachada falló al cargar. */
  private readonly fotosLocalesRotas = new Set<string>();

  /** Cache estable: `localesDesdeContrato()` no debe recrear el DOM en cada CD. */
  private readonly localesCache = new Map<number, Record<string, unknown>[]>();

  constructor(
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private contratosService: ContratosService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row']) {
      this.localesCache.clear();
      this.fotosLocalesRotas.clear();
    }
  }

  /** Evita que el clic en el detalle colapse la fila del DxDataGrid. */
  @HostListener('click', ['$event'])
  onHostClick(event: Event): void {
    event.stopPropagation();
  }

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
    if (!Array.isArray(c)) return [];
    return (c as Record<string, unknown>[]).filter((contrato) =>
      contratoArrendatarioEsActivo(contrato),
    );
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
    const idContrato = Number(c['id']);
    if (Number.isFinite(idContrato) && idContrato > 0) {
      const cached = this.localesCache.get(Math.trunc(idContrato));
      if (cached) return cached;
    }

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
          idContratoLocal:
            fila['id'] ?? fila['idContratoLocal'] ?? fila['idContratoLocales'],
          idLocalContrato: fila['idLocal'],
          estatusContratoLocal: fila['estatus'],
          fechaBajaContratoLocal: fila['fechaBaja'],
        });
        continue;
      }
      out.push({
        ...fila,
        idContratoLocal:
          fila['id'] ?? fila['idContratoLocal'] ?? fila['idContratoLocales'],
        estatusContratoLocal: fila['estatusContratoLocal'] ?? fila['estatus'],
      });
    }
    out.sort((a, b) =>
      String(a['nombre'] ?? '').localeCompare(String(b['nombre'] ?? ''), 'es'),
    );

    if (Number.isFinite(idContrato) && idContrato > 0) {
      this.localesCache.set(Math.trunc(idContrato), out);
    }
    return out;
  }

  trackContratoLocal(_index: number, loc: Record<string, unknown>): string {
    const id = Number(loc['idContratoLocal']);
    if (Number.isFinite(id) && id > 0) return `cl-${Math.trunc(id)}`;
    return `cl-${String(loc['nombre'] ?? _index)}`;
  }

  invalidarCacheLocales(c?: Record<string, unknown>): void {
    if (c) {
      const id = Number(c['id']);
      if (Number.isFinite(id) && id > 0) {
        this.localesCache.delete(Math.trunc(id));
        return;
      }
    }
    this.localesCache.clear();
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
    if (this.esUrlFotoValida(direct)) return direct;
    const fachada = loc['fachada'];
    if (fachada != null && typeof fachada === 'object' && !Array.isArray(fachada)) {
      const url = String((fachada as Record<string, unknown>)['url'] ?? '').trim();
      if (this.esUrlFotoValida(url)) return url;
    }
    if (typeof fachada === 'string' && this.esUrlFotoValida(fachada.trim())) {
      return fachada.trim();
    }
    return '';
  }

  private esUrlFotoValida(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower === 'null' || lower === 'undefined' || lower === '#' || lower === '/') {
      return false;
    }
    return true;
  }

  fotoLocalRota(loc: Record<string, unknown>): boolean {
    return this.fotosLocalesRotas.has(this.claveFotoLocal(loc));
  }

  onErrorFotoLocal(loc: Record<string, unknown>): void {
    this.fotosLocalesRotas.add(this.claveFotoLocal(loc));
    this.cdr.markForCheck();
  }

  private claveFotoLocal(loc: Record<string, unknown>): string {
    const id =
      loc['idContratoLocal'] ?? loc['idLocalContrato'] ?? loc['id'] ?? loc['nombre'] ?? '';
    return String(id);
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

  contratoLocalEsCancelable(
    c: Record<string, unknown>,
    loc: Record<string, unknown>,
  ): boolean {
    if (!this.contratoEsCancelable(c)) return false;
    const idContratoLocal = Number(loc['idContratoLocal']);
    if (!Number.isFinite(idContratoLocal) || idContratoLocal <= 0) return false;
    const estatus = Number(loc['estatusContratoLocal']);
    return !Number.isFinite(estatus) || estatus !== 0;
  }

  confirmarCancelarContrato(c: Record<string, unknown>, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    const idContrato = Number(c['id']);
    if (!Number.isFinite(idContrato) || idContrato <= 0) {
      void this.alertaValidacion(
        'No se puede cancelar',
        'El contrato no tiene un identificador válido.',
      );
      return;
    }
    if (!this.contratoEsCancelable(c)) {
      void this.alertaValidacion(
        'Contrato no cancelable',
        'Este contrato ya está cancelado o dado de baja.',
      );
      return;
    }

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
            this.marcarLocalesContratoComoCancelados(c);
            this.invalidarCacheLocales(c);
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
              html: this.mensajeErrorHttp(err, 'No se pudo cancelar el contrato.'),
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          },
        });
    });
  }

  async confirmarCancelarContratoLocal(
    c: Record<string, unknown>,
    loc: Record<string, unknown>,
    event?: Event,
  ): Promise<void> {
    event?.stopPropagation();
    event?.preventDefault();

    try {
      const idContratoLocal = Number(
        loc['idContratoLocal'] ?? loc['idContratoLocales'],
      );
      if (!Number.isFinite(idContratoLocal) || idContratoLocal <= 0) {
        await this.alertaValidacion(
          'No se puede cancelar',
          'La asignación del local no tiene un identificador válido.',
        );
        return;
      }
      if (!this.contratoEsCancelable(c)) {
        await this.alertaValidacion(
          'Contrato no vigente',
          'No se puede cancelar un local de un contrato ya cancelado.',
        );
        return;
      }
      const estatusAsignacion = Number(loc['estatusContratoLocal']);
      if (Number.isFinite(estatusAsignacion) && estatusAsignacion === 0) {
        await this.alertaValidacion(
          'Local ya cancelado',
          'Esta asignación de local ya está dada de baja.',
        );
        return;
      }

      const idContrato = Number(c['id']);
      const indice = this.contratos.indexOf(c);
      const etiquetaContrato =
        indice >= 0 ? `Contrato ${indice + 1}` : `Contrato #${idContrato}`;
      const nombreLocal =
        String(loc['nombre'] ?? '').trim() || `Local #${Math.trunc(idContratoLocal)}`;
      const idOk = Math.trunc(idContratoLocal);

      const result = await Swal.fire({
        title: '¡Cancelación de local!',
        html: this.htmlModalCancelarContratoLocal(
          c,
          loc,
          etiquetaContrato,
          nombreLocal,
          idOk,
        ),
        icon: 'warning',
        background: '#141a21',
        color: '#ffffff',
        width: '36rem',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, cancelar local',
        cancelButtonText: 'No, volver',
        heightAuto: false,
        didOpen: () => {
          const el = Swal.getContainer();
          if (el) el.style.zIndex = '200000';
        },
      });

      if (!result.isConfirmed) return;

      this.contratosService
        .cancelarContratoLocal(idOk)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.aplicarCancelacionContratoLocal(c, idOk);
            this.invalidarCacheLocales(c);
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Local cancelado!',
              html: `La asignación de <strong>${this.escapeHtmlSwal(nombreLocal)}</strong> fue cancelada correctamente.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
              didOpen: () => {
                const el = Swal.getContainer();
                if (el) el.style.zIndex = '200000';
              },
            });
            this.contratoCancelado.emit();
          },
          error: (err: unknown) => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Ops!',
              html: this.mensajeErrorHttp(
                err,
                'No se pudo cancelar la asignación del local.',
              ),
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
              didOpen: () => {
                const el = Swal.getContainer();
                if (el) el.style.zIndex = '200000';
              },
            });
          },
        });
    } catch (err: unknown) {
      console.error('Error al confirmar cancelación de local:', err);
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: '¡Ops!',
        html: this.mensajeErrorHttp(err, 'No se pudo abrir la confirmación de cancelación.'),
        icon: 'error',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
        didOpen: () => {
          const el = Swal.getContainer();
          if (el) el.style.zIndex = '200000';
        },
      });
    }
  }

  private alertaValidacion(titulo: string, mensaje: string): Promise<unknown> {
    return Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: titulo,
      html: mensaje,
      icon: 'info',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Entendido',
      didOpen: () => {
        const el = Swal.getContainer();
        if (el) el.style.zIndex = '200000';
      },
    });
  }

  private marcarLocalesContratoComoCancelados(c: Record<string, unknown>): void {
    const filas = c['contratoLocales'];
    if (!Array.isArray(filas)) return;
    for (const raw of filas) {
      if (raw == null || typeof raw !== 'object') continue;
      const fila = raw as Record<string, unknown>;
      const estatus = Number(fila['estatus']);
      if (Number.isFinite(estatus) && estatus === 0) continue;
      fila['estatus'] = 0;
      const loc = fila['local'];
      if (loc != null && typeof loc === 'object') {
        (loc as Record<string, unknown>)['estatus'] = 1;
      }
    }
  }

  private aplicarCancelacionContratoLocal(
    c: Record<string, unknown>,
    idContratoLocal: number,
  ): void {
    const filas = c['contratoLocales'];
    if (!Array.isArray(filas)) return;
    for (const raw of filas) {
      if (raw == null || typeof raw !== 'object') continue;
      const fila = raw as Record<string, unknown>;
      if (Number(fila['id']) !== idContratoLocal) continue;
      fila['estatus'] = 0;
      if (!fila['fechaBaja']) {
        fila['fechaBaja'] = new Date().toISOString();
      }
      const loc = fila['local'];
      if (loc != null && typeof loc === 'object') {
        (loc as Record<string, unknown>)['estatus'] = 1;
      }
      break;
    }
  }

  private mensajeErrorHttp(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return String(e?.error?.message ?? e?.message ?? fallback);
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

  private htmlModalCancelarContratoLocal(
    c: Record<string, unknown>,
    loc: Record<string, unknown>,
    etiquetaContrato: string,
    nombreLocal: string,
    idContratoLocal: number,
  ): string {
    const inmueble = this.inmuebleDesdeContrato(c);
    const area =
      loc['areaM2'] != null && loc['areaM2'] !== '' && Number.isFinite(Number(loc['areaM2']))
        ? `${Number(loc['areaM2'])} m²`
        : '';
    const mensualidad =
      loc['mensualidad'] != null && loc['mensualidad'] !== ''
        ? formatearMoneda(loc['mensualidad'])
        : '';

    const lineasLocal = [
      this.lineaResumenCancelacion('Local', nombreLocal),
      this.lineaResumenCancelacion('ID asignación', String(idContratoLocal)),
      this.lineaResumenCancelacion('Área', area),
      this.lineaResumenCancelacion('Giro', loc['giro']),
      this.lineaResumenCancelacion('Mensualidad', mensualidad),
      this.lineaResumenCancelacion('Contrato', etiquetaContrato),
      this.lineaResumenCancelacion('Inmueble', inmueble?.['inmueble']),
      this.lineaResumenCancelacion('Arrendatario', this.item['arrendatario']),
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
      'Está cancelando la <strong>asignación de un local</strong> en el contrato. Revise los datos antes de confirmar:',
      '</p>',
      '<div style="text-align:left;margin:0 0 0.85rem;padding:0.85rem;border-radius:10px;border:1px solid rgba(130,160,255,0.28);background:rgba(8,12,20,0.72);">',
      bloque('Asignación a cancelar', lineasLocal),
      '</div>',
      '<p style="margin:0 0 0.75rem;font-size:0.86rem;line-height:1.45;color:#fcd34d;">',
      'Esta acción dará de baja la asignación del local y lo marcará como disponible. El contrato permanecerá vigente.',
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
