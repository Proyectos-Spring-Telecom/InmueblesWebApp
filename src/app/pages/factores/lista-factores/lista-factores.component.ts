import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { FactoresService } from 'src/app/services/moduleService/factores.service';
import { FormulasService } from 'src/app/services/moduleService/formulas.service';
import { formatValorMilesParaLista } from 'src/app/shared/valor-miles-format';
import Swal from 'sweetalert2';

function mapFactorGridRow(item: any) {
  const variable = String(
    item?.variable ?? item?.Variable ?? item?.nombre ?? item?.Nombre ?? '',
  ).trim();
  const valorRaw = item?.valor ?? item?.Valor ?? '';
  return {
    ...item,
    id: Number(item?.id ?? item?.Id),
    variable,
    valor: valorRaw,
    valorFmt: formatValorMilesParaLista(valorRaw),
    descripcion: item?.descripcion ?? item?.Descripcion ?? '',
    estatus: Number(item?.estatus ?? item?.Estatus ?? 1),
  };
}

function mapFormulaGridRow(item: any) {
  return {
    ...item,
    id: Number(item?.id ?? item?.Id),
    nombre: item?.nombre ?? item?.Nombre ?? '',
    formula: item?.formula ?? item?.Formula ?? '',
    estatus: Number(item?.estatus ?? item?.Estatus ?? 1),
  };
}

