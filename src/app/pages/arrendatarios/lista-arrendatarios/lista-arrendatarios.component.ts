import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent, DxPieChartComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import {
  exportarDxDataGridExcel,
  gridTieneDatosParaExportar,
  hojasDetalleArrendatario,
  obtenerItemsGridCompletos,
} from 'src/app/shared/grid-excel-export';
import {
  ArrendatarioGridRow,
  mapArrendatariosApiToGridRows,
} from '../arrendatarios-list.mapper';
import {
  ArrendatarioDashboardContrato,
  ArrendatarioDashboardData,
  construirGraficaMensualidadDashboard,
  construirGraficaRentaEstado,
  construirGraficaRentaPeriodo,
  DashboardMensualidadLocalBar,
  DashboardRentaEstadoSlice,
  DashboardRentaPeriodoBar,
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
  private dashboardArrendatarioId: number | null = null;
  dashboardFechaInicio = '';
  dashboardFechaFin = '';
  private dashboardData: ArrendatarioDashboardData | null = null;
  dashboardRentaEstadoData: DashboardRentaEstadoSlice[] = [];
  dashboardMensualidadData: DashboardMensualidadLocalBar[] = [];
  dashboardRentaPeriodoData: DashboardRentaPeriodoBar[] = [];
  readonly zIndexTooltipDashboard = 100010;
  /** true cuando la gráfica de mensualidad usa contratos porque el API no envió locales. */
  mensualidadDesdeContratos = false;

  formatearFecha = formatearFecha;
  formatearMoneda = formatearMoneda;
  etiquetaMes = etiquetaMes;

  @ViewChild('pieDashboardRentaEstado', { static: false })
  pieDashboardRentaEstado?: DxPieChartComponent;

  @ViewChild('chartDashboardMensualidad', { static: false })
  chartDashboardMensualidad?: { instance?: { render?: () => void } };

  @ViewChild('chartDashboardRenta', { static: false })
  chartDashboardRenta?: { instance?: { render?: () => void } };

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

  eliminarArrendatario(row: ArrendatarioGridRow): void {
    const nombre =
      String(row?.arrendatario ?? '').trim() || `Arrendatario ${row?.id ?? ''}`;
    void Swal.fire({
      title: '¡Eliminar Arrendatario!',
      html: `¿Está seguro que requiere eliminar el arrendatario: <strong>${nombre}</strong>?`,
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
      this.arrendatariosService.eliminarArrendatario(row.id).subscribe({
        next: () => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Eliminado!',
            html: 'El arrendatario ha sido eliminado de forma exitosa.',
            icon: 'success',
            showCancelButton: false,
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
          this.refrescarListaArrendatarios();
        },
        error: () => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Ops!',
            html: 'Error al intentar eliminar el arrendatario.',
            icon: 'error',
            showCancelButton: false,
          });
        },
      });
    });
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
        fileName: 'Arrendatarios',
        detailSheets: hojasDetalleArrendatario(masters),
      });
    } catch (err) {
      console.error('Error al exportar grid:', err);
    }
  }

  onMasterRowClick(e: any): void {
    if (e?.rowType !== 'data' || e?.key == null) return;
    const raw = e?.event?.target ?? null;
    const target =
      raw instanceof Element ? raw : ((raw as Node | null)?.parentElement ?? null);
    // Clics dentro del detalle (p. ej. Cancelar local) no deben colapsar la fila.
    if (
      target?.closest(
        'button, a, input, textarea, select, .btnAcciones, .mat-mdc-button-base, .dx-command-expand, .inm-master-detail',
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
    this.dashboardArrendatarioId = Math.floor(id);
    const def = this.fechasDefaultDashboard();
    this.dashboardFechaInicio = def.fechaInicio;
    this.dashboardFechaFin = def.fechaFin;
    this.dashboardData = null;
    this.dashboardRentaEstadoData = [];
    this.dashboardMensualidadData = [];
    this.dashboardRentaPeriodoData = [];
    this.mensualidadDesdeContratos = false;
    this.mostrarModalDashboard = true;
    this.cargarDashboardArrendatario();
  }

  aplicarFiltroDashboard(): void {
    if (this.dashboardArrendatarioId == null) return;
    this.cargarDashboardArrendatario();
  }

  private cargarDashboardArrendatario(): void {
    const id = this.dashboardArrendatarioId;
    if (id == null) return;

    this.dashboardCargando = true;
    this.dashboardData = null;
    this.dashboardRentaEstadoData = [];
    this.dashboardMensualidadData = [];
    this.dashboardRentaPeriodoData = [];
    this.mensualidadDesdeContratos = false;

    const { fechaInicio, fechaFin } = this.rangoFechasDashboard();
    this.arrendatariosService.obtenerDashboardArrendatario(id, fechaInicio, fechaFin)
      .pipe(take(1))
      .subscribe({
        next: (res: unknown) => {
          this.dashboardData = normalizarDashboardArrendatario(res);
          this.dashboardRentaEstadoData = construirGraficaRentaEstado(
            this.dashboardData?.resumen ?? null,
          );
          this.dashboardMensualidadData = construirGraficaMensualidadDashboard(
            this.dashboardData?.locales ?? [],
            this.dashboardData?.contratos ?? [],
          );
          this.mensualidadDesdeContratos = !(this.dashboardData?.locales?.length);
          this.dashboardRentaPeriodoData = construirGraficaRentaPeriodo(
            this.dashboardData?.rentaActual ?? [],
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
    this.dashboardArrendatarioId = null;
    this.dashboardFechaInicio = '';
    this.dashboardFechaFin = '';
    this.dashboardData = null;
    this.dashboardRentaEstadoData = [];
    this.dashboardMensualidadData = [];
    this.dashboardRentaPeriodoData = [];
    this.mensualidadDesdeContratos = false;
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

  trackByDashboardContratoId(_index: number, contrato: ArrendatarioDashboardContrato): number {
    return contrato.id;
  }

  etiquetaMetrosContrato(contrato: ArrendatarioDashboardContrato): string {
    if (contrato.metrosRentados <= 0) return '';
    const metros = `${contrato.metrosRentados.toLocaleString('es-MX')} m²`;
    if (contrato.costoM2 > 0) {
      return `${metros} · ${formatearMoneda(contrato.costoM2)}/m²`;
    }
    return metros;
  }

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
    const categoria = String(info.argumentText ?? data?.categoria ?? '');
    const cantidad = Number(data?.cantidad ?? info.valueText ?? 0);
    const total = Number(data?.totalRentas ?? this.dashboardResumen?.rentasPagadas ?? 0)
      + Number(this.dashboardResumen?.rentasPendientes ?? 0);
    const descripcion = categoria === 'Pagadas'
      ? 'Rentas liquidadas en el periodo'
      : categoria === 'Pendientes'
        ? 'Rentas por cobrar en el periodo'
        : 'Cantidad de rentas';
    const lineas = [
      categoria,
      descripcion,
      total > 0 ? `${cantidad} de ${total} rentas` : `${cantidad} rentas`,
      info.percentText ? `Participación: ${info.percentText}` : '',
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

  customizarTooltipRentaPeriodoDashboard = (info: {
    argumentText?: string;
    valueText?: string;
    seriesName?: string;
    originalValue?: number;
    value?: number;
  }): { text: string } => {
    const periodo = String(info.argumentText ?? '');
    const serie = String(info.seriesName ?? '');
    const valor = this.montoDesdeTooltip(info);
    const concepto = serie === 'Renta'
      ? 'Renta del periodo'
      : serie === 'Mantenimiento'
        ? 'Mantenimiento del periodo'
        : serie;
    const lineas = [
      periodo ? `Periodo: ${periodo}` : '',
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

  alturaGraficaRentaDashboard(): number {
    const n = this.dashboardRentaPeriodoData.length;
    if (n <= 0) return 220;
    return Math.max(220, Math.min(n * 44, 520));
  }

  private refrescarGraficasDashboard(): void {
    this.cdr.detectChanges();
    setTimeout(() => {
      this.pieDashboardRentaEstado?.instance?.render?.();
      this.chartDashboardMensualidad?.instance?.render?.();
      this.chartDashboardRenta?.instance?.render?.();
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
