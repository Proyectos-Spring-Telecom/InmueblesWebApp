import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
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
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { environment } from 'src/environments/environment';
import Swal from 'sweetalert2';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { ContratosService } from 'src/app/services/moduleService/contratos.service';
import { InstalacionService } from 'src/app/services/moduleService/instalaciones.service';
import { InstalacionCentral } from 'src/app/services/moduleService/instalacionesCentral.service';
import { PagoInmuebleService } from 'src/app/services/moduleService/pago-inmueble.service';
import {
  CatMetodoPagoItem,
  CatMetodosPagoService,
} from 'src/app/services/moduleService/cat-metodos-pago.service';
import {
  CatServicioItem,
  CatServiciosService,
} from 'src/app/services/moduleService/cat-servicios.service';
import {
  contarMontoSimbolosAntesCursor,
  cursorMontoTrasFormato,
  extraerMontoRawDesdeDisplay,
  formatMonedaDesdeNumero,
  formatearMonedaDesdeLimpia,
  parseMonedaNumerico,
} from 'src/app/shared/valor-miles-format';

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

type FrecuenciaPago = 'mensual' | 'bimestral-impar' | 'bimestral-par' | 'anual-marzo';

/** Fila de expediente en detalle de inmueble (mismas categorías que el formulario de alta). */
interface MonitoreoExpedienteDoc {
  etiqueta: string;
  detalle: string;
}

type PagoEstatus = 'Pagado' | 'Pendiente' | 'Cancelado';

