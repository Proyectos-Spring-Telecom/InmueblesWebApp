import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { DxDataGridComponent } from 'devextreme-angular';
import { io, Socket } from 'socket.io-client';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EMPTY, forkJoin, Observable, of, Subscription } from 'rxjs';
import { catchError, finalize, map, switchMap, take } from 'rxjs/operators';

import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { environment } from 'src/environments/environment';
import Swal from 'sweetalert2';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { ContratosService } from 'src/app/services/moduleService/contratos.service';
import { InstalacionService } from 'src/app/services/moduleService/instalaciones.service';
import { InstalacionCentral } from 'src/app/services/moduleService/instalacionesCentral.service';

const IVA_CONTRATO = 0.16;

/** Vista de solo lectura del modal local: mismos campos que el formulario de contratos. */
interface VistaContratoLocalModal {
  tipoModificacion: string;
  numeroContrato: string;
  arrendador: string;
  arrendatario: string;
  inmuebles: string;
  fechaInicio: string;
  fechaTermino: string;
  tipoMoneda: string;
  metrosRentados: string;
  costoPorM2: string;
  mesesDeposito: string;
  montoDeposito: string;
  pctMantenimiento: string;
  anosForzososArrendador: string;
  anosForzososArrendatario: string;
  mesesAdelanto: string;
  montoAdelanto: string;
  subtotalRenta: string;
  ivaRenta: string;
  rentaTotal: string;
  subtotalMantenimiento: string;
  ivaMantenimiento: string;
  mantenimientoTotal: string;
  observaciones: string;
  documentoUrl: string | null;
  esDemo: boolean;
}

interface ServicioDetalle {
  concepto: string;
  contrato: string;
  fechaPago: string;
  fechaLimitePago: string;
}

/** Documento en la sección Documentos (demo / futura API). */
interface MonitoreoDocumentoArchivo {
  nombre: string;
  /** URL del PDF. */
  url: string;
}

/** Fila de expediente en detalle de inmueble (mismas categorías que el formulario de alta). */
interface MonitoreoExpedienteDoc {
  etiqueta: string;
  archivo: MonitoreoDocumentoArchivo;
}

type PagoEstatus = 'Pagado' | 'Pendiente' | 'Cancelado';

interface PagoRow {
  id: number;
  concepto: string;
  fechaPago: string;
  fechaLimitePago: string;
  monto: number;
  metodo: string;
  estatus: PagoEstatus;
}

@Component({
  selector: 'app-monitoreo-instalacion',
  templateUrl: './monitoreo-instalacion.component.html',
  styleUrl: './monitoreo-instalacion.component.scss',
  standalone: false,
  animations: [
    routeAnimation,
    trigger('gallerySwap', [
      transition('* => *', [
        style({ opacity: 0, transform: 'scale(1.03)' }),
        animate(
          '220ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'scale(1)' })
        ),
      ]),
    ]),
    trigger('contractDimAnim', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('180ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 })),
      ]),
    ]),
    trigger('contractModalAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px) scale(0.98)' }),
        animate(
          '220ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '170ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'translateY(8px) scale(0.985)' }),
        ),
      ]),
    ]),
  ],
})
export class MonitoreoInstalacionComponent implements OnInit, OnDestroy {
  private readonly PREVIEW_SERIE = 'preview-demo';
  isPreviewMode = false;
  showInmuebleExtras = false;
  /** Tema y copy: misma estructura de página, distinta identidad visual (`?vista=local` o `?vista=inmueble`). */
  vistaEntidad: 'inmueble' | 'local' = 'inmueble';
  /** Contrato asociado en URL (`?idContrato=`) para cargar el mismo modelo que el formulario de contratos. */
  idContratoQuery: number | null = null;
  inmuebleEsRenta = true;
  localEstatus: 'ocupado' | 'libre' = 'ocupado';
  mostrarModalContratoLocal = false;
  mostrarModalPago = false;
  pagoForm!: FormGroup;
  contratoModalLoading = false;
  contratoModalError: string | null = null;
  contratoModal: VistaContratoLocalModal | null = null;
  private clientesNombreMap: Map<number, string> | null = null;
  private inmueblesNombreMap: Map<number, string> | null = null;
  private vistaQuerySub?: Subscription;
  now = new Date();
  readonly ubicacionLat = 18.9242;
  readonly ubicacionLng = -99.2216;
  galleryIndex = 0;
  readonly galleryImages: string[] = [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1483366774565-c783b9f70e2c?auto=format&fit=crop&w=1200&q=80',
  ];
  /** Nombre mostrado en vista Local (contrato); independiente del expediente del inmueble. */
  readonly nombreArchivoContratoLocalDemo = 'Contrato_local_corporativo.pdf';
  /** Archivo del contrato en vista Local (demo). */
  readonly contratoLocalArchivo: MonitoreoDocumentoArchivo = {
    nombre: this.nombreArchivoContratoLocalDemo,
    url: '/assets/docs/Contrato_local_corporativo.pdf',
  };

