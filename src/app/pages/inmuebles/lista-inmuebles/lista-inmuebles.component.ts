import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent, DxPieChartComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { InmueblesService } from 'src/app/services/moduleService/inmuebles.service';
import { InmuebleGridRow, mapInmueblesApiToGridRows } from '../inmuebles-list.mapper';

interface LocalOcupacionProcesado {
  id: string;
  nombre: string;
  area: number;
  porcentaje: number;
  color: string;
  arrendatario: string;
  zona: string;
}

interface OcupacionInmuebleData {
  totalM2: number;
  localesRentados: unknown[];
}

interface DonaSlice {
  nombre: string;
  area: number;
  porcentaje: number;
  color: string;
  arrendatario?: string;
  esDisponible?: boolean;
}

const COLORES_LOCALES = [
  '#3b82f6', '#a855f7', '#f97316', '#ec4899',
  '#06b6d4', '#eab308', '#6366f1', '#14b8a6',
  '#ef4444', '#84cc16', '#d946ef', '#0ea5e9',
];

@Component({
  selector: 'app-lista-inmuebles',
  templateUrl: './lista-inmuebles.component.html',
  styleUrl: './lista-inmuebles.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaInmueblesComponent implements OnInit {
  public listaInmuebles: any;
  public showFilterRow = true;
  public showHeaderFilter = true;
  public loading = false;
  public paginaActual = 1;
  public totalRegistros = 0;
  public pageSize = 20;
  public totalPaginas = 0;
  public paginaActualData: InmuebleGridRow[] = [];
  public filtroActivo = '';
  public mensajeAgrupar = 'Arrastre un encabezado de columna aquí para agrupar por dicha columna';

  mostrarModalMapa = false;
  mapaTitulo = '';
  private mapaLat: number | null = null;
  private mapaLng: number | null = null;
  private map: unknown = null;
  private marker: unknown = null;

  mostrarModalLugar  = false;
  lugarTitulo        = '';
  lugarCargando      = false;
  private lugarData: OcupacionInmuebleData | null = null;

  // ─── Dona ────────────────────────────────────────────────────────────────────
  donaData: DonaSlice[] = [];
  localGraficaHover: string | null = null;
  // ─────────────────────────────────────────────────────────────────────────────

  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';
  private readonly pinUrl = 'assets/images/logos/marker_spring.webp';

  @ViewChild('gridContainer', { static: false })
  dataGrid!: DxDataGridComponent;

  @ViewChild('pieOcupacion', { static: false })
  pieOcupacion?: DxPieChartComponent;

  constructor(
    private router: Router,
    private inmueblesService: InmueblesService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.setupDataSource();
  }

  agregarInmueble(): void {
    void this.router.navigateByUrl('/inmuebles/agregar-inmueble');
  }

  editarInmueble(row: InmuebleGridRow): void {
    void this.router.navigate(['/inmuebles/editar-inmueble', row.id]);
  }

  recargarInmueblesPaginated(): void {
    const grid = this.dataGrid?.instance;
    if (!grid) return;
    if (this.filtroActivo) {
      grid.option('dataSource', this.listaInmuebles);
      this.filtroActivo = '';
      grid.option('searchPanel.text', '');
    }
    grid.refresh();
  }

  onPageIndexChanged(e: any): void {
    this.paginaActual = e.component.pageIndex() + 1;
    e.component.refresh();
  }

  setupDataSource(): void {
    this.loading = true;
    this.listaInmuebles = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp: any = await lastValueFrom(
            this.inmueblesService.obtenerInmueblesData(page, take),
          );
          this.loading = false;
          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros = toNum(meta.total) ?? toNum(resp?.total) ?? rows.length;
          const paginaActual   = toNum(meta.page)  ?? toNum(resp?.page)  ?? page;
          const totalPaginas   = toNum(meta.lastPage) ?? toNum(resp?.pages) ?? Math.max(1, Math.ceil(totalRegistros / take));
          const dataTransformada = mapInmueblesApiToGridRows(rows);
          this.totalRegistros  = totalRegistros;
          this.paginaActual    = paginaActual;
          this.totalPaginas    = totalPaginas;
          this.paginaActualData = dataTransformada;
          return { data: dataTransformada, totalCount: totalRegistros };
        } catch (err) {
          this.loading = false;
          console.error('Error en la solicitud de datos:', err);
          return { data: [], totalCount: 0 };
        }
      },
    });
    function toNum(v: any): number | null {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
  }

  onGridOptionChanged(e: any): void {
    if (e.fullName !== 'searchPanel.text') return;
    const grid  = this.dataGrid?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaInmuebles);
      return;
    }
    this.filtroActivo = texto;
    let columnas: any[] = [];
    try {
      const colsOpt = grid?.option('columns');
      if (Array.isArray(colsOpt) && colsOpt.length) columnas = colsOpt;
    } catch { /* noop */ }
    if (!columnas.length && grid?.getVisibleColumns) columnas = grid.getVisibleColumns();
    const dataFields: string[] = columnas
      .map((c: any) => c?.dataField)
      .filter((df: any) => typeof df === 'string' && df.trim().length > 0);
    const normalizar = (val: any): string =>
      val === null || val === undefined ? '' : String(val).toLowerCase();
    const dataFiltrada = (this.paginaActualData || []).filter((row: InmuebleGridRow) => {
      const hitEnColumnas = dataFields.some((df) => normalizar((row as any)?.[df]).includes(texto));
      const extras = [
        normalizar(row.inmueble), normalizar(row.direccionFiscal),
        normalizar(row.arrendadorNombre), normalizar(row.representanteNombre),
        normalizar(row.estatusLabel),
      ];
      return hitEnColumnas || extras.some((s) => s.includes(texto));
    });
    grid?.option('dataSource', dataFiltrada);
  }

  formatoMoneda(e: any) {
    if (!e.value) return '$0.00';
    return '$' + Number(e.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  limpiarVista(): void {
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    inst.clearFilter();
    inst.clearGrouping();
    inst.pageIndex(0);
    inst.option('searchPanel.text', '');
    this.filtroActivo = '';
    inst.option('dataSource', this.listaInmuebles);
    inst.refresh();
  }

  verMapaDesdeDetalle(row: InmuebleGridRow): void {
    if (row.lat == null || row.lng == null) return;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    this.mapaTitulo = row.inmueble;
    this.mapaLat = lat;
    this.mapaLng = lng;
    this.mostrarModalMapa = true;
    setTimeout(() => {
      this.loadGoogleMaps()
        .then(() => this.initMapaListaModal())
        .catch((err) => console.error('No se pudo cargar Google Maps', err));
    }, 0);
  }

  verLugarInmueble(row: InmuebleGridRow): void {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    this.lugarTitulo  = row.inmueble ?? `Inmueble #${id}`;
    this.lugarData    = null;
    this.donaData     = [];
    this.lugarCargando = true;
    this.localGraficaHover = null;
    this.mostrarModalLugar = true;

    this.inmueblesService.obtenerMetrosInmueble(Math.floor(id))
      .pipe(take(1))
      .subscribe({
        next: (res: unknown) => {
          this.lugarData  = this.normalizarOcupacionApi(res);
          this.donaData   = this.construirDonaData();
          this.lugarCargando = false;
          this.refrescarGraficaOcupacion();
        },
        error: () => {
          this.lugarCargando = false;
        },
      });
  }

  cerrarModalLugar(): void {
    this.mostrarModalLugar = false;
    this.lugarTitulo   = '';
    this.lugarData     = null;
    this.donaData      = [];
    this.lugarCargando = false;
    this.localGraficaHover = null;
  }

  // ─── Getters para el template ─────────────────────────────────────────────

  get data(): OcupacionInmuebleData | null { return this.lugarData; }

  get totalM2(): number { return this.lugarData?.totalM2 ?? 0; }

  get localesProcesados(): LocalOcupacionProcesado[] {
    const total = this.totalM2;
    const items = Array.isArray(this.lugarData?.localesRentados) ? this.lugarData!.localesRentados : [];
    return items.map((raw, index) => {
      const area      = this.areaLocalDesdeApi(raw);
      const porcentaje = total > 0 ? (area / total) * 100 : 0;
      return {
        id:           `local-${index}`,
        nombre:       this.nombreLocalDesdeApi(raw, index),
        area,
        porcentaje,
        color:        COLORES_LOCALES[index % COLORES_LOCALES.length],
        arrendatario: this.arrendatarioLocalDesdeApi(raw),
        zona:         this.zonaLocalDesdeApi(raw),
      };
    });
  }

  get m2Ocupados(): number    { return this.localesProcesados.reduce((s, l) => s + l.area, 0); }
  get m2Disponibles(): number { return Math.max(0, this.totalM2 - this.m2Ocupados); }
  get porcentajeOcupado(): number    { return this.totalM2 > 0 ? (this.m2Ocupados    / this.totalM2) * 100 : 0; }
  get porcentajeDisponible(): number { return this.totalM2 > 0 ? (this.m2Disponibles / this.totalM2) * 100 : 0; }

  // ─── Dona ─────────────────────────────────────────────────────────────────

  private construirDonaData(): DonaSlice[] {
    const slices: DonaSlice[] = this.localesProcesados.map(l => ({
      nombre:       l.nombre,
      area:         l.area,
      porcentaje:   l.porcentaje,
      color:        l.color,
      arrendatario: l.arrendatario,
    }));

    if (this.m2Disponibles > 0) {
      slices.push({
        nombre:       'Disponible',
        area:         this.m2Disponibles,
        porcentaje:   this.porcentajeDisponible,
        color:        '#22c55e',
        esDisponible: true,
      });
    }

    return slices;
  }

  customizarPuntoDona = (pointInfo: {
    argument?: string;
    data?: DonaSlice;
  }): Record<string, unknown> => {
    const color  = pointInfo?.data?.color ?? '#888';
    const nombre = String(pointInfo?.data?.nombre ?? pointInfo?.argument ?? '');
    const hover  = this.localGraficaHover;

    if (!hover) {
      return { color };
    }

    if (nombre === hover) {
      return {
        color,
        border: {
          visible: true,
          width: 3,
          color: 'rgba(255, 255, 255, 0.95)',
        },
      };
    }

    return {
      color: this.atenuarColorGrafica(color, 0.22),
      border: { visible: false },
    };
  };

  customizarTooltipDona = (info: {
    argumentText?: string;
    point?: { data?: DonaSlice };
  }): { text: string } => {
    const data       = info.point?.data;
    const area       = Number(data?.area ?? 0);
    const porcentaje = Number(data?.porcentaje ?? 0);
    const lineas     = [
      String(info.argumentText ?? ''),
      `${area.toLocaleString('es-MX')} m²  ·  ${porcentaje.toFixed(1)}%`,
    ];

    if (data?.esDisponible) {
      lineas.push('Sin arrendatario asignado');
    } else if (data?.arrendatario && data.arrendatario !== '—') {
      lineas.push(`Arrendatario: ${data.arrendatario}`);
    }

    return { text: lineas.join('\n') };
  };

  customizarLabelDona = (info: { point?: { data?: DonaSlice } }): string => {
    const porcentaje = Number(info.point?.data?.porcentaje ?? 0);
    return `${Math.round(porcentaje)}%`;
  };

  resaltarGraficaLocal(nombre: string | null): void {
    if (this.localGraficaHover === nombre) return;
    this.localGraficaHover = nombre;
    this.aplicarResaltadoGrafica();
  }

  private aplicarResaltadoGrafica(): void {
    setTimeout(() => {
      const inst = this.pieOcupacion?.instance as {
        render?: () => void;
        getAllSeries?: () => Array<{
          getAllPoints?: () => Array<{
            argument?: string;
            showTooltip?: () => void;
            hideTooltip?: () => void;
          }>;
        }>;
      } | undefined;

      if (!inst?.render) return;
      inst.render();

      const puntos = inst.getAllSeries?.()?.[0]?.getAllPoints?.() ?? [];
      puntos.forEach((punto) => {
        const arg = String(punto.argument ?? '');
        if (this.localGraficaHover && arg === this.localGraficaHover) {
          punto.showTooltip?.();
        } else {
          punto.hideTooltip?.();
        }
      });
    }, 0);
  }

  private atenuarColorGrafica(color: string, alpha: number): string {
    const hex = color.trim();
    if (hex.startsWith('#') && hex.length >= 7) {
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      if ([r, g, b].every((n) => Number.isFinite(n))) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    return color;
  }

  private refrescarGraficaOcupacion(): void {
    this.cdr.detectChanges();
    setTimeout(() => {
      const inst = this.pieOcupacion?.instance;
      if (!inst) return;
      inst.render();
    }, 0);
  }

  // ─── Helpers API ──────────────────────────────────────────────────────────

  private normalizarOcupacionApi(res: unknown): OcupacionInmuebleData {
    const body = res != null && typeof res === 'object' && 'data' in (res as object)
      ? (res as { data?: unknown }).data : res;
    const raw        = (body ?? {}) as Record<string, unknown>;
    const totalM2    = Number(raw['totalM2'] ?? raw['total_m2'] ?? 0);
    const localesRentados = Array.isArray(raw['localesRentados'])
      ? raw['localesRentados']
      : Array.isArray(raw['locales_rentados']) ? raw['locales_rentados'] : [];
    return { totalM2: Number.isFinite(totalM2) ? totalM2 : 0, localesRentados };
  }

  private areaLocalDesdeApi(raw: unknown): number {
    if (raw == null || typeof raw !== 'object') return 0;
    const item = raw as Record<string, unknown>;
    const area = Number(item['areaM2'] ?? item['area_m2'] ?? item['area'] ?? item['metros'] ?? item['m2'] ?? 0);
    return Number.isFinite(area) && area > 0 ? area : 0;
  }

  private nombreLocalDesdeApi(raw: unknown, index: number): string {
    if (raw == null || typeof raw !== 'object') return `Local ${index + 1}`;
    const item   = raw as Record<string, unknown>;
    const nombre = String(item['nombre'] ?? item['local'] ?? '').trim();
    return nombre || `Local ${index + 1}`;
  }

  private arrendatarioLocalDesdeApi(raw: unknown): string {
    if (raw == null || typeof raw !== 'object') return '—';
    const item = raw as Record<string, unknown>;
    const nombre = String(
      item['nombreArrendador'] ?? item['nombre_arrendador'] ??
      item['nombreArrendatario'] ?? item['nombre_arrendatario'] ??
      item['arrendatario'] ?? '',
    ).trim();
    return nombre || '—';
  }

  private zonaLocalDesdeApi(raw: unknown): string {
    if (raw == null || typeof raw !== 'object') return '';
    const item = raw as Record<string, unknown>;
    return String(item['zonaPrincipal'] ?? item['zona_principal'] ?? item['zona'] ?? '').trim();
  }

  // ─── Mapa ─────────────────────────────────────────────────────────────────

  cerrarModalMapa(): void {
    this.limpiarMapaListaModal();
    this.mostrarModalMapa = false;
    this.mapaTitulo = '';
    this.mapaLat = null;
    this.mapaLng = null;
  }

  private limpiarMapaListaModal(): void {
    const marker = this.marker as { setMap?: (m: null) => void } | null;
    if (marker?.setMap) marker.setMap(null);
    this.marker = null;
    this.map    = null;
  }

  private loadGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as Window & { google?: { maps?: unknown } };
      if (w.google?.maps) { resolve(); return; }
      const existingScript = document.querySelector('script[data-gmaps="true"]');
      if (existingScript) {
        existingScript.addEventListener('load',  () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }
      const script = document.createElement('script');
      script.src  = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', 'true');
      script.onload  = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  private initMapaListaModal(): void {
    if (this.mapaLat == null || this.mapaLng == null) return;
    const el = document.getElementById('mapListaInmueble');
    if (!el) return;
    const w = window as Window & {
      google?: {
        maps: {
          Map:    new (node: HTMLElement, opts: object) => unknown;
          Marker: new (opts: object) => { setMap?: (m: unknown) => void };
          Size:   new (w: number, h: number) => unknown;
          Point:  new (x: number, y: number) => unknown;
        };
      };
    };
    if (!w.google?.maps) return;
    const g   = w.google.maps;
    const lat = this.mapaLat;
    const lng = this.mapaLng;
    this.limpiarMapaListaModal();
    el.innerHTML = '';
    this.map = new g.Map(el, { center: { lat, lng }, zoom: 16, mapTypeControl: true, streetViewControl: true, fullscreenControl: true });
    this.marker = new g.Marker({
      position: { lat, lng },
      map: this.map,
      icon: { url: this.pinUrl, scaledSize: new g.Size(70, 70), anchor: new g.Point(35, 70) },
    });
  }
}