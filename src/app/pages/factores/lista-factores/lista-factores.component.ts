import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { FactoresService } from 'src/app/services/moduleService/factores.service';
import Swal from 'sweetalert2';

const CATEGORIA_FACTOR_LABEL: Record<string, string> = {
  UBICACION: 'Ubicación y entorno',
  SUPERFICIE: 'Superficie / físico',
  MERCADO: 'Mercado / demanda',
  USO_SUELO: 'Uso de suelo',
  OTRO: 'Otro',
};

const UNIDAD_FACTOR_LABEL: Record<string, string> = {
  COEFICIENTE: 'Coeficiente',
  POR_M2: 'Por m²',
  PORCENTUAL: 'Porcentual (%)',
};

@Component({
  selector: 'app-lista-factores',
  templateUrl: './lista-factores.component.html',
  styleUrl: './lista-factores.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaFactoresComponent implements OnInit {
  public mensajeAgrupar: string =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public listaFactores: any;
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
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';

  constructor(
    private router: Router,
    private factoresService: FactoresService,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    this.setupDataSource();
  }

  agregarFactor() {
    this.router.navigateByUrl('/factores/agregar-factor');
  }

  actualizarFactor(idFactor: number) {
    this.router.navigateByUrl('/factores/editar-factor/' + idFactor);
  }

  activar(rowData: any) {
    Swal.fire({
      title: '¡Activar!',
      html: `¿Está seguro que requiere activar el factor: <strong>${rowData.nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.value) {
        this.factoresService.updateEstatusActivar(rowData.id, 1).subscribe(
          () => {
            Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Confirmación Realizada!',
              html: `El factor ha sido activado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.setupDataSource();
            this.dataGrid.instance.refresh();
          },
          (error) => {
            Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Ops!',
              html: `${error}`,
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          },
        );
      }
    });
  }

  desactivar(rowData: any) {
    Swal.fire({
      title: '¡Desactivar!',
      html: `¿Está seguro que requiere desactivar el factor: <strong>${rowData.nombre}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      background: '#141a21',
      color: '#ffffff',
    }).then((result) => {
      if (result.value) {
        this.factoresService.updateEstatusDesactivar(rowData.id, 0).subscribe(
          () => {
            Swal.fire({
              title: '¡Confirmación Realizada!',
              html: `El factor ha sido desactivado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
              background: '#141a21',
              color: '#ffffff',
            });
            this.setupDataSource();
            this.dataGrid.instance.refresh();
          },
          (error) => {
            Swal.fire({
              title: '¡Ops!',
              html: `${error}`,
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
              background: '#141a21',
              color: '#ffffff',
            });
          },
        );
      }
    });
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  setupDataSource() {
    this.loading = true;

    this.listaFactores = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.factoresService.obtenerFactoresData(page, take),
          );
          this.loading = false;
          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ?? toNum(resp?.total) ?? rows.length;
          const paginaActual = toNum(meta.page) ?? toNum(resp?.page) ?? page;
          const totalPaginas =
            toNum(meta.lastPage) ??
            toNum(resp?.pages) ??
            Math.max(1, Math.ceil(totalRegistros / take));

          const dataTransformada = rows.map((item: any) => ({
            ...item,
            estatusTexto:
              item?.estatus === 1
                ? 'Activo'
                : item?.estatus === 0
                  ? 'Inactivo'
                  : null,
            categoriaLabel:
              CATEGORIA_FACTOR_LABEL[item?.categoria] ?? item?.categoria ?? '',
            unidadLabel: UNIDAD_FACTOR_LABEL[item?.unidad] ?? item?.unidad ?? '',
            formulaTexto: `${item?.nombre ?? 'Factor'} = (${item?.valor ?? 0}) x ${UNIDAD_FACTOR_LABEL[item?.unidad] ?? item?.unidad ?? 'unidad'}`,
          }));

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

  onGridOptionChanged(e: any) {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGrid?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaFactores);
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
      const extras = [normalizar(row?.id), normalizar(row?.estatusTexto)];

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