  /**
   * Expediente digital alineado con «Documentos e imágenes» del formulario de inmuebles.
   * Demo: cada rubro con archivo (URLs locales / PDF demo).
   */
  readonly expedienteDocumentosInmueble: MonitoreoExpedienteDoc[] = [
    {
      etiqueta: 'Escritura del inmueble (PDF)',
      archivo: {
        nombre: 'Escritura_inmueble_BHV.pdf',
        url: '/assets/docs/Escritura_inmueble_BHV.pdf',
      },
    },
    {
      etiqueta: 'Licencia / uso de suelo',
      archivo: {
        nombre: 'Licencia_uso_suelo_2026.svg',
        url: '/assets/docs/Licencia_uso_suelo_2026.svg',
      },
    },
    {
      etiqueta: 'Fachada',
      archivo: {
        nombre: 'Fachada_principal.svg',
        url: '/assets/docs/Fachada_principal.svg',
      },
    },
    {
      etiqueta: 'Contrato de renta',
      archivo: {
        nombre: 'Contrato_renta_vigente.pdf',
        url: '/assets/docs/Contrato_renta_vigente.pdf',
      },
    },
    {
      etiqueta: 'Constancia de Situación Fiscal',
      archivo: {
        nombre: 'CSF_inmueble_sat.pdf',
        url: '/assets/docs/CSF_inmueble_sat.pdf',
      },
    },
    {
      etiqueta: 'Comprobante de Domicilio',
      archivo: {
        nombre: 'Comprobante_domicilio_fiscal.pdf',
        url: '/assets/docs/Comprobante_domicilio_fiscal.pdf',
      },
    },
    {
      etiqueta: 'Acta Constitutiva',
      archivo: {
        nombre: 'Acta_constitutiva_sociedad.pdf',
        url: '/assets/docs/Acta_constitutiva_sociedad.pdf',
      },
    },
    {
      etiqueta: 'Constancia de situación fiscal del representante legal',
      archivo: {
        nombre: 'CSF_representante.pdf',
        url: '/assets/docs/CSF_representante.pdf',
      },
    },
    {
      etiqueta: 'INE Representante Legal',
      archivo: {
        nombre: 'INE_representante_legal.pdf',
        url: '/assets/docs/INE_representante_legal.pdf',
      },
    },
    {
      etiqueta: 'Imagen 1 (galería del inmueble)',
      archivo: {
        nombre: 'Galeria_interior_demo.svg',
        url: '/assets/docs/Galeria_interior_demo.svg',
      },
    },
  ];
  private readonly referenciasServicioBase: Record<string, string> = {
    Agua: 'SRV-AGUA-54035',
    Luz: 'SRV-LUZ-348150305391',
    'Licencia funcionamiento': 'SRV-LIC-2026-001',
    Seguridad: 'SRV-SEG-88210',
    Limpieza: 'SRV-LMP-64012',
    Internet: 'SRV-INT-78155',
    Renta: 'CON-RTA-2026-004',
    Mantenimiento: 'CON-MNT-2026-004',
    Predio: 'IMP-PRED-110009829001',
  };
  readonly zonas = [
    { zona: 'Planta Baja Corporativo Piramide', superficie: '2,598.31 m²' },
    { zona: '1er. Piso Corporativo Piramide', superficie: '2,003.35 m²' },
    { zona: '2do Piso Corporativo Piramide', superficie: '1,191.07 m²' },
  ];
  readonly estacionamientosInmueble = [
    { nombrePensionado: 'Juan Pérez', numeroTarjeta: 'TAR-1001', arrendatario: 'Santory' },
    { nombrePensionado: 'María Gómez', numeroTarjeta: 'TAR-1042', arrendatario: 'Spring Telecom México' },
    { nombrePensionado: 'Luis Ramírez', numeroTarjeta: 'TAR-1108', arrendatario: 'Santory' },
  ];
  pagosData: PagoRow[] = [
    {
      id: 1,
      concepto: 'Mantenimiento',
      fechaPago: '2026-04-02',
      fechaLimitePago: '2026-04-05',
      monto: 12850.5,
      metodo: 'Transferencia',
      estatus: 'Pagado',
    },
    {
      id: 2,
      concepto: 'Vigilancia',
      fechaPago: '2026-04-06',
      fechaLimitePago: '2026-04-08',
      monto: 7600,
      metodo: 'Tarjeta',
      estatus: 'Pagado',
    },
    {
      id: 3,
      concepto: 'Limpieza',
      fechaPago: '2026-04-10',
      fechaLimitePago: '2026-04-12',
      monto: 5400,
      metodo: 'Transferencia',
      estatus: 'Pendiente',
    },
  ];

  numeroSerie: string = '';

  hit = {
    genero: '',
    edad: null as number | null,
    estado: '',
    id: null as number | null,
  };
  hitFecha: Date | null = null;
  hitFechaLabel: string | null = null;

  totalPersonas = 0;
  totalHombres = 0;
  totalMujeres = 0;

  mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  loading = false;
  loadingMessage = 'Cargando...';

  fechaInicio: Date = new Date();
  fechaFin: Date = new Date();

  ultimoHit: any = null;
  totalFiltrado = 0;

  private page = 1;
  private limit = 200;

  chartHits = [
    { grupo: 'Hombres', valor: 0, colors: 2 },
    { grupo: 'Mujeres', valor: 0, colors: 1 },
  ];

  chartEdadesAmbos = [
    { rango: '0 - 20', valor: 0, color: 1 },
    { rango: '21 - 40', valor: 0, color: 2 },
    { rango: '41 - 60', valor: 0, color: 3 },
    { rango: '61+', valor: 0, color: 4 },
  ];

  chartEdadesMujeres = [
    { rango: '0 - 20', valor: 0, color: 1 },
    { rango: '21 - 40', valor: 0, color: 2 },
    { rango: '41 - 60', valor: 0, color: 3 },
    { rango: '61+', valor: 0, color: 4 },
  ];

  chartEdadesHombres = [
    { rango: '0 - 20', valor: 0, color: 1 },
    { rango: '21 - 40', valor: 0, color: 2 },
    { rango: '41 - 60', valor: 0, color: 3 },
    { rango: '61+', valor: 0, color: 4 },
  ];

  hitsPorHora = [{ hora: '00:00', hombres: 0, mujeres: 0 }];

  registros: any[] = [];
  @ViewChild('gridRef', { static: false }) gridRef: DxDataGridComponent;

