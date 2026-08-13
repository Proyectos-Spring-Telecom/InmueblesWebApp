import { ChangeDetectorRef, Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent, DxPieChartComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { InmueblesService } from 'src/app/services/moduleService/inmuebles.service';
import { ThemeService } from 'src/app/services/theme.service';
import {
  exportarDxDataGridExcel,
  gridTieneDatosParaExportar,
  hojasDetalleInmueble,
  obtenerItemsGridCompletos,
} from 'src/app/shared/grid-excel-export';
import { mapClientesApiToGridRows } from '../../clientes/clientes-list.mapper';
import { InmuebleGridRow, mapInmueblesApiToGridRows } from '../inmuebles-list.mapper';
import {
  construirGraficaMensualidadLocales,
  construirGraficaOcupacionLocales,
  construirGraficaRentaArrendatarios,
  DashboardMensualidadLocalBar,
  DashboardOcupacionSlice,
  DashboardRentaArrendatarioBar,
  formatearFecha,
  formatearMoneda,
  InmuebleDashboardData,
  normalizarDashboardInmueble,
} from '../inmueble-dashboard.mapper';

interface LocalOcupacionProcesado {
  id: string;
  nombre: string;
  area: number;
  porcentaje: number;
  color: string;
  arrendatario: string;
  zona: string;
}

interface ZonaOcupacionProcesada {
  id: number;
  nombre: string;
  superficieM2: number;
  superficieDisponibleM2: number;
  numeroZona: number;
  locales: LocalOcupacionProcesado[];
}

interface OcupacionInmuebleData {
  totalM2: number;
  zonas: ZonaOcupacionProcesada[];
}

interface DonaSlice {
  nombre: string;
  area: number;
  porcentaje: number;
  color: string;
  arrendatario?: string;
  esDisponible?: boolean;
}

interface ArrendadorFiltroItem {
  id: number;
  nombre: string;
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
  public listaArrendadores: ArrendadorFiltroItem[] = [];
  public idArrendadorSeleccionado: number | null = null;
  public cargandoArrendadores = false;
  public filtroArrendadorAbierto = false;

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

  mostrarModalDashboard = false;
  dashboardTitulo = '';
  dashboardCargando = false;
  dashboardFechaInicio = '';
  dashboardFechaFin = '';
  private dashboardInmuebleId: number | null = null;
  private dashboardData: InmuebleDashboardData | null = null;
  dashboardOcupacionData: DashboardOcupacionSlice[] = [];
  dashboardRentaData: DashboardRentaArrendatarioBar[] = [];
  readonly zIndexTooltipDashboard = 100010;
  dashboardMensualidadData: DashboardMensualidadLocalBar[] = [];

  formatearFecha = formatearFecha;
  formatearMoneda = formatearMoneda;

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

  @ViewChild('pieDashboardOcupacion', { static: false })
  pieDashboardOcupacion?: DxPieChartComponent;

  @ViewChild('chartDashboardRenta', { static: false })
  chartDashboardRenta?: { instance?: { render?: () => void } };

  @ViewChild('chartDashboardMensualidad', { static: false })
  chartDashboardMensualidad?: { instance?: { render?: () => void } };

  constructor(
    private router: Router,
    private inmueblesService: InmueblesService,
    private clientesService: ClientesService,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService,
  ) {}

  /** Texto de leyenda/labels de la dona: oscuro en tema claro. */
  get colorTextoGraficaOcupacion(): string {
    return this.themeService.getTheme() === 'light'
      ? '#1e293b'
      : 'rgba(230, 241, 255, 0.92)';
  }

  get textoSinDatosGrid(): string {
    return 'Sin registros para mostrar';
  }

  get etiquetaArrendadorFiltro(): string {
    if (this.cargandoArrendadores) return 'Cargando arrendadores…';
    const id = this.idArrendadorSeleccionado;
    if (id == null) return 'Todos los arrendadores';
    return this.listaArrendadores.find((a) => a.id === id)?.nombre ?? 'Todos los arrendadores';
  }

  ngOnInit(): void {
    this.setupDataSource();
    this.cargarArrendadores();
  }

  agregarInmueble(): void {
    void this.router.navigateByUrl('/inmuebles/agregar-inmueble');
  }

  editarInmueble(row: InmuebleGridRow): void {
    void this.router.navigate(['/inmuebles/editar-inmueble', row.id]);
  }

  eliminarInmueble(row: InmuebleGridRow): void {
    const nombre = String(row?.inmueble ?? '').trim() || `Inmueble ${row?.id ?? ''}`;
    void Swal.fire({
      title: '¡Eliminar Inmueble!',
      html: `¿Está seguro que requiere eliminar el inmueble: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed && !result.value) return;
      this.inmueblesService.eliminarInmueble(row.id).subscribe({
        next: () => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Eliminado!',
            html: 'El inmueble ha sido eliminado de forma exitosa.',
            icon: 'success',
            showCancelButton: false,
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
          this.recargarInmueblesPaginated();
        },
        error: () => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Ops!',
            html: 'Error al intentar eliminar el inmueble.',
            icon: 'error',
            showCancelButton: false,
          });
        },
      });
    });
  }

  activarInmueble(row: InmuebleGridRow): void {
    const nombre = String(row?.inmueble ?? '').trim() || `Inmueble ${row?.id ?? ''}`;
    void Swal.fire({
      title: '¡Activar!',
      html: `¿Está seguro que requiere activar el inmueble: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed && !result.value) return;
      this.inmueblesService.updateEstatus(row.id, 1).subscribe({
        next: () => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Confirmación Realizada!',
            html: 'El inmueble ha sido activado.',
            icon: 'success',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
          this.recargarInmueblesPaginated();
        },
        error: () => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Ops!',
            html: 'Error al intentar activar el inmueble.',
            icon: 'error',
            showCancelButton: false,
          });
        },
      });
    });
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

  onArrendadorFiltroChange(id: number | null): void {
    const n = Number(id);
    this.idArrendadorSeleccionado = Number.isFinite(n) && n > 0 ? n : null;
    this.filtroArrendadorAbierto = false;
    this.reiniciarBusquedaGrid();
    this.refrescarGridInmuebles();
  }

  toggleFiltroArrendador(ev?: Event): void {
    ev?.stopPropagation();
    if (this.cargandoArrendadores) return;
    this.filtroArrendadorAbierto = !this.filtroArrendadorAbierto;
  }

  @HostListener('document:click')
  cerrarFiltroArrendador(): void {
    if (!this.filtroArrendadorAbierto) return;
    this.filtroArrendadorAbierto = false;
  }

  @HostListener('document:keydown.escape')
  cerrarFiltroArrendadorTecla(): void {
    if (!this.filtroArrendadorAbierto) return;
    this.filtroArrendadorAbierto = false;
  }

  private cargarArrendadores(): void {
    this.cargandoArrendadores = true;
    this.clientesService
      .obtenerClientes()
      .pipe(
        take(1),
        catchError((err) => {
          console.error('Error al cargar arrendadores:', err);
          return of(null);
        }),
      )
      .subscribe((res) => {
        const r = res as { data?: unknown[] } | unknown[] | null;
        const rows = Array.isArray(r) ? r : ((r as { data?: unknown[] } | null)?.data ?? []);
        this.listaArrendadores = mapClientesApiToGridRows(Array.isArray(rows) ? rows : [])
          .filter((c) => Number.isFinite(c.id) && c.id > 0)
          .map((c) => ({
            id: c.id,
            nombre: String(c.NombreCompleto || c.nombre || 'Arrendador').trim() || 'Arrendador',
          }));
        this.cargandoArrendadores = false;
        this.cdr.markForCheck();
      });
  }

  private extraerFilasInmueblesApi(resp: unknown): unknown[] {
    if (Array.isArray(resp)) return resp;
    if (resp != null && typeof resp === 'object') {
      const data = (resp as { data?: unknown }).data;
      if (Array.isArray(data)) return data;
    }
    return [];
  }

  private reiniciarBusquedaGrid(): void {
    this.filtroActivo = '';
    const grid = this.dataGrid?.instance;
    if (!grid) return;
    grid.option('searchPanel.text', '');
    grid.option('dataSource', this.listaInmuebles);
  }

  private refrescarGridInmuebles(): void {
    const grid = this.dataGrid?.instance;
    if (!grid) {
      this.cdr.markForCheck();
      return;
    }
    grid.pageIndex(0);
    grid.refresh();
    this.cdr.markForCheck();
  }

  onPageIndexChanged(e: any): void {
    this.paginaActual = e.component.pageIndex() + 1;
    e.component.refresh();
  }

  onMasterRowClick(e: any): void {
    if (e?.rowType !== 'data' || e?.key == null) return;
    const target = (e?.event?.target ?? null) as HTMLElement | null;
    if (
      target?.closest(
        'button, a, input, textarea, select, .btnAcciones, .mat-mdc-button-base, .dx-command-expand',
      )
    ) {
      return;
    }
    const grid = this.dataGrid?.instance;
    if (!grid) return;
    if (grid.isRowExpanded(e.key)) {
      void grid.collapseRow(e.key);
    } else {
      void grid.expandRow(e.key);
    }
  }

  setupDataSource(): void {
    this.listaInmuebles = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 20;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        const idArrendador = this.idArrendadorSeleccionado;
        this.loading = true;
        try {
          if (idArrendador == null) {
            const resp: any = await lastValueFrom(
              this.inmueblesService.obtenerInmueblesData(page, take),
            );
            this.loading = false;
            const rows: unknown[] = Array.isArray(resp?.data) ? resp.data : [];
            const meta = resp?.paginated || {};
            const toNum = (v: unknown): number | null => {
              const n = Number(v);
              return Number.isFinite(n) ? n : null;
            };
            const totalRegistros = toNum(meta.total) ?? toNum(resp?.total) ?? rows.length;
            const paginaActual = toNum(meta.page) ?? toNum(resp?.page) ?? page;
            const totalPaginas =
              toNum(meta.lastPage) ??
              toNum(resp?.pages) ??
              Math.max(1, Math.ceil(totalRegistros / take));
            const dataTransformada = mapInmueblesApiToGridRows(rows);
            this.totalRegistros = totalRegistros;
            this.paginaActual = paginaActual;
            this.totalPaginas = totalPaginas;
            this.paginaActualData = dataTransformada;
            return { data: dataTransformada, totalCount: totalRegistros };
          }

          const resp = await lastValueFrom(
            this.inmueblesService.obtenerInmueblesPorArrendador(idArrendador),
          );
          this.loading = false;
          const rows = this.extraerFilasInmueblesApi(resp);
          const dataTransformada = mapInmueblesApiToGridRows(rows);
          this.totalRegistros = dataTransformada.length;
          this.paginaActual = page;
          this.totalPaginas = Math.max(1, Math.ceil(dataTransformada.length / take));
          this.paginaActualData = dataTransformada;
          return {
            data: dataTransformada.slice(skip, skip + take),
            totalCount: dataTransformada.length,
          };
        } catch (err) {
          this.loading = false;
          console.error('Error en la solicitud de datos:', err);
          this.totalRegistros = 0;
          this.paginaActualData = [];
          return { data: [], totalCount: 0 };
        }
      },
    });
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
    this.idArrendadorSeleccionado = null;
    this.filtroArrendadorAbierto = false;
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

  puedeExportarExcel(): boolean {
    return gridTieneDatosParaExportar(this.dataGrid?.instance);
  }

  async exportarExcel(): Promise<void> {
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    try {
      const masters = await obtenerItemsGridCompletos(inst);
      await exportarDxDataGridExcel({
        component: inst,
        fileName: 'Inmuebles',
        detailSheets: hojasDetalleInmueble(masters),
      });
    } catch (err) {
      console.error('Error al exportar grid:', err);
    }
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

  verDashboardInmueble(row: InmuebleGridRow): void {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    this.dashboardTitulo = row.inmueble ?? `Inmueble #${id}`;
    this.dashboardInmuebleId = Math.floor(id);
    const def = this.fechasDefaultDashboard();
    this.dashboardFechaInicio = def.fechaInicio;
    this.dashboardFechaFin = def.fechaFin;
    this.dashboardData = null;
    this.dashboardOcupacionData = [];
    this.dashboardRentaData = [];
    this.dashboardMensualidadData = [];
    this.mostrarModalDashboard = true;
    this.cargarDashboardInmueble();
  }

  aplicarFiltroDashboard(): void {
    if (this.dashboardInmuebleId == null) return;
    this.cargarDashboardInmueble();
  }

  private cargarDashboardInmueble(): void {
    const id = this.dashboardInmuebleId;
    if (id == null) return;

    this.dashboardCargando = true;
    this.dashboardData = null;
    this.dashboardOcupacionData = [];
    this.dashboardRentaData = [];
    this.dashboardMensualidadData = [];

    const { fechaInicio, fechaFin } = this.rangoFechasDashboard();
    this.inmueblesService.obtenerDashboardInmueble(id, fechaInicio, fechaFin)
      .pipe(take(1))
      .subscribe({
        next: (res: unknown) => {
          this.dashboardData = normalizarDashboardInmueble(res);
          this.dashboardOcupacionData = construirGraficaOcupacionLocales(
            this.dashboardData?.resumenOcupacion ?? null,
          );
          this.dashboardRentaData = construirGraficaRentaArrendatarios(
            this.dashboardData?.arrendatarios ?? [],
          );
          this.dashboardMensualidadData = construirGraficaMensualidadLocales(
            this.dashboardData?.zonas ?? [],
          );
          if (this.dashboardData?.inmueble?.nombre) {
            this.dashboardTitulo = this.dashboardData.inmueble.nombre;
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
    this.dashboardInmuebleId = null;
    this.dashboardFechaInicio = '';
    this.dashboardFechaFin = '';
    this.dashboardData = null;
    this.dashboardOcupacionData = [];
    this.dashboardRentaData = [];
    this.dashboardMensualidadData = [];
    this.dashboardCargando = false;
  }

  get dashboard(): InmuebleDashboardData | null { return this.dashboardData; }

  get dashboardResumen() { return this.dashboardData?.resumenOcupacion ?? null; }

  get dashboardZonas() { return this.dashboardData?.zonas ?? []; }

  get dashboardArrendatarios() { return this.dashboardData?.arrendatarios ?? []; }

  get dashboardPagosInmueble() { return this.dashboardData?.pagosInmueble ?? []; }

  get dashboardArrendador() { return this.dashboardData?.arrendador ?? null; }

  get dashboardInmueble() { return this.dashboardData?.inmueble ?? null; }

  claseEstadoLocal(estado: string): string {
    const e = (estado ?? '').toLowerCase();
    if (e === 'ocupado') return 'dash-badge dash-badge--ocupado';
    if (e === 'libre' || e === 'disponible') return 'dash-badge dash-badge--libre';
    return 'dash-badge';
  }

  claseEstatusPago(estatus: string): string {
    const e = (estatus ?? '').toLowerCase();
    if (e.includes('pagad')) return 'dash-badge dash-badge--pagado';
    if (e.includes('pend')) return 'dash-badge dash-badge--pendiente';
    return 'dash-badge';
  }

  alturaGraficaRentaDashboard(): number {
    const n = this.dashboardRentaData.length;
    if (n <= 0) return 220;
    return Math.max(220, Math.min(n * 44, 520));
  }

  customizarPuntoOcupacionDashboard = (pointInfo: {
    argument?: string;
    data?: DashboardOcupacionSlice;
  }): Record<string, unknown> => ({
    color: pointInfo?.data?.color ?? '#888',
  });

  customizarTooltipOcupacionDashboard = (info: {
    argumentText?: string;
    valueText?: string;
    percentText?: string;
    point?: { data?: DashboardOcupacionSlice };
  }): { text: string } => {
    const data = info.point?.data;
    const categoria = String(info.argumentText ?? data?.categoria ?? '');
    const cantidad = Number(data?.cantidad ?? info.valueText ?? 0);
    const total = Number(data?.totalLocales ?? this.dashboardResumen?.totalLocales ?? 0);
    const descripcion = categoria === 'Ocupados'
      ? 'Locales con arrendatario asignado'
      : categoria === 'Libres'
        ? 'Locales disponibles sin arrendatario'
        : 'Cantidad de locales';
    const lineas = [
      categoria,
      descripcion,
      total > 0 ? `${cantidad} de ${total} locales` : `${cantidad} locales`,
      info.percentText ? `Participación: ${info.percentText}` : '',
    ];
    return { text: lineas.filter(Boolean).join('\n') };
  };

  customizarLabelOcupacionDashboard = (info: {
    point?: { data?: DashboardOcupacionSlice };
  }): string => {
    const data = info.point?.data;
    const cantidad = Number(data?.cantidad ?? 0);
    const total = Number(data?.totalLocales ?? this.dashboardResumen?.totalLocales ?? 0);
    if (total > 0) return `${cantidad} de ${total}`;
    return String(cantidad);
  };

  customizarLeyendaOcupacionDashboard = (info: {
    pointName?: string;
    pointIndex?: number;
  }): string => {
    const resumen = this.dashboardResumen;
    const nombre = String(info.pointName ?? '');
    if (!resumen) return nombre;
    const total = resumen.totalLocales;
    if (nombre === 'Ocupados') return `Ocupados (${resumen.localesOcupados} de ${total})`;
    if (nombre === 'Libres') return `Libres (${resumen.localesLibres} de ${total})`;
    return nombre;
  };

  private montoDesdeTooltip(info: {
    valueText?: string;
    originalValue?: number | string;
    value?: number | string;
  }): string {
    const directo = Number(info.originalValue ?? info.value);
    if (Number.isFinite(directo)) {
      return formatearMoneda(directo);
    }
    const parsed = Number(String(info.valueText ?? '').replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsed)) {
      return formatearMoneda(parsed);
    }
    return String(info.valueText ?? '');
  }

  customizarTooltipMonedaDashboard = (info: {
    argumentText?: string;
    valueText?: string;
    seriesName?: string;
    originalValue?: number;
    value?: number;
  }): { text: string } => {
    const valor = this.montoDesdeTooltip(info);
    return {
      text: [info.seriesName ?? info.argumentText ?? '', valor].filter(Boolean).join('\n'),
    };
  };

  customizarTooltipMensualidadDashboard = (info: {
    argumentText?: string;
    valueText?: string;
    originalValue?: number;
    value?: number;
    point?: { data?: DashboardMensualidadLocalBar };
  }): { text: string } => {
    const local = String(info.argumentText ?? '');
    const data = info.point?.data;
    const valor = this.montoDesdeTooltip(info);
    const estado = String(data?.estado ?? '').trim();
    const lineas = [
      local ? `Local: ${local}` : '',
      'Mensualidad base del local',
      `Monto: ${valor}`,
      estado ? `Estatus: ${estado}` : '',
    ];
    return { text: lineas.filter(Boolean).join('\n') };
  };

  customizarTooltipRentaDashboard = (info: {
    argumentText?: string;
    valueText?: string;
    seriesName?: string;
    originalValue?: number;
    value?: number;
  }): { text: string } => {
    const arrendatario = String(info.argumentText ?? '');
    const serie = String(info.seriesName ?? '');
    const valor = this.montoDesdeTooltip(info);
    const concepto = serie === 'Renta'
      ? 'Renta del periodo'
      : serie === 'Mantenimiento'
        ? 'Mantenimiento del periodo'
        : serie;
    const lineas = [
      arrendatario ? `Arrendatario: ${arrendatario}` : '',
      concepto,
      `Monto: ${valor}`,
    ];
    return { text: lineas.filter(Boolean).join('\n') };
  };

  customizarPuntoMensualidadDashboard = (pointInfo: {
    data?: DashboardMensualidadLocalBar;
  }): Record<string, unknown> => {
    const estado = (pointInfo?.data?.estado ?? '').toLowerCase();
    const color = estado === 'ocupado' ? '#f59e0b' : '#22c55e';
    return { color };
  };

  private refrescarGraficasDashboard(): void {
    this.cdr.detectChanges();
    setTimeout(() => {
      const pie = this.pieDashboardOcupacion?.instance;
      const chartRenta = this.chartDashboardRenta?.instance;
      const chartMens = this.chartDashboardMensualidad?.instance;
      pie?.render?.();
      chartRenta?.render?.();
      chartMens?.render?.();
    }, 0);
  }

  private fechasDefaultDashboard(): { fechaInicio: string; fechaFin: string } {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return {
      fechaInicio: this.fechaApiDesdeDate(inicioMes),
      fechaFin: this.fechaApiDesdeDate(hoy),
    };
  }

  private rangoFechasDashboard(): { fechaInicio: string; fechaFin: string } {
    const def = this.fechasDefaultDashboard();
    const fechaInicio = this.dashboardFechaInicio.trim() || def.fechaInicio;
    const fechaFin = this.dashboardFechaFin.trim() || def.fechaFin;
    return { fechaInicio, fechaFin };
  }

  private fechaApiDesdeDate(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ─── Getters para el template ─────────────────────────────────────────────

  get data(): OcupacionInmuebleData | null { return this.lugarData; }

  get totalM2(): number { return this.lugarData?.totalM2 ?? 0; }

  get zonasProcesadas(): ZonaOcupacionProcesada[] {
    return this.lugarData?.zonas ?? [];
  }

  get localesProcesados(): LocalOcupacionProcesado[] {
    return this.zonasProcesadas.flatMap((z) => z.locales);
  }

  get m2Ocupados(): number { return this.localesProcesados.reduce((s, l) => s + l.area, 0); }

  get m2Disponibles(): number {
    return Math.max(0, this.totalM2 - this.m2Ocupados);
  }
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
    const raw     = (body ?? {}) as Record<string, unknown>;
    const totalM2 = this.numeroDesdeApi(raw['totalM2'] ?? raw['total_m2']);

    const zonasRaw = Array.isArray(raw['zonas']) ? raw['zonas'] : [];
    if (zonasRaw.length) {
      let colorIndex = 0;
      const zonas = zonasRaw.map((zonaRaw, zi) => {
        const zona = (zonaRaw ?? {}) as Record<string, unknown>;
        const nombreZona = String(
          zona['zonaPrincipal'] ?? zona['zona_principal'] ?? `Zona ${zi + 1}`,
        ).trim();
        const localesRaw = Array.isArray(zona['localesRentados'])
          ? zona['localesRentados']
          : Array.isArray(zona['locales_rentados']) ? zona['locales_rentados'] : [];
        const locales = localesRaw.map((localRaw, li) => {
          const local = this.procesarLocalOcupacion(
            localRaw, li, colorIndex, totalM2, nombreZona,
          );
          colorIndex += 1;
          return local;
        });
        return {
          id: Number(zona['id'] ?? zi),
          nombre: nombreZona,
          superficieM2: this.numeroDesdeApi(zona['superficieZonaM2'] ?? zona['superficie_zona_m2']),
          superficieDisponibleM2: this.numeroDesdeApi(
            zona['superficieDisponibleM2'] ?? zona['superficie_disponible_m2'],
          ),
          numeroZona: Number(zona['numeroZona'] ?? zona['numero_zona'] ?? zi + 1),
          locales,
        };
      });
      return { totalM2, zonas };
    }

    const localesRentados = Array.isArray(raw['localesRentados'])
      ? raw['localesRentados']
      : Array.isArray(raw['locales_rentados']) ? raw['locales_rentados'] : [];
    const locales = localesRentados.map((localRaw, index) =>
      this.procesarLocalOcupacion(
        localRaw,
        index,
        index,
        totalM2,
        this.zonaLocalDesdeApi(localRaw),
      ),
    );
    const ocupado = locales.reduce((s, l) => s + l.area, 0);
    return {
      totalM2,
      zonas: [{
        id: 0,
        nombre: '',
        superficieM2: totalM2,
        superficieDisponibleM2: Math.max(0, totalM2 - ocupado),
        numeroZona: 1,
        locales,
      }],
    };
  }

  private procesarLocalOcupacion(
    raw: unknown,
    index: number,
    colorIndex: number,
    totalM2: number,
    zonaNombre: string,
  ): LocalOcupacionProcesado {
    const area = this.areaLocalDesdeApi(raw);
    return {
      id: `local-${colorIndex}`,
      nombre: this.nombreLocalDesdeApi(raw, index),
      area,
      porcentaje: totalM2 > 0 ? (area / totalM2) * 100 : 0,
      color: COLORES_LOCALES[colorIndex % COLORES_LOCALES.length],
      arrendatario: this.arrendatarioLocalDesdeApi(raw),
      zona: zonaNombre || this.zonaLocalDesdeApi(raw),
    };
  }

  private numeroDesdeApi(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
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