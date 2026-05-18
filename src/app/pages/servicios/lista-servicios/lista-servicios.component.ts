import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { CatServiciosService } from 'src/app/services/moduleService/cat-servicios.service';
import Swal from 'sweetalert2';

export interface CatServicioGridRow {
  id: number;
  nombre: string;
  estatus: number;
}

function extraerFilasPaginadas(resp: Record<string, unknown>): unknown[] {
  if (resp == null) return [];
  if (Array.isArray(resp)) return resp;
  let rows: unknown = resp['data'];
  if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
    const bag = rows as Record<string, unknown>;
    rows = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
  }
  return Array.isArray(rows) ? rows : [];
}

function mapCatServicioApiToRow(item: unknown): CatServicioGridRow | null {
  const row = item as Record<string, unknown>;
  const id = Number(row['id'] ?? row['idCatServicio']);
  if (!Number.isFinite(id)) return null;
  const nombreRaw = row['nombre'] ?? row['servicio'];
  const nombre =
    nombreRaw != null && String(nombreRaw).trim() !== ''
      ? String(nombreRaw).trim()
      : '—';
  let estatus = 1;
  if (typeof row['activo'] === 'boolean') {
    estatus = row['activo'] ? 1 : 0;
  } else if (row['estatus'] != null) {
    const n = Number(row['estatus']);
    estatus = n === 1 ? 1 : 0;
  }
  return { id, nombre, estatus };
}

@Component({
  selector: 'app-lista-servicios',
  templateUrl: './lista-servicios.component.html',
  styleUrl: './lista-servicios.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaServiciosComponent implements OnInit {
  public mensajeAgrupar: string =
    'Arrastre una columna aquí para agrupar por dicha columna';
  /** CustomStore de DevExtreme; tipado laxo para compatibilidad con el template del grid. */
  public listaServicios: any;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loading: boolean;
  public loadingMessage: string = 'Cargando...';
  public pageSize: number = 20;
  @ViewChild(DxDataGridComponent, { static: false })
  dataGrid: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;
  public paginaActualData: CatServicioGridRow[] = [];
  public filtroActivo: string = '';
  public totalRegistros: number = 0;
  public paginaActual: number = 1;
  public totalPaginas: number = 0;

  constructor(
    private router: Router,
    private catServiciosService: CatServiciosService,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    this.setupDataSource();
  }

  agregarServicio() {
    this.router.navigateByUrl('/servicios/agregar-servicio');
  }

  editarServicio(idServicio: number) {
    this.router.navigateByUrl('/servicios/editar-servicio/' + idServicio);
  }

  activar(rowData: CatServicioGridRow) {
    Swal.fire({
      title: 'Activar',
      html: `¿Confirma dar de alta el servicio <strong>${rowData.nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.catServiciosService.activarServicio(rowData.id).subscribe({
        next: () => {
          Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: 'Listo',
            html: `El servicio ha sido activado.`,
            icon: 'success',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
          this.setupDataSource();
          this.dataGrid?.instance?.refresh();
        },
        error: (error: unknown) => {
          Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: 'Error',
            html: `${error}`,
            icon: 'error',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
        },
      });
    });
  }

  desactivar(rowData: CatServicioGridRow) {
    Swal.fire({
      title: 'Desactivar',
      html: `¿Confirma dar de baja el servicio <strong>${rowData.nombre}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      background: '#141a21',
      color: '#ffffff',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.catServiciosService.desactivarServicio(rowData.id).subscribe({
        next: () => {
          Swal.fire({
            title: 'Listo',
            html: `El servicio ha sido desactivado.`,
            icon: 'success',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
            background: '#141a21',
            color: '#ffffff',
          });
          this.setupDataSource();
          this.dataGrid?.instance?.refresh();
        },
        error: (error: unknown) => {
          Swal.fire({
            title: 'Error',
            html: `${error}`,
            icon: 'error',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
            background: '#141a21',
            color: '#ffffff',
          });
        },
      });
    });
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  setupDataSource() {
    this.loading = true;
    const defaultPageSize = this.pageSize || 10;

    this.listaServicios = new CustomStore({
      key: 'id',
      load: async (loadOptions: { skip?: number; take?: number }) => {
        const skipValue = Number(loadOptions?.skip) || 0;
        const takeValue = Number(loadOptions?.take) || defaultPageSize;
        const page = Math.floor(skipValue / takeValue) + 1;

        try {
          const resp = (await lastValueFrom(
            this.catServiciosService.obtenerServiciosPaginados(page, takeValue),
          )) as Record<string, unknown>;
          this.loading = false;

          const rowsRaw = extraerFilasPaginadas(resp);
          const meta = (resp?.['paginated'] as Record<string, unknown>) || {};

          const totalRegistros =
            toNum(meta['total']) ?? toNum(resp['total']) ?? rowsRaw.length;
          const paginaActual = toNum(meta['page']) ?? toNum(resp['page']) ?? page;
          const totalPaginasCalc =
            toNum(meta['lastPage']) ??
            toNum(resp['pages']) ??
            Math.max(1, Math.ceil(totalRegistros / takeValue));

          const dataTransformada = rowsRaw
            .map((item) => mapCatServicioApiToRow(item))
            .filter((r): r is CatServicioGridRow => r != null);

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual ?? page;
          this.totalPaginas = totalPaginasCalc;
          this.paginaActualData = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros,
          };
        } catch {
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
      grid?.option('dataSource', this.listaServicios);
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
      .filter((df): df is string => typeof df === 'string' && df.trim().length > 0);
    const normalizar = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) {
        const dd = String(val.getDate()).padStart(2, '0');
        const mm = String(val.getMonth() + 1).padStart(2, '0');
        const yyyy = val.getFullYear();
        return `${dd}/${mm}/${yyyy}`.toLowerCase();
      }
      return String(val).toLowerCase();
    };
    const dataFiltrada = (this.paginaActualData || []).filter((row) => {
      const rowRec = row as unknown as Record<string, unknown>;
      const hitEnColumnas = dataFields.some((df) =>
        normalizar(rowRec[df]).includes(texto),
      );
      const extras = [normalizar(row?.id), normalizar(row?.nombre)];
      return hitEnColumnas || extras.some((s) => s.includes(texto));
    });
    grid?.option('dataSource', dataFiltrada);
  }

  limpiarCampos() {
    this.dataGrid.instance.clearGrouping();
    this.isGrouped = false;
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
        title: 'Agrupación',
        text: 'Arrastre el encabezado de una columna al panel de agrupación para poder expandir o contraer grupos.',
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