  private socket!: Socket;
  constructor(
    private incidencias: InstalacionCentral,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private router: Router,
    private contratosService: ContratosService,
    private clientesService: ClientesService,
    private instalacionService: InstalacionService,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {}

  ngOnDestroy(): void {
    this.vistaQuerySub?.unsubscribe();
  }

  /** `?vista=local|inmueble` o `?origen=local` para vista de local (tema morado). */
  private applyVistaDesdeQuery(qp: ParamMap): void {
    const vista = (qp.get('vista') ?? '').toLowerCase();
    const origen = (qp.get('origen') ?? '').toLowerCase();
    this.vistaEntidad =
      vista === 'local' || origen === 'local' ? 'local' : 'inmueble';
    this.showInmuebleExtras = this.vistaEntidad === 'inmueble';
    const esRentaRaw = (qp.get('esRenta') ?? '').trim().toLowerCase();
    const estatusLocalRaw = (qp.get('estatusLocal') ?? '').trim().toLowerCase();
    if (esRentaRaw === 'true' || esRentaRaw === '1' || esRentaRaw === 'si') {
      this.inmuebleEsRenta = true;
    } else if (esRentaRaw === 'false' || esRentaRaw === '0' || esRentaRaw === 'no') {
      this.inmuebleEsRenta = false;
    } else {
      this.inmuebleEsRenta = true;
    }
    this.localEstatus = estatusLocalRaw === 'libre' ? 'libre' : 'ocupado';
    const idRaw = qp.get('idContrato');
    const idn = idRaw != null && String(idRaw).trim() !== '' ? Number(idRaw) : NaN;
    this.idContratoQuery =
      Number.isFinite(idn) && idn > 0 ? Math.floor(idn) : null;
    this.refrescarServiciosDataSource();
    this.cdr.markForCheck();
  }

  /**
   * Referencia estable para `dx-data-grid` (un getter que devuelve un array nuevo
   * en cada CD rompe el render de DevExtreme).
   */
  serviciosDataSource: ServicioDetalle[] = [];

  private refrescarServiciosDataSource(): void {
    this.serviciosDataSource = this.buildServiciosLista();
  }

  private buildServiciosLista(): ServicioDetalle[] {
    const comunes = [
      'Agua',
      'Luz',
      'Licencia funcionamiento',
      'Seguridad',
      'Limpieza',
      'Internet',
    ];
    const conceptos =
      this.vistaEntidad === 'local'
        ? ['Renta', 'Mantenimiento']
        : this.inmuebleEsRenta
          ? [...comunes, 'Renta', 'Mantenimiento']
          : [...comunes, 'Predio'];

    const ciclos: { fechaPago: string; fechaLimitePago: string }[] = [
      { fechaPago: '2026-01-08', fechaLimitePago: '2026-01-15' },
      { fechaPago: '2026-02-03', fechaLimitePago: '2026-02-10' },
      { fechaPago: '2026-02-20', fechaLimitePago: '2026-02-28' },
      { fechaPago: '2026-03-05', fechaLimitePago: '2026-03-12' },
      { fechaPago: '2026-03-18', fechaLimitePago: '2026-03-25' },
      { fechaPago: '2026-04-01', fechaLimitePago: '2026-04-08' },
      { fechaPago: '2026-04-14', fechaLimitePago: '2026-04-21' },
      { fechaPago: '2026-04-22', fechaLimitePago: '2026-04-29' },
    ];

    return conceptos.map((concepto, i) => {
      const f = ciclos[i % ciclos.length];
      return {
        concepto,
        contrato: this.referenciasServicioBase[concepto] ?? 'N/D',
        fechaPago: f.fechaPago,
        fechaLimitePago: f.fechaLimitePago,
      };
    });
  }

  verComprobanteImagenPago(_row: PagoRow): void {}

  verComprobanteImagenServicio(_row: ServicioDetalle): void {}

  /** Clases de etiqueta para la columna Estatus del grid de pagos. */
  clasesEstatusPago(estatus: unknown): Record<string, boolean> {
    const e = String(estatus ?? '') as PagoEstatus;
    return {
      'mono-pago-estatus': true,
      'mono-pago-estatus--pagado': e === 'Pagado',
      'mono-pago-estatus--pendiente': e === 'Pendiente',
      'mono-pago-estatus--cancelado': e === 'Cancelado',
    };
  }

  private fechaIsoMasDias(isoDate: string, dias: number): string {
    const s = String(isoDate ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const d = new Date(`${s}T12:00:00`);
    d.setDate(d.getDate() + dias);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  get nombreArchivoContratoLocal(): string {
    const nombre = this.nombreArchivoContratoLocalDemo.trim();
    return nombre ? nombre : 'Sin archivo';
  }

  /**
   * Descarga el PDF sin navegar ni abrir pestañas: obtiene blob y dispara descarga local.
   */
  descargarDocumento(archivo: MonitoreoDocumentoArchivo, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.http
      .get(archivo.url, { responseType: 'blob' })
      .pipe(take(1))
      .subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = archivo.nombre;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objectUrl);
        },
        error: () => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo descargar',
            text: 'No se obtuvo el archivo. En desarrollo, usa `ng serve` con proxy (proxy.conf.json). En producción, la URL debe ser del mismo sitio que la aplicación.',
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  abrirModalContratoLocal(): void {
    this.mostrarModalContratoLocal = true;
    this.contratoModalError = null;
    this.contratoModal = null;
    this.contratoModalLoading = true;
    this.cdr.markForCheck();
    this.cargarContenidoModalContrato();
  }

  cerrarModalContratoLocal(): void {
    this.mostrarModalContratoLocal = false;
    this.contratoModalLoading = false;
    this.contratoModalError = null;
    this.cdr.markForCheck();
  }

  private cargarContenidoModalContrato(): void {
    if (this.idContratoQuery) {
      this.getCatalogosMaps$()
        .pipe(
          catchError(() => {
            this.contratoModal = null;
            this.contratoModalError =
              'No se pudieron cargar los catálogos de clientes o inmuebles.';
            return EMPTY;
          }),
          switchMap((maps) =>
            this.contratosService.obtenerContrato(this.idContratoQuery!).pipe(
              map((res: any) => ({ maps, res })),
              catchError(() => {
                this.contratoModal = null;
                this.contratoModalError =
                  'No se pudo cargar el contrato. Verifique el identificador o su conexión.';
                return EMPTY;
              }),
            ),
          ),
          finalize(() => {
            this.contratoModalLoading = false;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: ({ maps, res }) => {
            const d = res?.data ?? res ?? {};
            this.contratoModal = this.buildVistaContratoDesdeBackend(
              d,
              maps.c,
              maps.i,
              false,
            );
            this.contratoModalError = null;
          },
        });
      return;
    }

    this.getCatalogosMaps$()
      .pipe(
        catchError(() =>
          of({ c: new Map<number, string>(), i: new Map<number, string>() }),
        ),
        finalize(() => {
          this.contratoModalLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (maps) => {
          this.contratoModal = this.buildVistaContratoDemo(maps.c, maps.i);
          this.contratoModalError = null;
        },
      });
  }

  private getCatalogosMaps$(): Observable<{
    c: Map<number, string>;
    i: Map<number, string>;
  }> {
    if (this.clientesNombreMap && this.inmueblesNombreMap) {
      return of({ c: this.clientesNombreMap, i: this.inmueblesNombreMap });
    }
    return forkJoin({
      clientes: this.clientesService.obtenerClientes(),
      inmuebles: this.instalacionService.obtenerInstalaciones(),
    }).pipe(
      map(({ clientes, inmuebles }) => {
        const c = this.mapClientesAResolver(clientes);
        const i = this.mapInmueblesAResolver(inmuebles);
        this.clientesNombreMap = c;
        this.inmueblesNombreMap = i;
        return { c, i };
      }),
    );
  }

  private mapClientesAResolver(res: any): Map<number, string> {
    const m = new Map<number, string>();
    const rows = res?.data ?? res ?? [];
    (Array.isArray(rows) ? rows : []).forEach((cl: any) => {
      const id = Number(cl?.id);
      if (!Number.isFinite(id)) return;
      const t = [cl?.nombre, cl?.apellidoPaterno, cl?.apellidoMaterno]
        .filter(Boolean)
        .join(' ')
        .trim();
      m.set(id, t || `#${id}`);
    });
    return m;
  }

  private mapInmueblesAResolver(res: any): Map<number, string> {
    const m = new Map<number, string>();
    const rows = res?.data ?? res ?? [];
    (Array.isArray(rows) ? rows : []).forEach((ins: any) => {
      const id = Number(ins?.id);
      if (!Number.isFinite(id)) return;
      const t =
        ins?.nombreInstalacion ?? ins?.nombre ?? ins?.clave ?? `#${id}`;
      m.set(id, String(t));
    });
    return m;
  }

  private parseIdsInmuebles(raw: unknown): number[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
      return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
    }
    if (typeof raw === 'string') {
      try {
        return this.parseIdsInmuebles(JSON.parse(raw));
      } catch {
        return raw
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n));
      }
    }
    return [];
  }

  private toDateDisplay(v: unknown): string {
    if (v == null || v === '') return '—';
    const d = v instanceof Date ? v : new Date(String(v));
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private mesesCatalogoTexto(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return '0 meses';
    return `${n} ${n === 1 ? 'mes' : 'meses'}`;
  }

  private anosForzososTexto(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return `${n} ${n === 1 ? 'año' : 'años'}`;
  }

  private formatoImporte(
    n: number | null | undefined,
    tipoMonedaLabel: string,
  ): string {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const num = Number(n);
    const isUsd = (tipoMonedaLabel || '').toUpperCase().includes('USD');
    return num.toLocaleString(isUsd ? 'en-US' : 'es-MX', {
      style: 'currency',
      currency: isUsd ? 'USD' : 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  private formatoNumero(
    n: number | null | undefined,
    maxFrac = 4,
  ): string {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Number(n).toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFrac,
    });
  }

  private calcTotalesContrato(
    metros: number,
    costoM2: number,
    pctMant: number,
  ): {
    subtotalRenta: number;
    ivaRenta: number;
    rentaTotal: number;
    subtotalMantenimiento: number;
    ivaMantenimiento: number;
    mantenimientoTotal: number;
  } {
    const subR = metros * costoM2;
    const ivaR = subR * IVA_CONTRATO;
    const totR = subR + ivaR;
    const subM = subR * (pctMant / 100);
    const ivaM = subM * IVA_CONTRATO;
    const totM = subM + ivaM;
    return {
      subtotalRenta: Math.round(subR * 1e6) / 1e6,
      ivaRenta: Math.round(ivaR * 1e6) / 1e6,
      rentaTotal: Math.round(totR * 1e6) / 1e6,
      subtotalMantenimiento: Math.round(subM * 1e6) / 1e6,
      ivaMantenimiento: Math.round(ivaM * 1e6) / 1e6,
      mantenimientoTotal: Math.round(totM * 1e6) / 1e6,
    };
  }

  private nombresInmueblesLista(
    mapa: Map<number, string> | null,
    ids: number[],
  ): string {
    if (!ids.length) return '—';
    if (!mapa) return ids.join(', ');
    return ids
      .map((id) => mapa.get(id) ?? `#${id}`)
      .join(' · ');
  }

  private nombreClienteId(
    mapa: Map<number, string> | null,
    id: number | null,
  ): string {
    if (id == null || !Number.isFinite(id)) return '—';
    return mapa?.get(id) ?? `#${id}`;
  }

  private buildVistaContratoDesdeBackend(
    d: any,
    mapC: Map<number, string>,
    mapI: Map<number, string>,
    esDemo: boolean,
  ): VistaContratoLocalModal {
    const tipoMoneda = d.tipoMoneda != null ? String(d.tipoMoneda) : '—';
    const m = Number(d.metrosRentados) || 0;
    const c = Number(d.costoPorM2) || 0;
    const p = Number(d.pctMantenimiento) || 0;
    const t = this.calcTotalesContrato(m, c, p);
    const idArr = this.parseIdsInmuebles(d.idInmuebles ?? d.idsInmuebles);
    const idArrendador =
      d.idArrendador != null ? Number(d.idArrendador) : null;
    const idArrendatario =
      d.idArrendatario != null ? Number(d.idArrendatario) : null;
    return {
      tipoModificacion:
        d.tipoModificacion != null ? String(d.tipoModificacion) : '—',
      numeroContrato:
        d.numeroContrato != null ? String(d.numeroContrato) : '—',
      arrendador: this.nombreClienteId(mapC, idArrendador),
      arrendatario: this.nombreClienteId(mapC, idArrendatario),
      inmuebles: this.nombresInmueblesLista(mapI, idArr),
      fechaInicio: this.toDateDisplay(d.fechaInicio),
      fechaTermino: this.toDateDisplay(d.fechaTermino),
      tipoMoneda,
      metrosRentados: this.formatoNumero(m, 2),
      costoPorM2: this.formatoNumero(c, 4),
      mesesDeposito: this.mesesCatalogoTexto(d.mesesDeposito),
      montoDeposito: this.formatoImporte(
        d.montoDeposito != null ? Number(d.montoDeposito) : null,
        tipoMoneda,
      ),
      pctMantenimiento:
        d.pctMantenimiento != null && Number.isFinite(Number(d.pctMantenimiento))
          ? `${Number(d.pctMantenimiento).toLocaleString('es-MX', { maximumFractionDigits: 2 })}%`
          : '—',
      anosForzososArrendador: this.anosForzososTexto(d.anosForzososArrendador),
      anosForzososArrendatario: this.anosForzososTexto(
        d.anosForzososArrendatario,
      ),
      mesesAdelanto: this.mesesCatalogoTexto(d.mesesAdelanto),
      montoAdelanto: this.formatoImporte(
        d.montoAdelanto != null ? Number(d.montoAdelanto) : null,
        tipoMoneda,
      ),
      subtotalRenta: this.formatoImporte(t.subtotalRenta, tipoMoneda),
      ivaRenta: this.formatoImporte(t.ivaRenta, tipoMoneda),
      rentaTotal: this.formatoImporte(t.rentaTotal, tipoMoneda),
      subtotalMantenimiento: this.formatoImporte(
        t.subtotalMantenimiento,
        tipoMoneda,
      ),
      ivaMantenimiento: this.formatoImporte(t.ivaMantenimiento, tipoMoneda),
      mantenimientoTotal: this.formatoImporte(
        t.mantenimientoTotal,
        tipoMoneda,
      ),
      observaciones:
        d.observaciones != null && String(d.observaciones).trim() !== ''
          ? String(d.observaciones)
          : '—',
      documentoUrl: d.documentoUrl ?? d.documento ?? null,
      esDemo,
    };
  }

  private buildVistaContratoDemo(
    mapC: Map<number, string> | null,
    mapI: Map<number, string> | null,
  ): VistaContratoLocalModal {
    const ck = mapC && mapC.size ? Array.from(mapC.keys()) : [];
    const ik = mapI && mapI.size ? Array.from(mapI.keys()) : [];
    const idArrendador = ck[0] ?? 1;
    const idArrendatario = ck[1] ?? ck[0] ?? 2;
    const idsInmuebles = ik.length ? [ik[0]] : [1];
    return this.buildVistaContratoDesdeBackend(
      {
        tipoModificacion: 'Por renovación',
        numeroContrato: 'PC-DEMO-BHV-001',
        idArrendador,
        idArrendatario,
        idInmuebles: idsInmuebles,
        fechaInicio: '2025-01-15',
        fechaTermino: '2028-01-14',
        tipoMoneda: 'Peso (MXN)',
        metrosRentados: 128.5,
        costoPorM2: 385.5,
        mesesDeposito: 2,
        montoDeposito: 95000,
        pctMantenimiento: 12,
        anosForzososArrendador: 3,
        anosForzososArrendatario: 2,
        mesesAdelanto: 1,
        montoAdelanto: 47500,
        observaciones:
          'Contrato de demostración para la vista de local. Cuando la URL incluya ?idContrato= se cargarán los datos reales del API.',
        documentoUrl: '/assets/docs/Contrato_local_corporativo.pdf',
      },
      mapC ?? new Map<number, string>(),
      mapI ?? new Map<number, string>(),
      true,
    );
  }

  regresar() {
    const qp = this.route.snapshot.queryParamMap;
    const retorno = (qp.get('retorno') ?? '').toLowerCase();
    const idInmueble = qp.get('idInmueble');
    const idCliente = qp.get('idCliente');
    const extras: Record<string, string> = {};
    if (idInmueble != null && String(idInmueble).trim() !== '') {
      extras['idInmueble'] = String(idInmueble).trim();
    }
    if (idCliente != null && String(idCliente).trim() !== '') {
      extras['idCliente'] = String(idCliente).trim();
    }

    if (retorno === 'locales') {
      this.router.navigate(['/monitoreo'], {
        queryParams: { retorno: 'locales', ...extras },
      });
      return;
    }
    if (retorno === 'inmuebles') {
      this.router.navigate(['/monitoreo'], {
        queryParams: { retorno: 'inmuebles', ...extras },
      });
      return;
    }

    window.history.back();
  }

  prevGallery(): void {
    if (!this.galleryImages.length) return;
    this.galleryIndex =
      (this.galleryIndex - 1 + this.galleryImages.length) %
      this.galleryImages.length;
  }

  nextGallery(): void {
    if (!this.galleryImages.length) return;
    this.galleryIndex = (this.galleryIndex + 1) % this.galleryImages.length;
  }

  goToGallery(index: number): void {
    if (index < 0 || index >= this.galleryImages.length) return;
    this.galleryIndex = index;
  }

  ngOnInit(): void {
    this.initPagoForm();
    this.numeroSerie = this.route.snapshot.paramMap.get('numeroSerie') ?? '';
    this.applyVistaDesdeQuery(this.route.snapshot.queryParamMap);
    this.vistaQuerySub = this.route.queryParamMap.subscribe((qp) =>
      this.applyVistaDesdeQuery(qp),
    );

    // Fecha fin: hoy a la hora actual
    this.fechaFin = new Date();
    
    // Fecha inicio: hoy a las 00:00:00
    this.fechaInicio = new Date();
    this.fechaInicio.setHours(0, 0, 0, 0);

    // Temporal: modo demo para mostrar la vista sin numeroSerie real.
    if (!this.numeroSerie || this.numeroSerie === this.PREVIEW_SERIE) {
      this.isPreviewMode = true;
      return;
    }

    this.socket = io('https://springtelecom.mx/api/incidencias', {
      path: '/analiticaVideoAPI/socket.io',
      transports: ['polling'],
      upgrade: false,
      withCredentials: false,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Conectado al namespace /incidencias', this.socket.id);
      console.log('📡 Socket conectado, escuchando eventos...');
    });

    this.socket.on('connect_error', (e) => {
      console.error('❌ Error de conexión:', e);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Desconectado:', reason);
    });

    this.socket.on('nueva-incidencia', (incidencia) => {
      this.cargarHoy();
      this.cargarUltimoHit();
      this.consultar();
      console.log('🔔 Nueva incidencia recibida:', incidencia);
    });

    this.socket.onAny((eventName, ...args) => {
      console.log('📨 Evento recibido:', eventName, args);
    });

    this.cargarHoy();
    this.cargarUltimoHit();
    this.consultar();
  }

  private initPagoForm(): void {
    this.pagoForm = this.fb.group({
      concepto: ['', Validators.required],
      fechaPago: ['', Validators.required],
      monto: ['', Validators.required],
      metodo: ['', Validators.required],
      estatus: ['Pendiente' as PagoEstatus, Validators.required],
    });
  }

  abrirModalPago(): void {
    this.mostrarModalPago = true;
    this.pagoForm?.reset({
      concepto: '',
      fechaPago: '',
      monto: '',
      metodo: '',
      estatus: 'Pendiente' as PagoEstatus,
    });
    this.cdr.markForCheck();
  }

  cerrarModalPago(): void {
    this.mostrarModalPago = false;
    this.cdr.markForCheck();
  }

  guardarPagoDesdeModal(): void {
    if (!this.pagoForm) return;
    if (this.pagoForm.invalid) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completa los campos obligatorios para agregar el pago.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const v = this.pagoForm.value as {
      concepto: string;
      fechaPago: string;
      monto: string;
      metodo: string;
      estatus: PagoEstatus;
    };

    const montoN = this.parseMontoToNumber(v.monto);
    if (!Number.isFinite(montoN)) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Monto inválido',
        text: 'Captura un monto válido.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const nextId =
      this.pagosData.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    const fechaPagoStr = String(v.fechaPago ?? '').trim();
    const nuevo: PagoRow = {
      id: nextId,
      concepto: String(v.concepto ?? '').trim(),
      fechaPago: fechaPagoStr,
      fechaLimitePago: this.fechaIsoMasDias(fechaPagoStr, 10),
      monto: montoN,
      metodo: String(v.metodo ?? '').trim(),
      estatus: (v.estatus ?? 'Pendiente') as PagoEstatus,
    };

    this.pagosData = [nuevo, ...this.pagosData];
    this.cerrarModalPago();
  }

  onMontoKeydown(ev: KeyboardEvent): void {
    const allowedKeys = new Set([
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
    ]);
    if (allowedKeys.has(ev.key)) return;
    if (ev.ctrlKey || ev.metaKey) return;
    if (ev.key >= '0' && ev.key <= '9') return;
    if (ev.key === '.') return;
    ev.preventDefault();
  }

  onMontoInput(ev: Event): void {
    const input = ev.target as HTMLInputElement | null;
    if (!input || !this.pagoForm) return;
    const formatted = this.formatMontoTyping(input.value);
    this.pagoForm.get('monto')?.setValue(formatted, { emitEvent: false });
  }

  onMontoBlur(): void {
    const raw = String(this.pagoForm?.get('monto')?.value ?? '');
    const n = this.parseMontoToNumber(raw);
    if (!Number.isFinite(n)) {
      this.pagoForm?.get('monto')?.setValue('', { emitEvent: false });
      return;
    }
    this.pagoForm?.get('monto')?.setValue(this.formatCurrencyFixed(n), {
      emitEvent: false,
    });
  }

  private parseMontoToNumber(raw: string): number {
    const s = String(raw ?? '')
      .replace(/[^\d.]/g, '')
      .trim();
    if (!s) return NaN;
    const parts = s.split('.');
    const intPart = parts[0] ?? '';
    const decPart = (parts[1] ?? '').slice(0, 2);
    const num = Number(decPart ? `${intPart}.${decPart}` : intPart);
    return Number.isFinite(num) ? num : NaN;
  }

  private formatMontoTyping(raw: string): string {
    const cleaned = String(raw ?? '').replace(/[^\d.]/g, '');
    if (!cleaned) return '';

    const firstDot = cleaned.indexOf('.');
    const intRaw = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
    const decRaw =
      firstDot === -1 ? '' : cleaned.slice(firstDot + 1).replace(/\./g, '');

    const intDigits = (intRaw || '0').replace(/^0+(?=\d)/, '') || '0';
    const intNum = Number(intDigits);
    const intFmt = Number.isFinite(intNum)
      ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
          intNum,
        )
      : '0';

    const decPart = decRaw.slice(0, 2);
    if (firstDot !== -1) return `$${intFmt}.${decPart}`;
    return `$${intFmt}`;
  }

  private formatCurrencyFixed(n: number): string {
    const num = Math.round(n * 100) / 100;
    const fmt = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
    return `$${fmt}`;
  }

  cambiarEstatusPago(row: PagoRow): void {
    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'question',
      title: 'Cambiar estatus',
      text: `Pago: ${row.concepto}`,
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Pagado',
      denyButtonText: 'Pendiente',
      cancelButtonText: 'Cancelado',
      allowOutsideClick: false,
    }).then((res) => {
      let nuevo: PagoEstatus | null = null;
      if (res.isConfirmed) nuevo = 'Pagado';
      else if (res.isDenied) nuevo = 'Pendiente';
      else if (res.dismiss === Swal.DismissReason.cancel) nuevo = 'Cancelado';
      if (!nuevo) return;

      this.pagosData = this.pagosData.map((p) =>
        p.id === row.id ? { ...p, estatus: nuevo! } : p,
      );
      this.cdr.markForCheck();
    });
  }

