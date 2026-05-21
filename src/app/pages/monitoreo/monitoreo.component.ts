// monitoreo.component.ts
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  animate,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, forkJoin, map, of } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { AuthenticationService } from 'src/app/services/auth.service';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { InmueblesService } from 'src/app/services/moduleService/inmuebles.service';
import { extraerArrendatariosInmuebleApi } from './monitoreo-arrendatarios.mapper';
import {
  buildMonitoreoLocalesZonasListaUnica,
  extraerLocalesInmuebleApi,
  localMonitoreoTieneInformacion,
  urlFachadaDesdeArchivos,
  urlFachadaLocalApi,
} from './monitoreo-locales.mapper';
import {
  extraerFilasListadoApi,
  extraerInmueblesListadoApi,
  mapClienteMonitoreoCentral,
  mapInmuebleMonitoreoInstalacion,
  nombreClienteMonitoreo,
} from './monitoreo-clientes.mapper';
import {
  extraerMapaInmuebleApi,
  mapaInmuebleTienePlano,
  visualLayoutDesdeCatalogoInmueble,
  visualLayoutDesdeMapaInmueble,
} from './monitoreo-mapa.mapper';

declare const google: any;

type ViewMode = 'centrales' | 'instalaciones';
type RightPanelMode = 'mapa' | 'locales';
type MonitorFlowMode = 'clientes' | 'inmuebles';
type MapScopeMode = 'inmuebles' | 'locales';
type LocalVisualState = 'libre' | 'ocupado' | 'reservado' | 'inactivo';

interface CanvasPoint {
  x: number;
  y: number;
}

interface CanvasSize {
  width: number;
  height: number;
}

