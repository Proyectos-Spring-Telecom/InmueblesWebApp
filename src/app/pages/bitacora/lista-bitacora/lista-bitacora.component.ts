import { Component, OnInit, ViewChild } from '@angular/core';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { BitacoraService } from 'src/app/services/moduleService/bitacora.service';
import {
  BitacoraGridRow,
  mapBitacoraPaginatedItemToRow,
} from '../bitacora-list.mapper';
import Swal from 'sweetalert2';
import { exportarDxDataGridExcel, gridTieneDatosParaExportar } from 'src/app/shared/grid-excel-export';

@Component({
  selector: 'app-lista-bitacora',
  templateUrl: './lista-bitacora.component.html',
  styleUrl: './lista-bitacora.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaBitacoraComponent implements OnInit {
  public mensajeAgrupar: string =
    'Arrastre una columna aquí para agrupar por dicha columna';
  public listaBitacora: any;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loading: boolean;
  public loadingMessage: string = 'Cargando...';
  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  @ViewChild(DxDataGridComponent, { static: false })
  dataGrid: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;
  public paginaActualData: BitacoraGridRow[] = [];
  public filtroActivo: string = '';

  fechaInicioFiltro = '';
  fechaFinFiltro = '';

  constructor(private bitacoraService: BitacoraService) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    const rango = this.rangoFechasPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.setupDataSource();
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  /** Mes vigente: del día 1 al día presente. */
  private rangoFechasPorDefecto(): { inicio: string; fin: string } {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return {
      inicio: this.toIsoFecha(inicioMes),
      fin: this.toIsoFecha(hoy),
    };
  }

  private toIsoFecha(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  aplicarFiltros(): void {
    if (!this.fechaInicioFiltro?.trim() || !this.fechaFinFiltro?.trim()) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Fechas obligatorias',
        text: 'Indica fecha inicial y fecha final.',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    if (this.fechaInicioFiltro > this.fechaFinFiltro) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Rango inválido',
        text: 'La fecha inicial no puede ser posterior a la final.',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    this.dataGrid?.instance?.pageIndex(0);
    this.dataGrid?.instance?.refresh();
  }

  setupDataSource() {
    this.loading = true;
    const defaultPageSize = this.pageSize || 10;

    this.listaBitacora = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const skipValue = Number(loadOptions?.skip) || 0;
        const takeValue = Number(loadOptions?.take) || defaultPageSize;
        const page = Math.floor(skipValue / takeValue) + 1;

        try {
          const resp = await lastValueFrom(
            this.bitacoraService.obtenerBitacoraPaginada(
              page,
              takeValue,
              this.fechaInicioFiltro,
              this.fechaFinFiltro,
            ),
          );

          this.loading = false;
          const rowsRaw: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ?? toNum((resp as any)?.total) ?? rowsRaw.length;
          const paginaActual = toNum(meta.page) ?? toNum((resp as any)?.page) ?? page;
          const totalPaginasCalc =
            toNum(meta.lastPage) ??
            toNum((resp as any)?.pages) ??
            Math.max(1, Math.ceil(totalRegistros / takeValue));

          const dataTransformada = rowsRaw
            .map((item) => mapBitacoraPaginatedItemToRow(item))
            .filter((row): row is BitacoraGridRow => row != null);

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginasCalc;
          this.paginaActualData = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros,
          };
        } catch (_error) {
          this.loading = false;
          return { data: [], totalCount: 0 };
        }
      },
    });

    function toNum(v: unknown): number | null {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
  }

  onGridOptionChanged(e: any) {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGrid?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaBitacora);
      return;
    }
    this.filtroActivo = texto;
    let columnas: any[] = [];
    try {
      const colsOpt = grid?.option('columns');
      if (Array.isArray(colsOpt) && colsOpt.length) columnas = colsOpt;
    } catch {
      /* noop */
    }
    if (!columnas.length && grid?.getVisibleColumns) {
      columnas = grid.getVisibleColumns();
    }
    const dataFields: string[] = columnas
      .map((c: any) => c?.dataField)
      .filter((df: any) => typeof df === 'string' && df.trim().length > 0);
    const normalizar = (val: any): string => {
      if (val === null || val === undefined) return '';
      return String(val).toLowerCase();
    };
    const dataFiltrada = (this.paginaActualData || []).filter((row: any) =>
      dataFields.some((df) => normalizar(row?.[df]).includes(texto)),
    );
    grid?.option('dataSource', dataFiltrada);
  }

  limpiarCampos() {
    const rango = this.rangoFechasPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.dataGrid.instance.clearGrouping();
    this.isGrouped = false;
    this.dataGrid.instance.pageIndex(0);
    this.dataGrid.instance.refresh();
  }

  toggleExpandGroups() {
    const groupedColumns = this.dataGrid.instance
      .getVisibleColumns()
      .filter((col) => (col.groupIndex ?? -1) >= 0);
    if (groupedColumns.length === 0) {
      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: '¡Ops!',
        text: 'Debes arrastrar un encabezado de una columna para expandir o contraer grupos.',
        icon: 'warning',
        showCancelButton: false,
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
        allowOutsideClick: false,
      });
    } else {
      this.autoExpandAllGroups = !this.autoExpandAllGroups;
      this.dataGrid.instance.refresh();
    }
  }

  puedeExportarExcel(): boolean {
    return gridTieneDatosParaExportar(this.dataGrid?.instance);
  }

  async exportarExcel(): Promise<void> {
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    try {
      await exportarDxDataGridExcel({ component: inst, fileName: 'Bitacora' });
    } catch (err) {
      console.error('Error al exportar grid:', err);
    }
  }
}