  private cargarUltimoHit(): void {
    if (!this.numeroSerie) return;

    this.incidencias.ultimoHit(this.numeroSerie).subscribe({
      next: (resp: any) => {
        const u = this.normalizeItem(resp);

        this.hit = {
          genero: u.genero,
          edad: u.edad,
          estado: u.estado,
          id: u.id,
        };
        this.hitFecha = u.fechaHora ?? null;
        this.hitFechaLabel = this.formatFechaLabel(u.fechaRaw);

        const newKey = this.hitKey(u);
        const isNew =
          this.currentHitKey !== null && newKey !== this.currentHitKey;
        this.currentHitKey = newKey;

        if (isNew) {
          this.activarHighlight(u.genero);
          this.playNewHitSound();
        }

        this.cdr.detectChanges();
      },
      error: () => { },
    });
  }

  consultar(): void {
    if (!this.numeroSerie) return;

    if (!this.fechaFin) {
      this.fechaFin = new Date();
    }
    if (!this.fechaInicio) {
      this.fechaInicio = new Date(this.fechaFin);
      this.fechaInicio.setDate(this.fechaFin.getDate() - 7);
    }

    const fi = this.fmt(this.fechaInicio);
    const ff = this.fmt(this.fechaFin);
    this.loading = true;
    this.incidencias
      .rangoPaginado(this.numeroSerie, fi, ff, this.page, this.limit)
      .subscribe({
        next: (resp: any) => {
          const items = this.pickArray(resp);
          const regs = items.map(this.normalizeItem);
          this.registros = regs;
          this.totalFiltrado = Number(resp?.total ?? regs.length);
          
          // Si el backend devuelve datos agregados, usarlos (como en cargarHoy)
          if (resp?.totales) {
            this.totalPersonas = Number(resp.totales.total ?? this.totalPersonas);
            this.totalHombres = Number(resp.totales.hombres ?? this.totalHombres);
            this.totalMujeres = Number(resp.totales.mujeres ?? this.totalMujeres);
            this.chartHits = [
              { grupo: 'Hombres', valor: this.totalHombres, colors: 2 },
              { grupo: 'Mujeres', valor: this.totalMujeres, colors: 1 },
            ];
          } else {
            // Si no hay totales del backend, recalcular desde registros
            this.recalcularDesdeRegistros(regs);
          }
          
          // Actualizar gráficas de edades si vienen del backend
          if (Array.isArray(resp?.edadesAmbos)) {
            this.chartEdadesAmbos = this.ensureEdadShape(resp.edadesAmbos);
          } else {
            // Si no vienen del backend, ya se calcularon en recalcularDesdeRegistros
          }
          
          if (Array.isArray(resp?.edadesMujeres)) {
            this.chartEdadesMujeres = this.ensureEdadShape(resp.edadesMujeres);
          }
          
          if (Array.isArray(resp?.edadesHombres)) {
            this.chartEdadesHombres = this.ensureEdadShape(resp.edadesHombres);
          }
          
          // Actualizar gráfica de hits por hora si viene del backend
          if (Array.isArray(resp?.hitsPorHora)) {
            this.hitsPorHora = this.normalizarHoras(resp.hitsPorHora);
          } else {
            // Si no viene del backend, ya se calculó en recalcularDesdeRegistros
          }
          
          // Si no hay datos agregados del backend, recalcular todo desde registros
          if (!resp?.totales && !Array.isArray(resp?.edadesAmbos) && !Array.isArray(resp?.hitsPorHora)) {
            this.recalcularDesdeRegistros(regs);
          }
        },
        error: () => { },
        complete: () => (this.loading = false),
      });
  }

