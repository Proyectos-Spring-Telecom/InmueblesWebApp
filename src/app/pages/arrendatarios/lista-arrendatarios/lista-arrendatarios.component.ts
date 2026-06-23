import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent, DxPieChartComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import {
  ArrendatarioGridRow,
  mapArrendatariosApiToGridRows,
} from '../arrendatarios-list.mapper';
import {
  ArrendatarioDashboardData,
  construirGraficaMensualidadLocales,
  construirGraficaPagosConcepto,
  construirGraficaRentaEstado,
  DashboardMensualidadLocalBar,
  DashboardPagoConceptoBar,
  DashboardRentaEstadoSlice,
  etiquetaMes,
  formatearFecha,
  formatearMoneda,
  normalizarDashboardArrendatario,
} from '../arrendatario-dashboard.mapper';

@Component({
  selector: 'app-lista-arrendatarios',
  templateUrl: './lista-arrendatarios.component.html',
  styleUrl: './lista-arrendatarios.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaArrendatariosComponent implements OnInit {
  /** ``CustomStore`` remoto (paridad ``lista-inmuebles``). */
  public listaArrendatarios: InstanceType<typeof CustomStore>;
  public showFilterRow = true;
  public showHeaderFilter = true;
  public loading = false;
  public paginaActual = 1;
  public totalRegistros = 0;
  public pageSize = 20;
  public totalPaginas = 0;
  public paginaActualData: ArrendatarioGridRow[] = [];
  public filtroActivo = '';
  public mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por dicha columna';

  mostrarModalMapa = false;
  mapaTitulo = '';
  private mapaLat: number | null = null;
  private mapaLng: number | null = null;
  private map: unknown = null;
  private marker: unknown = null;
  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';
  private readonly pinUrl = 'assets/images/logos/marker_spring.webp';

  mostrarModalDashboard = false;
  dashboardTitulo = '';
  dashboardCargando = false;
  private dashboardData: ArrendatarioDashboardData | null = null;
  dashboardRentaEstadoData: DashboardRentaEstadoSlice[] = [];
  dashboardMensualidadData: DashboardMensualidadLocalBar[] = [];
  dashboardPagosData: DashboardPagoConceptoBar[] = [];

  formatearFecha = formatearFecha;
  formatearMoneda = formatearMoneda;
  etiquetaMes = etiquetaMes;

  @ViewChild('pieDashboardRentaEstado', { static: false })
  pieDashboardRentaEstado?: DxPieChartComponent;

  @ViewChild('chartDashboardMensualidad', { static: false })
  chartDashboardMensualidad?: { instance?: { render?: () => void } };

  @ViewChild('chartDashboardPagos', { static: false })
  chartDashboardPagos?: { instance?: { render?: () => void } };

  constructor(
    private router: Router,
    private arrendatariosService: ArrendatariosService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.setupDataSource();
  }

  agregarArrendatario(): void {
    void this.router.navigateByUrl('/arrendatarios/agregar-arrendatario');
  }

  editarArrendatario(row: ArrendatarioGridRow): void {
    void this.router.navigate(['/arrendatarios/editar-arrendatario', row.id]);
  }

  onPageIndexChanged(e: any): void {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  setupDataSource(): void {
    this.loading = true;

    this.listaArrendatarios = new CustomStore({
      key: 'id',
      load: async (loadOptions: { take?: number; skip?: number }) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp = (await lastValueFrom(
            this.arrendatariosService.obtenerArrendatariosPaginated(page, take),
          )) as Record<string, unknown>;
          this.loading = false;
          const rowsRaw = resp?.['data'];
          const rows: unknown[] = Array.isArray(rowsRaw) ? rowsRaw : [];
          const meta =
            resp?.['paginated'] != null && typeof resp['paginated'] === 'object'
              ? (resp['paginated'] as Record<string, unknown>)
              : {};
          const totalRegistros =
            toNum(meta['total']) ?? toNum(resp?.['total']) ?? rows.length;
          const paginaActual = toNum(meta['page']) ?? toNum(resp?.['page']) ?? page;
          const totalPaginas =
            toNum(meta['lastPage']) ??
            toNum(resp?.['pages']) ??
            Math.max(1, Math.ceil(totalRegistros / take));

          const dataTransformada = mapArrendatariosApiToGridRows(rows);

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginas;
          this.paginaActualData = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros,
          };
        } catch (err) {
          this.loading = false;
          console.error('Error en la solicitud de arrendatarios:', err);
          return { data: [], totalCount: 0 };
        }
      },
    });

    function toNum(v: unknown): number | null {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
  }

  onGridOptionChanged(e: any): void {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGrid?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaArrendatarios);
      return;
    }
    this.filtroActivo = texto;
    let columnas: { dataField?: string }[] = [];
    try {
      const colsOpt = grid?.option('columns') as unknown;
      if (Array.isArray(colsOpt) && colsOpt.length) columnas = colsOpt as { dataField?: string }[];
    } catch {
      /* noop */
    }
    if (!columnas.length && grid?.getVisibleColumns) {
      columnas = grid.getVisibleColumns() as { dataField?: string }[];
    }
    const dataFields: string[] = columnas
      .map((c) => c?.dataField)
      .filter((df): df is string => typeof df === 'string' && df.trim().length > 0);

    const normalizar = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      return String(val).toLowerCase();
    };

    const dataFiltrada = (this.paginaActualData || []).filter((row: ArrendatarioGridRow) => {
      const hitEnColumnas = dataFields.some((df) =>
        normalizar((row as unknown as Record<string, unknown>)?.[df]).includes(texto),
      );
      const extras = [
        normalizar(row.etiquetaBusqueda),
        normalizar(row.arrendatario),
        normalizar(row.rfc),
        normalizar(row.arrendadorNombre),
        normalizar(row.inmuebleVinculado),
        normalizar(row.direccionInmuebleVinculado),
        normalizar(row.estatusLabel),
        normalizar(row.representanteNombre),
      ];
      return hitEnColumnas || extras.some((s) => s.includes(texto));
    });
    grid?.option('dataSource', dataFiltrada);
  }

  refrescarListaArrendatarios(): void {
    this.dataGrid?.instance?.refresh();
  }

  limpiarVista(): void {
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    inst.clearFilter();
    inst.clearGrouping();
    inst.pageIndex(0);
    inst.option('searchPanel.text', '');
    this.filtroActivo = '';
    inst.option('dataSource', this.listaArrendatarios);
    inst.refresh();
  }

  verMapaDesdeDetalle(row: ArrendatarioGridRow): void {
    if (row.lat == null || row.lng == null) return;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const nombre =
      String(row.arrendatario ?? row.detalle?.['arrendatario'] ?? row.detalle?.['nombre'] ?? '').trim();
    this.mapaTitulo = nombre || `Arrendatario #${row.id}`;
    this.mapaLat = lat;
    this.mapaLng = lng;
    this.mostrarModalMapa = true;

    setTimeout(() => {
      this.loadGoogleMaps()
        .then(() => this.initMapaListaModal())
        .catch((err) => console.error('No se pudo cargar Google Maps', err));
    }, 0);
  }

  cerrarModalMapa(): void {
    this.limpiarMapaListaModal();
    this.mostrarModalMapa = false;
    this.mapaTitulo = '';
    this.mapaLat = null;
    this.mapaLng = null;
  }

  verDashboardArrendatario(row: ArrendatarioGridRow): void {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    this.dashboardTitulo = row.arrendatario ?? `Arrendatario #${id}`;
    this.dashboardData = null;
    this.dashboardRentaEstadoData = [];
    this.dashboardMensualidadData = [];
    this.dashboardPagosData = [];
    this.dashboardCargando = true;
    this.mostrarModalDashboard = true;

    const { fechaInicio, fechaFin } = this.rangoFechasDashboard();
    this.arrendatariosService.obtenerDashboardArrendatario(Math.floor(id), fechaInicio, fechaFin)
      .pipe(take(1))
      .subscribe({
        next: (res: unknown) => {
          this.dashboardData = normalizarDashboardArrendatario(res);
          this.dashboardRentaEstadoData = construirGraficaRentaEstado(
            this.dashboardData?.resumen ?? null,
          );
          this.dashboardMensualidadData = construirGraficaMensualidadLocales(
            this.dashboardData?.locales ?? [],
          );
          this.dashboardPagosData = construirGraficaPagosConcepto(
            this.dashboardData?.pagos ?? [],
          );
          if (this.dashboardData?.arrendatario?.nombre) {
            this.dashboardTitulo = this.dashboardData.arrendatario.nombre;
          }
          this.dashboardCargando = false;
          this.refrescarGraficasDashboard();
        },
        error: () => {
          this.dashboardCargando = false;
        },
      });
  }

  cerrarModalDashboard(): void {
    this.mostrarModalDashboard = false;
    this.dashboardTitulo = '';
    this.dashboardData = null;
    this.dashboardRentaEstadoData = [];
    this.dashboardMensualidadData = [];
    this.dashboardPagosData = [];
    this.dashboardCargando = false;
  }

  get dashboard(): ArrendatarioDashboardData | null { return this.dashboardData; }

  get dashboardResumen() { return this.dashboardData?.resumen ?? null; }

  get dashboardInfo() { return this.dashboardData?.arrendatario ?? null; }

  get dashboardContratos() { return this.dashboardData?.contratos ?? []; }

  get dashboardZonas() { return this.dashboardData?.zonas ?? []; }

  get dashboardLocales() { return this.dashboardData?.locales ?? []; }

  get dashboardRentaActual() { return this.dashboardData?.rentaActual ?? []; }

  get dashboardPagos() { return this.dashboardData?.pagos ?? []; }

  get dashboardRentaPagadaTotal(): number {
    return this.dashboardRentaActual
      .filter((r) => r.pagada)
      .reduce((sum, r) => sum + r.montoFinalTotal, 0);
  }

  get dashboardRentaPendienteTotal(): number {
    return this.dashboardRentaActual
      .filter((r) => !r.pagada)
      .reduce((sum, r) => sum + r.montoFinalTotal, 0);
  }

  get dashboardFiltros() { return this.dashboardData?.filtros ?? null; }

  claseEstatusPago(estatus: string): string {
    const e = (estatus ?? '').toLowerCase();
    if (e.includes('pagad')) return 'dash-badge dash-badge--pagado';
    if (e.includes('pend')) return 'dash-badge dash-badge--pendiente';
    return 'dash-badge';
  }

  customizarPuntoRentaEstadoDashboard = (pointInfo: {
    data?: DashboardRentaEstadoSlice;
  }): Record<string, unknown> => ({
    color: pointInfo?.data?.color ?? '#888',
  });

  customizarTooltipRentaEstadoDashboard = (info: {
    argumentText?: string;
    valueText?: string;
    percentText?: string;
    point?: { data?: DashboardRentaEstadoSlice };
  }): { text: string } => {
    const data = info.point?.data;
    const cantidad = Number(data?.cantidad ?? info.valueText ?? 0);
    const total = Number(data?.totalRentas ?? this.dashboardResumen?.rentasPagadas ?? 0)
      + Number(this.dashboardResumen?.rentasPendientes ?? 0);
    const lineas = [
      String(info.argumentText ?? ''),
      total > 0 ? `${cantidad} de ${total} rentas` : `${cantidad} rentas`,
      info.percentText ?? '',
    ];
    return { text: lineas.filter(Boolean).join('\n') };
  };

  customizarLabelRentaEstadoDashboard = (info: {
    point?: { data?: DashboardRentaEstadoSlice };
  }): string => {
    const data = info.point?.data;
    const cantidad = Number(data?.cantidad ?? 0);
    const total = Number(data?.totalRentas ?? 0);
    if (total > 0) return `${cantidad} de ${total}`;
    return String(cantidad);
  };

  customizarLeyendaRentaEstadoDashboard = (info: { pointName?: string }): string => {
    const resumen = this.dashboardResumen;
    const nombre = String(info.pointName ?? '');
    if (!resumen) return nombre;
    const total = resumen.rentasPagadas + resumen.rentasPendientes;
    if (nombre === 'Pagadas') return `Pagadas (${resumen.rentasPagadas} de ${total})`;
    if (nombre === 'Pendientes') return `Pendientes (${resumen.rentasPendientes} de ${total})`;
    return nombre;
  };

  customizarTooltipMonedaDashboard = (info: {
    argumentText?: string;
    valueText?: string;
    seriesName?: string;
  }): { text: string } => {
    const monto = Number(String(info.valueText ?? '').replace(/[^\d.-]/g, ''));
    const valor = Number.isFinite(monto)
      ? formatearMoneda(monto)
      : String(info.valueText ?? '');
    return {
      text: [info.seriesName ?? info.argumentText ?? '', valor].filter(Boolean).join('\n'),
    };
  };

  private refrescarGraficasDashboard(): void {
    this.cdr.detectChanges();
    setTimeout(() => {
      this.pieDashboardRentaEstado?.instance?.render?.();
      this.chartDashboardMensualidad?.instance?.render?.();
      this.chartDashboardPagos?.instance?.render?.();
    }, 0);
  }

  private rangoFechasDashboard(): { fechaInicio: string; fechaFin: string } {
    return {
      fechaInicio: '2026-01-01',
      fechaFin: this.fechaApiDesdeDate(new Date()),
    };
  }

  private fechaApiDesdeDate(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private limpiarMapaListaModal(): void {
    const marker = this.marker as { setMap?: (m: null) => void } | null;
    if (marker?.setMap) marker.setMap(null);
    this.marker = null;
    this.map = null;
  }

  private loadGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as Window & { google?: { maps?: unknown } };

      if (w.google?.maps) {
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[data-gmaps="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', 'true');
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  private initMapaListaModal(): void {
    if (this.mapaLat == null || this.mapaLng == null) return;

    const el = document.getElementById('mapListaArrendatario');
    if (!el) return;

    const w = window as Window & {
      google?: {
        maps: {
          Map: new (node: HTMLElement, opts: object) => unknown;
          Marker: new (opts: object) => { setMap?: (m: unknown) => void };
          Size: new (w: number, h: number) => unknown;
          Point: new (x: number, y: number) => unknown;
        };
      };
    };
    if (!w.google?.maps) return;

    const g = w.google.maps;
    const lat = this.mapaLat;
    const lng = this.mapaLng;

    this.limpiarMapaListaModal();
    el.innerHTML = '';

    this.map = new g.Map(el, {
      center: { lat, lng },
      zoom: 16,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    this.marker = new g.Marker({
      position: { lat, lng },
      map: this.map,
      icon: {
        url: this.pinUrl,
        scaledSize: new g.Size(70, 70),
        anchor: new g.Point(35, 70),
      },
    });
  }

  @ViewChild('gridContainer', { static: false })
  dataGrid!: DxDataGridComponent;
}
