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
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { AuthenticationService } from 'src/app/services/auth.service';
import { InstalacionCentral } from 'src/app/services/moduleService/instalacionesCentral.service';

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
  private readonly PREVIEW_SERIE = 'preview-demo';
  /**
   * Logos por defecto cuando el API no envía imagen (temporal).
   * Se elige uno u otro según identidad del arrendador para que no salgan iguales.
   */
  readonly imagenesClientes = [
    'https://analiticadevideo.s3.us-east-1.amazonaws.com/Clientes/37269948-9b8c-42c7-a858-87d0f6101fad.png',
    'https://analiticadevideo.s3.us-east-1.amazonaws.com/Clientes/1b74ca94-7427-4689-bca8-29963c05925f.png',
  ];
  readonly imagenesInmuebles = [
    'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1430285561322-7808604715df?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80',
  ];
  readonly imagenesLocales = [
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=900&q=80',
  ];
  /** Imagen default de locales cuando no llega foto del API. */
  readonly imagenLocalListaDefault = this.imagenesLocales[0];
  clienteSearchTerm = '';
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
  /** Abrir InfoWindow del local tras clic en fila, Mapa o Centrar (no al primer pintado pasivo del mapa). */
  private pendingLocalInfoWindow = false;

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
  localNameDraft = '';
  showZoneNameEditor = false;
  showLocalNameEditor = false;
  isRenamingZone = false;

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
  ]);

  get listaVisible(): any[] {
    if (this.flowMode === 'clientes') {
      return this.listaInstalaciones;
    }
    const c = this.selectedCentral;
    return Array.isArray(c?.instalaciones) ? c.instalaciones : [];
  }

  get clientesFiltrados(): any[] {
    const list = this.listaVisible;
    if (this.flowMode !== 'clientes') return list;
    const q = this.clienteSearchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter((cliente: any) =>
      String(cliente?.nombreCliente ?? cliente?.nombre ?? '')
        .toLowerCase()
        .includes(q)
    );
  }

  /** Locales mostrados en la lista izquierda en vista Zonas (API o representación del diagrama). */
  get localesParaListaZonas(): any[] {
    if (!this.zonasViewActive || !this.selectedInmuebleForLocales) return [];
    const ins = this.selectedInmuebleForLocales;
    const raw = Array.isArray(ins.locales) ? ins.locales : [];
    if (raw.length) return raw;
    // Evita recrear un nuevo array/objetos en cada detección de cambios
    // para que la lista no se re-renderice continuamente al hacer scroll.
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

  getImagenLocalLista(local: any, index = 0): string {
    const u =
      local?.imagenUrl ??
      local?.urlImagen ??
      local?.foto ??
      local?.imagen ??
      local?.photoUrl ??
      local?.urlFoto;
    const s = u != null ? String(u).trim() : '';
    if (s.length) return s;
    const seed = local?.id ?? local?.nombre ?? index;
    return this.pickImageBySeed(seed, this.imagenesLocales, this.imagenLocalListaDefault);
  }

  getImagenInmuebleCard(inmueble: any, index: number): string {
    const seed = inmueble?.id ?? inmueble?.idInstalacion ?? inmueble?.nombreDepartamento ?? index;
    return this.pickImageBySeed(seed, this.imagenesInmuebles, this.imagenesInmuebles[0]);
  }

  getImagenClienteCard(cliente: any, index: number): string {
    const u =
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
    const e = String(local?.estado ?? '').toLowerCase().trim();
    const map: Record<string, string> = {
      libre: 'Libre',
      ocupado: 'Ocupado',
      reservado: 'Reservado',
      inactivo: 'Inactivo',
    };
    return map[e] ?? (local?.estado != null && String(local.estado).trim() !== ''
      ? String(local.estado)
      : 'Sin dato');
  }

  getEstadoChipClassLista(local: any): string {
    const e = String(local?.estado ?? 'libre').toLowerCase().trim();
    if (e === 'ocupado') return 'local-status--ocupado';
    if (e === 'reservado') return 'local-status--reservado';
    if (e === 'inactivo') return 'local-status--inactivo';
    return 'local-status--libre';
  }

  getMensualidadLocalLista(local: any): string | null {
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
    private insService: InstalacionCentral,
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

  obtenerInstalacionesCentral() {
    this.insService.obtenerInstalacionCentral().subscribe((response: any) => {
      let data: any[] = response?.data ?? [];
      const u = this.auth.getUser();
      const idCliente = u?.idCliente != null ? u.idCliente : null;

      if (this.isRol1) {
        this.listaInstalaciones = data;
        this.viewMode = 'centrales';
        this.flowMode = 'clientes';
        this.selectedCentral = null;
      } else {
        const filtered = data.filter(
          (c: any) => c?.idCliente == idCliente || c?.id == idCliente
        );
        this.listaInstalaciones = filtered;
        this.selectedCentral = filtered.length ? filtered[0] : null;
        this.viewMode = 'instalaciones';
        this.flowMode = 'inmuebles';
      }

      if (this.map && this.flowMode === 'inmuebles') this.renderAccordingMode();
      this.aplicarRetornoDesdeDetalleSiCorresponde();
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
        this.verInstalacionesDeCentral(c);
      }
    }

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
    this.zonasViewActive = false;
    this.selectedInmuebleForLocales = null;
    this.selectedLocalForMap = null;
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
      const n = Math.max(list.length, 1);
      const radius = 0.00055;
      list.forEach((loc: any, i: number) => {
        const lat = Number(loc?.lat);
        const lng = Number(loc?.lng);
        if (isFinite(lat) && isFinite(lng)) {
          points.push({ lat, lng, local: loc, index: i, kind: 'local' });
        } else if (isFinite(baseLat) && isFinite(baseLng)) {
          const angle = (i / n) * Math.PI * 2;
          points.push({
            lat: baseLat + Math.cos(angle) * radius,
            lng: baseLng + Math.sin(angle) * radius,
            local: loc,
            index: i,
            kind: 'local',
          });
        }
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
      } else {
        marker.addListener('click', () =>
          this.togglePin(marker, html, {
            central: this.selectedCentral,
            instalacion: inmueble,
          })
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

    for (const ins of childs) {
      const lat = Number(ins.lat);
      const lng = Number(ins.lng);
      if (!isFinite(lat) || !isFinite(lng)) continue;

      const pos = { lat, lng };

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
        this.showHover(marker, this.buildInfoHtmlInstalacion(c, ins));
      });
      marker.addListener('mouseout', () => this.hideHover(marker));
      marker.addListener('click', () =>
        this.togglePin(marker, this.buildInfoHtmlInstalacion(c, ins), {
          central: c,
          instalacion: ins,
        })
      );

      this.markers.push(marker);
      bounds.extend(pos);
      hasAny = true;
    }

    if (hasAny) this.fitBoundsNice(bounds);
  }

  goToCentrales() {
    this.viewMode = 'centrales';
    this.flowMode = 'clientes';
    this.selectedCentral = null;
    this.selectedInmuebleForLocales = null;
    this.zonasViewActive = false;
    this.selectedLocalForMap = null;
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
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'inmuebles';
    this.clearPin();
    this.renderAccordingMode();
  }

  verInstalacionesDeCentral(central: any) {
    this.selectedCentral = central;
    this.viewMode = 'instalaciones';
    this.flowMode = 'inmuebles';
    this.selectedInmuebleForLocales = null;
    this.zonasViewActive = false;
    this.selectedLocalForMap = null;
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'inmuebles';
    this.clearPin();
    this.ensureMapReadyAndRender();
  }

  seleccionarCliente(central: any) {
    this.verInstalacionesDeCentral(central);
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

  /** Botón Zonas en la card de inmueble: lista de locales + diagrama. */
  abrirZonasInmueble(inmueble: any): void {
    this.selectedInmuebleForLocales = inmueble;
    this.zonasViewActive = true;
    this.selectedLocalForMap = null;
    this.clearPin();
    this.rightPanelMode = 'locales';
    this.mapScopeMode = 'locales';
    this.loadVisualLayout();
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
    this.zonasViewActive = false;
    this.selectedInmuebleForLocales = null;
    this.selectedLocalForMap = null;
    this.closeInlineEditors();
    this.clearSelection();
    this.rightPanelMode = 'mapa';
    this.mapScopeMode = 'inmuebles';
    this.ensureMapReadyAndRender();
  }

  /** Mapa: ubicación del local (o representación junto al inmueble). */
  mostrarMapaLocal(local: any, index: number, event?: Event): void {
    event?.stopPropagation();
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
    this.selectedLocalForMap = null;
    this.rightPanelMode = 'locales';
    this.mapScopeMode = 'locales';
    const id = this.resolveLocalIdParaLista(local, index);
    if (id) this.selectLocal(id);
  }

  onInfoLocal(local: any, event?: Event): void {
    event?.stopPropagation();
    const ins = this.selectedInmuebleForLocales;
    const parentInmuebleId =
      ins?.id ?? ins?.idInstalacion ?? ins?.idDepartamento ?? ins?.idInstalacionDepartamento;
    const merged = { ...(ins || {}), ...(local || {}) };
    this.onInfoAction({
      central: this.selectedCentral,
      instalacion: merged,
      vistaEntidad: 'local',
      parentInmuebleId,
    });
  }

  trackByLocalEnZonas(index: number, local: any): string {
    return String(local?.id ?? local?.nombre ?? index);
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
    this.sincronizarSeleccionLocalLista(local, index);
    this.selectedLocalForMap = { local, index };
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

  /** Id estable para fila + scroll; coincide con `selectLocal`. */
  idAtributoFilaListaLocal(local: any, index: number): string {
    const id = this.resolveLocalIdParaLista(local, index);
    return this.listaLocalRowDomId(id ?? `idx-${index}`);
  }

  isLocalResaltadoEnListaZonas(local: any, index: number): boolean {
    const sid = this.uiState.selectedLocalId;
    if (!sid) return false;
    const id = this.resolveLocalIdParaLista(local, index);
    return id != null && String(id) === String(sid);
  }

  private listaLocalRowDomId(localId: string): string {
    return `zona-list-local-${String(localId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  private resolveLocalIdParaLista(local: any, index: number): string | null {
    if (local?.id != null) return String(local.id);
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
    const rawModel = this.mapBackendToCanvasModel(this.selectedInmuebleForLocales);
    this.visualLayout = rawModel;
    this.buildZonesAndLocales();
    this.fitToContent();
    requestAnimationFrame(() => this.fitToContent());
    this.lastSavedLayoutSerialized = this.serializeLayout();
    this.uiState = { ...this.uiState, loading: false, dirty: false };
  }

  mapBackendToCanvasModel(source: unknown): VisualLayoutModel {
    const inmueble = source as Record<string, unknown> | null;
    const rawLocales = Array.isArray(inmueble?.['locales'])
      ? (inmueble?.['locales'] as Record<string, unknown>[])
      : [];

    if (!rawLocales.length) {
      const fallbackLocales: LocalCanvasModel[] = Array.from({ length: 8 }).map((_, i) => {
        const enPlantaBaja = i < 4;
        const col = enPlantaBaja ? i : i - 4;
        const estado: LocalVisualState =
          i % 3 === 0 ? 'ocupado' : i % 4 === 0 ? 'reservado' : 'libre';
        return {
          id: `local-${i + 1}`,
          nombre: `Local ${i + 1}`,
          x: 60 + col * 120,
          y: enPlantaBaja ? 70 : 400,
          width: 92,
          height: 72,
          zonaId: enPlantaBaja ? 'zona-a' : 'zona-b',
          estado,
          bloqueado: false,
          ocupanteNombre:
            estado === 'ocupado'
              ? i % 2 === 0
                ? `Comercializadora Demo ${i + 1} SA`
                : `Ing. María López ${i + 1}`
              : undefined,
          mensualidadMxn: 7800 + i * 420,
          ...(estado === 'ocupado'
            ? {
                giroActividad:
                  i % 2 === 0 ? 'Comercio minorista' : 'Servicios profesionales',
                vigenciaHasta: `202${7 + (i % 2)}-0${(i % 6) + 1}-28`,
              }
            : estado === 'reservado'
              ? { vigenciaHasta: '2026-04-15' }
              : {}),
        };
      });

      return {
        canvas: { width: 1200, height: 760 },
        zonas: [
          { id: 'zona-a', nombre: 'Planta baja', x: 30, y: 35, width: 550, height: 320 },
          { id: 'zona-b', nombre: 'Piso 1', x: 30, y: 380, width: 550, height: 320 },
        ],
        locales: fallbackLocales,
      };
    }

    const mappedLocales: LocalCanvasModel[] = rawLocales.map((it, i) => {
      const ocupanteRaw =
        it['ocupanteNombre'] ??
        it['nombreEmpresa'] ??
        it['empresa'] ??
        it['arrendatario'] ??
        it['inquilino'];
      const mensRaw =
        it['mensualidadMxn'] ?? it['mensualidad'] ?? it['rentaMensual'] ?? it['pagoMensual'];
      const base: LocalCanvasModel = {
        id: String(it['id'] ?? `local-${i + 1}`),
        nombre: String(it['nombre'] ?? `Local ${i + 1}`),
        x: Number(it['x'] ?? 0),
        y: Number(it['y'] ?? 0),
        width: Math.max(50, Number(it['width'] ?? 92)),
        height: Math.max(50, Number(it['height'] ?? 72)),
        zonaId: it['zonaId'] != null ? String(it['zonaId']) : null,
        estado: this.normalizeLocalState(it['estado']),
        bloqueado: Boolean(it['bloqueado']),
      };
      if (ocupanteRaw != null && String(ocupanteRaw).trim() !== '') {
        base.ocupanteNombre = String(ocupanteRaw).trim();
      }
      const mn = Number(mensRaw);
      if (isFinite(mn) && mn >= 0) base.mensualidadMxn = mn;
      const giroRaw =
        it['giroActividad'] ??
        it['giro'] ??
        it['rubro'] ??
        it['actividad'] ??
        it['giroComercial'] ??
        it['tipoNegocio'] ??
        it['descripcionGiro'];
      if (giroRaw != null && String(giroRaw).trim() !== '') {
        base.giroActividad = String(giroRaw).trim();
      }
      const vigRaw =
        it['vigenciaHasta'] ??
        it['fechaFinContrato'] ??
        it['fechaFinVigencia'] ??
        it['finContrato'] ??
        it['vigenciaFin'];
      if (vigRaw != null && String(vigRaw).trim() !== '') {
        base.vigenciaHasta = String(vigRaw).trim();
      }
      return base;
    });

    const zonaSet = new Set<string>();
    mappedLocales.forEach((l) => {
      if (l.zonaId) zonaSet.add(l.zonaId);
    });
    const zonas: ZonaCanvasModel[] = Array.from(zonaSet).map((zonaId, i) => ({
      id: zonaId,
      nombre: this.nombreNivelPlantaPorIndice(i),
      x: 30 + i * 300,
      y: 35,
      width: 270,
      height: 670,
    }));

    return {
      canvas: { width: 1200, height: 760 },
      zonas,
      locales: mappedLocales,
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
    const panelWidth = Math.max(320, board?.clientWidth ?? 860);
    const panelHeight = Math.max(260, board?.clientHeight ?? 640);
    const bounds = this.getDiagramContentBounds();
    const contentWidth = Math.max(1, bounds.width);
    const contentHeight = Math.max(1, bounds.height);
    const fitX = panelWidth / contentWidth;
    const fitY = panelHeight / contentHeight;
    this.zoom = Math.max(
      this.layoutConfig.minZoom,
      Math.min(this.layoutConfig.maxZoom, Math.min(fitX, fitY))
    );
    const contentCenterX = bounds.x + bounds.width / 2;
    const contentCenterY = bounds.y + bounds.height / 2;
    this.pan = {
      x: Math.round(panelWidth / 2 - contentCenterX * this.zoom),
      y: Math.round(panelHeight / 2 - contentCenterY * this.zoom),
    };
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
      if (!local.zonaId) {
        errors.push(`El local ${local.nombre} debe pertenecer a una zona.`);
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

    this.uiState = { ...this.uiState, saving: true, error: null };
    const payload = this.serializeLayout();
    Promise.resolve(payload)
      .then(() => {
        this.lastSavedLayoutSerialized = payload;
        this.uiState = { ...this.uiState, saving: false, dirty: false };
        this.toastr.success('Layout de locales guardado correctamente.');
      })
      .catch(() => {
        this.uiState = {
          ...this.uiState,
          saving: false,
          error: 'No fue posible guardar el layout. Intente de nuevo.',
        };
        this.toastr.error('No fue posible guardar el layout. Intente de nuevo.');
      });
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

  addZona(): void {
    this.showLocalNameEditor = false;
    this.zoneNameDraft = '';
    this.showZoneNameEditor = true;
    this.isRenamingZone = false;
  }

  confirmAddZona(): void {
    const zoneName = this.zoneNameDraft.trim();
    if (!zoneName) {
      this.uiState = {
        ...this.uiState,
        error: 'Indique el nombre del nivel o planta (ej. Planta baja, Piso 1).',
      };
      return;
    }
    const idx = this.visualLayout.zonas.length + 1;
    const position = this.findAvailableZonePosition(260, 180);
    if (!position) {
      this.uiState = {
        ...this.uiState,
        error: 'No hay espacio libre para agregar otra zona sin solapamiento.',
      };
      return;
    }
    const zona: ZonaCanvasModel = {
      id: `zona-${Date.now()}`,
      nombre: zoneName,
      x: position.x,
      y: position.y,
      width: 260,
      height: 180,
    };
    this.visualLayout = {
      ...this.visualLayout,
      zonas: [...this.visualLayout.zonas, zona],
    };
    this.selectedZoneId = zona.id;
    this.showZoneNameEditor = false;
    this.isRenamingZone = false;
    this.zoneNameDraft = '';
    this.uiState = { ...this.uiState, error: null };
    this.detectDirtyChanges();
  }

  cancelAddZona(): void {
    this.showZoneNameEditor = false;
    this.isRenamingZone = false;
    this.zoneNameDraft = '';
  }

  addLocal(): void {
    this.showZoneNameEditor = false;
    this.localNameDraft = '';
    this.showLocalNameEditor = true;
  }

  confirmAddLocal(): void {
    const localName = this.localNameDraft.trim();
    if (!localName) {
      this.uiState = { ...this.uiState, error: 'Debe capturar el nombre del local.' };
      return;
    }
    const idx = this.visualLayout.locales.length + 1;
    const targetZona = this.visualLayout.zonas.find((z) => z.id === this.selectedZoneId);
    const local: LocalCanvasModel = {
      id: `local-${Date.now()}`,
      nombre: localName || `Local ${idx}`,
      x: targetZona ? targetZona.x + 20 : 100,
      y: targetZona ? targetZona.y + 20 : 100,
      width: 98,
      height: 78,
      zonaId: targetZona?.id ?? null,
      estado: 'libre',
      bloqueado: false,
    };
    this.visualLayout = {
      ...this.visualLayout,
      locales: [...this.visualLayout.locales, local],
    };
    this.selectLocal(local.id);
    this.showLocalNameEditor = false;
    this.localNameDraft = '';
    this.uiState = { ...this.uiState, error: null };
    this.detectDirtyChanges();
  }

  cancelAddLocal(): void {
    this.showLocalNameEditor = false;
    this.localNameDraft = '';
  }

  closeInlineEditors(): void {
    this.cancelAddZona();
    this.cancelAddLocal();
  }

  renameZona(zona: ZonaCanvasModel): void {
    this.showLocalNameEditor = false;
    this.showZoneNameEditor = true;
    this.isRenamingZone = true;
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
    this.showZoneNameEditor = false;
    this.isRenamingZone = false;
    this.zoneNameDraft = '';
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
    const value = String(raw ?? '').toLowerCase();
    if (value === 'ocupado' || value === 'reservado' || value === 'inactivo') return value;
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

  private findAvailableZonePosition(width: number, height: number): CanvasPoint | null {
    const step = this.layoutConfig.gridSize;
    const maxX = this.visualLayout.canvas.width - width;
    const maxY = this.visualLayout.canvas.height - height;
    for (let y = 20; y <= maxY; y += step) {
      for (let x = 20; x <= maxX; x += step) {
        const candidate = { x, y, width, height };
        const overlapsZona = this.visualLayout.zonas.some((z) =>
          this.hasZoneOverlap(candidate, z)
        );
        if (!overlapsZona) return { x, y };
      }
    }
    return null;
  }

  private hasZoneOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ): boolean {
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
    const padding = 48;
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: Math.min(this.visualLayout.canvas.width, maxX + padding) - Math.max(0, minX - padding),
      height: Math.min(this.visualLayout.canvas.height, maxY + padding) - Math.max(0, minY - padding),
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
    const minSize = 120;

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

    nextX = Math.max(0, Math.min(nextX, this.visualLayout.canvas.width - minSize));
    nextY = Math.max(0, Math.min(nextY, this.visualLayout.canvas.height - minSize));
    nextW = Math.min(nextW, this.visualLayout.canvas.width - nextX);
    nextH = Math.min(nextH, this.visualLayout.canvas.height - nextY);

    this.visualLayout = {
      ...this.visualLayout,
      zonas: this.visualLayout.zonas.map((z) =>
        z.id === state.zonaId
          ? { ...z, x: nextX, y: nextY, width: nextW, height: nextH }
          : z
      ),
    };
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

    const ins = this.selectedCentral?.instalaciones?.[index];
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
        infoCard?.addEventListener('mouseenter', () => {
          this.isHoveringInfoWindow = true;
          this.cancelHoverClose();
        });
        infoCard?.addEventListener('mouseleave', () => {
          this.isHoveringInfoWindow = false;
          this.scheduleHoverClose(marker);
        });
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

  onInfoAction(payload: any) {
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
    if (esVistaLocal && Number.isFinite(idContratoNum) && idContratoNum > 0) {
      qp['idContrato'] = idContratoNum;
    }
    const parentId =
      payload?.parentInmuebleId ??
      ins?.id ??
      ins?.idInstalacion ??
      ins?.idDepartamento ??
      ins?.idInstalacionDepartamento;
    if (esVistaLocal && parentId != null && String(parentId).trim() !== '') {
      qp['idInmueble'] = String(parentId).trim();
    }
    const central = payload?.central;
    const idCli = central?.idCliente ?? central?.id;
    if (idCli != null && String(idCli).trim() !== '') {
      qp['idCliente'] = String(idCli).trim();
    }
    this.router.navigate(
      ['/monitoreo', 'instalacion', numeroSerie || this.PREVIEW_SERIE],
      { queryParams: qp },
    );
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

  private static iwStylesInstalled = false;

  private installInfoWindowSkin(): void {
    if (MonitoreoComponent.iwStylesInstalled) return;
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
      .gm-style-iw-d { padding: 0 !important; overflow: visible !important; }
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
    `;
    const style = document.createElement('style');
    style.setAttribute('data-iw-skin', 'true');
    style.textContent = css;
    document.head.appendChild(style);
    MonitoreoComponent.iwStylesInstalled = true;
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
    const nom = this.escapeHtml(
      String(
        inmueble?.nombreDepartamento ??
          inmueble?.nombreInstalacion ??
          'Inmueble'
      )
    );
    return `
    <div class="iw-card iw-enter" style="
      background:#151f35; color:#e5e7eb;
      padding:0px 18px 16px;
      border-radius:12px; min-width:240px; max-width:300px; line-height:1.25rem;
      box-shadow:0 12px 28px rgba(0,0,0,.20);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px;">
        <h6 style="margin:0;font-size:1rem;color:#fff;">${nom}</h6>
        <button class="iw-close" aria-label="Cerrar" style="background:transparent;border:0;cursor:pointer;color:#fff;font-size:18px;line-height:1;width:28px;height:28px;border-radius:8px;">✕</button>
      </div>
      <p style="margin:0;font-size:.85rem;color:#c6cfde;">Ubicación del inmueble.</p>
    </div>
    `;
  }

  private buildInfoHtmlLocal(local: any, _index: number): string {
    const nom = this.escapeHtml(this.getNombreLocalEnLista(local));
    const nivel = this.getNombreNivelEnDiagramaParaLocal(local);
    const nivelHtml = nivel
      ? `<div><strong>Nivel:</strong> ${this.escapeHtml(nivel)}</div>`
      : '';
    const est = this.escapeHtml(this.getOcupacionEtiquetaLista(local));
    const occ = this.getOcupanteLocalLista(local);
    const occHtml = occ
      ? `<div><strong>Ocupante:</strong> ${this.escapeHtml(occ)}</div>`
      : '';
    const med = this.getMedidaLocalLista(local);
    const medHtml = med
      ? `<div><strong>Medida:</strong> ${this.escapeHtml(med)}</div>`
      : '';
    const men = this.getMensualidadLocalLista(local);
    const menHtml = men
      ? `<div><strong>Mensualidad:</strong> ${this.escapeHtml(men)}</div>`
      : '';
    return `
    <div class="iw-card iw-enter" style="
      background:#151f35; color:#e5e7eb;
      padding:0px 18px 16px;
      border-radius:12px; min-width:260px; max-width:320px; line-height:1.25rem;
      box-shadow:0 12px 28px rgba(0,0,0,.20);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px;">
        <h6 style="margin:0;font-size:1rem;color:#fff;">${nom}</h6>
        <button class="iw-close" aria-label="Cerrar" style="background:transparent;border:0;cursor:pointer;color:#fff;font-size:18px;line-height:1;width:28px;height:28px;border-radius:8px;">✕</button>
      </div>
      <hr style="border:none;height:1px;background:rgba(255,255,255,.10);margin:6px 0;" />
      <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:.85rem;color:#c6cfde;">
        <div><strong>Estado:</strong> ${est}</div>
        ${nivelHtml}
        ${occHtml}
        ${medHtml}
        ${menHtml}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px;">
        <button class="iw-action" style="
          background:#681330; color:#fff; border:0; cursor:pointer;
          border-radius:10px; padding:8px 12px; font-size:.85rem;
        ">
          Información
        </button>
      </div>
    </div>
  `;
  }

  private buildInfoHtmlInstalacion(c: any, ins: any): string {
    const estatusOk = Number(ins?.estatus) === 1;

    const numeroSerie = ins?.equipo?.numeroSerie ?? ins?.numeroSerie ?? '—';

    const fhRegFmt = this.formatDate(ins?.fhRegistro);
    const fhActFmt = this.formatDate(ins?.fechaActualizacion);
    const direccion = c?.direccion ?? '—';

    const nroPisoHtml = (ins?.nroPiso !== null && ins?.nroPiso !== undefined) 
      ? `<div><strong>Número de Piso:</strong> ${ins.nroPiso}</div>` 
      : '';
    const nombreDepartamentoHtml = ins?.nombreDepartamento 
      ? `<div><strong>Departamento:</strong> ${ins.nombreDepartamento}</div>` 
      : '';

    return `
    <div class="iw-card iw-enter" style="
      background:#151f35; color:#e5e7eb;
      padding:0px 18px 16px;
      border-radius:12px; min-width:260px; max-width:320px; line-height:1.25rem;
      box-shadow:0 12px 28px rgba(0,0,0,.20);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px;">
        <h6 style="margin:0;font-size:1rem;color:#fff;">Equipo: ${numeroSerie}</h6>
        <button class="iw-close" aria-label="Cerrar" style="background:transparent;border:0;cursor:pointer;color:#fff;font-size:18px;line-height:1;width:28px;height:28px;border-radius:8px;">✕</button>
      </div>
      <hr style="border:none;height:1px;background:rgba(255,255,255,.10);margin:6px 0;" />
      <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:.85rem;color:#c6cfde;">
        ${nroPisoHtml}
        ${nombreDepartamentoHtml}
        <div><strong>Arrendador:</strong> ${c?.nombreCliente ?? '—'}</div>
        <div>
          <strong>Estatus:</strong>
          <span style="
            display:inline-block;padding:2px 8px;margin-left:6px;border-radius:999px;
            background:${estatusOk ? '#16a34a' : '#ef4444'}; color:#fff; font-size:.78rem;">
            ${estatusOk ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div><strong>Registro:</strong> ${fhRegFmt}</div>
        <div><strong>Actualización:</strong> ${fhActFmt}</div>
      </div>
      <div style="display:flex;gap:.5rem;align-items:flex-start;color:#c6cfde;margin-top:8px;">
        <span style="margin-top:4px;width:8px;height:8px;border-radius:999px;background:#681330;display:inline-block;flex:0 0 8px;"></span>
        <span>${direccion}</span>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px;">
        <button class="iw-action" style="
          background:#681330; color:#fff; border:0; cursor:pointer;
          border-radius:10px; padding:8px 12px; font-size:.85rem;
        ">
          Información
        </button>
      </div>
    </div>
  `;
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