  private cargarHoy(): void {
    if (!this.numeroSerie) return;

    this.loading = true;
    this.incidencias.hoy(this.numeroSerie).subscribe({
      next: (resp: any) => {
        const items = this.pickArray(resp);
        const regs = items.map(this.normalizeItem);
        this.registros = regs;
        this.totalFiltrado = Number(resp?.total ?? regs.length);
        this.recalcularDesdeRegistros(regs);

        if (resp?.totales) {
          this.totalPersonas = Number(resp.totales.total ?? this.totalPersonas);
          this.totalHombres = Number(resp.totales.hombres ?? this.totalHombres);
          this.totalMujeres = Number(resp.totales.mujeres ?? this.totalMujeres);
          this.chartHits = [
            { grupo: 'Hombres', valor: this.totalHombres, colors: 2 },
            { grupo: 'Mujeres', valor: this.totalMujeres, colors: 1 },
          ];
        }
        if (Array.isArray(resp?.hitsPorHora))
          this.hitsPorHora = this.normalizarHoras(resp.hitsPorHora);
        if (Array.isArray(resp?.edadesAmbos))
          this.chartEdadesAmbos = this.ensureEdadShape(resp.edadesAmbos);
        if (Array.isArray(resp?.edadesMujeres))
          this.chartEdadesMujeres = this.ensureEdadShape(resp.edadesMujeres);
        if (Array.isArray(resp?.edadesHombres))
          this.chartEdadesHombres = this.ensureEdadShape(resp.edadesHombres);
      },
      error: () => { },
      complete: () => (this.loading = false),
    });
  }

