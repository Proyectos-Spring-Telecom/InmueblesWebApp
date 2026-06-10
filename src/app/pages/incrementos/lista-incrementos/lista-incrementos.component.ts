import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { IncrementosService } from 'src/app/services/moduleService/incrementos.service';
import {
  InpcBanxicoGridRow,
  mapBanxicoDatoToRow,
} from '../inpc-historico.data';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-lista-incrementos',
  templateUrl: './lista-incrementos.component.html',
  styleUrl: './lista-incrementos.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaIncrementosComponent implements OnInit {
  public mensajeAgrupar: string =
    'Arrastre una columna aquí para agrupar por dicha columna';
  public listaIncrementos: any;
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
  public paginaActualData: InpcBanxicoGridRow[] = [];
  public filtroActivo: string = '';

  fechaInicioFiltro = '';
  fechaFinFiltro = '';
  private datosBanxicoCache: InpcBanxicoGridRow[] = [];

  constructor(
    private router: Router,
    private incrementosService: IncrementosService,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    const rango = this.rangoFechasPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.setupDataSource();
  }

  agregarIncremento() {
    this.router.navigateByUrl('/incrementos/agregar-incremento');
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  private rangoFechasPorDefecto(): { inicio: string; fin: string } {
    const hoy = new Date();
    return {
      inicio: '2026-01-01',
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
    this.datosBanxicoCache = [];
    this.dataGrid?.instance?.pageIndex(0);
    this.dataGrid?.instance?.refresh();
  }

  setupDataSource() {
    this.loading = true;
    const defaultPageSize = this.pageSize || 10;

    this.listaIncrementos = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const skipValue = Number(loadOptions?.skip) || 0;
        const takeValue = Number(loadOptions?.take) || defaultPageSize;

        try {
          if (!this.datosBanxicoCache.length) {
            const resp = await lastValueFrom(
              this.incrementosService.obtenerBanxicoDatos(
                this.fechaInicioFiltro,
                this.fechaFinFiltro,
              ),
            );
            const rowsRaw: any[] = Array.isArray(resp?.datos) ? resp.datos : [];
            this.datosBanxicoCache = rowsRaw
              .map((item) => mapBanxicoDatoToRow(item))
              .filter((row): row is InpcBanxicoGridRow => row != null);
          }

          this.loading = false;
          const totalRegistros = this.datosBanxicoCache.length;
          const paginaActual = Math.floor(skipValue / takeValue) + 1;
          const totalPaginasCalc = Math.max(
            1,
            Math.ceil(totalRegistros / takeValue),
          );
          const dataTransformada = this.datosBanxicoCache.slice(
            skipValue,
            skipValue + takeValue,
          );

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
          this.datosBanxicoCache = [];
          return { data: [], totalCount: 0 };
        }
      },
    });
  }

  onGridOptionChanged(e: any) {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGrid?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaIncrementos);
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
      if (val instanceof Date) {
        const dd = String(val.getDate()).padStart(2, '0');
        const mm = String(val.getMonth() + 1).padStart(2, '0');
        const yyyy = val.getFullYear();
        return `${dd}/${mm}/${yyyy}`.toLowerCase();
      }
      return String(val).toLowerCase();
    };
    const dataFiltrada = (this.paginaActualData || []).filter((row: any) => {
      const hitEnColumnas = dataFields.some((df) =>
        normalizar(row?.[df]).includes(texto),
      );
      const extras = [
        normalizar(row?.id),
        normalizar(row?.indice),
        normalizar(row?.porcAnual),
        normalizar(row?.porcAcumAnual),
        normalizar(String(row?.indiceFmt ?? '').replace(/,/g, '')),
      ];

      return hitEnColumnas || extras.some((s) => s.includes(texto));
    });
    grid?.option('dataSource', dataFiltrada);
  }

  limpiarCampos() {
    const rango = this.rangoFechasPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.datosBanxicoCache = [];
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
}