interface ZonaCanvasModel {
  id: string;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LocalCanvasModel {
  id: string;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zonaId: string | null;
  estado: LocalVisualState;
  bloqueado: boolean;
  /** Lista / API extendida: empresa o persona (opcional). */
  ocupanteNombre?: string;
  /** Lista / API: mensualidad en MXN (opcional). */
  mensualidadMxn?: number;
  /** Giro o actividad comercial (opcional). */
  giroActividad?: string;
  /** Fin de vigencia de contrato (ISO o texto). */
  vigenciaHasta?: string;
}

interface VisualLayoutModel {
  canvas: CanvasSize;
  zonas: ZonaCanvasModel[];
  locales: LocalCanvasModel[];
}

interface LayoutUIState {
  loading: boolean;
  selectedLocalId: string | null;
  dragging: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
}

type ZoneResizeHandle =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

interface ZoneResizeState {
  zonaId: string;
  handle: ZoneResizeHandle;
  startMouse: CanvasPoint;
  startZone: ZonaCanvasModel;
}

interface ZoneDragState {
  zonaId: string;
  startMouse: CanvasPoint;
  startZone: ZonaCanvasModel;
  linkedLocales: Array<{ id: string; x: number; y: number }>;
}

type MonitorListLevel = 'clientes' | 'inmuebles' | 'locales';

const MONITOR_SLIDE_EASE = '260ms cubic-bezier(0.22, 0.82, 0.22, 1)';
const MONITOR_SLIDE_OUT = '200ms ease-in';

const monitorPanelLeaveFwd = [
  style({ position: 'absolute', width: '100%', top: 0, left: 0, zIndex: 0 }),
  animate(
    MONITOR_SLIDE_OUT,
    style({ opacity: 0, transform: 'translateX(-28px)' }),
  ),
];
const monitorPanelEnterFwd = [
  style({ opacity: 0, transform: 'translateX(32px)' }),
  animate(
    MONITOR_SLIDE_EASE,
    style({ opacity: 1, transform: 'translateX(0)' }),
  ),
];
const monitorPanelLeaveBack = [
  style({ position: 'absolute', width: '100%', top: 0, left: 0, zIndex: 0 }),
  animate(
    MONITOR_SLIDE_OUT,
    style({ opacity: 0, transform: 'translateX(28px)' }),
  ),
];
const monitorPanelEnterBack = [
  style({ opacity: 0, transform: 'translateX(-32px)' }),
  animate(
    MONITOR_SLIDE_EASE,
    style({ opacity: 1, transform: 'translateX(0)' }),
  ),
];

@Component({
  selector: 'app-monitoreo',
  templateUrl: './monitoreo.component.html',
  styleUrls: ['./monitoreo.component.scss'],
  standalone: false,
  animations: [
    routeAnimation,
    trigger('monitorModeHeader', [
      transition('* <=> *', [
        style({ opacity: 0.6, transform: 'translateY(-4px) scale(0.98)' }),
        animate(
          '180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
    ]),
    trigger('monitorListPanel', [
      transition('clientes => inmuebles', [
        style({ position: 'relative', display: 'block', overflow: 'hidden' }),
        query(':leave', monitorPanelLeaveFwd, { optional: true }),
        query(':enter', monitorPanelEnterFwd, { optional: true }),
      ]),
      transition('clientes => locales', [
        style({ position: 'relative', display: 'block', overflow: 'hidden' }),
        query(':leave', monitorPanelLeaveFwd, { optional: true }),
        query(':enter', monitorPanelEnterFwd, { optional: true }),
      ]),
      transition('inmuebles => clientes', [
        style({ position: 'relative', display: 'block', overflow: 'hidden' }),
        query(':leave', monitorPanelLeaveBack, { optional: true }),
        query(':enter', monitorPanelEnterBack, { optional: true }),
      ]),
      transition('locales => clientes', [
        style({ position: 'relative', display: 'block', overflow: 'hidden' }),
        query(':leave', monitorPanelLeaveBack, { optional: true }),
        query(':enter', monitorPanelEnterBack, { optional: true }),
      ]),
    ]),
    trigger('monitorListInner', [
      transition('inmuebles => locales', [
        style({ position: 'relative', display: 'block', overflow: 'hidden' }),
        query(':leave', monitorPanelLeaveFwd, { optional: true }),
        query(':enter', monitorPanelEnterFwd, { optional: true }),
      ]),
      transition('locales => inmuebles', [
        style({ position: 'relative', display: 'block', overflow: 'hidden' }),
        query(':leave', monitorPanelLeaveBack, { optional: true }),
        query(':enter', monitorPanelEnterBack, { optional: true }),
      ]),
    ]),
    trigger('monitorRightPanel', [
      transition('mapa => locales', [
        style({ position: 'relative', display: 'block', overflow: 'hidden' }),
        query(':leave', monitorPanelLeaveFwd, { optional: true }),
        query(':enter', monitorPanelEnterFwd, { optional: true }),
      ]),
      transition('locales => mapa', [
        style({ position: 'relative', display: 'block', overflow: 'hidden' }),
        query(':leave', monitorPanelLeaveBack, { optional: true }),
        query(':enter', monitorPanelEnterBack, { optional: true }),
      ]),
    ]),
    trigger('monitorListSwap', [
      transition('* <=> *', [
        query(
          '.insta-item',
          [
            style({ opacity: 0, transform: 'translateY(10px) scale(0.98)' }),
            stagger(
              40,
              animate(
                '170ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                style({ opacity: 1, transform: 'translateY(0) scale(1)' })
              )
            ),
          ],
          { optional: true }
        ),
      ]),
    ]),
    trigger('monitorItemIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px) scale(0.98)' }),
        animate(
          '160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
    ]),
    trigger('inlineEditorPop', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-6px) scale(0.96)' }),
        animate(
          '170ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '120ms ease-in',
          style({ opacity: 0, transform: 'translateY(-4px) scale(0.98)' })
        ),
      ]),
    ]),
    /** Al cambiar datos del local (o al alternar vistas) el bloque de info repunta suave. */
    trigger('localCardInfo', [
      transition('* => *', [
        style({ opacity: 0.45, transform: 'translateY(8px)' }),
        animate(
          '240ms cubic-bezier(0.22, 0.82, 0.22, 1)',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
      ]),
    ]),
  ],
})
export class MonitoreoComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly layoutInicialInmueble = {
    canvas: { width: 1200, height: 760 },
    zonas: [
      { id: 'Planta baja', nombre: 'Planta baja', x: 0, y: 260, width: 400, height: 500 },
      { id: 'Segundo piso', nombre: 'Piso 1', x: 540, y: 260, width: 400, height: 500 },
    ],
    locales: [
      { id: '3001', zonaId: 'Planta baja', x: 40, y: 620, width: 92, height: 72, estado: 'ocupado' as LocalVisualState },
      { id: '3002', zonaId: 'Planta baja', x: 280, y: 620, width: 92, height: 72, estado: 'ocupado' as LocalVisualState },
      { id: '3003', zonaId: 'Segundo piso', x: 700, y: 640, width: 92, height: 72, estado: 'ocupado' as LocalVisualState },
      { id: '3004', zonaId: 'Segundo piso', x: 700, y: 320, width: 92, height: 72, estado: 'ocupado' as LocalVisualState },
    ],
  };

  private readonly PREVIEW_SERIE = 'preview-demo';
  /**
   * Logos por defecto cuando el API no envía imagen (temporal).
   * Se elige uno u otro según identidad del arrendador para que no salgan iguales.
   */
  readonly imagenesClientes = [
    'https://analiticadevideo.s3.us-east-1.amazonaws.com/Clientes/37269948-9b8c-42c7-a858-87d0f6101fad.png',
    'https://analiticadevideo.s3.us-east-1.amazonaws.com/Clientes/1b74ca94-7427-4689-bca8-29963c05925f.png',
  ];
  /** Fachada / predio para tarjetas de inmuebles en monitoreo (demo San Cristóbal). */
  readonly imagenListaInmuebleMonitoreo =
    'https://lh3.googleusercontent.com/gps-cs-s/APNQkAFlG1RuIX_TUTB944PQtcU_VhwJBKarAk6AZl61hj8-4Pes7T6n4kUQicm-qp8DtXMazia1NU7pjij4ziIozMFwvKH6Lbr1r60PIedWpOhP9ouysXVnE2gjY2rWj212L9kc7r3D=s680-w680-h510-rw';
  readonly imagenesInmuebles = [this.imagenListaInmuebleMonitoreo];
  readonly imagenesLocales = [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRoG7Mwy-QiPc4n0i5-UL1ucJTAqtzOdRikSA&s',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=900&q=80',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRhU5VreFPfCZ6G2tYfgXy3igpgfvgq9mYpRg&s',
  ];
  /** Imagen default de locales cuando no llega foto del API. */
  readonly imagenLocalListaDefault = this.imagenesLocales[0];
  clienteSearchTerm = '';
  cargandoClientes = false;
  cargandoInmueblesArrendador = false;
  cargandoLocalesInmueble = false;
  /** Vista Zonas: una lista (catálogo + libres + ocupados). */
  localesZonasLista: any[] = [];
  listaInstalaciones: any[] = [];
  selectedId?: number;
  viewMode: ViewMode = 'centrales';
  flowMode: MonitorFlowMode = 'clientes';
  rightPanelMode: RightPanelMode = 'mapa';
  mapScopeMode: MapScopeMode = 'inmuebles';
  selectedCentral: any | null = null;
  selectedInmuebleForLocales: any | null = null;
  /** Vista Zonas: lista izquierda muestra locales del inmueble (no la lista de inmuebles). */
  zonasViewActive = false;
  /** Al abrir Mapa desde un local, pintamos solo ese punto. */
  private selectedLocalForMap: { local: any; index: number } | null = null;
  /** Inmueble resaltado al elegir fila o pin en mapa (lista del arrendador). */
  private selectedInmuebleForMap: { inmueble: any; index: number } | null = null;
  /** Abrir InfoWindow del local tras clic en fila, Mapa o Centrar (no al primer pintado pasivo del mapa). */
  private pendingLocalInfoWindow = false;
  /** Salida suave de la lista antes de abrir detalle (instalación). */
  navigatingToDetail = false;
  private readonly listLevelOrder: Record<MonitorListLevel, number> = {
    clientes: 0,
    inmuebles: 1,
    locales: 2,
  };

  readonly layoutConfig = {
    gridSize: 20,
    minZoom: 0.4,
    maxZoom: 2.6,
    defaultZoom: 1,
  };
  gridEnabled = true;
  zoom = this.layoutConfig.defaultZoom;
  pan: CanvasPoint = { x: 0, y: 0 };
  visualLayout: VisualLayoutModel = {
    canvas: { width: 1200, height: 760 },
    zonas: [],
    locales: [],
  };
  uiState: LayoutUIState = {
    loading: false,
    selectedLocalId: null,
    dragging: false,
    dirty: false,
    saving: false,
    error: null,
  };
  selectedZoneId: string | null = null;
  private draggingLocalId: string | null = null;
  private dragPointerOffset: CanvasPoint = { x: 0, y: 0 };
  private panning = false;
  private panStartClient: CanvasPoint = { x: 0, y: 0 };
  private panStartOffset: CanvasPoint = { x: 0, y: 0 };
  private lastSavedLayoutSerialized = '';
  private zoneResizeState: ZoneResizeState | null = null;
  private zoneDragState: ZoneDragState | null = null;
  zoneNameDraft = '';
  showZoneNameEditor = false;
  /** Sin elementos en el lienzo (ni mapa ni catálogo). */
  diagramaMapaVacio = true;
  /** Plano generado desde zonas/locales del catálogo; aún no guardado en `mapaInmueble`. */
  diagramaPlanoDesdeCatalogo = false;

  /** Solo rol 1 ve la lista de Clientes; el resto solo sus Instalaciones. */
  isRol1 = false;

  private map?: any;
  private markers: any[] = [];
  private infoWindow?: any;
  private resizeObserver?: ResizeObserver;
  private static mapsLoading?: Promise<void>;

  private currentInfoMarker?: any;
  private pinnedMarker?: any;
  private mapClickUnpinListener?: any;
  private hoverCloseTimer?: ReturnType<typeof setTimeout>;
  private isHoveringInfoWindow = false;
  private closingInfoForMarker?: any;

  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';

  private readonly MAP_ID?: string = undefined;
  private readonly PIN_URL = 'assets/images/logos/markerInstalacion.png';
  private readonly CENTRAL_PIN_URL = 'assets/images/logos/markerCliente.png';
  /** Marcador distinto (color + icono) para locales dentro del inmueble. */
  private readonly LOCAL_PIN_URL = 'assets/images/logos/marker_local.png';
  private readonly hiddenClienteFields = new Set([
    'id',
    'idCliente',
    'lat',
    'lng',
    'nroPisos',
    'estatus',
    'instalaciones',
    'nombre',
    'logotipo',
    'imagenUrl',
    'detalle',
  ]);

  get listaVisible(): any[] {
    if (this.flowMode === 'clientes') {
      return this.listaInstalaciones;
    }
    const c = this.selectedCentral;
    return Array.isArray(c?.instalaciones) ? c.instalaciones : [];
  }

  /** Nivel actual de la jerarquía: arrendadores → inmuebles → locales. */
  get monitorListLevel(): MonitorListLevel {
    if (this.flowMode === 'clientes') return 'clientes';
    return this.zonasViewActive ? 'locales' : 'inmuebles';
  }

  private prepareListNavigation(target: MonitorListLevel): void {
    const cur = this.listLevelOrder[this.monitorListLevel];
    const next = this.listLevelOrder[target];
    if (next > cur) {
      this.listNavDirection = 'forward';
    } else if (next < cur) {
      this.listNavDirection = 'back';
    }
  }

  private runDetailLeaveTransition(then: () => void): void {
    this.navigatingToDetail = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      then();
      this.navigatingToDetail = false;
      this.cdr.markForCheck();
    }, 240);
  }

  listNavDirection: 'forward' | 'back' = 'forward';

  get clientesFiltrados(): any[] {
    const list = this.listaVisible;
    if (this.flowMode !== 'clientes') return list;
    const q = this.clienteSearchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter((cliente: any) => {
      const haystack = [
        cliente?.nombreCliente,
        cliente?.nombre,
        cliente?.nombreEncargado,
        cliente?.direccion,
      ]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
  }

  /** 1–2 arrendadores: mitad de fila (`col-6`); 3 o más: tercio (`col-4`). */
  get clienteCardColClass(): string {
    return this.clientesFiltrados.length > 2 ? 'col-12 col-md-4' : 'col-12 col-md-6';
  }

  get clientesGridRowClass(): string {
    return this.clientesFiltrados.length === 1
      ? 'row g-3 justify-content-center'
      : 'row g-3';
  }

  limpiarBusquedaClientes(): void {
    this.clienteSearchTerm = '';
  }

  /** Locales en la lista izquierda y base del diagrama. */
  get localesParaListaZonas(): any[] {
    if (!this.zonasViewActive || !this.selectedInmuebleForLocales) return [];
    if (this.localesZonasLista.length) return this.localesZonasLista;
    const ins = this.selectedInmuebleForLocales;
    const raw = Array.isArray(ins.locales) ? ins.locales : [];
    if (raw.length) return raw;
    return this.visualLayout.locales;
  }

  getNombreLocalEnLista(local: any): string {
    return (
      local?.nombre ||
      local?.nombreLocal ||
      local?.nombreDepartamento ||
      'Local'
    );
  }

  /** Clave para animar el bloque informativo cuando cambian datos, vista mapa/diagrama o la fila. */
  localListaAnimKey(local: any, index: number): string {
    const id = this.resolveLocalIdParaLista(local, index) ?? `idx-${index}`;
    const nom = this.getNombreLocalEnLista(local);
    const occ = this.getOcupanteLocalLista(local) ?? '';
    const med = this.getMedidaLocalLista(local) ?? '';
    const men = this.getMensualidadLocalLista(local) ?? '';
    const est = String(local?.estado ?? '');
    const img = this.getImagenLocalLista(local, index);
    const vista = this.isLocalVisibleEnMapa(local, index) ? 'mapa' : 'diagrama';
    const zona = this.getZonaNombreLocalLista(local) ?? '';
    const giro = this.getGiroActividadLocalLista(local) ?? '';
    const vig = this.getVigenciaContratoLocalLista(local) ?? '';
    return `${id}|${nom}|${occ}|${med}|${men}|${est}|${img}|${vista}|${zona}|${giro}|${vig}`;
  }

  /** URL de fachada para la tarjeta (API `fachadaUrl` o respaldo en arrendatario). */
  private urlFachadaEnListaLocal(local: any): string {
    const fachada = String(local?.imagenFachada ?? '').trim();
    if (fachada) return fachada;
    const detLocal = local?.detalleLocal as Record<string, unknown> | undefined;
    const desdeLocal = urlFachadaLocalApi(detLocal);
    if (desdeLocal) return desdeLocal;
    const detArr = local?.detalleArrendatario as Record<string, unknown> | undefined;
    return urlFachadaDesdeArchivos(detArr) || '';
  }

  /** Sin `fachadaUrl`: icono; con URL válida: foto del local. */
  localMuestraIconoDisponible(local: any): boolean {
    return !this.urlFachadaEnListaLocal(local);
  }

  getImagenFachadaLocalLista(local: any): string {
    return this.urlFachadaEnListaLocal(local) || this.imagenLocalListaDefault;
  }

  /** @deprecated Usar {@link localMuestraIconoDisponible} y {@link getImagenFachadaLocalLista}. */
  getImagenLocalLista(local: any, index = 0): string {
    if (this.localMuestraIconoDisponible(local)) return '';
    return this.getImagenFachadaLocalLista(local);
  }

  getImagenInmuebleCard(inmueble: any, _index = 0): string {
    const fachada = String(inmueble?.imagenFachada ?? '').trim();
    if (fachada) return fachada;
    return this.imagenListaInmuebleMonitoreo;
  }

  vigenciaInmuebleCard(inmueble: any): string {
    const v = String(
      inmueble?.vigenciaAnios ?? inmueble?.tiempoRentaAnios ?? '',
    ).trim();
    return v;
  }

  getImagenClienteCard(cliente: any, index: number): string {
    const u =
      cliente?.logotipo ??
      cliente?.imagenUrl ??
      cliente?.urlImagen ??
      cliente?.foto ??
      cliente?.imagen ??
      cliente?.photoUrl ??
      cliente?.urlFoto ??
      cliente?.logoUrl ??
      cliente?.urlLogo;
    const direct = u != null ? String(u).trim() : '';
    if (direct.length) return direct;

    const pool = this.imagenesClientes;
    if (!pool.length) return '';

    // Solo hay 2 logos temporales: alternar por posición en la lista (evita colisiones hash % 2).
    if (pool.length <= 2) {
      return pool[index % pool.length];
    }

    const idRaw = cliente?.id ?? cliente?.idCliente;
    const idStr = idRaw != null ? String(idRaw).trim() : '';
    const identityParts = [
      idStr.length ? `id:${idStr}` : '',
      cliente?.nombreCliente,
      cliente?.nombre,
      cliente?.apellidoPaterno,
      cliente?.apellidoMaterno,
      cliente?.razonSocial,
      cliente?.rfc,
      cliente?.correo ?? cliente?.email,
      cliente?.telefono,
      cliente?.telefonoMovil,
      `row:${index}`,
    ]
      .map((v) => (v != null ? String(v).trim() : ''))
      .filter((t) => t.length > 0);
    const seed = identityParts.join('|') || `arrendador-${index}`;
    return this.pickImageBySeed(seed, pool, pool[index % pool.length]);
  }

  private pickImageBySeed(seed: unknown, pool: string[], fallback: string): string {
    if (!Array.isArray(pool) || !pool.length) return fallback;
    const raw = String(seed ?? '');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash * 31 + raw.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % pool.length;
    return pool[idx] || fallback;
  }

  /** Empresa o persona que ocupa el local (según API). */
  getOcupanteLocalLista(local: any): string | null {
    const v =
      local?.nombreEmpresa ??
      local?.empresa ??
      local?.razonSocial ??
      local?.nombreComercial ??
      local?.arrendatario ??
      local?.inquilino ??
      local?.ocupante ??
      local?.nombreContacto ??
      local?.titular ??
      local?.representanteLegal ??
      local?.personaNombre ??
      local?.nombreArrendatario ??
      local?.nombreOcupante ??
      local?.ocupanteNombre;
    const s = v != null ? String(v).trim() : '';
    return s.length ? s : null;
  }

  /** Superficie en m² o, si no hay, tamaño del bloque en el plano. */
  getMedidaLocalLista(local: any): string | null {
    const raw =
      local?.superficie ??
      local?.metrosCuadrados ??
      local?.m2 ??
      local?.superficieM2 ??
      local?.areaM2 ??
      local?.metros2;
    const n = Number(raw);
    if (isFinite(n) && n > 0) {
      return `${n % 1 === 0 ? n : n.toFixed(2)} m²`;
    }
    const w = Number(local?.width);
    const h = Number(local?.height);
    if (isFinite(w) && isFinite(h) && w > 0 && h > 0) {
      return `${Math.round(w)} × ${Math.round(h)} u. (plano)`;
    }
    return null;
  }

  getOcupacionEtiquetaLista(local: any): string {
    const catalogo = String(local?.estatusLocalLabel ?? '').trim();
    if (catalogo && catalogo !== '—') {
      return this.etiquetaOcupacionListaLocal(catalogo, local);
    }

    const registro = String(local?.estatusLabel ?? '').trim();
    if (registro && registro !== '—') {
      return this.etiquetaOcupacionListaLocal(registro, local);
    }

    const e = String(local?.estado ?? '').toLowerCase().trim();
    const map: Record<string, string> = {
      libre: 'Disponible',
      ocupado: 'Ocupado',
      reservado: 'Apartado',
      inactivo: 'Fuera de servicio',
    };
    const fallback =
      map[e] ??
      (local?.estado != null && String(local.estado).trim() !== ''
        ? String(local.estado)
        : 'Sin dato');
    return this.etiquetaOcupacionListaLocal(fallback, local);
  }

  /** Etiqueta breve en la lista de locales (p. ej. «Disponible» en lugar del texto del catálogo). */
  private etiquetaOcupacionListaLocal(etiqueta: string, local: any): string {
    const est =
      local?.estatusLocal != null
        ? Number(local.estatusLocal)
        : Number(local?.estatus);
    const e = String(local?.estado ?? '').toLowerCase().trim();
    const esDisponible =
      est === 1 ||
      e === 'libre' ||
      local?.disponible === true ||
      /disponible/i.test(etiqueta);
    if (esDisponible) return 'Disponible';
    return etiqueta;
  }

  getEstadoChipClassLista(local: any): string {
    const est =
      local?.estatusLocal != null ? Number(local.estatusLocal) : Number(local?.estatus);
    if (est === 2) return 'local-status--ocupado';
    if (est === 3) return 'local-status--reservado';
    if (est === 0) return 'local-status--inactivo';
    if (est === 1) return 'local-status--libre';

    if (local?.ocupado === true) return 'local-status--ocupado';

    const e = String(local?.estado ?? 'libre').toLowerCase().trim();
    if (e === 'ocupado') return 'local-status--ocupado';
    if (e === 'reservado') return 'local-status--reservado';
    if (e === 'inactivo') return 'local-status--inactivo';
    return 'local-status--libre';
  }

  localTieneInformacion(local: any): boolean {
    return localMonitoreoTieneInformacion(
      (local ?? {}) as Record<string, unknown>,
    );
  }

  getMensualidadLocalLista(local: any): string | null {
    const rentaFmt = String(local?.rentaFmt ?? local?.mensualidadFmt ?? '').trim();
    if (rentaFmt) return rentaFmt;

    const raw =
      local?.mensualidadMxn ??
      local?.mensualidad ??
      local?.pagoMensual ??
      local?.importeMensual ??
      local?.rentaMensual ??
      local?.precioMensual ??
      local?.montoMensual ??
      local?.renta ??
      local?.precio;
    const n = Number(raw);
    if (!isFinite(n) || n < 0) return null;
    try {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `$${n.toLocaleString('es-MX')}`;
    }
  }

  /** Nivel o zona del plano (p. ej. Planta baja, Piso 1). */
  getZonaNombreLocalLista(local: any): string | null {
    const nivelDirecto =
      local?.nivel ??
      local?.nivelLocal ??
      local?.planta ??
      local?.piso;
    const nivelTexto = nivelDirecto != null ? String(nivelDirecto).trim() : '';
    if (nivelTexto.length) return nivelTexto;

    const zid = local?.zonaId;
    if (zid == null || String(zid).trim() === '') return null;
    const z = this.visualLayout?.zonas?.find((it) => String(it.id) === String(zid));
    const n = z?.nombre != null ? String(z.nombre).trim() : '';
    return n.length ? n : null;
  }

  /** Giro, rubro o actividad. */
  getGiroActividadLocalLista(local: any): string | null {
    const v =
      local?.giroActividad ??
      local?.giro ??
      local?.rubro ??
      local?.actividad ??
      local?.giroComercial ??
      local?.tipoNegocio ??
      local?.descripcionGiro;
    const s = v != null ? String(v).trim() : '';
    return s.length ? s : null;
  }

  /** Fin de vigencia del contrato (texto corto en español). */
  getVigenciaContratoLocalLista(local: any): string | null {
    const raw =
      local?.vigenciaHasta ??
      local?.fechaFinContrato ??
      local?.fechaFinVigencia ??
      local?.finContrato ??
      local?.vigenciaFin;
    if (raw == null || String(raw).trim() === '') return null;
    if (raw instanceof Date) {
      return this.formatFechaCortaLista(raw);
    }
    const d = new Date(String(raw));
    if (!Number.isNaN(d.getTime())) {
      return this.formatFechaCortaLista(d);
    }
    const t = String(raw).trim();
    return t.length ? t : null;
  }

  private formatFechaCortaLista(d: Date): string {
    try {
      return d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  /** Texto junto a «Locales:» en el encabezado de la lista izquierda. */
  get nombreInmuebleCabeceraLocales(): string {
    if (this.zonasViewActive && this.selectedInmuebleForLocales) {
      return (
        this.selectedInmuebleForLocales.nombreInstalacion ||
        this.selectedInmuebleForLocales.nombreDepartamento ||
        'Inmueble'
      );
    }
    return this.selectedCentral?.nombreCliente || '—';
  }

  constructor(
    private clientesService: ClientesService,
    private inmueblesService: InmueblesService,
    private arrendatariosService: ArrendatariosService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private auth: AuthenticationService,
    private cdr: ChangeDetectorRef,
  ) {}

  private checkRol(): void {
    const u = this.auth.getUser();
    const rol = u?.rol != null ? Number(u.rol) : null;
    this.isRol1 = rol === 1;
  }

  ngOnInit(): void {
    this.checkRol();
    this.obtenerInstalacionesCentral();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.cancelHoverClose();
    if (this.mapClickUnpinListener) {
      google.maps.event.removeListener(this.mapClickUnpinListener);
      this.mapClickUnpinListener = null;
    }
  }

  private pinIcon(url: string, width: number, height: number) {
    return {
      url,
      scaledSize: new google.maps.Size(width, height),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(width / 2, height)
    };
  }

  obtenerInstalacionesCentral(): void {
    this.cargandoClientes = true;

    this.clientesService
      .obtenerClientes()
      .pipe(
        catchError((err) => {
          console.error('Error al cargar arrendadores:', err);
          this.toastr.error('No se pudo cargar la lista de arrendadores.', 'Monitoreo');
          return of(null);
        }),
      )
      .subscribe({
        next: (clientes) => {
          this.cargandoClientes = false;

          const filasCliente = extraerFilasListadoApi(clientes);
          const centrales = filasCliente
            .map((fila) => mapClienteMonitoreoCentral(fila, []))
            .filter((c) => Number(c['id']) > 0);

          this.aplicarCentralesMonitoreo(this.resolverCentralesParaUsuario(centrales));
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.cargandoClientes = false;
          console.error('Error al cargar monitoreo:', err);
          this.toastr.error('No se pudo cargar el monitoreo.', 'Monitoreo');
          this.listaInstalaciones = [];
          this.cdr.markForCheck();
        },
      });
  }

  private resolverCentralesParaUsuario(centrales: any[]): any[] {
    if (this.isRol1 || !centrales.length) {
      return centrales;
    }
    const u = this.auth.getUser() as Record<string, unknown> | null;
    const idUserCliente = Number(u?.['IdCliente'] ?? u?.['idCliente']);
    if (Number.isFinite(idUserCliente) && idUserCliente > 0) {
      const found = centrales.find(
        (c) => Number(c?.idCliente ?? c?.id) === idUserCliente,
      );
      if (found) return [found];
    }
    return [centrales[0]];
  }

  private aplicarCentralesMonitoreo(data: any[]): void {
    if (this.isRol1) {
      this.listaInstalaciones = data;
      this.viewMode = 'centrales';
      this.flowMode = 'clientes';
      this.selectedCentral = null;
    } else {
      this.listaInstalaciones = data;
      this.selectedCentral = data[0] ?? null;
      this.viewMode = 'instalaciones';
      this.flowMode = 'inmuebles';
    }

    if (this.map && this.flowMode === 'inmuebles' && !this.cargandoInmueblesArrendador) {
      this.renderAccordingMode();
    }

    if (!this.isRol1 && this.selectedCentral) {
      this.cargarYMostrarInmueblesArrendador(this.selectedCentral, () =>
        this.aplicarRetornoDesdeDetalleSiCorresponde(),
      );
      return;
    }

    this.aplicarRetornoDesdeDetalleSiCorresponde();
  }

  private idArrendadorDesdeCentral(central: any): number | null {
    const id = Number(central?.idCliente ?? central?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private sincronizarInstalacionesEnLista(
    central: any,
    instalaciones: Record<string, unknown>[],
  ): any {
    const id = this.idArrendadorDesdeCentral(central);
    const actualizado = { ...central, instalaciones };
    if (id == null) {
      return actualizado;
    }
    const idx = this.listaInstalaciones.findIndex(
      (c) => Number(c?.idCliente ?? c?.id) === id,
    );
    if (idx >= 0) {
      this.listaInstalaciones[idx] = {
        ...this.listaInstalaciones[idx],
        instalaciones,
      };
      return this.listaInstalaciones[idx];
    }
    return actualizado;
  }

  /**
   * GET `/inmuebles/arrendador/{id}` y vista de inmuebles del arrendador seleccionado.
   */
  cargarYMostrarInmueblesArrendador(
    central: any,
    onListo?: () => void,
    mostrarVista = true,
  ): void {
    const id = this.idArrendadorDesdeCentral(central);
    if (id == null) {
      this.toastr.warning('Arrendador sin identificador válido.', 'Monitoreo');
      return;
    }

    this.cargandoInmueblesArrendador = true;
    const nombre = String(central?.nombreCliente ?? 'Arrendador');

    this.inmueblesService
      .obtenerInmueblesPorArrendador(id)
      .pipe(
        map((resp) =>
          extraerInmueblesListadoApi(resp).map((item) =>
            mapInmuebleMonitoreoInstalacion(item, nombre),
          ),
        ),
        catchError((err) => {
          console.error('Error al cargar inmuebles del arrendador:', err);
          this.toastr.error(
            'No se pudieron cargar los inmuebles del arrendador.',
            'Monitoreo',
          );
          return of([] as Record<string, unknown>[]);
        }),
      )
      .subscribe((instalaciones) => {
        this.cargandoInmueblesArrendador = false;
        const actualizado = this.sincronizarInstalacionesEnLista(
          central,
          instalaciones,
        );

        if (mostrarVista) {
          this.verInstalacionesDeCentral(actualizado);
        } else {
          this.selectedCentral = actualizado;
          if (this.map && this.flowMode === 'inmuebles') {
            this.renderAccordingMode();
          }
        }

        onListo?.();
        this.cdr.markForCheck();
      });
  }

  /** Al volver desde detalle instalación/local: restaurar lista de inmuebles o de locales. */
  private aplicarRetornoDesdeDetalleSiCorresponde(): void {
    const qp = this.route.snapshot.queryParamMap;
    const retorno = (qp.get('retorno') ?? '').toLowerCase();
    if (!retorno) return;

    const idClienteRaw = qp.get('idCliente');
    if (idClienteRaw != null && String(idClienteRaw).trim() !== '' && this.isRol1) {
      const idStr = String(idClienteRaw).trim();
      const c = this.listaInstalaciones.find(
        (x: any) => String(x?.idCliente ?? x?.id ?? '') === idStr,
      );
      if (c) {
        this.cargarYMostrarInmueblesArrendador(c, () =>
          this.continuarRetornoDesdeDetalle(retorno, qp),
        );
        return;
      }
    }

    this.continuarRetornoDesdeDetalle(retorno, qp);
  }

  private continuarRetornoDesdeDetalle(retorno: string, qp: ParamMap): void {

    if (retorno === 'inmuebles') {
      this.cerrarVistaZonasSinDirtyConfirm();
      this.flowMode = 'inmuebles';
      this.viewMode = 'instalaciones';
      this.clearQueryParamsRetorno();
      this.cdr.markForCheck();
      if (this.map && this.flowMode === 'inmuebles') this.renderAccordingMode();
      return;
    }

    if (retorno === 'locales') {
      const idInm = qp.get('idInmueble');
      if (idInm != null && String(idInm).trim() !== '' && this.selectedCentral) {
        const insts = Array.isArray(this.selectedCentral.instalaciones)
          ? this.selectedCentral.instalaciones
          : [];
        const ins = insts.find(
          (x: any) =>
            String(x?.id ?? x?.idInstalacion ?? x?.idDepartamento ?? '') ===
            String(idInm).trim(),
        );
        if (ins) {
          this.abrirZonasInmueble(ins);
        }
      }
      this.flowMode = 'inmuebles';
      this.viewMode = 'instalaciones';
      this.clearQueryParamsRetorno();
      this.cdr.markForCheck();
      if (this.map && this.flowMode === 'inmuebles') this.renderAccordingMode();
    }
  }

  private clearQueryParamsRetorno(): void {
    this.router.navigate(['/monitoreo'], { replaceUrl: true });
  }

  /** Cierra vista Zonas sin diálogo de cambios sin guardar (vuelta desde detalle). */
  private cerrarVistaZonasSinDirtyConfirm(): void {
    this.prepareListNavigation('inmuebles');
    this.zonasViewActive = false;
    this.localesZonasLista = [];
    this.selectedInmuebleForLocales = null;
    this.selectedLocalForMap = null;
    this.selectedInmuebleForMap = null;
    this.closeInlineEditors();
    this.clearSelection();
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'inmuebles';
    this.ensureMapReadyAndRender();
  }

  private async initMap() {
    await this.loadGoogleMaps();
    this.installInfoWindowSkin();

    const el = document.getElementById('map');
    if (!el) return;

    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;

    const center = { lat: 19.432608, lng: -99.133209 };

    let MapCtor: any;
    if (google.maps?.importLibrary) {
      const { Map } = await google.maps.importLibrary('maps');
      MapCtor = Map;
    } else {
      MapCtor = google.maps.Map;
    }

    const mapOptions: any = {
      center,
      zoom: 12,
      mapTypeId: 'roadmap',
      gestureHandling: 'greedy',
      fullscreenControl: true,
      streetViewControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi.park', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    };
    if (this.MAP_ID) mapOptions.mapId = this.MAP_ID;

    this.map = new MapCtor(el, mapOptions);
    this.infoWindow = new google.maps.InfoWindow({
      disableAutoPan: false,
      maxWidth: 300,
    });

    if (this.listaInstalaciones.length && this.flowMode === 'inmuebles') {
      this.renderAccordingMode();
    }

    setTimeout(() => {
      google.maps.event?.trigger(this.map, 'resize');
      this.map?.setCenter(center);
    }, 0);

    if ('ResizeObserver' in window && el) {
      this.resizeObserver = new ResizeObserver(() => {
        google.maps.event?.trigger(this.map, 'resize');
      });
      this.resizeObserver.observe(el);
    }
  }

  /** El #map se destruye con *ngIf al pasar al diagrama; la instancia vieja queda huérfana. */
  private mapInstanceIsStale(): boolean {
    if (!this.map) return true;
    const div = typeof this.map.getDiv === 'function' ? this.map.getDiv() : null;
    if (!div || !div.isConnected) return true;
    const live = document.getElementById('map');
    return !!live && div !== live;
  }

  private teardownGoogleMap(): void {
    this.clearPin();
    this.clearMarkers();
    this.infoWindow?.close();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.map = undefined;
    this.infoWindow = undefined;
  }

  private renderAccordingMode() {
    if (this.flowMode === 'clientes') return;
    if (this.rightPanelMode === 'mapa' && this.mapScopeMode === 'locales' && this.selectedInmuebleForLocales) {
      this.renderLocalesForSelectedInmueble();
      return;
    }
    if (this.viewMode === 'centrales') {
      this.renderAllInstalaciones();
    } else {
      this.renderInstalacionesOnly();
    }
  }

  /** Nombres de “zona” = nivel/planta en el diagrama (el botón sigue siendo “Agregar Zona”). */
  private nombreNivelPlantaPorIndice(i: number): string {
    if (i <= 0) return 'Planta baja';
    return `Piso ${i}`;
  }

  private mismoLocalEnLista(a: any, ai: number, b: any, bi: number): boolean {
    const ida = this.resolveLocalIdParaLista(a, ai);
    const idb = this.resolveLocalIdParaLista(b, bi);
    if (ida && idb) return ida === idb;
    return ai === bi;
  }

  private getNombreNivelEnDiagramaParaLocal(local: any): string | null {
    const zid = local?.zonaId;
    if (zid == null || zid === '') return null;
    const z = this.visualLayout.zonas.find((it) => it.id === String(zid));
    return z?.nombre?.trim() ? z.nombre : String(zid);
  }

  private escapeHtml(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private iwLine(label: string, value: unknown): string {
    const v = String(value ?? '').trim();
    if (!v || v === '—') return '';
    return `<div class="iw-line"><span class="iw-line__label">${this.escapeHtml(label)}</span><span class="iw-line__value">${this.escapeHtml(v)}</span></div>`;
  }

  /** Celda label/valor para grid 2 columnas (estilo col-6) en el tooltip. */
  private iwLineCelda(
    label: string,
    value: unknown,
    spanFull = false,
  ): string {
    const line = this.iwLine(label, value);
    if (!line) return '';
    const span = spanFull ? ' iw-grid-cell--full' : '';
    return `<div class="iw-grid-cell${span}">${line}</div>`;
  }

  private iwCuerpoEnGrid(
    celdas: Array<{ label: string; value: unknown; spanFull?: boolean }>,
  ): string {
    const html = celdas
      .map((c) => this.iwLineCelda(c.label, c.value, c.spanFull === true))
      .filter(Boolean)
      .join('');
    if (!html) {
      return '<div class="iw-line"><span class="iw-line__value">Sin datos adicionales.</span></div>';
    }
    return `<div class="iw-card__grid">${html}</div>`;
  }

  private iwChipHtml(
    text: string,
    variant: 'activo' | 'inactivo' | 'tipo' | 'estado',
  ): string {
    const t = String(text ?? '').trim();
    if (!t || t === '—') return '';
    return `<span class="iw-chip iw-chip--${variant}">${this.escapeHtml(t)}</span>`;
  }

  /** Chip de estatus del local con los mismos colores que la lista. */
  private iwChipLocalEstatus(local: any): string {
    const t = this.getOcupacionEtiquetaLista(local);
    if (!t || t === '—') return '';
    const tone = this.getEstadoChipClassLista(local).replace('local-status--', '');
    const variant =
      tone === 'libre' ||
      tone === 'ocupado' ||
      tone === 'reservado' ||
      tone === 'inactivo'
        ? tone
        : 'estado';
    return `<span class="iw-chip iw-chip--${variant}">${this.escapeHtml(t)}</span>`;
  }

  private iwHeroArrendatario(nombre: string): string {
    const n = String(nombre ?? '').trim();
    if (!n) return '';
    return `<div class="iw-card__hero">
      <span class="iw-card__hero-label">Arrendatario</span>
      <span class="iw-card__hero-name">${this.escapeHtml(n)}</span>
    </div>`;
  }

  private vigenciaTextoInmuebleIw(ins: any): string {
    const ini = String(ins?.fechaInicio ?? '').trim();
    const fin = String(ins?.fechaFin ?? '').trim();
    const vig = this.vigenciaInmuebleCard(ins);
    const parts: string[] = [];
    if (ini && fin) parts.push(`${ini} – ${fin}`);
    else if (ini) parts.push(ini);
    else if (fin) parts.push(fin);
    if (vig) {
      parts.push(`${vig} ${vig === '1' ? 'año' : 'años'}`);
    }
    return parts.join(' · ');
  }

  private buildIwCardHtml(opts: {
    title: string;
    eyebrow?: string;
    chipsHtml?: string;
    /** Si true, el chip va en la misma fila que el título (p. ej. estatus del local). */
    chipsInTitle?: boolean;
    heroHtml?: string;
    bodyHtml: string;
    addressHtml?: string;
    actionLabel?: string;
    actionBtnClass?: string;
    cardClass?: string;
  }): string {
    const chipsRaw = opts.chipsHtml?.trim() ?? '';
    const chipsInTitle = opts.chipsInTitle === true && chipsRaw.length > 0;
    const chipsInline = chipsInTitle ? chipsRaw : '';
    const chips = !chipsInTitle && chipsRaw
      ? `<div class="iw-card__chips">${chipsRaw}</div>`
      : '';
    const hero = opts.heroHtml?.trim() ?? '';
    const addr = opts.addressHtml?.trim() ?? '';
    const action = opts.actionLabel
      ? `<div class="iw-card__footer"><button type="button" class="${opts.actionBtnClass ?? 'iw-action iw-action--credito'}">${this.escapeHtml(opts.actionLabel)}</button></div>`
      : '';
    const eyebrow = opts.eyebrow?.trim()
      ? `<span class="iw-card__eyebrow">${this.escapeHtml(opts.eyebrow)}</span>`
      : '';
    const extraClass = opts.cardClass?.trim() ? ` ${opts.cardClass.trim()}` : '';
    const scrollInner = `${chips}${hero}<div class="iw-card__body">${opts.bodyHtml}</div>${addr}`;
    return `
    <div class="iw-card iw-enter${extraClass}">
      <div class="iw-card__head">
        <div class="iw-card__title-block">
          ${eyebrow}
          <div class="iw-card__title-row">
            <h6 class="iw-card__title">${this.escapeHtml(opts.title)}</h6>
            ${chipsInline}
          </div>
        </div>
        <button type="button" class="iw-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="iw-card__scroll" tabindex="0">${scrollInner}</div>
      ${action}
    </div>`;
  }

  /**
   * Posición en mapa del inmueble: cada local en un anillo alrededor del predio.
   * No usamos lat/lng del arrendatario (varios locales comparten la misma dirección).
   */
  private coordenadasMapaLocalEnInmueble(
    index: number,
    total: number,
    baseLat: number,
    baseLng: number,
  ): { lat: number; lng: number } | null {
    if (!isFinite(baseLat) || !isFinite(baseLng)) return null;
    const n = Math.max(total, 1);
    const perRing = 8;
    const ring = Math.floor(index / perRing);
    const slot = index % perRing;
    const baseRadius = 0.00048;
    const radius = baseRadius * (1 + ring * 0.95);
    const angle = (slot / perRing) * Math.PI * 2 + ring * 0.38;
    return {
      lat: baseLat + Math.cos(angle) * radius,
      lng: baseLng + Math.sin(angle) * radius,
    };
  }

  /** Todos los locales del inmueble en el mapa. */
  private renderLocalesForSelectedInmueble() {
    this.clearMarkers();
    this.clearPin();
    const inmueble = this.selectedInmuebleForLocales;
    if (!inmueble || !this.map) return;

    const list = this.localesParaListaZonas;
    type MapPoint = {
      lat: number;
      lng: number;
      local: any;
      index: number;
      kind: 'local' | 'inmueble';
    };

    let points: MapPoint[] = [];

    if (list.length) {
      const baseLat = Number(inmueble?.lat);
      const baseLng = Number(inmueble?.lng);
      list.forEach((loc: any, i: number) => {
        const pos = this.coordenadasMapaLocalEnInmueble(
          i,
          list.length,
          baseLat,
          baseLng,
        );
        if (!pos) return;
        points.push({
          lat: pos.lat,
          lng: pos.lng,
          local: loc,
          index: i,
          kind: 'local',
        });
      });
    }

    if (!points.length) {
      const lat = Number(inmueble?.lat);
      const lng = Number(inmueble?.lng);
      if (isFinite(lat) && isFinite(lng)) {
        points.push({
          lat,
          lng,
          local: {},
          index: 0,
          kind: 'inmueble',
        });
      }
    }

    const bounds = new google.maps.LatLngBounds();
    const markerAtIndex: any[] = [];

    for (const p of points) {
      const pos = { lat: p.lat, lng: p.lng };
      const isLocal = p.kind === 'local';
      const title = isLocal
        ? this.getNombreLocalEnLista(p.local)
        : inmueble?.nombreDepartamento || inmueble?.nombreInstalacion || 'Inmueble';
      const html = isLocal
        ? this.buildInfoHtmlLocal(p.local, p.index)
        : this.buildInfoHtmlInmueblePunto(inmueble);

      const marker = new google.maps.Marker({
        map: this.map,
        position: pos,
        title,
        icon: isLocal
          ? this.pinIcon(this.LOCAL_PIN_URL, 40, 60)
          : this.pinIcon(this.PIN_URL, 40, 60),
      });

      if (isLocal) {
        markerAtIndex[p.index] = marker;
        const localPayload = {
          central: this.selectedCentral,
          instalacion: {
            ...(this.selectedInmuebleForLocales || {}),
            ...(p.local || {}),
          },
          vistaEntidad: 'local' as const,
          parentInmuebleId: this.idInmuebleDesdeInstalacion(
            this.selectedInmuebleForLocales,
          ),
        };
        marker.addListener('mouseover', () => {
          this.cancelHoverClose();
          this.showHover(marker, html);
        });
        marker.addListener('mouseout', () => this.hideHover(marker));
        marker.addListener('click', () => {
          this.seleccionarLocalDesdeMapa(p.local, p.index);
          this.togglePin(marker, html, localPayload);
        });
      } else {
        marker.addListener('mouseover', () => {
          this.cancelHoverClose();
          this.showHover(marker, html);
        });
        marker.addListener('mouseout', () => this.hideHover(marker));
        marker.addListener('click', () =>
          this.togglePin(marker, html, {
            central: this.selectedCentral,
            instalacion: inmueble,
          }),
        );
      }

      this.markers.push(marker);
      bounds.extend(pos);
    }

    if (!points.length) return;

    const focus = this.selectedLocalForMap;
    let focusMarker: any = null;
    if (focus && list.length) {
      for (let i = 0; i < list.length; i++) {
        if (this.mismoLocalEnLista(focus.local, focus.index, list[i], i)) {
          focusMarker = markerAtIndex[i];
          break;
        }
      }
    }

    const abrirGlobo = this.pendingLocalInfoWindow;
    this.pendingLocalInfoWindow = false;

    if (focusMarker && focus) {
      const idLista = this.resolveLocalIdParaLista(focus.local, focus.index);
      if (idLista) {
        requestAnimationFrame(() =>
          this.scrollListaZonaLocalAlSeleccionado(idLista),
        );
      }
      const pos = focusMarker.getPosition();
      if (pos) {
        this.map.panTo(pos);
        this.map.setZoom(17);
      }
      if (abrirGlobo) {
        const html = this.buildInfoHtmlLocal(focus.local, focus.index);
        const payload = {
          central: this.selectedCentral,
          instalacion: { ...(inmueble || {}), ...(focus.local || {}) },
          vistaEntidad: 'local' as const,
        };
        const markerRef = focusMarker;
        const mapRef = this.map;
        let globoAbierto = false;
        const openGlobo = () => {
          if (globoAbierto) return;
          if (!this.map || mapRef !== this.map) return;
          const m = markerRef?.getMap?.();
          if (m == null || m !== this.map) return;
          globoAbierto = true;
          this.togglePin(markerRef, html, payload);
        };
        google.maps.event.addListenerOnce(this.map, 'idle', openGlobo);
        setTimeout(openGlobo, 280);
      }
    } else {
      this.fitBoundsNice(bounds);
    }
  }

  private renderAllInstalaciones() {
    this.clearMarkers();

    const bounds = new google.maps.LatLngBounds();
    let hasAny = false;

    for (const central of this.listaInstalaciones) {
      const instalaciones = Array.isArray(central?.instalaciones)
        ? central.instalaciones
        : [];

      for (const ins of instalaciones) {
        const lat = Number(ins?.lat);
        const lng = Number(ins?.lng);
        if (!isFinite(lat) || !isFinite(lng)) continue;

        const pos = { lat, lng };
        const marker = new google.maps.Marker({
          map: this.map,
          position: pos,
          title: central?.nombreCliente
            ? `${central.nombreCliente} - Inmueble`
            : 'Inmueble',
          icon: this.pinIcon(this.PIN_URL, 40, 60),
        });

        marker.addListener('mouseover', () => {
          this.cancelHoverClose();
          this.showHover(marker, this.buildInfoHtmlInstalacion(central, ins));
        });
        marker.addListener('mouseout', () => this.hideHover(marker));
        marker.addListener('click', () =>
          this.togglePin(marker, this.buildInfoHtmlInstalacion(central, ins), {
            central,
            instalacion: ins,
          })
        );

        this.markers.push(marker);
        bounds.extend(pos);
        hasAny = true;
      }
    }

    if (hasAny) this.fitBoundsNice(bounds);
  }

  private renderCentrales() {
    this.clearMarkers();

    const bounds = new google.maps.LatLngBounds();
    let hasAny = false;

    for (const c of this.listaInstalaciones) {
      const lat = Number(c.lat);
      const lng = Number(c.lng);
      if (!isFinite(lat) || !isFinite(lng)) continue;

      const pos = { lat, lng };

      const marker = new google.maps.Marker({
        map: this.map,
        position: pos,
        title: c.nombreCliente || 'Central',
        icon: this.pinIcon(this.CENTRAL_PIN_URL, 40, 60),
      });

      marker.addListener('mouseover', () => {
        this.cancelHoverClose();
        this.showHover(marker, this.buildInfoHtml(c));
      });
      marker.addListener('mouseout', () => this.hideHover(marker));
      marker.addListener('click', () =>
        this.togglePin(marker, this.buildInfoHtml(c), { central: c })
      );

      this.markers.push(marker);
      bounds.extend(pos);
      hasAny = true;
    }

    if (hasAny) this.fitBoundsNice(bounds);
  }

  private renderInstalacionesOnly() {
    this.clearMarkers();

    const c = this.selectedCentral;
    const childs = Array.isArray(c?.instalaciones) ? c.instalaciones : [];

    const bounds = new google.maps.LatLngBounds();
    let hasAny = false;

    for (let i = 0; i < childs.length; i++) {
      const ins = childs[i];
      const lat = Number(ins.lat);
      const lng = Number(ins.lng);
      if (!isFinite(lat) || !isFinite(lng)) continue;

      const pos = { lat, lng };
      const html = this.buildInfoHtmlInstalacion(c, ins);
      const payload = { central: c, instalacion: ins };

      const marker = new google.maps.Marker({
        map: this.map,
        position: pos,
        title: c?.nombreCliente
          ? `${c.nombreCliente} - Instalación`
          : 'Instalación',
        icon: this.pinIcon(this.PIN_URL, 40, 60),
      });

      marker.addListener('mouseover', () => {
        this.cancelHoverClose();
        this.showHover(marker, html);
      });
      marker.addListener('mouseout', () => this.hideHover(marker));
      marker.addListener('click', () => {
        this.seleccionarInmuebleDesdeMapa(ins, i);
        this.togglePin(marker, html, payload);
      });

      this.markers.push(marker);
      bounds.extend(pos);
      hasAny = true;
    }

    if (hasAny) this.fitBoundsNice(bounds);
  }

  goToCentrales() {
    this.prepareListNavigation('clientes');
    this.viewMode = 'centrales';
    this.flowMode = 'clientes';
    this.selectedCentral = null;
    this.selectedInmuebleForLocales = null;
    this.zonasViewActive = false;
    this.selectedLocalForMap = null;
    this.selectedInmuebleForMap = null;
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'inmuebles';
    this.clearPin();
    this.clearMarkers();
  }

  goToInstalaciones() {
    if (!this.selectedCentral) return;
    this.viewMode = 'instalaciones';
    this.flowMode = 'inmuebles';
    this.selectedInmuebleForLocales = null;
    this.zonasViewActive = false;
    this.selectedLocalForMap = null;
    this.selectedInmuebleForMap = null;
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'inmuebles';
    this.clearPin();
    this.renderAccordingMode();
  }

  verInstalacionesDeCentral(central: any) {
    this.prepareListNavigation('inmuebles');
    this.selectedCentral = central;
    this.viewMode = 'instalaciones';
    this.flowMode = 'inmuebles';
    this.selectedInmuebleForLocales = null;
    this.zonasViewActive = false;
    this.selectedLocalForMap = null;
    this.selectedInmuebleForMap = null;
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'inmuebles';
    this.clearPin();
    this.ensureMapReadyAndRender();
  }

  seleccionarCliente(central: any): void {
    this.cargarYMostrarInmueblesArrendador(central);
  }

  getClienteInfoEntries(
    cliente: Record<string, unknown>,
    omitFieldKeys: string[] = [],
  ): Array<{ key: string; value: string }> {
    if (!cliente) return [];
    const omit = new Set(omitFieldKeys.filter(Boolean));
    return Object.entries(cliente)
      .filter(([key, value]) => {
        if (omit.has(key)) return false;
        if (this.hiddenClienteFields.has(key)) return false;
        if (value === null || value === undefined || value === '') return false;
        if (Array.isArray(value) || typeof value === 'object') return false;
        return true;
      })
      .map(([key, value]) => ({
        key: this.formatClienteLabel(key),
        value: String(value),
      }));
  }

  private formatClienteLabel(raw: string): string {
    const withSpaces = raw
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .trim();
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  }

  getClienteInitials(cliente: Record<string, unknown>): string {
    const base = String(cliente?.['nombreCliente'] ?? cliente?.['nombre'] ?? 'CL').trim();
    const parts = base.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'CL';
    const first = parts[0]?.charAt(0) ?? 'C';
    const second = parts.length > 1 ? parts[1]?.charAt(0) : parts[0]?.charAt(1) ?? 'L';
    return `${first}${second}`.toUpperCase();
  }

  /**
   * Simula asociar estacionamientos al inmueble (contador en sessionStorage) y abre el alta de estacionamiento.
   */
  irAEstacionamientosDesdeInmueble(inmueble: any, ev?: Event): void {
    ev?.stopPropagation();
    const id = String(
      inmueble?.id ??
        inmueble?.idInstalacion ??
        inmueble?.idDepartamento ??
        inmueble?.idInstalacionDepartamento ??
        'sin-id'
    );
    const key = 'monitoreoSimEstacionamientos';
    let total = 1;
    try {
      const raw = sessionStorage.getItem(key);
      const map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      map[id] = (map[id] ?? 0) + 1;
      total = map[id];
      sessionStorage.setItem(key, JSON.stringify(map));
    } catch {
      /* ignore storage errors */
    }
    const nombre =
      inmueble?.nombreDepartamento ??
      inmueble?.nombreInstalacion ??
      inmueble?.nombre ??
      'Inmueble';
    const idCliente =
      this.selectedCentral != null
        ? String(this.selectedCentral?.idCliente ?? this.selectedCentral?.id ?? '').trim()
        : '';
    const nombreCliente =
      this.selectedCentral != null
        ? String(this.selectedCentral?.nombreCliente ?? '').trim().slice(0, 120)
        : '';
    const nombreCorto = String(nombre).trim().slice(0, 160);
    void this.router.navigate(['/estacionamiento/agregar-estacionamiento'], {
      queryParams: {
        desdeMonitoreo: '1',
        inmuebleId: id,
        ...(nombreCorto ? { inmuebleNombre: nombreCorto } : {}),
        ...(nombreCliente ? { nombreCliente } : {}),
        ...(idCliente ? { idCliente } : {}),
      },
    });
  }

  private idInmuebleDesdeInstalacion(inmueble: any): number | null {
    const id = Number(
      inmueble?.id ?? inmueble?.idInstalacion ?? inmueble?.idDepartamento,
    );
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private sincronizarLocalesEnInmueble(
    inmueble: any,
    locales: Record<string, unknown>[],
  ): void {
    const id = this.idInmuebleDesdeInstalacion(inmueble);
    if (id == null || !this.selectedCentral) return;
    const insts = Array.isArray(this.selectedCentral.instalaciones)
      ? this.selectedCentral.instalaciones
      : [];
    const idx = insts.findIndex(
      (x: any) => Number(x?.id ?? x?.idInstalacion) === id,
    );
    if (idx >= 0) {
      this.selectedCentral.instalaciones[idx] = {
        ...this.selectedCentral.instalaciones[idx],
        locales,
      };
    }
  }

  /** Botón Zonas: una lista con `/locales`, `/locales-libres` y `/arrendatarios/inmueble`. */
  abrirZonasInmueble(inmueble: any, event?: Event): void {
    event?.stopPropagation();

    const idInmueble = this.idInmuebleDesdeInstalacion(inmueble);
    if (idInmueble == null) {
      this.toastr.warning('Inmueble sin identificador válido.', 'Monitoreo');
      return;
    }

    this.prepareListNavigation('locales');
    this.localesZonasLista = [];
    this.selectedInmuebleForLocales = { ...inmueble, locales: [] };
    this.zonasViewActive = true;
    this.selectedLocalForMap = null;
    this.selectedInmuebleForMap = null;
    this.clearPin();
    this.rightPanelMode = 'locales';
    this.mapScopeMode = 'locales';

    this.cargarLocalesZonasInmueble(inmueble, {
      recargarDiagrama: true,
      mostrarCargaLista: true,
    });
  }

  /**
   * Refresca la lista izquierda (y opcionalmente el diagrama) sin salir de la vista de zonas.
   */
  private cargarLocalesZonasInmueble(
    inmueble: any,
    opciones: { recargarDiagrama?: boolean; mostrarCargaLista?: boolean } = {},
  ): void {
    const idInmueble = this.idInmuebleDesdeInstalacion(inmueble);
    if (idInmueble == null) return;

    const recargarDiagrama = opciones.recargarDiagrama === true;
    const mostrarCargaLista = opciones.mostrarCargaLista !== false;

    if (mostrarCargaLista) {
      this.cargandoLocalesInmueble = true;
    }

    forkJoin({
      locales: this.inmueblesService.obtenerLocalesPorInmueble(idInmueble).pipe(
        map((resp) => extraerLocalesInmuebleApi(resp)),
        catchError((err) => {
          console.error('Error al cargar locales del inmueble:', err);
          if (mostrarCargaLista) {
            this.toastr.error(
              'No se pudieron cargar los locales del inmueble.',
              'Monitoreo',
            );
          }
          return of([] as Record<string, unknown>[]);
        }),
      ),
      localesLibres: this.inmueblesService.obtenerLocalesLibres(idInmueble).pipe(
        map((resp) => extraerLocalesInmuebleApi(resp)),
        catchError((err) => {
          console.error('Error al cargar locales libres:', err);
          return of([] as Record<string, unknown>[]);
        }),
      ),
      arrendatarios: this.arrendatariosService
        .obtenerArrendatariosPorInmueble(idInmueble)
        .pipe(
          map((resp) => extraerArrendatariosInmuebleApi(resp)),
          catchError((err) => {
            console.error('Error al cargar arrendatarios del inmueble:', err);
            return of([] as Record<string, unknown>[]);
          }),
        ),
    }).subscribe(({ locales, localesLibres, arrendatarios }) => {
      if (mostrarCargaLista) {
        this.cargandoLocalesInmueble = false;
      }
      const filas = buildMonitoreoLocalesZonasListaUnica(
        locales,
        localesLibres,
        arrendatarios,
        idInmueble,
      );
      this.localesZonasLista = filas;

      const previo = this.selectedInmuebleForLocales ?? inmueble;
      this.selectedInmuebleForLocales = {
        ...previo,
        ...inmueble,
        locales: filas,
        mapaInmueble:
          (previo as Record<string, unknown>)['mapaInmueble'] ??
          (inmueble as Record<string, unknown>)['mapaInmueble'],
      };
      this.sincronizarLocalesEnInmueble(inmueble, filas);

      if (recargarDiagrama) {
        this.loadVisualLayout();
      } else {
        this.actualizarMetadatosLocalesEnDiagrama(filas);
      }
      this.cdr.markForCheck();
    });
  }

  /** Sincroniza nombres/estado de la lista con los locales ya colocados en el plano. */
  private actualizarMetadatosLocalesEnDiagrama(
    filas: Record<string, unknown>[],
  ): void {
    const porId = new Map<string, Record<string, unknown>>();
    for (const f of filas) {
      const id = String(f['id'] ?? f['idLocal'] ?? '').trim();
      if (id) porId.set(id, f);
    }
    const locales = this.visualLayout.locales.map((local) => {
      const fila = porId.get(String(local.id));
      if (!fila) return local;
      const nom = String(
        fila['nombre'] ?? fila['nombreLocal'] ?? fila['local'] ?? '',
      ).trim();
      return {
        ...local,
        nombre: nom || local.nombre,
        estado: this.normalizeLocalState(
          fila['estado'] ?? fila['estatusLocal'] ?? fila['estatus'] ?? local.estado,
        ),
      };
    });
    this.visualLayout = { ...this.visualLayout, locales };
  }

  private sincronizarMapaEnInmueble(inmueble: any, mapaInmueble: unknown): void {
    const id = this.idInmuebleDesdeInstalacion(inmueble);
    if (id == null || !this.selectedCentral) return;
    const insts = Array.isArray(this.selectedCentral.instalaciones)
      ? this.selectedCentral.instalaciones
      : [];
    const idx = insts.findIndex(
      (x: any) => Number(x?.id ?? x?.idInstalacion) === id,
    );
    if (idx >= 0) {
      this.selectedCentral.instalaciones[idx] = {
        ...this.selectedCentral.instalaciones[idx],
        mapaInmueble,
      };
    }
    if (
      this.selectedInmuebleForLocales &&
      this.idInmuebleDesdeInstalacion(this.selectedInmuebleForLocales) === id
    ) {
      this.selectedInmuebleForLocales = {
        ...this.selectedInmuebleForLocales,
        mapaInmueble,
      };
    }
  }

  volverDiagramaDesdeMapaLocal(): void {
    this.selectedLocalForMap = null;
    this.rightPanelMode = 'locales';
    this.mapScopeMode = 'locales';
  }

  volverListaInmueblesDesdeZonas(): void {
    if (this.uiState.dirty) {
      const ok = window.confirm(
        'Hay cambios sin guardar en el diagrama. ¿Volver a la lista de inmuebles?'
      );
      if (!ok) return;
    }
    this.prepareListNavigation('inmuebles');
    this.zonasViewActive = false;
    this.localesZonasLista = [];
    this.diagramaMapaVacio = true;
    this.diagramaPlanoDesdeCatalogo = false;
    this.selectedInmuebleForLocales = null;
    this.selectedLocalForMap = null;
    this.selectedInmuebleForMap = null;
    this.closeInlineEditors();
    this.clearSelection();
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'inmuebles';
    this.ensureMapReadyAndRender();
  }

  /** Mapa: ubicación del local (o representación junto al inmueble). */
  mostrarMapaLocal(local: any, index: number, event?: Event): void {
    event?.stopPropagation();
    if (this.rightPanelMode === 'locales') {
      this.listNavDirection = 'forward';
    }
    this.pendingLocalInfoWindow = true;
    this.selectedLocalForMap = { local, index };
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'locales';
    this.sincronizarSeleccionLocalLista(local, index);
    this.ensureMapReadyAndRender();
  }

  /** Diagrama: panel drag & drop y resalta el local en el lienzo si coincide id. */
  mostrarDiagramaLocal(local: any, index: number, event?: Event): void {
    event?.stopPropagation();
    if (this.rightPanelMode === 'mapa') {
      this.listNavDirection = 'back';
    }
    this.selectedLocalForMap = null;
    this.rightPanelMode = 'locales';
    this.mapScopeMode = 'locales';
    const id = this.resolveLocalIdParaLista(local, index);
    if (id) this.selectLocal(id);
  }

  onInfoLocal(local: any, event?: Event): void {
    event?.stopPropagation();
    if (!this.localTieneInformacion(local)) return;

    const ins = this.selectedInmuebleForLocales;
    const parentInmuebleId =
      ins?.id ?? ins?.idInstalacion ?? ins?.idDepartamento ?? ins?.idInstalacionDepartamento;
    const merged = {
      ...(ins || {}),
      ...(local || {}),
      idContrato: local?.idContrato ?? local?.detalleContrato?.id,
      nombreLocal: local?.nombre ?? local?.nombreLocal,
      arrendatario:
        local?.arrendatario ?? local?.ocupanteNombre ?? local?.nombreEmpresa,
    };
    this.onInfoAction(
      {
        central: this.selectedCentral,
        instalacion: merged,
        vistaEntidad: 'local',
        parentInmuebleId,
      },
      { animateLeave: true },
    );
  }

  trackByLocalEnZonas(index: number, local: any): string {
    return String(local?.idLocal ?? local?.id ?? local?.nombre ?? index);
  }

  isLocalVisibleEnMapa(local: any, index: number): boolean {
    if (this.rightPanelMode !== 'mapa' || this.mapScopeMode !== 'locales') return false;
    const sel = this.selectedLocalForMap;
    if (!sel) return false;
    const currentId = local?.id != null ? String(local.id) : null;
    const selectedId = sel.local?.id != null ? String(sel.local.id) : null;
    if (currentId && selectedId) return currentId === selectedId;
    return sel.index === index;
  }

  toggleVistaLocal(local: any, index: number, event?: Event): void {
    if (this.isLocalVisibleEnMapa(local, index)) {
      this.mostrarDiagramaLocal(local, index, event);
      return;
    }
    this.mostrarMapaLocal(local, index, event);
  }

  /** Solo con mapa de locales visible: recentrar en ese local. */
  centrarMapaEnLocal(local: any, index: number, event?: Event): void {
    event?.stopPropagation();
    if (
      !this.zonasViewActive ||
      this.rightPanelMode !== 'mapa' ||
      this.mapScopeMode !== 'locales'
    ) {
      return;
    }
    this.pendingLocalInfoWindow = true;
    this.selectedLocalForMap = { local, index };
    this.sincronizarSeleccionLocalLista(local, index);
    if (this.map) {
      this.renderAccordingMode();
      this.refreshMapAfterPanelSwitch();
    } else {
      this.ensureMapReadyAndRender();
    }
  }

  onListaLocalRowClick(local: any, index: number): void {
    if (!this.zonasViewActive) return;
    this.pendingLocalInfoWindow = true;
    this.seleccionarLocalDesdeMapa(local, index);
    if (this.rightPanelMode !== 'mapa' || this.mapScopeMode !== 'locales') {
      this.rightPanelMode = 'mapa';
      this.mapScopeMode = 'locales';
      this.ensureMapReadyAndRender();
      return;
    }
    if (this.map) {
      this.renderAccordingMode();
      this.refreshMapAfterPanelSwitch();
    } else {
      this.ensureMapReadyAndRender();
    }
  }

  onListaInmuebleRowClick(item: any, index: number): void {
    if (this.viewMode !== 'instalaciones' || this.zonasViewActive) return;
    this.seleccionarInmuebleDesdeMapa(item, index);
    this.selectInstalacion(item, index);
  }

  private seleccionarLocalDesdeMapa(local: any, index: number): void {
    this.selectedLocalForMap = { local, index };
    this.sincronizarSeleccionLocalLista(local, index);
    const id = this.resolveLocalIdParaLista(local, index);
    if (id) {
      requestAnimationFrame(() => this.scrollListaZonaLocalAlSeleccionado(id));
    }
    this.cdr.markForCheck();
  }

  private seleccionarInmuebleDesdeMapa(inmueble: any, index: number): void {
    if (this.viewMode !== 'instalaciones' || this.zonasViewActive) return;
    this.selectedInmuebleForMap = { inmueble, index };
    const id = this.resolveInmuebleIdParaLista(inmueble, index);
    if (id) {
      requestAnimationFrame(() => this.scrollListaInmuebleAlSeleccionado(id));
    }
    this.cdr.markForCheck();
  }

  /** Id estable para fila + scroll; coincide con `selectLocal`. */
  idAtributoFilaListaLocal(local: any, index: number): string {
    const id = this.resolveLocalIdParaLista(local, index);
    return this.listaLocalRowDomId(id ?? `idx-${index}`);
  }

  isLocalResaltadoEnListaZonas(local: any, index: number): boolean {
    const focus = this.selectedLocalForMap;
    if (focus) {
      return this.mismoLocalEnLista(focus.local, focus.index, local, index);
    }
    const sid = this.uiState.selectedLocalId;
    if (!sid) return false;
    const id = this.resolveLocalIdParaLista(local, index);
    return id != null && String(id) === String(sid);
  }

  idAtributoFilaListaInmueble(item: any, index: number): string {
    return this.listaInmuebleRowDomId(
      this.resolveInmuebleIdParaLista(item, index) ?? `idx-${index}`,
    );
  }

  isInmuebleResaltadoEnLista(item: any, index: number): boolean {
    const focus = this.selectedInmuebleForMap;
    if (!focus) return false;
    return this.mismoInmuebleEnLista(focus.inmueble, focus.index, item, index);
  }

  private mismoInmuebleEnLista(
    a: any,
    ai: number,
    b: any,
    bi: number,
  ): boolean {
    const ida = this.resolveInmuebleIdParaLista(a, ai);
    const idb = this.resolveInmuebleIdParaLista(b, bi);
    if (ida && idb) return ida === idb;
    return ai === bi;
  }

  private resolveInmuebleIdParaLista(inmueble: any, index: number): string {
    const id = this.idInmuebleDesdeInstalacion(inmueble);
    if (id != null) return String(id);
    const raw = inmueble?.id ?? inmueble?.idInstalacion ?? inmueble?.idDepartamento;
    if (raw != null && String(raw).trim() !== '') return String(raw).trim();
    return `idx-${index}`;
  }

  private listaInmuebleRowDomId(inmuebleId: string): string {
    return `lista-inmueble-${String(inmuebleId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  private scrollListaInmuebleAlSeleccionado(inmuebleId: string): void {
    const el = document.getElementById(this.listaInmuebleRowDomId(inmuebleId));
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  private listaLocalRowDomId(localId: string): string {
    return `zona-list-local-${String(localId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  private resolveLocalIdParaLista(local: any, index: number): string | null {
    const idRaw = local?.idLocal ?? local?.id;
    if (idRaw != null) return String(idRaw);
    const vl = this.visualLayout.locales[index];
    return vl?.id ?? null;
  }

  private sincronizarSeleccionLocalLista(local: any, index: number): void {
    const id = this.resolveLocalIdParaLista(local, index);
    if (id) this.selectLocal(id);
  }

  private scrollListaZonaLocalAlSeleccionado(localId: string): void {
    const el = document.getElementById(this.listaLocalRowDomId(localId));
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  volverAMapa() {
    if (this.zonasViewActive) {
      this.volverListaInmueblesDesdeZonas();
      return;
    }
    if (this.uiState.dirty) {
      const shouldExit = window.confirm(
        'Hay cambios sin guardar en el plano de locales. ¿Desea salir de todos modos?'
      );
      if (!shouldExit) return;
    }
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'inmuebles';
    this.selectedInmuebleForLocales = null;
    this.selectedLocalForMap = null;
    this.ensureMapReadyAndRender();
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent): void {
    if (!this.uiState.dirty) return;
    event.preventDefault();
    event.returnValue = true;
  }

  loadVisualLayout(): void {
    this.uiState = { ...this.uiState, loading: true, error: null };
    this.closeInlineEditors();
    const mapa = extraerMapaInmuebleApi(this.selectedInmuebleForLocales);
    const tieneMapaGuardado = mapaInmuebleTienePlano(mapa);
    const rawModel = this.mapBackendToCanvasModel(this.selectedInmuebleForLocales);
    this.diagramaMapaVacio =
      rawModel.zonas.length === 0 && rawModel.locales.length === 0;
    this.diagramaPlanoDesdeCatalogo =
      !tieneMapaGuardado && !this.diagramaMapaVacio;
    this.visualLayout = rawModel;
    if (!this.diagramaMapaVacio) {
      this.buildZonesAndLocales();
      this.expandCanvasToContent();
      this.fitToContent();
      requestAnimationFrame(() => this.fitToContent());
    } else {
      this.zoom = this.layoutConfig.defaultZoom;
      this.pan = { x: 0, y: 0 };
    }
    this.lastSavedLayoutSerialized = this.serializeLayout();
    this.uiState = { ...this.uiState, loading: false, dirty: false };
  }

  mapBackendToCanvasModel(source: unknown): VisualLayoutModel {
    const mapa = extraerMapaInmuebleApi(source);
    const desdeMapa = visualLayoutDesdeMapaInmueble(mapa);
    if (desdeMapa) {
      return this.enriquecerLayoutDiagramaConLista(desdeMapa, source);
    }

    const inmueble = source as Record<string, unknown> | null;
    const filas = Array.isArray(inmueble?.['locales'])
      ? (inmueble?.['locales'] as Record<string, unknown>[])
      : this.localesZonasLista;
    const desdeCatalogo = visualLayoutDesdeCatalogoInmueble(source, filas);
    if (desdeCatalogo) {
      return this.enriquecerLayoutDiagramaConLista(desdeCatalogo, source);
    }

    return {
      canvas: { width: 1200, height: 760 },
      zonas: [],
      locales: [],
    };
  }

  /** Actualiza estado y datos de locales del plano con la lista unificada de la API. */
  private enriquecerLayoutDiagramaConLista(
    layout: ReturnType<typeof visualLayoutDesdeMapaInmueble>,
    source: unknown,
  ): VisualLayoutModel {
    if (!layout) {
      return { canvas: { width: 1200, height: 760 }, zonas: [], locales: [] };
    }

    const inmueble = source as Record<string, unknown> | null;
    const filas = Array.isArray(inmueble?.['locales'])
      ? (inmueble?.['locales'] as Record<string, unknown>[])
      : this.localesZonasLista;

    const porId = new Map<string, Record<string, unknown>>();
    for (const f of filas) {
      const id = String(f['id'] ?? f['idLocal'] ?? '').trim();
      if (id) porId.set(id, f);
    }

    const zonas: ZonaCanvasModel[] = layout.zonas
      .filter((z) => !this.esZonaAuxiliarDiagrama(z.id))
      .map((z) => ({ ...z }));
    const locales: LocalCanvasModel[] = layout.locales.map((local) => {
      const fila = porId.get(String(local.id));
      const base: LocalCanvasModel = {
        id: local.id,
        nombre: local.nombre,
        x: local.x,
        y: local.y,
        width: local.width,
        height: local.height,
        zonaId: local.zonaId,
        estado: this.normalizeLocalState(
          fila?.['estado'] ?? fila?.['estatusLocal'] ?? fila?.['estatus'] ?? local.estado,
        ),
        bloqueado: Boolean(fila?.['bloqueado']),
      };
      if (fila) {
        const nom = String(
          fila['nombre'] ?? fila['nombreLocal'] ?? fila['local'] ?? '',
        ).trim();
        if (nom) base.nombre = nom;
        const ocupante = this.getOcupanteLocalLista(fila);
        if (ocupante) base.ocupanteNombre = ocupante;
        const mn = Number(
          fila['mensualidadMxn'] ?? fila['mensualidad'] ?? fila['rentaMensual'],
        );
        if (isFinite(mn) && mn >= 0) base.mensualidadMxn = mn;
        const giro = String(fila['giro'] ?? fila['giroActividad'] ?? '').trim();
        if (giro) base.giroActividad = giro;
        const vig = String(
          fila['vigenciaHasta'] ?? fila['vigenciaTexto'] ?? '',
        ).trim();
        if (vig) base.vigenciaHasta = vig;
      }
      return base;
    });

    return {
      canvas: { ...layout.canvas },
      zonas,
      locales,
    };
  }

  buildZonesAndLocales(): void {
    const boundedLocales = this.visualLayout.locales.map((local) =>
      this.constrainToBounds(local)
    );
    this.visualLayout = { ...this.visualLayout, locales: boundedLocales };
    this.selectedZoneId = null;
    this.clearSelection();
  }

  selectLocal(localId: string): void {
    this.uiState = { ...this.uiState, selectedLocalId: localId };
    const local = this.visualLayout.locales.find((it) => it.id === localId);
    this.selectedZoneId = local?.zonaId ?? null;
    if (this.zonasViewActive) {
      this.cdr.detectChanges();
      queueMicrotask(() => this.scrollListaZonaLocalAlSeleccionado(localId));
    }
  }

  clearSelection(): void {
    this.uiState = { ...this.uiState, selectedLocalId: null };
    this.selectedZoneId = null;
  }

  onDragStart(event: MouseEvent, local: LocalCanvasModel): void {
    event.stopPropagation();
    if (!this.canMoveLocal(local) || this.uiState.saving) return;
    this.selectLocal(local.id);
    this.draggingLocalId = local.id;
    this.uiState = { ...this.uiState, dragging: true };
    const pointerCanvas = this.toCanvasCoordinates(event);
    this.dragPointerOffset = {
      x: pointerCanvas.x - local.x,
      y: pointerCanvas.y - local.y,
    };
  }

  onDragMove(event: MouseEvent): void {
    if (this.zoneDragState) {
      this.moveZoneDrag(event);
      return;
    }

    if (this.zoneResizeState) {
      this.resizeZoneMove(event);
      return;
    }

    if (!this.uiState.dragging || !this.draggingLocalId) {
      if (this.panning) this.movePan(event);
      return;
    }

    const index = this.visualLayout.locales.findIndex((it) => it.id === this.draggingLocalId);
    if (index < 0) return;
    const local = this.visualLayout.locales[index];
    const pointerCanvas = this.toCanvasCoordinates(event);
    let nextPosition: LocalCanvasModel = {
      ...local,
      x: pointerCanvas.x - this.dragPointerOffset.x,
      y: pointerCanvas.y - this.dragPointerOffset.y,
    };
    if (this.gridEnabled) {
      const snapped = this.snapToGrid({ x: nextPosition.x, y: nextPosition.y });
      nextPosition = { ...nextPosition, x: snapped.x, y: snapped.y };
    }
    const dropZone = this.detectDropZone(nextPosition);
    nextPosition = this.reassignLocalToZone(nextPosition, dropZone?.id ?? null);
    const updated = [...this.visualLayout.locales];
    updated[index] = nextPosition;
    this.visualLayout = { ...this.visualLayout, locales: updated };
    this.detectDirtyChanges();
  }

  onDragEnd(): void {
    if (this.zoneDragState) {
      this.zoneDragState = null;
      this.detectDirtyChanges();
      return;
    }

    if (this.zoneResizeState) {
      this.zoneResizeState = null;
      this.detectDirtyChanges();
      return;
    }
    if (this.uiState.dragging) {
      this.uiState = { ...this.uiState, dragging: false };
      this.draggingLocalId = null;
    }
  }

  detectDropZone(local: LocalCanvasModel): ZonaCanvasModel | null {
    const centerX = local.x + local.width / 2;
    const centerY = local.y + local.height / 2;
    return (
      this.visualLayout.zonas.find(
        (zona) =>
          centerX >= zona.x &&
          centerX <= zona.x + zona.width &&
          centerY >= zona.y &&
          centerY <= zona.y + zona.height
      ) ?? null
    );
  }

  canMoveLocal(local: LocalCanvasModel): boolean {
    return !local.bloqueado;
  }

  constrainToBounds(local: LocalCanvasModel): LocalCanvasModel {
    const maxX = this.visualLayout.canvas.width - local.width;
    const maxY = this.visualLayout.canvas.height - local.height;
    return {
      ...local,
      x: Math.min(Math.max(0, local.x), Math.max(0, maxX)),
      y: Math.min(Math.max(0, local.y), Math.max(0, maxY)),
    };
  }

  snapToGrid(point: CanvasPoint): CanvasPoint {
    const g = this.layoutConfig.gridSize;
    return {
      x: Math.round(point.x / g) * g,
      y: Math.round(point.y / g) * g,
    };
  }

  reassignLocalToZone(local: LocalCanvasModel, zonaId: string | null): LocalCanvasModel {
    return { ...local, zonaId };
  }

  zoomIn(): void {
    this.setZoom(this.zoom + 0.1);
  }

  zoomOut(): void {
    this.setZoom(this.zoom - 0.1);
  }

  setZoom(value: number): void {
    this.zoom = Math.min(this.layoutConfig.maxZoom, Math.max(this.layoutConfig.minZoom, value));
  }

  resetZoom(): void {
    this.zoom = this.layoutConfig.defaultZoom;
    this.pan = { x: 0, y: 0 };
  }

  fitToContent(): void {
    const board = document.querySelector('.locales-board') as HTMLElement | null;
    if (!board || this.diagramaMapaVacio) return;
    this.expandCanvasToContent();
    const panelWidth = Math.max(320, board.clientWidth);
    const panelHeight = Math.max(260, board.clientHeight);
    const bounds = this.getDiagramContentBounds();
    const margin = 36;
    const contentWidth = Math.max(1, bounds.width);
    const contentHeight = Math.max(1, bounds.height);
    const availW = Math.max(1, panelWidth - margin * 2);
    const availH = Math.max(1, panelHeight - margin * 2);
    const fitZoom = Math.min(availW / contentWidth, availH / contentHeight);
    this.zoom = Math.max(
      this.layoutConfig.minZoom,
      Math.min(1, fitZoom * 0.92),
    );
    const contentCenterX = bounds.x + bounds.width / 2;
    const contentCenterY = bounds.y + bounds.height / 2;
    this.pan = {
      x: Math.round(panelWidth / 2 - contentCenterX * this.zoom),
      y: Math.round(panelHeight / 2 - contentCenterY * this.zoom),
    };
  }

  /** Ajusta el lienzo al contenido real (sin tope rígido al redimensionar zonas). */
  private expandCanvasToContent(): void {
    const pad = 64;
    let maxX = 0;
    let maxY = 0;
    for (const z of this.visualLayout.zonas) {
      maxX = Math.max(maxX, z.x + z.width);
      maxY = Math.max(maxY, z.y + z.height);
    }
    for (const l of this.visualLayout.locales) {
      maxX = Math.max(maxX, l.x + l.width);
      maxY = Math.max(maxY, l.y + l.height);
    }
    const width = Math.max(400, Math.ceil(maxX + pad));
    const height = Math.max(300, Math.ceil(maxY + pad));
    if (
      width === this.visualLayout.canvas.width &&
      height === this.visualLayout.canvas.height
    ) {
      return;
    }
    this.visualLayout = {
      ...this.visualLayout,
      canvas: { width, height },
    };
  }

  private esZonaAuxiliarDiagrama(zonaId: string): boolean {
    return String(zonaId).startsWith('__');
  }

  private resolveZonaIdParaGuardar(local: LocalCanvasModel): string | null {
    const directo = local.zonaId != null ? String(local.zonaId).trim() : '';
    if (directo) return directo;
    const zona = this.visualLayout.zonas.find((z) =>
      this.isLocalInsideZone(local, z),
    );
    return zona?.id ?? null;
  }

  startPan(event: MouseEvent): void {
    if (this.uiState.dragging) return;
    this.clearSelection();
    this.panning = true;
    this.panStartClient = { x: event.clientX, y: event.clientY };
    this.panStartOffset = { ...this.pan };
  }

  movePan(event: MouseEvent): void {
    if (!this.panning) return;
    this.pan = {
      x: this.panStartOffset.x + (event.clientX - this.panStartClient.x),
      y: this.panStartOffset.y + (event.clientY - this.panStartClient.y),
    };
  }

  endPan(): void {
    this.panning = false;
  }

  toCanvasCoordinates(event: MouseEvent): CanvasPoint {
    const target = event.currentTarget as HTMLElement | null;
    const board = target?.closest('.locales-board') as HTMLElement | null;
    if (!board) return { x: 0, y: 0 };
    const rect = board.getBoundingClientRect();
    const screenPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    return {
      x: (screenPoint.x - this.pan.x) / this.zoom,
      y: (screenPoint.y - this.pan.y) / this.zoom,
    };
  }

  toScreenCoordinates(point: CanvasPoint): CanvasPoint {
    return {
      x: point.x * this.zoom + this.pan.x,
      y: point.y * this.zoom + this.pan.y,
    };
  }

  detectDirtyChanges(): boolean {
    const current = this.serializeLayout();
    const dirty = current !== this.lastSavedLayoutSerialized;
    this.uiState = { ...this.uiState, dirty };
    return dirty;
  }

  validateBeforeSave(): string[] {
    const errors: string[] = [];
    const locales = this.visualLayout.locales;

    for (const local of locales) {
      const isInvalidCoord =
        !Number.isFinite(local.x) ||
        !Number.isFinite(local.y) ||
        !Number.isFinite(local.width) ||
        !Number.isFinite(local.height);
      if (isInvalidCoord) {
        errors.push(`El local ${local.nombre} tiene coordenadas inválidas.`);
      }
      if (!this.resolveZonaIdParaGuardar(local)) {
        errors.push(
          `El local ${local.nombre} debe estar dentro de una zona o tener zona asignada.`,
        );
      }
    }

    for (let i = 0; i < locales.length; i++) {
      for (let j = i + 1; j < locales.length; j++) {
        if (this.hasOverlap(locales[i], locales[j])) {
          errors.push(`Hay solapamiento entre ${locales[i].nombre} y ${locales[j].nombre}.`);
        }
      }
    }

    return errors;
  }

  serializeLayout(): string {
    const payload = {
      canvas: this.visualLayout.canvas,
      zonas: this.visualLayout.zonas
        .map((zona) => ({
          id: zona.id,
          nombre: zona.nombre,
          x: Math.round(zona.x),
          y: Math.round(zona.y),
          width: Math.round(zona.width),
          height: Math.round(zona.height),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      locales: this.visualLayout.locales
        .map((local) => ({
          id: local.id,
          zonaId: local.zonaId,
          x: Math.round(local.x),
          y: Math.round(local.y),
          width: Math.round(local.width),
          height: Math.round(local.height),
          estado: local.estado,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    };
    return JSON.stringify(payload);
  }

  saveLayout(): void {
    if (this.uiState.saving) return;
    const validations = this.validateBeforeSave();
    if (validations.length) {
      this.uiState = { ...this.uiState, error: validations[0] };
      this.toastr.warning(validations[0]);
      return;
    }

    const idInmueble = this.idInmuebleDesdeInstalacion(this.selectedInmuebleForLocales);
    if (idInmueble == null) {
      this.toastr.warning('No se identificó el inmueble para guardar el mapa.');
      return;
    }

    this.expandCanvasToContent();
    const mapaInmueble = this.buildMapaInmuebleFeatureCollection();
    const snapshot = this.serializeLayout();

    this.uiState = { ...this.uiState, saving: true, error: null };
    this.inmueblesService.actualizarMapaInmueble(idInmueble, mapaInmueble).subscribe({
      next: () => {
        this.lastSavedLayoutSerialized = snapshot;
        this.diagramaMapaVacio = false;
        this.diagramaPlanoDesdeCatalogo = false;
        this.sincronizarMapaEnInmueble(this.selectedInmuebleForLocales, mapaInmueble);
        this.uiState = { ...this.uiState, saving: false, dirty: false };
        this.toastr.success('Mapa del inmueble guardado correctamente.');
        if (this.selectedInmuebleForLocales) {
          this.cargarLocalesZonasInmueble(this.selectedInmuebleForLocales, {
            recargarDiagrama: false,
            mostrarCargaLista: true,
          });
        }
      },
      error: () => {
        this.uiState = {
          ...this.uiState,
          saving: false,
          error: 'No fue posible guardar el mapa. Intente de nuevo.',
        };
        this.toastr.error('No fue posible guardar el mapa. Intente de nuevo.');
      },
    });
  }

  private buildMapaInmuebleFeatureCollection(): {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: { type: 'Polygon'; coordinates: number[][][] };
      properties: Record<string, unknown>;
    }>;
  } {
    const features: Array<{
      type: 'Feature';
      geometry: { type: 'Polygon'; coordinates: number[][][] };
      properties: Record<string, unknown>;
    }> = [];

    for (const zona of this.visualLayout.zonas) {
      if (this.esZonaAuxiliarDiagrama(zona.id)) continue;
      features.push(
        this.rectToMapFeature(zona, {
          entityType: 'zona',
          id: zona.id,
          nombre: zona.nombre,
        }),
      );
    }

    for (const local of this.visualLayout.locales) {
      const zonaId = this.resolveZonaIdParaGuardar(local);
      features.push(
        this.rectToMapFeature(local, {
          entityType: 'local',
          id: local.id,
          nombre: local.nombre,
          zonaId,
          estado: local.estado,
        }),
      );
    }

    return { type: 'FeatureCollection', features };
  }

  private rectToMapFeature(
    rect: { x: number; y: number; width: number; height: number },
    properties: Record<string, unknown>,
  ): {
    type: 'Feature';
    geometry: { type: 'Polygon'; coordinates: number[][][] };
    properties: Record<string, unknown>;
  } {
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const ring: number[][] = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ];
    return {
      type: 'Feature',
      properties,
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    };
  }

  restoreLastSavedLayout(): void {
    if (!this.lastSavedLayoutSerialized) return;
    const parsed = JSON.parse(this.lastSavedLayoutSerialized) as {
      zonas: Array<{
        id: string;
        nombre: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
      locales: Array<{
        id: string;
        zonaId: string | null;
        x: number;
        y: number;
        width: number;
        height: number;
        estado: LocalVisualState;
      }>;
    };

    const restoredZonas = parsed.zonas?.length
      ? this.visualLayout.zonas.map((zona) => {
          const saved = parsed.zonas.find((it) => it.id === zona.id);
          if (!saved) return zona;
          return {
            ...zona,
            nombre: saved.nombre,
            x: saved.x,
            y: saved.y,
            width: saved.width,
            height: saved.height,
          };
        })
      : this.visualLayout.zonas;

    const restored = this.visualLayout.locales.map((local) => {
      const saved = parsed.locales.find((it) => it.id === local.id);
      if (!saved) return local;
      return {
        ...local,
        x: saved.x,
        y: saved.y,
        width: saved.width,
        height: saved.height,
        zonaId: saved.zonaId,
        estado: saved.estado,
      };
    });
    this.visualLayout = { ...this.visualLayout, zonas: restoredZonas, locales: restored };
    this.uiState = { ...this.uiState, dirty: false, error: null };
    this.toastr.info('Se restauró el último layout guardado.');
  }

  onLayoutWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    this.setZoom(this.zoom + delta);
  }

  closeInlineEditors(): void {
    this.showZoneNameEditor = false;
    this.zoneNameDraft = '';
  }

  renameZona(zona: ZonaCanvasModel): void {
    this.showZoneNameEditor = true;
    this.zoneNameDraft = zona.nombre;
    this.selectedZoneId = zona.id;
  }

  applyRenameZonaSelected(): void {
    const zoneName = this.zoneNameDraft.trim();
    if (!zoneName || !this.selectedZoneId) return;
    this.visualLayout = {
      ...this.visualLayout,
      zonas: this.visualLayout.zonas.map((z) =>
        z.id === this.selectedZoneId ? { ...z, nombre: zoneName } : z
      ),
    };
    this.closeInlineEditors();
    this.detectDirtyChanges();
  }

  startResizeZona(event: MouseEvent, zona: ZonaCanvasModel, handle: ZoneResizeHandle): void {
    event.stopPropagation();
    event.preventDefault();
    this.selectedZoneId = zona.id;
    this.zoneResizeState = {
      zonaId: zona.id,
      handle,
      startMouse: this.toCanvasCoordinates(event),
      startZone: { ...zona },
    };
  }

  onZoneDragStart(event: MouseEvent, zona: ZonaCanvasModel): void {
    event.stopPropagation();
    event.preventDefault();
    this.selectedZoneId = zona.id;
    const linkedLocales = this.visualLayout.locales
      .filter((l) => this.isLocalInsideZone(l, zona))
      .map((l) => ({ id: l.id, x: l.x, y: l.y }));
    this.zoneDragState = {
      zonaId: zona.id,
      startMouse: this.toCanvasCoordinates(event),
      startZone: { ...zona },
      linkedLocales,
    };
  }

  getLocalClasses(local: LocalCanvasModel): string {
    const selected = this.uiState.selectedLocalId === local.id ? ' selected' : '';
    const dragging = this.draggingLocalId === local.id ? ' dragging' : '';
    return `estado-${local.estado}${selected}${dragging}`;
  }

  trackByZona(_: number, zona: ZonaCanvasModel): string {
    return zona.id;
  }

  trackByLocal(_: number, local: LocalCanvasModel): string {
    return local.id;
  }

  getZoneResizeHandles(): ZoneResizeHandle[] {
    return ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  }

  getZoneHandleClass(handle: ZoneResizeHandle): string {
    return `resize-${handle}`;
  }

  private normalizeLocalState(raw: unknown): LocalVisualState {
    const n = Number(raw);
    if (n === 2) return 'ocupado';
    if (n === 3) return 'reservado';
    if (n === 0) return 'inactivo';
    if (n === 1) return 'libre';
    const value = String(raw ?? '').toLowerCase();
    if (value === 'ocupado' || value === 'reservado' || value === 'inactivo') {
      return value;
    }
    return 'libre';
  }

  private hasOverlap(a: LocalCanvasModel, b: LocalCanvasModel): boolean {
    return !(
      a.x + a.width <= b.x ||
      b.x + b.width <= a.x ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y
    );
  }

  private getDiagramContentBounds(): { x: number; y: number; width: number; height: number } {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [
      ...this.visualLayout.zonas,
      ...this.visualLayout.locales,
    ];
    if (!rects.length) {
      return {
        x: 0,
        y: 0,
        width: this.visualLayout.canvas.width,
        height: this.visualLayout.canvas.height,
      };
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const r of rects) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    }
    const padding = 40;
    const x0 = Math.max(0, minX - padding);
    const y0 = Math.max(0, minY - padding);
    return {
      x: x0,
      y: y0,
      width: Math.max(1, maxX + padding - x0),
      height: Math.max(1, maxY + padding - y0),
    };
  }

  private moveZoneDrag(event: MouseEvent): void {
    if (!this.zoneDragState) return;
    const state = this.zoneDragState;
    const current = this.toCanvasCoordinates(event);
    let dx = current.x - state.startMouse.x;
    let dy = current.y - state.startMouse.y;

    if (this.gridEnabled) {
      const snapped = this.snapToGrid({ x: dx, y: dy });
      dx = snapped.x;
      dy = snapped.y;
    }

    const safeDx = dx;
    const safeDy = dy;

    this.visualLayout = {
      ...this.visualLayout,
      zonas: this.visualLayout.zonas.map((z) =>
        z.id === state.zonaId
          ? { ...z, x: state.startZone.x + safeDx, y: state.startZone.y + safeDy }
          : z
      ),
      locales: this.visualLayout.locales.map((l) => {
        const linked = state.linkedLocales.find((it) => it.id === l.id);
        if (!linked) return l;
        return {
          ...l,
          x: linked.x + safeDx,
          y: linked.y + safeDy,
          zonaId: state.zonaId,
        };
      }),
    };
    this.expandCanvasToContent();
    this.detectDirtyChanges();
  }

  private isLocalInsideZone(local: LocalCanvasModel, zona: ZonaCanvasModel): boolean {
    const centerX = local.x + local.width / 2;
    const centerY = local.y + local.height / 2;
    return (
      centerX >= zona.x &&
      centerX <= zona.x + zona.width &&
      centerY >= zona.y &&
      centerY <= zona.y + zona.height
    );
  }

  private resizeZoneMove(event: MouseEvent): void {
    if (!this.zoneResizeState) return;
    const state = this.zoneResizeState;
    const current = this.toCanvasCoordinates(event);
    const dx = current.x - state.startMouse.x;
    const dy = current.y - state.startMouse.y;
    const minSize = 8;

    let nextX = state.startZone.x;
    let nextY = state.startZone.y;
    let nextW = state.startZone.width;
    let nextH = state.startZone.height;

    if (state.handle.includes('e')) nextW = Math.max(minSize, state.startZone.width + dx);
    if (state.handle.includes('s')) nextH = Math.max(minSize, state.startZone.height + dy);
    if (state.handle.includes('w')) {
      nextX = Math.min(state.startZone.x + state.startZone.width - minSize, state.startZone.x + dx);
      nextW = Math.max(minSize, state.startZone.width - (nextX - state.startZone.x));
    }
    if (state.handle.includes('n')) {
      nextY = Math.min(state.startZone.y + state.startZone.height - minSize, state.startZone.y + dy);
      nextH = Math.max(minSize, state.startZone.height - (nextY - state.startZone.y));
    }

    if (this.gridEnabled) {
      const snapPos = this.snapToGrid({ x: nextX, y: nextY });
      const snapSize = this.snapToGrid({ x: nextW, y: nextH });
      nextX = snapPos.x;
      nextY = snapPos.y;
      nextW = Math.max(minSize, snapSize.x);
      nextH = Math.max(minSize, snapSize.y);
    }

    nextX = Math.max(0, nextX);
    nextY = Math.max(0, nextY);
    nextW = Math.max(minSize, nextW);
    nextH = Math.max(minSize, nextH);

    this.visualLayout = {
      ...this.visualLayout,
      zonas: this.visualLayout.zonas.map((z) =>
        z.id === state.zonaId
          ? { ...z, x: nextX, y: nextY, width: nextW, height: nextH }
          : z
      ),
    };
    this.expandCanvasToContent();
    this.detectDirtyChanges();
  }

  private showHover(marker: any, html: string) {
    if (this.pinnedMarker) return;
    this.cancelHoverClose();
    this.openInfo(marker, html, undefined, false);
  }

  private hideHover(marker: any) {
    if (this.pinnedMarker) return;
    this.scheduleHoverClose(marker);
  }

  private togglePin(marker: any, html: string, payload?: any) {
    if (this.pinnedMarker === marker) {
      this.clearPin();
      return;
    }
    this.clearPin();
    this.pinnedMarker = marker;
    this.openInfo(marker, html, payload, true);
    this.mapClickUnpinListener = this.map?.addListener('click', () => {
      this.clearPin();
    });
  }

  private clearPin() {
    if (this.mapClickUnpinListener) {
      google.maps.event.removeListener(this.mapClickUnpinListener);
      this.mapClickUnpinListener = null;
    }
    this.pinnedMarker = null;
    this.cancelHoverClose();
    this.isHoveringInfoWindow = false;
    this.animateInfoClose(this.currentInfoMarker, true);
  }

  private scheduleHoverClose(marker: any): void {
    this.cancelHoverClose();
    this.hoverCloseTimer = setTimeout(() => {
      if (this.pinnedMarker || this.isHoveringInfoWindow) return;
      this.animateInfoClose(marker, false);
    }, 180);
  }

  private cancelHoverClose(): void {
    if (!this.hoverCloseTimer) return;
    clearTimeout(this.hoverCloseTimer);
    this.hoverCloseTimer = undefined;
  }

  private animateInfoClose(marker: any, force = false): void {
    if (!marker || this.currentInfoMarker !== marker) return;
    if (this.closingInfoForMarker === marker) return;

    const root: HTMLElement | null = document.querySelector('.gm-style-iw');
    const infoCard: HTMLElement | null = root?.querySelector('.iw-card') as HTMLElement;

    if (!infoCard || force) {
      this.infoWindow?.close();
      this.currentInfoMarker = undefined;
      this.closingInfoForMarker = undefined;
      return;
    }

    this.closingInfoForMarker = marker;
    infoCard.classList.remove('iw-enter');
    infoCard.classList.add('iw-leave');

    setTimeout(() => {
      if (this.currentInfoMarker === marker) {
        this.infoWindow?.close();
        this.currentInfoMarker = undefined;
      }
      this.closingInfoForMarker = undefined;
    }, 120);
  }

  private fitBoundsNice(bounds: any) {
    this.map.fitBounds(bounds);
    const listener = google.maps.event.addListenerOnce(
      this.map,
      'bounds_changed',
      () => {
        const z = this.map.getZoom();
        if (z > 16) this.map.setZoom(16);
        google.maps.event.removeListener(listener);
      }
    );
  }

  private clearMarkers() {
    this.markers.forEach((m) => m.setMap?.(null));
    this.markers = [];
  }

  selectInstalacion(item: any, index: number) {
    if (this.viewMode === 'centrales') {
      this.selectedId = item.id;
      this.selectedCentral = item;
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      if (isFinite(lat) && isFinite(lng)) {
        const pos = { lat, lng };
        this.map?.panTo(pos);
        this.map?.setZoom(Math.max(this.map?.getZoom() ?? 12, 15));
      }
      return;
    }

    this.selectedInmuebleForMap = { inmueble: item, index };
    const ins = this.selectedCentral?.instalaciones?.[index] ?? item;
    if (ins) {
      const lat = Number(ins.lat);
      const lng = Number(ins.lng);
      if (isFinite(lat) && isFinite(lng)) {
        const pos = { lat, lng };
        this.map?.panTo(pos);
        this.map?.setZoom(Math.max(this.map?.getZoom() ?? 12, 15));
        const marker = this.markers[index];
        if (marker) {
          this.togglePin(
            marker,
            this.buildInfoHtmlInstalacion(this.selectedCentral, ins),
            { central: this.selectedCentral, instalacion: ins }
          );
        }
      }
    }
  }

  private openInfo(marker: any, html: string, payload?: any, pinned = false) {
    this.infoWindow?.setContent(html);
    this.infoWindow?.open(this.map, marker);
    this.currentInfoMarker = marker;
    this.isHoveringInfoWindow = false;

    google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
      const root: HTMLElement | null = document.querySelector('.gm-style-iw');
      const infoCard: HTMLElement | null = root?.querySelector(
        '.iw-card'
      ) as HTMLElement;
      const scrollPane = root?.querySelector(
        '.iw-card__scroll',
      ) as HTMLElement | null;
      this.enlazarScrollInfoWindow(scrollPane);
      const btnClose: HTMLElement | null = root?.querySelector(
        '.iw-close'
      ) as HTMLElement;
      const btnAction: HTMLElement | null = root?.querySelector(
        '.iw-action'
      ) as HTMLElement;
      const btnDetailAction: HTMLElement | null = root?.querySelector(
        '.iw-detail-action'
      ) as HTMLElement;

      if (!pinned) {
        const onEnter = () => {
          this.isHoveringInfoWindow = true;
          this.cancelHoverClose();
        };
        const onLeave = () => {
          this.isHoveringInfoWindow = false;
          this.scheduleHoverClose(marker);
        };
        infoCard?.addEventListener('mouseenter', onEnter);
        infoCard?.addEventListener('mouseleave', onLeave);
        scrollPane?.addEventListener('mouseenter', onEnter);
        scrollPane?.addEventListener('mouseleave', onLeave);
      }

      btnClose?.addEventListener('click', () => {
        if (pinned) this.clearPin();
        else this.hideHover(marker);
      });
      btnAction?.addEventListener('click', () => this.onInfoAction(payload));
      btnDetailAction?.addEventListener('click', () =>
        this.onPredioDetalleAction(payload?.central)
      );
    });
  }

  irADetalleInmueble(inmueble: any, event?: Event): void {
    event?.stopPropagation();
    this.onInfoAction(
      {
        central: this.selectedCentral,
        instalacion: inmueble,
      },
      { animateLeave: true },
    );
  }

  onInfoAction(
    payload: any,
    options?: { animateLeave?: boolean },
  ) {
    const numeroSerie =
      payload?.instalacion?.equipo?.numeroSerie ??
      payload?.instalacion?.numeroSerie;
    const esVistaLocal = payload?.vistaEntidad === 'local';
    const ins = payload?.instalacion;
    const idContratoRaw =
      ins?.idContrato ?? ins?.id_contrato ?? ins?.contratoId ?? ins?.contrato?.id;
    const idContratoNum = Number(idContratoRaw);
    const qp: Record<string, string | number> = esVistaLocal
      ? { vista: 'local', retorno: 'locales' }
      : { origen: 'inmueble', retorno: 'inmuebles' };
    const nombreInmueble =
      ins?.nombreDepartamento ??
      ins?.nombreInstalacion ??
      ins?.nombreInmueble ??
      '';
    const nombreLocal =
      ins?.nombreLocal ??
      ins?.local ??
      '';
    const arrendadorNombre =
      ins?.arrendador ??
      payload?.central?.nombreCliente ??
      '';
    const arrendatarioNombre =
      ins?.arrendatario ??
      ins?.arrendatarioLocal ??
      ins?.ocupante ??
      '';
    const estatusLocal =
      ins?.estado != null && String(ins.estado).trim() !== ''
        ? String(ins.estado).toLowerCase()
        : '';
    if (String(nombreInmueble).trim() !== '') {
      qp['nombreInmueble'] = String(nombreInmueble).trim();
    }
    if (String(nombreLocal).trim() !== '') {
      qp['nombreLocal'] = String(nombreLocal).trim();
    }
    if (String(arrendadorNombre).trim() !== '') {
      qp['arrendador'] = String(arrendadorNombre).trim();
    }
    if (String(arrendatarioNombre).trim() !== '') {
      qp['arrendatario'] = String(arrendatarioNombre).trim();
    }
    if (estatusLocal === 'ocupado' || estatusLocal === 'libre') {
      qp['estatusLocal'] = estatusLocal;
    }
    if (!esVistaLocal) {
      const estInm = Number(
        ins?.estatusInmueble ?? ins?.detalle?.estatusInmueble,
      );
      if (estInm === 1) {
        qp['esRenta'] = 'true';
      } else if (estInm === 2) {
        qp['esRenta'] = 'false';
      }
    }
    if (esVistaLocal && Number.isFinite(idContratoNum) && idContratoNum > 0) {
      qp['idContrato'] = idContratoNum;
    }
    const idArrendatarioRaw = ins?.idArrendatario;
    const idArrendatarioNum = Number(idArrendatarioRaw);
    if (
      esVistaLocal &&
      Number.isFinite(idArrendatarioNum) &&
      idArrendatarioNum > 0
    ) {
      qp['idArrendatario'] = Math.floor(idArrendatarioNum);
    }
    const idLocalRaw = ins?.idLocal ?? ins?.id;
    const idLocalNum = Number(idLocalRaw);
    if (esVistaLocal && Number.isFinite(idLocalNum) && idLocalNum > 0) {
      qp['idLocal'] = Math.floor(idLocalNum);
    }
    const parentId =
      payload?.parentInmuebleId ??
      ins?.id ??
      ins?.idInstalacion ??
      ins?.idDepartamento ??
      ins?.idInstalacionDepartamento;
    if (parentId != null && String(parentId).trim() !== '') {
      qp['idInmueble'] = String(parentId).trim();
    }
    const central = payload?.central;
    const idCli = central?.idCliente ?? central?.id;
    if (idCli != null && String(idCli).trim() !== '') {
      qp['idCliente'] = String(idCli).trim();
    }
    const go = () =>
      this.router.navigate(
        ['/monitoreo', 'instalacion', numeroSerie || this.PREVIEW_SERIE],
        { queryParams: qp },
      );
    if (options?.animateLeave) {
      this.runDetailLeaveTransition(go);
    } else {
      go();
    }
  }

  onPredioDetalleAction(central: any) {
    const numeroSerie = this.getFirstNumeroSerieFromCentral(central);
    this.router.navigate([
      '/monitoreo',
      'instalacion',
      numeroSerie || this.PREVIEW_SERIE,
    ], {
      queryParams: { origen: 'predio' },
    });
  }

  private getFirstNumeroSerieFromCentral(central: any): string | null {
    const instalaciones = Array.isArray(central?.instalaciones)
      ? central.instalaciones
      : [];
    for (const ins of instalaciones) {
      const numeroSerie = ins?.equipo?.numeroSerie ?? ins?.numeroSerie;
      if (numeroSerie) return String(numeroSerie);
    }
    return null;
  }

  /** Evita que la rueda del mapa se coma el scroll del tooltip. */
  private enlazarScrollInfoWindow(scrollPane: HTMLElement | null): void {
    if (!scrollPane) return;
    scrollPane.addEventListener(
      'wheel',
      (e) => {
        e.stopPropagation();
      },
      { passive: true },
    );
  }

  private installInfoWindowSkin(): void {
    document.querySelector('style[data-iw-skin="true"]')?.remove();
    const css = `
      .gm-style-iw, .gm-style-iw.gm-style-iw-c {
        background: #151f35 !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
      }
        .gm-style .gm-style-iw-tc::after {
            background: #151f35;
            -webkit-clip-path: polygon(0 0, 50% 100%, 100% 0);
            clip-path: polygon(0 0, 50% 100%, 100% 0);
            content: "";
            height: 12px;
            left: 0;
            position: absolute;
            top: -1px;
            width: 25px;
        }
      .gm-style .gm-style-iw-d {
        padding: 0 !important;
        overflow: hidden !important;
      }
      .gm-style .gm-style-iw-t::after { background: transparent !important; box-shadow: none !important; }
      .gm-style-iw-tc { padding: 0 !important; margin: 0 !important; }
      .gm-ui-hover-effect { display: none !important; }

      .iw-card {
        transform-origin: 50% 100%;
        will-change: transform, opacity, filter;
      }
      .iw-card.iw-enter {
        animation: iwEnter 140ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }
      .iw-card.iw-leave {
        animation: iwLeave 120ms ease-in both;
      }
      @keyframes iwEnter {
        0% { opacity: 0; transform: translateY(8px) scale(0.94); filter: blur(2px); }
        100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
      }
      @keyframes iwLeave {
        0% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        100% { opacity: 0; transform: translateY(6px) scale(0.95); filter: blur(1.5px); }
      }

      .gm-style-iw-c {
        max-width: min(360px, 94vw) !important;
      }

      .iw-card {
        background: #151f35;
        color: #e5e7eb;
        display: flex;
        flex-direction: column;
        max-height: min(52vh, 340px);
        padding: 0;
        border-radius: 12px;
        min-width: min(300px, 92vw);
        max-width: min(360px, 94vw);
        line-height: 1.35;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
        box-sizing: border-box;
        overflow: hidden;
      }
      .iw-card__scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 6px 14px 6px;
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.5) rgba(255, 255, 255, 0.06);
      }
      .iw-card__scroll::-webkit-scrollbar {
        width: 7px;
      }
      .iw-card__scroll::-webkit-scrollbar-track {
        margin: 4px 0;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
      }
      .iw-card__scroll::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.45);
        border-radius: 8px;
      }
      .iw-card--local .iw-card__title {
        font-size: clamp(1.12rem, 3vw, 1.28rem);
        letter-spacing: 0.04em;
        color: #ffffff;
      }
      .iw-card__title-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        min-width: 0;
      }
      .iw-card__title-row .iw-card__title {
        flex: 1 1 auto;
        min-width: 0;
        margin: 0;
      }
      .iw-card__title-row .iw-chip {
        flex: 0 0 auto;
      }
      .iw-card__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-shrink: 0;
        margin-bottom: 0;
        padding: 12px 14px 10px;
        border-bottom: 1px solid rgba(130, 160, 255, 0.22);
      }
      .iw-card__title-block {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .iw-card__eyebrow {
        font-size: 0.68rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #9eb0d8;
      }
      .iw-card__title {
        margin: 0;
        font-size: clamp(1.05rem, 2.8vw, 1.2rem);
        letter-spacing: 0.03em;
        color: #f8fafc;
        line-height: 1.25;
        word-break: break-word;
      }
      .iw-close {
        background: transparent;
        border: 0;
        cursor: pointer;
        color: #fff;
        font-size: 18px;
        line-height: 1;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        flex-shrink: 0;
      }
      .iw-card__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }
      .iw-chip {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        line-height: 1.2;
        color: #e8edf6;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.06);
      }
      .iw-chip--activo {
        color: #bbf7d0;
        border-color: rgba(74, 222, 128, 0.4);
        background: rgba(20, 83, 45, 0.35);
      }
      .iw-chip--inactivo {
        color: #fecaca;
        border-color: rgba(248, 113, 113, 0.45);
        background: rgba(127, 29, 29, 0.35);
      }
      .iw-chip--tipo {
        color: #c8d2f0;
        border-color: rgba(130, 160, 255, 0.35);
        background: rgba(89, 109, 255, 0.16);
      }
      .iw-chip--estado {
        color: #e8edff;
        border-color: rgba(130, 160, 255, 0.28);
        background: rgba(14, 20, 32, 0.88);
      }
      .iw-chip--libre {
        color: #ecfdf5;
        border-color: rgba(134, 239, 172, 0.45);
        background: rgba(22, 163, 74, 0.92);
      }
      .iw-chip--ocupado {
        color: #fff1f2;
        border-color: rgba(248, 113, 113, 0.45);
        background: rgba(220, 38, 38, 0.88);
      }
      .iw-chip--reservado {
        color: #fffbeb;
        border-color: rgba(253, 224, 71, 0.4);
        background: rgba(217, 119, 6, 0.92);
      }
      .iw-chip--inactivo {
        color: #f5f3ff;
        border-color: rgba(216, 180, 254, 0.5);
        background: rgba(109, 40, 217, 0.88);
      }
      .iw-card__hero {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(130, 160, 255, 0.2);
      }
      .iw-card__hero-label {
        font-size: 0.68rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #9eb0d8;
        line-height: 1.3;
      }
      .iw-card__hero-name {
        font-size: clamp(1rem, 2.6vw, 1.12rem);
        letter-spacing: 0.03em;
        color: #f8fafc;
        line-height: 1.3;
        word-break: break-word;
      }
      .iw-card__body {
        display: block;
        padding-top: 4px;
      }
      .iw-card__grid {
        display: flex;
        flex-wrap: wrap;
        margin: 0 -5px;
      }
      .iw-grid-cell {
        flex: 0 0 50%;
        max-width: 50%;
        padding: 0 5px;
        box-sizing: border-box;
      }
      .iw-grid-cell--full {
        flex: 0 0 100%;
        max-width: 100%;
      }
      .iw-grid-cell .iw-line {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: clamp(0.78rem, 2vw, 0.86rem);
        padding: 4px 0 6px;
        border-bottom: none;
        min-height: 100%;
      }
      .iw-line {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 3px;
        font-size: clamp(0.8rem, 2vw, 0.88rem);
        padding: 6px 0;
        border-bottom: none;
      }
      .iw-line__label {
        color: #9eb0d8;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-size: 0.68rem;
        line-height: 1.35;
        white-space: normal;
        word-break: normal;
      }
      .iw-line__value {
        color: #eef2f8;
        word-break: break-word;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .iw-address {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: clamp(0.75rem, 2vw, 0.82rem);
        color: #c6cfde;
      }
      .iw-address__dot {
        margin-top: 5px;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(52, 152, 219, 0.9);
        flex: 0 0 8px;
      }
      .iw-card__footer {
        display: flex;
        justify-content: flex-end;
        flex-shrink: 0;
        margin-top: 0;
        padding: 8px 14px 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }
      .iw-action, .iw-detail-action {
        color: #fff;
        border: 1px solid transparent;
        cursor: pointer;
        border-radius: 10px;
        padding: 8px 16px;
        font-size: clamp(0.82rem, 2vw, 0.9rem);
        letter-spacing: 0.02em;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .iw-action--credito, .iw-detail-action.iw-action--credito {
        border-color: rgba(52, 152, 219, 0.55);
        background: rgba(52, 152, 219, 0.22);
      }
      .iw-action--credito:hover {
        border-color: rgba(52, 152, 219, 0.7);
        background: rgba(52, 152, 219, 0.32);
      }
    `;
    let style = document.querySelector(
      'style[data-iw-skin="monitoreo"]',
    ) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.setAttribute('data-iw-skin', 'monitoreo');
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  private buildInfoHtml(item: any): string {
    const name = item?.nombre ?? item?.nombreInstalacion ?? 'Instalación';
    const dir = item?.direccion ?? '';

    return `
    <div class="iw-card iw-enter" style="
      background:#151f35; color:#e5e7eb;
      padding:0px 18px 16px;
      border-radius:12px; min-width:260px; max-width:320px; line-height:1.25rem;
      box-shadow:0 12px 28px rgba(0,0,0,.20);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px;">
        <h6 style="margin:0;font-size:1rem;color:#fff;">${name}</h6>
        <button class="iw-close" aria-label="Cerrar" style="background:transparent;border:0;cursor:pointer;color:#fff;font-size:18px;line-height:1;width:28px;height:28px;border-radius:8px;">✕</button>
      </div>
      <div style="display:flex;gap:.5rem;align-items:flex-start;color:#c6cfde;">
        <span style="margin-top:4px;width:8px;height:8px;border-radius:999px;background:var(--mat-sys-primary,#681330);display:inline-block;flex:0 0 8px;"></span>
        <span>${dir}</span>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px;">
        <button class="iw-detail-action" style="
          background:#681330; color:#fff; border:0; cursor:pointer;
          border-radius:10px; padding:8px 12px; font-size:.85rem;
        ">
          Detalle
        </button>
      </div>
    </div>
  `;
  }

  private buildInfoHtmlInmueblePunto(inmueble: any): string {
    const titulo =
      inmueble?.nombreDepartamento ??
      inmueble?.nombreInstalacion ??
      'Inmueble';
    const dir = String(inmueble?.direccion ?? '').trim();
    const body = [
      this.iwLine('Arrendador', inmueble?.arrendador),
      this.iwLine('Vigencia', this.vigenciaTextoInmuebleIw(inmueble)),
    ]
      .filter(Boolean)
      .join('');
    const addressHtml = dir
      ? `<div class="iw-address"><span class="iw-address__dot" aria-hidden="true"></span><span>${this.escapeHtml(dir)}</span></div>`
      : '';
    return this.buildIwCardHtml({
      title: titulo,
      bodyHtml: body || '<div class="iw-line"><span class="iw-line__value">Ubicación del inmueble en mapa.</span></div>',
      addressHtml,
    });
  }

  private buildInfoHtmlLocal(local: any, _index: number): string {
    const chips = this.iwChipLocalEstatus(local);
    const ocupado = this.localTieneInformacion(local);
    const zona =
      String(local?.zonaPrincipal ?? '').trim() ||
      this.getZonaNombreLocalLista(local) ||
      '';
    const giro =
      this.getGiroActividadLocalLista(local) ??
      (String(local?.giro ?? '').trim() || '');
    const mensualidad = this.getMensualidadLocalLista(local);
    const mensualidadConMoneda =
      mensualidad && ocupado && local?.monedaContrato
        ? `${mensualidad} (${local.monedaContrato})`
        : mensualidad;
    const superficie =
      String(local?.metrosRentadosTexto ?? '').trim() ||
      this.getMedidaLocalLista(local) ||
      '';

    const arrendatario = this.getOcupanteLocalLista(local);
    const celdas: Array<{ label: string; value: unknown; spanFull?: boolean }> =
      [];
    if (zona) celdas.push({ label: 'Zona', value: zona });
    if (giro) celdas.push({ label: 'Giro', value: giro });

    if (ocupado) {
      if (mensualidadConMoneda) {
        celdas.push({ label: 'Renta', value: mensualidadConMoneda });
      }
      if (local?.rentaTotalFmt) {
        celdas.push({ label: 'Total contrato', value: local.rentaTotalFmt });
      }
      if (superficie) {
        celdas.push({ label: 'Superficie rentada', value: superficie });
      }
      if (local?.representanteLegal) {
        celdas.push({
          label: 'Representante legal',
          value: local.representanteLegal,
        });
      }
      if (local?.telefonoRepresentante) {
        celdas.push({
          label: 'Tel. representante',
          value: local.telefonoRepresentante,
        });
      }
      if (local?.vigenciaTexto) {
        celdas.push({
          label: 'Vigencia',
          value: local.vigenciaTexto,
        });
      }
    } else {
      if (mensualidadConMoneda) {
        celdas.push({ label: 'Mensualidad', value: mensualidadConMoneda });
      }
      if (superficie) {
        celdas.push({ label: 'Superficie', value: superficie });
      }
    }

    const body = this.iwCuerpoEnGrid(celdas);

    return this.buildIwCardHtml({
      title: this.getNombreLocalEnLista(local),
      chipsHtml: chips,
      chipsInTitle: true,
      heroHtml: arrendatario ? this.iwHeroArrendatario(arrendatario) : '',
      bodyHtml: body,
      cardClass: 'iw-card--local',
      actionLabel: ocupado ? 'Información' : undefined,
      actionBtnClass: 'iw-action iw-action--credito',
    });
  }

  private buildInfoHtmlInstalacion(c: any, ins: any): string {
    const titulo =
      ins?.nombreDepartamento ?? ins?.nombreInstalacion ?? 'Inmueble';
    const estatusReg = Number(ins?.estatus);
    const chips: string[] = [];
    if (ins?.estatusLabel && ins.estatusLabel !== '—') {
      chips.push(
        this.iwChipHtml(
          ins.estatusLabel,
          estatusReg === 1 ? 'activo' : 'inactivo',
        ),
      );
    }
    if (
      ins?.estatusInmuebleTipoLabel &&
      ins.estatusInmuebleTipoLabel !== 'Sin estatus'
    ) {
      chips.push(this.iwChipHtml(ins.estatusInmuebleTipoLabel, 'tipo'));
    }

    const resumenZonas =
      ins?.numZonas != null || ins?.numServicios != null
        ? `${ins?.numZonas ?? 0} zona(s) · ${ins?.numServicios ?? 0} servicio(s)`
        : '';

    const body = this.iwCuerpoEnGrid([
      { label: 'Arrendador', value: ins?.arrendador ?? c?.nombreCliente },
      { label: 'Vigencia', value: this.vigenciaTextoInmuebleIw(ins), spanFull: true },
      { label: 'Representante', value: ins?.nombreRepresentante },
      { label: 'Resumen', value: resumenZonas },
    ]);

    const dir = String(ins?.direccion ?? '').trim();
    const addressHtml = dir
      ? `<div class="iw-address"><span class="iw-address__dot" aria-hidden="true"></span><span>${this.escapeHtml(dir)}</span></div>`
      : '';

    return this.buildIwCardHtml({
      title: titulo,
      eyebrow: 'Inmueble',
      chipsHtml: chips.join(''),
      bodyHtml: body,
      addressHtml,
      actionLabel: 'Información',
      actionBtnClass: 'iw-action iw-action--credito',
    });
  }


  private formatDate(value: any): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  }

  private loadGoogleMaps(): Promise<void> {
    if ((window as any).google?.maps) return Promise.resolve();
    if (MonitoreoComponent.mapsLoading) return MonitoreoComponent.mapsLoading;

    MonitoreoComponent.mapsLoading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        this.apiKey
      )}&v=weekly&libraries=marker,places`;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () =>
        reject(new Error('No se pudo cargar Google Maps JS API'));
      document.head.appendChild(s);
    });

    return MonitoreoComponent.mapsLoading;
  }

  /** Solo `resize`: el caller ya llamó `renderAccordingMode`; volver a render borraba marcadores y rompía tiles. */
  private refreshMapAfterPanelSwitch(): void {
    if (!this.map) return;
    setTimeout(() => {
      google.maps.event?.trigger(this.map, 'resize');
    }, 0);
    setTimeout(() => {
      google.maps.event?.trigger(this.map, 'resize');
    }, 120);
  }

  private ensureMapReadyAndRender(): void {
    this.cdr.detectChanges();
    let attempts = 0;
    const run = () => {
      attempts++;
      const el = document.getElementById('map');
      if (!el) {
        if (attempts < 24) setTimeout(run, 32);
        return;
      }

      if (this.mapInstanceIsStale()) {
        this.teardownGoogleMap();
        this.initMap().then(() => {
          this.renderAccordingMode();
          this.refreshMapAfterPanelSwitch();
        });
        return;
      }

      this.renderAccordingMode();
      this.refreshMapAfterPanelSwitch();
    };

    setTimeout(run, 0);
  }
}