  colorEstado: 'default' | 'hombre' | 'mujer' = 'default';
  highlightActive = false;

  private highlightTimer: any;
  private currentHitKey: string | null = null;

  private hitKey(u: any): string {
    return `${u?.id ?? 'x'}-${u?.fechaRaw ?? ''}`;
  }

  private generoToEstado(g?: string | null): 'default' | 'hombre' | 'mujer' {
    const s = (g || '').trim().toLowerCase();
    if (s === 'hombre' || s === 'masculino') return 'hombre';
    if (s === 'mujer' || s === 'femenino') return 'mujer';
    return 'default';
  }

  private activarHighlight(genero?: string | null): void {
    clearTimeout(this.highlightTimer);
    this.colorEstado = this.generoToEstado(genero);
    this.highlightActive = this.colorEstado !== 'default';
    this.cdr.markForCheck();

    this.highlightTimer = setTimeout(() => {
      this.highlightActive = false;
      this.colorEstado = 'default';
      this.cdr.markForCheck();
    }, 5000);
  }

  private playNewHitSound(): void {
    try {
      const a = new Audio('assets/images/notificacaion.mp3');
      a.volume = 0.8;
      a.play().catch(() => { });
    } catch { }
  }


  /** Tooltip: Conteo de hits por hora (barras apiladas). */
  customizePoint = (p: any) => {
    if (p?.seriesName === 'Mujeres') return { color: '#f87171' };
    if (p?.seriesName === 'Hombres') return { color: '#0ea5e9' };
    switch (p?.data?.colors) {
      case 1:
        return { color: '#f87171' };
      case 2:
        return { color: '#0ea5e9' };
      default:
        return {};
    }
  };