@Component({
  selector: 'app-lista-factores',
  templateUrl: './lista-factores.component.html',
  styleUrl: './lista-factores.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaFactoresComponent implements OnInit {
  public mensajeAgrupar: string =
    'Arrastre un encabezado de columna aquí para agrupar por dicha columna';
  public listaFactoresDemo: any;
  public listaFormulasDemo: any;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public pageSizeFactoresDemo: number = 20;
  public pageSizeFormulasDemo: number = 20;
  public paginaActual: number = 1;
  @ViewChild('gridFactoresDemo', { static: false })
  dataGridFactores!: DxDataGridComponent;
  @ViewChild('gridFormulas', { static: false })
  dataGridFormulas!: DxDataGridComponent;
  public autoExpandAllGroupsFactores: boolean = true;
  public autoExpandAllGroupsFormulas: boolean = true;
  isGrouped: boolean = false;
  public paginaActualDataFactores: any[] = [];
  public paginaActualDataFormulas: any[] = [];
  public filtroActivoFactores: string = '';
  public filtroActivoFormulas: string = '';

  constructor(
    private router: Router,
    private factoresService: FactoresService,
    private formulasService: FormulasService,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    this.setupFactoresDataSource();
    this.setupFormulasDataSource();
  }

  agregarFactor() {
    this.router.navigateByUrl('/factores/agregar-factor');
  }

  agregarFormula() {
    this.router.navigateByUrl('/factores/agregar-formula');
  }

  actualizarFactor(idFactor: number) {
    this.router.navigateByUrl('/factores/editar-factor/' + idFactor);
  }

  editarFormula(row: { id: number; nombre: string; formula: string }) {
    this.router.navigateByUrl('/factores/editar-formula/' + row.id);
  }

  activarFactor(rowData: any) {
    Swal.fire({
      title: '¡Activar!',
      html: `¿Confirma dar de alta el factor: <strong>${rowData.variable}</strong>?`,
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
      this.factoresService.updateEstatusActivar(rowData.id, 1).subscribe({
        next: () => {
            Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Confirmación realizada!',
              html: `El factor ha sido activado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.setupFactoresDataSource();
            this.dataGridFactores?.instance?.refresh();
          },
          error: (error) => {
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
      });
    });
  }

  desactivarFactor(rowData: any) {
    Swal.fire({
      title: '¡Desactivar!',
      html: `¿Confirma dar de baja el factor: <strong>${rowData.variable}</strong>?`,
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
      this.factoresService.updateEstatusDesactivar(rowData.id, 0).subscribe({
        next: () => {
            Swal.fire({
              title: '¡Confirmación realizada!',
              html: `El factor ha sido desactivado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
              background: '#141a21',
              color: '#ffffff',
            });
            this.setupFactoresDataSource();
            this.dataGridFactores?.instance?.refresh();
          },
          error: (error) => {
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
      });
    });
  }

  activarFormula(rowData: any) {
    Swal.fire({
      title: '¡Activar!',
      html: `¿Confirma dar de alta la fórmula: <strong>${rowData.nombre}</strong>?`,
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
      this.formulasService.updateEstatusActivar(rowData.id, 1).subscribe({
        next: () => {
            Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Confirmación realizada!',
              html: `La fórmula ha sido activada.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.setupFormulasDataSource();
            this.dataGridFormulas?.instance?.refresh();
          },
          error: (error) => {
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
      });
    });
  }

  desactivarFormula(rowData: any) {
    Swal.fire({
      title: '¡Desactivar!',
      html: `¿Confirma dar de baja la fórmula: <strong>${rowData.nombre}</strong>?`,
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
      this.formulasService.updateEstatusDesactivar(rowData.id, 0).subscribe({
        next: () => {
            Swal.fire({
              title: '¡Confirmación realizada!',
              html: `La fórmula ha sido desactivada.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
              background: '#141a21',
              color: '#ffffff',
            });
            this.setupFormulasDataSource();
            this.dataGridFormulas?.instance?.refresh();
          },
          error: (error) => {
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
      });
    });
  }

  onPageIndexChangedFactoresDemo(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  onPageIndexChangedFormulasDemo(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  setupFactoresDataSource() {
    const defaultPageSize = this.pageSizeFactoresDemo || 10;

    this.listaFactoresDemo = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || defaultPageSize;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.factoresService.obtenerFactoresData(page, take),
          );
          const rowsRaw: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ?? toNum(resp?.total) ?? rowsRaw.length;
          const dataTransformada = rowsRaw.map((item: any) => mapFactorGridRow(item));

          this.paginaActualDataFactores = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros,
          };
        } catch (err) {
          console.error('Error al cargar factores:', err);
          return { data: [], totalCount: 0 };
        }
      },
    });
  }

  setupFormulasDataSource() {
    const defaultPageSize = this.pageSizeFormulasDemo || 10;

    this.listaFormulasDemo = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || defaultPageSize;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.formulasService.obtenerFormulasData(page, take),
          );
          const rowsRaw: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ?? toNum(resp?.total) ?? rowsRaw.length;
          const dataTransformada = rowsRaw.map((item: any) => mapFormulaGridRow(item));

          this.paginaActualDataFormulas = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros,
          };
        } catch (err) {
          console.error('Error al cargar fórmulas:', err);
          return { data: [], totalCount: 0 };
        }
      },
    });
  }

  onFactoresDemoGridOptionChanged(e: any) {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGridFactores?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivoFactores = '';
      grid?.option('dataSource', this.listaFactoresDemo);
      return;
    }
    this.filtroActivoFactores = texto;
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
    const dataFiltrada = (this.paginaActualDataFactores || []).filter((row: any) => {
      const hitEnColumnas = dataFields.some((df) =>
        normalizar(row?.[df]).includes(texto),
      );
      const extras = [
        normalizar(row?.id),
        normalizar(row?.valor),
        normalizar(String(row?.valorFmt ?? '').replace(/,/g, '')),
      ];
      return hitEnColumnas || extras.some((s) => s.includes(texto));
    });
    grid?.option('dataSource', dataFiltrada);
  }

  onFormulasDemoGridOptionChanged(e: any) {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGridFormulas?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivoFormulas = '';
      grid?.option('dataSource', this.listaFormulasDemo);
      return;
    }
    this.filtroActivoFormulas = texto;
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
    const dataFiltrada = (this.paginaActualDataFormulas || []).filter((row: any) => {
      const hitEnColumnas = dataFields.some((df) =>
        normalizar(row?.[df]).includes(texto),
      );
      const extras = [normalizar(row?.id)];
      return hitEnColumnas || extras.some((s) => s.includes(texto));
    });
    grid?.option('dataSource', dataFiltrada);
  }

  limpiarFactores() {
    this.dataGridFactores?.instance?.clearGrouping();
    this.dataGridFactores?.instance?.refresh();
  }

  limpiarFormulas() {
    this.dataGridFormulas?.instance?.clearGrouping();
    this.dataGridFormulas?.instance?.refresh();
  }

  toggleExpandFactores() {
    const inst = this.dataGridFactores?.instance;
    if (!inst) return;
    const groupedColumns = inst
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
      const next = !this.autoExpandAllGroupsFactores;
      this.autoExpandAllGroupsFactores = next;
      inst.option('grouping.autoExpandAll', next);
      inst.refresh();
    }
  }

  toggleExpandFormulas() {
    const inst = this.dataGridFormulas?.instance;
    if (!inst) return;
    const groupedColumns = inst
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
      const next = !this.autoExpandAllGroupsFormulas;
      this.autoExpandAllGroupsFormulas = next;
      inst.option('grouping.autoExpandAll', next);
      inst.refresh();
    }
  }
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