/** API `estatus`: 2 Pendiente, 1 Pagado, 0 Cancelado (Swagger). */
function estatusPagoToApi(estatus: PagoEstatus): number {
  switch (estatus) {
    case 'Pagado':
      return 1;
    case 'Pendiente':
      return 2;
    case 'Cancelado':
      return 0;
    default:
      return 2;
  }
}

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
  /**
   * Inmueble asociado (`?idInmueble=`), inyectado al abrir el detalle desde el mapa.
   * Requerido para POST `/pago` (sin selector en UI).
   */
  idInmuebleContext: number | null = null;
  inmuebleEsRenta = true;
  localEstatus: 'ocupado' | 'libre' = 'ocupado';
  detalleTitulo = 'San Cristóbal';
  detalleInmuebleNombre = 'San Cristóbal';
  detalleLocalNombre = 'Local PB-01';
  detalleArrendador = 'Inmuebles y Desarrollos HAC S.A de C.V.';
  detalleArrendatario = 'Laboratorios Chopo';
  mostrarModalContratoLocal = false;
  mostrarModalPago = false;
  pagoForm!: FormGroup;
  listaCatMetodosPago: CatMetodoPagoItem[] = [];
  metodosPagoCargando = false;
  /** Catálogo GET `/cat-servicios/paginated` para el select de servicio. */
  listaCatServicios: CatServicioItem[] = [];
  catServiciosCargando = false;
  /** Etiqueta de inmueble/local en contexto para el campo `idInmueble` del POST /pago. */
  inmueblePagoEtiqueta = '';
  /** Valor real del monto: solo dígitos y punto (ej. `5325.50`). El input solo muestra formato. */
  private pagoMontoRaw = '';
  /** Deshabilita el botón Agregar mientras corre POST /pago. */
  pagoGuardando = false;
  contratoModalLoading = false;
  contratoModalError: string | null = null;
  contratoModal: VistaContratoLocalModal | null = null;
  private clientesNombreMap: Map<number, string> | null = null;
  private inmueblesNombreMap: Map<number, string> | null = null;
  private vistaQuerySub?: Subscription;
  now = new Date();
  readonly ubicacionLat = 18.953177342874035;
  readonly ubicacionLng = -99.23588919868236;
  galleryIndex = 0;
  readonly galleryImages: string[] = [
    'https://lh3.googleusercontent.com/gps-cs-s/APNQkAFlG1RuIX_TUTB944PQtcU_VhwJBKarAk6AZl61hj8-4Pes7T6n4kUQicm-qp8DtXMazia1NU7pjij4ziIozMFwvKH6Lbr1r60PIedWpOhP9ouysXVnE2gjY2rWj212L9kc7r3D=s680-w680-h510-rw',
    'https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=qjL0kL4w35FZ37eF-rx7AQ&cb_client=search.gws-prod.gps&w=408&h=240&yaw=61.73827&pitch=0&thumbfov=100',
    'https://joyeriafinaonline.com.mx/wp-content/uploads/2022/07/10-Cuernavaca2.jpg',
  ];
  /** Imagen de plano (tarjeta «Plano» en detalle de inmueble). */
  readonly imagenPlanoInmueble =
    'https://images.homify.com/v1558386691/p/photo/image/3062344/plano_3.jpg';
  /** Imagen de documentación del predio (vista local). */
  readonly imagenDocumentacionLocal =
    'https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=qjL0kL4w35FZ37eF-rx7AQ&cb_client=search.gws-prod.gps&w=408&h=240&yaw=61.73827&pitch=0&thumbfov=100';
  /** Nombre mostrado en vista Local (contrato); independiente del expediente del inmueble. */
  readonly nombreArchivoContratoLocalDemo = 'Contrato local vigente (texto informativo)';

  /**
   * Expediente digital alineado con «Documentos e imágenes» del formulario de inmuebles.
   * Demo: cada rubro con archivo (URLs locales / PDF demo).
   */
  readonly expedienteDocumentosInmueble: MonitoreoExpedienteDoc[] = [
    {
      etiqueta: 'Escritura del inmueble (PDF)',
      detalle: 'Documento base del predio registrado y vigente.',
    },
    {
      etiqueta: 'Licencia / uso de suelo',
      detalle: 'Licencia municipal y validación de uso de suelo.',
    },
    {
      etiqueta: 'Fachada',
      detalle: 'Evidencia fotográfica de fachada principal del inmueble.',
    },
    {
      etiqueta: 'Contrato de renta',
      detalle: 'Contrato principal de arrendamiento con vigencia activa.',
    },
    {
      etiqueta: 'Constancia de Situación Fiscal',
      detalle: 'Constancia fiscal del contribuyente asociado al inmueble.',
    },
    {
      etiqueta: 'Comprobante de Domicilio',
      detalle: 'Comprobante de domicilio fiscal actualizado.',
    },
    {
      etiqueta: 'Constancia de situación fiscal del representante legal',
      detalle: 'Constancia fiscal del representante legal registrado.',
    },
    {
      etiqueta: 'INE Representante Legal',
      detalle: 'Identificación oficial vigente del representante legal.',
    },
    {
      etiqueta: 'Imagen 1 (galería del inmueble)',
      detalle: 'Imagen de referencia de interiores para expediente.',
    },
  ];

  /** Expediente demo para vista local (misma checklist que alta de arrendatario). */
  readonly expedienteDocumentosLocal: MonitoreoExpedienteDoc[] = [
    {
      etiqueta: 'Contrato de renta del local',
      detalle: 'Contrato vigente entre arrendador y arrendatario.',
    },
    {
      etiqueta: 'Constancia de situación fiscal (arrendatario)',
      detalle: 'RFC y datos fiscales del arrendatario.',
    },
    {
      etiqueta: 'Identificación oficial del representante',
      detalle: 'INE o documento vigente del firmante.',
    },
    {
      etiqueta: 'Comprobante de domicilio del negocio',
      detalle: 'Reciente y coincidente con el domicilio fiscal.',
    },
    {
      etiqueta: 'Licencia de funcionamiento',
      detalle: 'Permiso municipal alineado al giro del local.',
    },
    {
      etiqueta: 'Anexo de obligaciones / uso de áreas',
      detalle: 'Condiciones de mantenimiento y zonas comunes.',
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
    { zona: 'Planta baja San Cristóbal', superficie: '200.00 m²' },
    { zona: 'Segundo piso San Cristóbal', superficie: '200.00 m²' },
  ];
  readonly estacionamientosInmueble = [
    { nombrePensionado: 'Carlos Ramírez', numeroTarjeta: 'TAR-1001', arrendatario: 'Laboratorios Chopo' },
    { nombrePensionado: 'Luis Hernández', numeroTarjeta: 'TAR-1042', arrendatario: 'Inglés Individual' },
    { nombrePensionado: 'Marta López', numeroTarjeta: 'TAR-1108', arrendatario: 'Poder Judicial del Estado' },
  ];
  pagosData: PagoRow[] = [];
  pagosDataGrid: PagoRow[] = [];
  mesFiltroPagosSeleccionado = '__all__';
  mesesFiltroPagosOpciones: Array<{ value: string; label: string }> = [
    { value: '__all__', label: 'Todos los meses' },
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
  @ViewChild('pagoComprobanteInput', { static: false })
  pagoComprobanteInput?: ElementRef<HTMLInputElement>;
  @ViewChild('pagoMontoInput', { static: false })
  pagoMontoInput?: ElementRef<HTMLInputElement>;

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
    private sanitizer: DomSanitizer,
    private pagoInmuebleService: PagoInmuebleService,
    private catMetodosPagoService: CatMetodosPagoService,
    private catServiciosService: CatServiciosService,
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
    this.detalleInmuebleNombre =
      (qp.get('nombreInmueble') ?? '').trim() || 'San Cristóbal';
    this.detalleLocalNombre =
      (qp.get('nombreLocal') ?? '').trim() || 'Local PB-01';
    this.detalleArrendador =
      (qp.get('arrendador') ?? '').trim() || 'Inmuebles y Desarrollos HAC S.A de C.V.';
    this.detalleArrendatario =
      (qp.get('arrendatario') ?? '').trim() || 'Laboratorios Chopo';
    this.detalleTitulo =
      this.vistaEntidad === 'local'
        ? this.detalleLocalNombre
        : this.detalleInmuebleNombre;
    const idRaw = qp.get('idContrato');
    const idn = idRaw != null && String(idRaw).trim() !== '' ? Number(idRaw) : NaN;
    this.idContratoQuery =
      Number.isFinite(idn) && idn > 0 ? Math.floor(idn) : null;
    const idInmRaw = (qp.get('idInmueble') ?? '').trim();
    const idInmNum = idInmRaw !== '' ? Number(idInmRaw) : NaN;
    this.idInmuebleContext =
      Number.isFinite(idInmNum) && idInmNum > 0 ? Math.floor(idInmNum) : null;
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
    this.pagosData = this.buildPagosDesdeServicios(this.serviciosDataSource);
    this.refrescarMesesFiltroPagosOpciones();
    this.aplicarFiltroPagosGrid();
  }

  private buildPagosDesdeServicios(servicios: ServicioDetalle[]): PagoRow[] {
    const metodos = ['Transferencia', 'Tarjeta', 'SPEI', 'Domiciliado'];
    const basePorConceptoInmueble: Record<string, number> = {
      Agua: 900,
      Luz: 1850,
      'Licencia funcionamiento': 650,
      Seguridad: 2400,
      Limpieza: 1600,
      Internet: 750,
      Renta: 32000,
      Mantenimiento: 4200,
      Predio: 1200,
    };
    const basePorConceptoArrendatario: Record<string, number> = {
      Renta: 18500,
      Mantenimiento: 2100,
    };
    const calendarioPagoPorConceptoInmueble: Record<
      string,
      { diaPago: number; diaLimite: number }
    > = {
      Renta: { diaPago: 1, diaLimite: 5 },
      Mantenimiento: { diaPago: 1, diaLimite: 10 },
      Agua: { diaPago: 8, diaLimite: 17 },
      Luz: { diaPago: 12, diaLimite: 20 },
      Internet: { diaPago: 10, diaLimite: 18 },
      Seguridad: { diaPago: 5, diaLimite: 12 },
      Limpieza: { diaPago: 5, diaLimite: 12 },
      'Licencia funcionamiento': { diaPago: 3, diaLimite: 15 },
      Predio: { diaPago: 10, diaLimite: 17 },
    };
    const calendarioPagoPorConceptoArrendatario: Record<
      string,
      { diaPago: number; diaLimite: number }
    > = {
      Renta: { diaPago: 1, diaLimite: 5 },
      Mantenimiento: { diaPago: 1, diaLimite: 10 },
    };
    const basePorConcepto =
      this.vistaEntidad === 'local'
        ? basePorConceptoArrendatario
        : basePorConceptoInmueble;
    const calendarioPagoPorConcepto =
      this.vistaEntidad === 'local'
        ? calendarioPagoPorConceptoArrendatario
        : calendarioPagoPorConceptoInmueble;
    const frecuenciaPorConcepto: Record<string, FrecuenciaPago> =
      this.vistaEntidad === 'local'
        ? {
            Renta: 'mensual',
            Mantenimiento: 'mensual',
          }
        : {
            Renta: 'mensual',
            Mantenimiento: 'mensual',
            Agua: 'mensual',
            Luz: 'bimestral-par',
            Internet: 'mensual',
            Seguridad: 'mensual',
            Limpieza: 'mensual',
            'Licencia funcionamiento': 'anual-marzo',
            Predio: 'bimestral-impar',
          };
    const hoy = new Date();
    const ciclos = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      return {
        anio: d.getFullYear(),
        mes: d.getMonth() + 1,
      };
    });

    const fechaIso = (anio: number, mes: number, dia: number): string => {
      const ultimoDia = new Date(anio, mes, 0).getDate();
      const d = String(Math.min(dia, ultimoDia)).padStart(2, '0');
      return `${anio}-${String(mes).padStart(2, '0')}-${d}`;
    };

    const rows: PagoRow[] = [];
    let id = 1;
    ciclos.forEach((ciclo, cicloIndex) => {
      servicios.forEach((servicio, servicioIndex) => {
        const frecuencia = frecuenciaPorConcepto[servicio.concepto] ?? 'mensual';
        if (!this.esMesProgramado(ciclo.mes, frecuencia)) return;
        const base = basePorConcepto[servicio.concepto] ?? 3500;
        const calendario =
          calendarioPagoPorConcepto[servicio.concepto] ?? {
            diaPago: 5,
            diaLimite: 12,
          };
        const fechaPago = fechaIso(ciclo.anio, ciclo.mes, calendario.diaPago);
        const fechaLimitePago = fechaIso(
          ciclo.anio,
          ciclo.mes,
          calendario.diaLimite,
        );
        const variacion = ((servicioIndex + 1) * 38.5) + (cicloIndex * 21.75);
        rows.push({
          id: id++,
          concepto: servicio.concepto,
          fechaPago,
          fechaLimitePago,
          monto: Number((base + variacion).toFixed(2)),
          metodo: metodos[(cicloIndex + servicioIndex) % metodos.length],
          estatus: cicloIndex >= ciclos.length - 2 ? 'Pendiente' : 'Pagado',
        });
      });
    });
    rows.sort((a, b) => {
      const fa = String(a.fechaPago ?? '');
      const fb = String(b.fechaPago ?? '');
      return fb.localeCompare(fa);
    });
    return rows;
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

    const calendarioPagoPorConcepto: Record<
      string,
      { diaPago: number; diaLimite: number }
    > =
      this.vistaEntidad === 'local'
        ? {
            Renta: { diaPago: 1, diaLimite: 5 },
            Mantenimiento: { diaPago: 1, diaLimite: 10 },
          }
        : {
            Renta: { diaPago: 1, diaLimite: 5 },
            Mantenimiento: { diaPago: 1, diaLimite: 10 },
            Agua: { diaPago: 8, diaLimite: 17 },
            Luz: { diaPago: 12, diaLimite: 20 },
            Internet: { diaPago: 10, diaLimite: 18 },
            Seguridad: { diaPago: 5, diaLimite: 12 },
            Limpieza: { diaPago: 5, diaLimite: 12 },
            'Licencia funcionamiento': { diaPago: 3, diaLimite: 15 },
            Predio: { diaPago: 10, diaLimite: 17 },
          };
    const frecuenciaPorConcepto: Record<string, FrecuenciaPago> =
      this.vistaEntidad === 'local'
        ? {
            Renta: 'mensual',
            Mantenimiento: 'mensual',
          }
        : {
            Renta: 'mensual',
            Mantenimiento: 'mensual',
            Agua: 'mensual',
            Luz: 'bimestral-par',
            Internet: 'mensual',
            Seguridad: 'mensual',
            Limpieza: 'mensual',
            'Licencia funcionamiento': 'anual-marzo',
            Predio: 'bimestral-impar',
          };
    const fechaIso = (anio: number, mes: number, dia: number): string => {
      const ultimoDia = new Date(anio, mes, 0).getDate();
      const d = String(Math.min(dia, ultimoDia)).padStart(2, '0');
      return `${anio}-${String(mes).padStart(2, '0')}-${d}`;
    };
    const hoy = new Date();
    const baseAnio = hoy.getFullYear();
    const baseMes = hoy.getMonth() + 1;

    return conceptos.map((concepto, i) => {
      const frecuencia = frecuenciaPorConcepto[concepto] ?? 'mensual';
      const calendario = calendarioPagoPorConcepto[concepto] ?? {
        diaPago: 5,
        diaLimite: 12,
      };
      const { anio: anioPago, mes: mesPago } =
        this.obtenerMesProgramadoReciente(baseAnio, baseMes, frecuencia);
      return {
        concepto,
        contrato: this.referenciasServicioBase[concepto] ?? 'N/D',
        fechaPago: fechaIso(anioPago, mesPago, calendario.diaPago),
        fechaLimitePago: fechaIso(anioPago, mesPago, calendario.diaLimite),
      };
    }).sort((a, b) => String(b.fechaPago).localeCompare(String(a.fechaPago)));
  }

  private esMesProgramado(mes: number, frecuencia: FrecuenciaPago): boolean {
    if (frecuencia === 'mensual') return true;
    if (frecuencia === 'bimestral-impar') return mes % 2 === 1;
    if (frecuencia === 'bimestral-par') return mes % 2 === 0;
    if (frecuencia === 'anual-marzo') return mes === 3;
    return true;
  }

  private obtenerMesProgramadoReciente(
    anioRef: number,
    mesRef: number,
    frecuencia: FrecuenciaPago,
  ): { anio: number; mes: number } {
    for (let i = 0; i < 24; i++) {
      const d = new Date(anioRef, mesRef - 1 - i, 1);
      const mes = d.getMonth() + 1;
      if (!this.esMesProgramado(mes, frecuencia)) continue;
      return { anio: d.getFullYear(), mes };
    }
    return { anio: anioRef, mes: mesRef };
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

  formatoMoneda(e: any): string {
    if (!e?.value) return '$0.00';
    return (
      '$' +
      Number(e.value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  onMesFiltroPagosChange(event: Event): void {
    const input = event.target as HTMLSelectElement | null;
    this.mesFiltroPagosSeleccionado = input?.value || '__all__';
    this.aplicarFiltroPagosGrid();
  }

  private refrescarMesesFiltroPagosOpciones(): void {
    const meses = new Set<string>();
    this.pagosData.forEach((r) => {
      const k = this.obtenerClaveMes(r.fechaPago);
      if (k) meses.add(k);
    });

    const ordenados = Array.from(meses).sort();
    const opciones = ordenados.map((value) => ({
      value,
      label: this.formatearEtiquetaMes(value),
    }));
    this.mesesFiltroPagosOpciones = [
      { value: '__all__', label: 'Todos los meses' },
      ...opciones,
    ];

    const existeSeleccion = this.mesesFiltroPagosOpciones.some(
      (o) => o.value === this.mesFiltroPagosSeleccionado,
    );
    if (!existeSeleccion) this.mesFiltroPagosSeleccionado = '__all__';
    this.aplicarFiltroPagosGrid();
  }

  private aplicarFiltroPagosGrid(): void {
    if (this.mesFiltroPagosSeleccionado === '__all__') {
      this.pagosDataGrid = [...this.pagosData];
      return;
    }
    this.pagosDataGrid = this.pagosData.filter(
      (r) => this.obtenerClaveMes(r.fechaPago) === this.mesFiltroPagosSeleccionado,
    );
  }

  private obtenerClaveMes(fechaIso: string): string {
    const s = String(fechaIso ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    return s.slice(0, 7);
  }

  private formatearEtiquetaMes(ym: string): string {
    if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
    const [yy, mm] = ym.split('-');
    const m = Number(mm);
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const nombreMes = meses[m - 1] ?? mm;
    return `${nombreMes} ${yy}`;
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
  descargarDocumento(archivo: { nombre: string; url: string }, ev: Event): void {
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
        numeroContrato: 'HAC-DEMO-001',
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
          'Contrato de demostración alineado con el inmueble y arrendatarios del monitoreo. Cuando la URL incluya ?idContrato= se cargarán los datos reales del API.',
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

  get mapaUbicacionEmbedUrl(): SafeResourceUrl {
    const url = `https://maps.google.com/maps?q=${this.ubicacionLat},${this.ubicacionLng}&z=16&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  get streetViewEmbedUrl(): SafeResourceUrl {
    const url = `https://maps.google.com/maps?q=&layer=c&cbll=${this.ubicacionLat},${this.ubicacionLng}&cbp=11,0,0,0,0&output=svembed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngOnInit(): void {
    this.initPagoForm();
    this.cargarCatalogoMetodosPago();
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
      idServicioInmueble: [null as number | null],
      concepto: [''],
      fechaPago: ['', Validators.required],
      monto: ['', Validators.required],
      idMetodoPago: [null as number | null],
      estatus: ['Pendiente' as PagoEstatus],
      comprobantePago: [null as File | null, Validators.required],
      comprobantePagoNombre: [''],
    });
  }

  etiquetaCatMetodoPago(item: CatMetodoPagoItem): string {
    const nombre = item.nombre;
    if (nombre != null && String(nombre).trim() !== '') return String(nombre).trim();
    return `Método ${item.id}`;
  }

  etiquetaCatServicio(item: CatServicioItem): string {
    const nombre = item.nombre ?? item.servicio ?? item.descripcion;
    if (nombre != null && String(nombre).trim() !== '') return String(nombre).trim();
    return `Servicio ${item.id}`;
  }

  etiquetaCatServicioPorId(id: number | null | undefined): string {
    if (id == null || !Number.isFinite(Number(id))) return '';
    const hit = this.listaCatServicios.find((s) => s.id === Number(id));
    return hit ? this.etiquetaCatServicio(hit) : '';
  }

  etiquetaCatMetodoPagoPorId(id: number | null | undefined): string {
    if (id == null || !Number.isFinite(Number(id))) return '—';
    const hit = this.listaCatMetodosPago.find((m) => m.id === Number(id));
    return hit ? this.etiquetaCatMetodoPago(hit) : `Método ${id}`;
  }

  private cargarCatalogoMetodosPago(): void {
    this.metodosPagoCargando = true;
    this.catMetodosPagoService.obtenerMetodosPagoPaginados(1, 100).subscribe({
      next: (res) => {
        this.listaCatMetodosPago = this.extraerFilasCatMetodosPago(res).filter(
          (m) => m.estatus == null || m.estatus === 1,
        );
        this.metodosPagoCargando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.listaCatMetodosPago = [];
        this.metodosPagoCargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  private extraerFilasCatMetodosPago(res: unknown): CatMetodoPagoItem[] {
    const r = res as { data?: unknown } | unknown[] | null;
    if (r == null) return [];
    let rows: unknown = Array.isArray(r) ? r : (r as { data?: unknown }).data;
    if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
      const bag = rows as Record<string, unknown>;
      rows = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
    }
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        const row = item as Record<string, unknown>;
        const id = Number(row['id'] ?? row['idCatMetodoPago']);
        if (!Number.isFinite(id)) return null;
        let estatus: number | undefined;
        if (typeof row['activo'] === 'boolean') {
          estatus = row['activo'] ? 1 : 0;
        } else if (row['estatus'] != null) {
          const n = Number(row['estatus']);
          estatus = n === 1 ? 1 : 0;
        }
        return {
          id,
          nombre: row['nombre'] != null ? String(row['nombre']) : undefined,
          estatus,
        } as CatMetodoPagoItem;
      })
      .filter((item): item is CatMetodoPagoItem => item != null);
  }

  /** Etiqueta de entidad (inmueble o local) según `vistaEntidad` y `idInmueble` en URL. */
  private actualizarEtiquetaEntidadPago(): void {
    if (this.idInmuebleContext == null) {
      this.inmueblePagoEtiqueta = '';
      return;
    }
    const id = this.idInmuebleContext;
    const esLocal = this.vistaEntidad === 'local';
    const tipo = esLocal ? 'Local' : 'Inmueble';
    const nombre = esLocal
      ? this.detalleLocalNombre || this.detalleTitulo
      : this.detalleInmuebleNombre || this.detalleTitulo;
    this.inmueblePagoEtiqueta = `${tipo}: ${nombre} (#${id})`;
  }

  private cargarCatalogoServiciosPago(): void {
    this.catServiciosCargando = true;
    this.catServiciosService.obtenerServiciosPaginados(1, 100).subscribe({
      next: (res) => {
        this.listaCatServicios = this.extraerFilasCatServicios(res).filter(
          (s) => s.estatus == null || s.estatus === 1,
        );
        this.catServiciosCargando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.listaCatServicios = [];
        this.catServiciosCargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  private extraerFilasCatServicios(res: unknown): CatServicioItem[] {
    const r = res as { data?: unknown } | unknown[] | null;
    if (r == null) return [];
    let rows: unknown = Array.isArray(r) ? r : (r as { data?: unknown }).data;
    if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
      const bag = rows as Record<string, unknown>;
      rows = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
    }
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        const row = item as Record<string, unknown>;
        const id = Number(row['id'] ?? row['idTipoServicio'] ?? row['idCatServicio']);
        if (!Number.isFinite(id)) return null;
        let estatus: number | undefined;
        if (typeof row['activo'] === 'boolean') {
          estatus = row['activo'] ? 1 : 0;
        } else if (row['estatus'] != null) {
          const n = Number(row['estatus']);
          estatus = n === 1 ? 1 : 0;
        }
        return {
          id: Math.floor(id),
          nombre: row['nombre'] != null ? String(row['nombre']) : undefined,
          servicio: row['servicio'] != null ? String(row['servicio']) : undefined,
          descripcion: row['descripcion'] != null ? String(row['descripcion']) : undefined,
          estatus,
        } as CatServicioItem;
      })
      .filter((item): item is CatServicioItem => item != null);
  }

  abrirModalPago(): void {
    this.mostrarModalPago = true;
    this.actualizarEtiquetaEntidadPago();
    this.cargarCatalogoMetodosPago();
    this.cargarCatalogoServiciosPago();
    this.pagoMontoRaw = '';
    this.pagoForm?.reset({
      idServicioInmueble: null,
      concepto: '',
      fechaPago: '',
      monto: '',
      idMetodoPago: null,
      estatus: 'Pendiente' as PagoEstatus,
      comprobantePago: null,
      comprobantePagoNombre: '',
    });
    this.cdr.markForCheck();
    setTimeout(() => {
      const el = this.pagoComprobanteInput?.nativeElement;
      if (el) el.value = '';
      const montoEl = this.pagoMontoInput?.nativeElement;
      if (montoEl) montoEl.value = '';
    });
  }

  cerrarModalPago(): void {
    this.mostrarModalPago = false;
    this.cdr.markForCheck();
  }

  onPagoComprobanteFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.pagoForm?.patchValue({
      comprobantePago: file,
      comprobantePagoNombre: file?.name ?? '',
    });
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
        text: 'Completa los campos obligatorios: inmueble en contexto, fecha, monto y comprobante.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    if (this.idInmuebleContext == null) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'info',
        title: 'Falta la entidad en contexto',
        html:
          'No hay <code>idInmueble</code> en la URL de esta pantalla (vista de inmueble o local), así que no se puede registrar el pago. ' +
          'Abre el detalle desde el mapa de monitoreo o agrega <code>?idInmueble=…</code> a la URL.',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    const idInmueble = this.idInmuebleContext;

    const v = this.pagoForm.value as {
      idServicioInmueble: number | null;
      concepto: string;
      fechaPago: string;
      monto: string;
      idMetodoPago: number | null;
      estatus: PagoEstatus;
      comprobantePago: File | null;
      comprobantePagoNombre: string;
    };

    const montoN = parseMonedaNumerico(v.monto);
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

    const archivo = v.comprobantePago;
    if (!(archivo instanceof File)) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Comprobante obligatorio',
        text: 'El API requiere adjuntar el archivo del comprobante.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const fd = this.construirFormDataPago(idInmueble, v, montoN, archivo);

    this.pagoGuardando = true;
    this.cdr.markForCheck();

    this.pagoInmuebleService
      .registrarPago(fd)
      .pipe(
        finalize(() => {
          this.pagoGuardando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          const fechaPagoStr = String(v.fechaPago ?? '').trim();
          const nextId =
            this.pagosData.reduce((max, r) => Math.max(max, r.id), 0) + 1;
          const nuevo: PagoRow = {
            id: nextId,
            concepto:
              String(v.concepto ?? '').trim() ||
              this.etiquetaCatServicioPorId(v.idServicioInmueble) ||
              'Pago',
            fechaPago: fechaPagoStr,
            fechaLimitePago: this.fechaIsoMasDias(fechaPagoStr, 10),
            monto: montoN,
            metodo: this.etiquetaCatMetodoPagoPorId(v.idMetodoPago),
            estatus: (v.estatus ?? 'Pendiente') as PagoEstatus,
          };
          this.pagosData = [nuevo, ...this.pagosData];
          this.refrescarMesesFiltroPagosOpciones();
          this.aplicarFiltroPagosGrid();
          this.cerrarModalPago();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'success',
            title: 'Pago registrado',
            text: 'El pago y el comprobante se enviaron correctamente.',
            confirmButtonText: 'Listo',
          });
        },
        error: (err: unknown) => {
          const msg = this.mensajeErrorHttp(err);
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo registrar el pago',
            text: msg,
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  private construirFormDataPago(
    idInmueble: number,
    v: {
      idServicioInmueble: number | null;
      concepto: string;
      fechaPago: string;
      monto: string;
      idMetodoPago: number | null;
      estatus: PagoEstatus;
    },
    montoN: number,
    comprobante: File,
  ): FormData {
    const fd = new FormData();
    const fecha = String(v.fechaPago ?? '').trim();
    const fechaPagoApi =
      fecha.length === 10 ? `${fecha}T12:00:00.000Z` : fecha;

    fd.append('idInmueble', String(idInmueble));

    const idServicio = Number(v.idServicioInmueble);
    if (Number.isFinite(idServicio) && idServicio > 0) {
      fd.append('idServicioInmueble', String(Math.floor(idServicio)));
    }

    const concepto = String(v.concepto ?? '').trim();
    if (concepto) {
      fd.append('concepto', concepto);
    }

    fd.append('fechaPago', fechaPagoApi);
    fd.append('monto', String(montoN));

    const idMetodo = Number(v.idMetodoPago);
    if (Number.isFinite(idMetodo) && idMetodo > 0) {
      fd.append('idMetodoPago', String(Math.floor(idMetodo)));
    }

    if (v.estatus != null) {
      fd.append('estatus', String(estatusPagoToApi(v.estatus)));
    }

    fd.append('ComprobantePagoArchivo', comprobante, comprobante.name);
    return fd;
  }

  private mensajeErrorHttp(err: unknown): string {
    const e = err as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (e?.error && typeof e.error === 'object' && typeof e.error.message === 'string') {
      return e.error.message;
    }
    if (typeof e?.error === 'string' && e.error) return e.error;
    if (typeof e?.message === 'string' && e.message) return e.message;
    return 'Ocurrió un error al enviar el pago. Intenta de nuevo.';
  }

  /** Índice en `pagoMontoRaw` según la posición del cursor en el texto visible. */
  private indiceRawDesdeCursorEnInput(input: HTMLInputElement, cursor: number): number {
    return contarMontoSimbolosAntesCursor(input.value, cursor);
  }

  private puedeInsertarDigitoEnRaw(indice: number): boolean {
    const dot = this.pagoMontoRaw.indexOf('.');
    if (dot === -1) return true;
    if (indice <= dot) return true;
    return this.pagoMontoRaw.length - dot - 1 < 2;
  }

  private aplicarVistaMontoInput(input: HTMLInputElement, cursorEnRaw: number): void {
    const visible = formatearMonedaDesdeLimpia(this.pagoMontoRaw);
    input.value = visible;
    this.pagoForm.get('monto')?.setValue(this.pagoMontoRaw, { emitEvent: false });
    this.pagoForm.get('monto')?.updateValueAndValidity({ emitEvent: false });
    const pos = cursorMontoTrasFormato(
      visible,
      Math.max(0, Math.min(cursorEnRaw, this.pagoMontoRaw.length)),
    );
    requestAnimationFrame(() => input.setSelectionRange(pos, pos));
  }

  onMontoKeydown(ev: KeyboardEvent): void {
    const input = ev.target as HTMLInputElement | null;
    if (!input || !this.pagoForm) return;

    const nav = new Set([
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]);
    if (nav.has(ev.key)) return;
    if (ev.ctrlKey || ev.metaKey) return;

    const cur = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? cur;
    const tieneSeleccion = cur !== end;

    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();
      if (tieneSeleccion) {
        const i0 = this.indiceRawDesdeCursorEnInput(input, Math.min(cur, end));
        const i1 = this.indiceRawDesdeCursorEnInput(input, Math.max(cur, end));
        this.pagoMontoRaw = this.pagoMontoRaw.slice(0, i0) + this.pagoMontoRaw.slice(i1);
        this.aplicarVistaMontoInput(input, i0);
        return;
      }
      if (ev.key === 'Backspace') {
        const idx = this.indiceRawDesdeCursorEnInput(input, cur);
        if (idx > 0) {
          this.pagoMontoRaw =
            this.pagoMontoRaw.slice(0, idx - 1) + this.pagoMontoRaw.slice(idx);
          this.aplicarVistaMontoInput(input, idx - 1);
        }
        return;
      }
      const idx = this.indiceRawDesdeCursorEnInput(input, cur);
      if (idx < this.pagoMontoRaw.length) {
        this.pagoMontoRaw =
          this.pagoMontoRaw.slice(0, idx) + this.pagoMontoRaw.slice(idx + 1);
        this.aplicarVistaMontoInput(input, idx);
      }
      return;
    }

    if (ev.key >= '0' && ev.key <= '9') {
      ev.preventDefault();
      if (tieneSeleccion) {
        const i0 = this.indiceRawDesdeCursorEnInput(input, Math.min(cur, end));
        const i1 = this.indiceRawDesdeCursorEnInput(input, Math.max(cur, end));
        if (!this.puedeInsertarDigitoEnRaw(i0)) return;
        const merged = this.pagoMontoRaw.slice(0, i0) + ev.key + this.pagoMontoRaw.slice(i1);
        this.pagoMontoRaw = extraerMontoRawDesdeDisplay(merged);
        this.aplicarVistaMontoInput(input, i0 + 1);
        return;
      }
      const idx = this.indiceRawDesdeCursorEnInput(input, cur);
      if (!this.puedeInsertarDigitoEnRaw(idx)) return;
      this.pagoMontoRaw =
        this.pagoMontoRaw.slice(0, idx) + ev.key + this.pagoMontoRaw.slice(idx);
      this.aplicarVistaMontoInput(input, idx + 1);
      return;
    }

    if (ev.key === '.' || ev.key === ',' || ev.key === 'Decimal') {
      ev.preventDefault();
      if (this.pagoMontoRaw.includes('.')) return;
      if (tieneSeleccion) {
        const i0 = this.indiceRawDesdeCursorEnInput(input, Math.min(cur, end));
        const i1 = this.indiceRawDesdeCursorEnInput(input, Math.max(cur, end));
        this.pagoMontoRaw =
          this.pagoMontoRaw.slice(0, i0) + '.' + this.pagoMontoRaw.slice(i1);
        this.aplicarVistaMontoInput(input, i0 + 1);
        return;
      }
      const idx = this.indiceRawDesdeCursorEnInput(input, cur);
      this.pagoMontoRaw =
        this.pagoMontoRaw.slice(0, idx) + '.' + this.pagoMontoRaw.slice(idx);
      this.aplicarVistaMontoInput(input, idx + 1);
      return;
    }

    ev.preventDefault();
  }

  onMontoPaste(ev: ClipboardEvent): void {
    ev.preventDefault();
    const input = ev.target as HTMLInputElement | null;
    if (!input || !this.pagoForm) return;

    const texto = ev.clipboardData?.getData('text') ?? '';
    const pegado = extraerMontoRawDesdeDisplay(texto);
    if (!pegado) return;

    const cur = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? cur;
    const i0 = this.indiceRawDesdeCursorEnInput(input, Math.min(cur, end));
    const i1 = this.indiceRawDesdeCursorEnInput(input, Math.max(cur, end));
    const merged = this.pagoMontoRaw.slice(0, i0) + pegado + this.pagoMontoRaw.slice(i1);
    this.pagoMontoRaw = extraerMontoRawDesdeDisplay(merged);
    this.aplicarVistaMontoInput(input, i0 + pegado.length);
  }

  onMontoBlur(): void {
    const input = this.pagoMontoInput?.nativeElement;
    const raw =
      this.pagoMontoRaw || String(this.pagoForm?.get('monto')?.value ?? '').trim();
    const n = parseMonedaNumerico(raw);
    if (!Number.isFinite(n)) {
      this.pagoMontoRaw = '';
      this.pagoForm?.get('monto')?.setValue('', { emitEvent: false });
      if (input) input.value = '';
      return;
    }
    this.pagoMontoRaw = String(n);
    this.pagoForm?.get('monto')?.setValue(this.pagoMontoRaw, { emitEvent: false });
    if (input) {
      input.value = formatMonedaDesdeNumero(n);
    }
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