  customizeEdadPoint = (p: any) => {
    const colorMap: any = {
      1: '#8e44ad',
      2: '#f39c12',
      3: '#16a085',
      4: '#c0392b',
    };
    return { color: colorMap[p.data.color] || '#7f8c8d' };
  };

  customizeEdadMujeresPoint = (p: any) => {
    const colorMap: any = {
      1: '#f87171',
      2: '#fb7185',
      3: '#fda4af',
      4: '#ef4444',
    };
    return { color: colorMap[p.data.color] || '#e1bee7' };
  };

  customizeEdadHombresPoint = (p: any) => {
    const colorMap: any = {
      1: '#06b6d4',
      2: '#0ea5e9',
      3: '#38bdf8',
      4: '#7dd3fc',
    };
    return { color: colorMap[p.data.color] || '#cfd8dc' };
  };

  pointClickHandler(e: any) {
    this.toggleVisibility(e?.target);
  }

  legendClickHandler(e: any) {
    const arg = e?.target;
    const cmp = e?.component;
    if (!arg || !cmp) return;
    const series = cmp.getAllSeries?.()[0];
    if (!series) return;
    const pts = series.getPointsByArg?.(arg) || [];
    const item = pts[0];
    if (item) this.toggleVisibility(item);
  }

  toggleVisibility(item: any) {
    if (!item?.isVisible || !item?.hide || !item?.show) return;
    item.isVisible() ? item.hide() : item.show();
  }

  edadText = (cellInfo: any) =>
    cellInfo?.value || cellInfo?.value === 0 ? `${cellInfo.value} Años` : '';

