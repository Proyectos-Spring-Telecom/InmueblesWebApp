import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { CellPreparedEvent, RowPreparedEvent } from 'devextreme/ui/data_grid';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { HistoricoPagosRentaService } from 'src/app/services/moduleService/historico-pagos-renta.service';
import {
  extraerFilasRentRolApi,
  extraerMetaPaginacionRentRol,
  filtrarRegistrosRentRol,
  flattenRentRolRowsToGridLines,
  mapHistoricoPagoRentaToRentRolRow,
  RENT_ROL_COLUMNAS_ROWSPAN,
  RENT_ROL_FILAS_GRID_POR_PAGINA,
  RENT_ROL_REGISTROS_POR_PAGINA,
  RentRolGridLine,
  RentRolRow,
} from './rent-rol-list.mapper';

@Component({
  selector: 'app-rent-rol',
  templateUrl: './rent-rol.component.html',
  styleUrl: './rent-rol.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class RentRolComponent implements OnInit, OnDestroy {
  readonly REGISTROS_POR_PAGINA = RENT_ROL_REGISTROS_POR_PAGINA;
  readonly FILAS_GRID_POR_PAGINA = RENT_ROL_FILAS_GRID_POR_PAGINA;
  private readonly LIMITE_CARGA_BUSQUEDA = 100;

  listaRentRol!: InstanceType<typeof CustomStore>;
  cargando = false;
  cargandoBusqueda = false;
  paginaActual = 1;
  totalRegistros = 0;
  totalPaginasApi = 1;
  totalRegistrosFiltrados = 0;

  fechaInicioFiltro = '';
  fechaFinFiltro = '';
  busquedaTexto = '';

  registrosVisibles: RentRolRow[] = [];
  /** Conjunto usado por los KPIs: todos los del periodo o todos los filtrados en búsqueda. */
  registrosParaKpi: RentRolRow[] = [];

  private cacheRegistrosKey = '';
  private todosRegistrosCache: RentRolRow[] = [];
  private busquedaTimer?: ReturnType<typeof setTimeout>;

  @ViewChild('gridRentRol', { static: false })
  gridRentRol?: DxDataGridComponent;

  constructor(private historicoPagosRentaService: HistoricoPagosRentaService) {}

  get totalPaginas(): number {
    return this.totalPaginasApi;
  }

  get modoBusquedaActivo(): boolean {
    return this.busquedaTexto.trim().length > 0;
  }

  get paginaInicio(): number {
    return (this.paginaActual - 1) * this.REGISTROS_POR_PAGINA;
  }

  get paginaFin(): number {
    if (this.modoBusquedaActivo) {
      return Math.min(this.paginaInicio + this.registrosVisibles.length, this.totalRegistrosFiltrados);
    }
    return Math.min(this.paginaInicio + this.registrosVisibles.length, this.totalRegistros);
  }

  get totalRenta(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.renta.subTotal, 0));
  }

  get totalIvaRenta(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.renta.iva, 0));
  }

  get totalRentaConIva(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.renta.montoFinal, 0));
  }

  get totalMantto(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.mantenimiento.subTotal, 0));
  }

  get totalIvaMantto(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.mantenimiento.iva, 0));
  }

  get totalManttoConIva(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.mantenimiento.montoFinal, 0));
  }

  get subTotalCombinado(): number {
    return this.redondear(this.totalRenta + this.totalMantto);
  }

  get ivaCombinado(): number {
    return this.redondear(this.totalIvaRenta + this.totalIvaMantto);
  }

  get granTotal(): number {
    return this.redondear(this.totalRentaConIva + this.totalManttoConIva);
  }

  ngOnInit(): void {
    const rango = this.rangoFechasPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.setupDataSource();
  }

  ngOnDestroy(): void {
    clearTimeout(this.busquedaTimer);
  }

  onBusquedaInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value ?? '';
    clearTimeout(this.busquedaTimer);
    this.busquedaTimer = setTimeout(() => this.aplicarBusqueda(valor), 350);
  }

  limpiarBusqueda(): void {
    clearTimeout(this.busquedaTimer);
    this.busquedaTexto = '';
    this.totalRegistrosFiltrados = 0;
    this.registrosParaKpi = [];
    this.gridRentRol?.instance?.pageIndex(0);
    this.gridRentRol?.instance?.refresh();
  }

  onRowPrepared(e: RowPreparedEvent): void {
    if (e.rowType !== 'data' || e.data == null) return;
    const line = e.data as RentRolGridLine;
    const rowEl = e.rowElement as HTMLElement | undefined;
    if (!rowEl) return;

    rowEl.classList.add(line.esLineaRenta ? 'row-renta' : 'row-mant');
    rowEl.classList.add(
      line.esLineaRenta ? line.claseEstatusRenta : line.claseEstatusMantenimiento,
    );
  }

  onCellPrepared(e: CellPreparedEvent): void {
    if (e.rowType !== 'data' || e.data == null) return;

    const cell = e.cellElement as HTMLElement | undefined;
    if (!cell) return;

    if (e.column?.type === 'adaptive') {
      cell.style.display = 'none';
      return;
    }

    const field = e.column?.dataField ? String(e.column.dataField) : '';
    if (!field || !RENT_ROL_COLUMNAS_ROWSPAN.includes(field)) return;

    const line = e.data as RentRolGridLine;
    if (line.esLineaRenta) {
      cell.setAttribute('rowspan', '2');
      cell.classList.add('rr-grid-cell--span');
      return;
    }

    cell.style.display = 'none';
  }

  private aplicarBusqueda(valor: string): void {
    this.busquedaTexto = valor.trim();
    this.gridRentRol?.instance?.pageIndex(0);
    this.gridRentRol?.instance?.refresh();
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  /** KPIs sobre todo el periodo (o todo lo filtrado), no solo la página visible del grid. */
  private filasParaKpi(): RentRolRow[] {
    return this.registrosParaKpi.length > 0 ? this.registrosParaKpi : this.registrosVisibles;
  }

  private async refrescarTotalesGlobales(): Promise<void> {
    if (this.modoBusquedaActivo) return;
    try {
      this.registrosParaKpi = await this.cargarTodosLosRegistros();
    } catch (err) {
      console.error('Error al calcular totales globales rent-rol:', err);
      this.registrosParaKpi = [...this.registrosVisibles];
    }
  }

  private rangoFechasPorDefecto(): { inicio: string; fin: string } {
    const hoy = new Date();
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    return {
      inicio: this.toIsoFecha(inicioAnio),
      fin: this.toIsoFecha(hoy),
    };
  }

  private toIsoFecha(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private claveCacheRegistros(): string {
    return `${this.fechaInicioFiltro}|${this.fechaFinFiltro}`;
  }

  private async cargarTodosLosRegistros(): Promise<RentRolRow[]> {
    const clave = this.claveCacheRegistros();
    if (this.cacheRegistrosKey === clave && this.todosRegistrosCache.length > 0) {
      return this.todosRegistrosCache;
    }

    this.cargandoBusqueda = true;
    const acumulado: RentRolRow[] = [];
    let page = 1;
    let totalPaginas = 1;

    try {
      do {
        const resp = await lastValueFrom(
          this.historicoPagosRentaService.obtenerHistoricoPaginado({
            page,
            limit: this.LIMITE_CARGA_BUSQUEDA,
            fechaInicio: this.fechaInicioFiltro,
            fechaFin: this.fechaFinFiltro,
          }),
        );

        const rowsRaw = extraerFilasRentRolApi(resp);
        const meta = extraerMetaPaginacionRentRol(resp, page, this.LIMITE_CARGA_BUSQUEDA);
        totalPaginas = meta.totalPaginas;

        const rows = rowsRaw
          .map((item) => mapHistoricoPagoRentaToRentRolRow(item))
          .filter((r): r is RentRolRow => r != null);

        acumulado.push(...rows);
        page += 1;
      } while (page <= totalPaginas);

      this.todosRegistrosCache = acumulado;
      this.cacheRegistrosKey = clave;
      return acumulado;
    } finally {
      this.cargandoBusqueda = false;
    }
  }

  private setupDataSource(): void {
    this.listaRentRol = new CustomStore({
      key: 'gridKey',
      load: async (loadOptions: { take?: number; skip?: number }) => {
        const take = Number(loadOptions?.take) || this.FILAS_GRID_POR_PAGINA;
        const skip = Number(loadOptions?.skip) || 0;
        const textoBusqueda = this.busquedaTexto.trim();

        if (textoBusqueda) {
          this.cargando = true;
          try {
            const todos = await this.cargarTodosLosRegistros();
            const filtrados = filtrarRegistrosRentRol(todos, textoBusqueda);
            const dataCompleta = flattenRentRolRowsToGridLines(filtrados);
            const pagina = Math.floor(skip / take) + 1;

            this.cargando = false;
            this.registrosParaKpi = filtrados;
            this.registrosVisibles = filtrados.slice(
              (pagina - 1) * this.REGISTROS_POR_PAGINA,
              pagina * this.REGISTROS_POR_PAGINA,
            );
            this.totalRegistrosFiltrados = filtrados.length;
            this.totalRegistros = todos.length;
            this.totalPaginasApi = Math.max(1, Math.ceil(filtrados.length / this.REGISTROS_POR_PAGINA));
            this.paginaActual = pagina;

            return {
              data: dataCompleta.slice(skip, skip + take),
              totalCount: dataCompleta.length,
            };
          } catch (err) {
            this.cargando = false;
            console.error('Error al buscar rent-rol:', err);
            this.registrosVisibles = [];
            this.registrosParaKpi = [];
            this.totalRegistrosFiltrados = 0;
            return { data: [], totalCount: 0 };
          }
        }

        this.cargando = true;
        const page = Math.floor(skip / take) + 1;
        const apiLimit = Math.max(1, Math.floor(take / 2));

        try {
          const resp = await lastValueFrom(
            this.historicoPagosRentaService.obtenerHistoricoPaginado({
              page,
              limit: apiLimit,
              fechaInicio: this.fechaInicioFiltro,
              fechaFin: this.fechaFinFiltro,
            }),
          );

          const rowsRaw = extraerFilasRentRolApi(resp);
          const meta = extraerMetaPaginacionRentRol(resp, page, apiLimit);
          const rows = rowsRaw
            .map((item) => mapHistoricoPagoRentaToRentRolRow(item))
            .filter((r): r is RentRolRow => r != null);

          this.cargando = false;
          this.totalRegistros = meta.total;
          this.totalPaginasApi = meta.totalPaginas;
          this.paginaActual = meta.page;
          this.registrosVisibles = rows;
          this.totalRegistrosFiltrados = 0;
          void this.refrescarTotalesGlobales();

          const data = flattenRentRolRowsToGridLines(rows);
          const totalCount = meta.total > 0 ? meta.total * 2 : data.length;

          return { data, totalCount };
        } catch (err) {
          this.cargando = false;
          console.error('Error al cargar rent-rol:', err);
          this.registrosVisibles = [];
          this.registrosParaKpi = [];
          this.totalRegistros = 0;
          this.totalPaginasApi = 1;
          return { data: [], totalCount: 0 };
        }
      },
    });
  }
}