  private fmt(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private pickArray(resp: any): any[] {
    if (Array.isArray(resp)) return resp;
    if (Array.isArray(resp?.items)) return resp.items;
    if (Array.isArray(resp?.registros)) return resp.registros;
    if (Array.isArray(resp?.data)) return resp.data;
    return [];
  }

  private parseFecha(fecha: any): Date {
    if (fecha instanceof Date) return fecha;
    if (typeof fecha !== 'string') return new Date();
    const s = fecha.trim();
    const ts = Date.parse(s);
    if (!isNaN(ts)) return new Date(ts);
    const [dpart, tpart] = s.split(' ');
    const [ddS, mmS, yyS] = (dpart || '').split(/[\/\-]/);
    const dd = Number(ddS) || 1;
    const mm = (Number(mmS) || 1) - 1;
    const yyyy = Number(yyS) || new Date().getFullYear();
    let hh = 0,
      mi = 0,
      ss = 0;
    if (tpart) {
      const [hS, mS, sS] = tpart.split(':');
      hh = Number(hS) || 0;
      mi = Number(mS) || 0;
      ss = Number(sS) || 0;
    }
    return new Date(yyyy, mm, dd, hh, mi, ss);
  }

  private formatFechaLabel(fechaRaw: any): string | null {
    if (!fechaRaw) return null;
    const s = String(fechaRaw).trim();
    const [dpart, tpart = '00:00:00'] = s.split(' ');
    const [ddS, mmS, yyS] = dpart.split(/[\/\-]/);
    const dd = Number(ddS);
    const mm = Number(mmS);
    const yyyy = Number(yyS);
    const [hS, mS, sS] = tpart.split(':');
    if (!(dd && mm && yyyy)) return s;
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hh = Number(hS || 0);
    const mi = Number(mS || 0);
    const ss = Number(sS || 0);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return `${pad2(dd)}-${meses[mm - 1]}-${yyyy} ${pad2(hh)}:${pad2(mi)}:${pad2(ss)}`;
  }

  private readonly ESTADOS_ANIMO = [
    'feliz', 'neutral', 'sorprendido', 'triste', 'molesto',
    'disgustado', 'asustado', 'despectivo',
  ] as const;

  private normalizeEstado(raw: string): string {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v) return '';
    const known = this.ESTADOS_ANIMO as readonly string[];
    const idx = known.indexOf(v);
    const base = idx >= 0 ? known[idx] : v;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  private normalizeItem = (x: any) => {
    const g = String(x?.genero ?? '')
      .trim()
      .toLowerCase();
    const genero =
      g === 'hombre' ? 'Hombre' : g === 'mujer' ? 'Mujer' : x?.genero ?? '';
    const edad = x?.edad != null ? Number(x.edad) : null;
    const estado = this.normalizeEstado(x?.estado ?? x?.estadoAnimo ?? '');
    const id = x?.id != null ? Number(x.id) : null;
    const fechaRaw = (x?.fechaHora ?? x?.fecha ?? '').toString().trim();
    const fechaHora = fechaRaw ? this.parseFecha(fechaRaw) : null;
    return { genero, edad, estado, id, fechaRaw, fechaHora };
  };

  private recalcularDesdeRegistros(regs: any[]): void {
    this.totalPersonas = regs.length;
    this.totalHombres = regs.filter((r) => r.genero === 'Hombre').length;
    this.totalMujeres = regs.filter((r) => r.genero === 'Mujer').length;

    this.chartHits = [
      { grupo: 'Hombres', valor: this.totalHombres, colors: 2 },
      { grupo: 'Mujeres', valor: this.totalMujeres, colors: 1 },
    ];

    const ambos = { a: 0, b: 0, c: 0, d: 0 };
    const m = { a: 0, b: 0, c: 0, d: 0 };
    const h = { a: 0, b: 0, c: 0, d: 0 };

    for (const r of regs) {
      const bucket =
        r.edad <= 20 ? 'a' : r.edad <= 40 ? 'b' : r.edad <= 60 ? 'c' : 'd';
      if (bucket === 'a') ambos.a++;
      else if (bucket === 'b') ambos.b++;
      else if (bucket === 'c') ambos.c++;
      else ambos.d++;
      if (r.genero === 'Mujer') {
        if (bucket === 'a') m.a++;
        else if (bucket === 'b') m.b++;
        else if (bucket === 'c') m.c++;
        else m.d++;
      } else if (r.genero === 'Hombre') {
        if (bucket === 'a') h.a++;
        else if (bucket === 'b') h.b++;
        else if (bucket === 'c') h.c++;
        else h.d++;
      }
    }

    this.chartEdadesAmbos = [
      { rango: '0 - 20', valor: ambos.a, color: 1 },
      { rango: '21 - 40', valor: ambos.b, color: 2 },
      { rango: '41 - 60', valor: ambos.c, color: 3 },
      { rango: '61+', valor: ambos.d, color: 4 },
    ];

    this.chartEdadesMujeres = [
      { rango: '0 - 20', valor: m.a, color: 1 },
      { rango: '21 - 40', valor: m.b, color: 2 },
      { rango: '41 - 60', valor: m.c, color: 3 },
      { rango: '61+', valor: m.d, color: 4 },
    ];

    this.chartEdadesHombres = [
      { rango: '0 - 20', valor: h.a, color: 1 },
      { rango: '21 - 40', valor: h.b, color: 2 },
      { rango: '41 - 60', valor: h.c, color: 3 },
      { rango: '61+', valor: h.d, color: 4 },
    ];

    const mapaHoras: Record<string, { hombres: number; mujeres: number }> = {};
    for (const r of regs) {
      const d: Date =
        r.fechaHora instanceof Date
          ? r.fechaHora
          : this.parseFecha(r.fechaHora);
      const hh = String(d.getHours()).padStart(2, '0') + ':00';
      if (!mapaHoras[hh]) mapaHoras[hh] = { hombres: 0, mujeres: 0 };
      if (r.genero === 'Hombre') mapaHoras[hh].hombres++;
      else if (r.genero === 'Mujer') mapaHoras[hh].mujeres++;
    }
    const horas = Object.keys(mapaHoras).sort();
    this.hitsPorHora = horas.map((hh) => ({
      hora: hh,
      hombres: mapaHoras[hh].hombres,
      mujeres: mapaHoras[hh].mujeres,
    }));
  }

  private normalizarHoras(arr: any[]): any[] {
    return arr
      .map((x) => {
        const hora =
          typeof x?.hora === 'string'
            ? x.hora
            : x?.hour != null
              ? String(x.hour).padStart(2, '0') + ':00'
              : '00:00';
        const hombres = Number(x?.hombres ?? x?.male ?? 0);
        const mujeres = Number(x?.mujeres ?? x?.female ?? 0);
        return { hora, hombres, mujeres };
      })
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }

  private ensureEdadShape(arr: any[]): any[] {
    const mapKey = (k: any) =>
      typeof k === 'number'
        ? k
        : (
          {
            '0-20': 1,
            '0 - 20': 1,
            '21-40': 2,
            '21 - 40': 2,
            '41-60': 3,
            '41 - 60': 3,
            '61+': 4,
          } as any
        )[k] || 1;
    return arr.map((x) => {
      const rango = x?.rango ?? x?.label ?? '';
      const valor = Number(x?.valor ?? x?.count ?? 0);
      const color = mapKey(x?.color ?? rango);
      return { rango, valor, color };
    });
  }

  onTooltipShown = (e: any) => {
    console.log('tooltipShown', e);
  };
  
  onTooltipHidden = (e: any) => {
    console.log('tooltipHidden', e);
  };
  
  customizeHitsTooltip = (arg: any) => {
    const etiqueta = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    return { text: `${etiqueta}: ${valor}` };
  };

  customizeEdadTooltip = (arg: any) => {
    const etiqueta = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    return { text: `${etiqueta}: ${valor}` };
  };

  customizeEdadMujeresTooltip = (arg: any) => {
    const etiqueta = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    return { text: `Mujeres ${etiqueta}: ${valor} registros` };
  };

  customizeEdadHombresTooltip = (arg: any) => {
    const etiqueta = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    return { text: `Hombres ${etiqueta}: ${valor} registros` };
  };

  customizeHitsPorHoraTooltip = (arg: any) => {
    const hora = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    const genero = arg?.seriesName === 'Mujeres' ? 'Mujeres' : 'Hombres';
    return { text: `${genero} ${hora}: ${valor} registros` };
  };
  
}
