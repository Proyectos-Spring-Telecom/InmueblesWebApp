import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import Swal from 'sweetalert2';
import { FACTORES_PRESUPUESTO_DEMO } from '../factores-presupuesto-demo.data';
import { FORMULAS_PRESUPUESTO_DEMO } from '../formulas-presupuesto-demo.data';

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
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;
  public paginaActualDataFactores: any[] = [];
  public paginaActualDataFormulas: any[] = [];
  public filtroActivoFactores: string = '';
  public filtroActivoFormulas: string = '';

  constructor(private router: Router) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    this.setupFactoresPresupuestoDemo();
    this.setupFormulasPresupuestoDemo();
  }

  agregarFactor() {
    this.router.navigateByUrl('/factores/agregar-factor');
  }

  actualizarFactor(idFactor: number) {
    this.router.navigateByUrl('/factores/editar-factor/' + idFactor);
  }

  editarFormulaDemo(_row: { id: number; nombre: string; formula: string }) {
    this.router.navigateByUrl('/factores/agregar-factor');
  }

  eliminarFormulaDemo(row: { id: number; nombre: string }) {
    Swal.fire({
      title: 'Eliminar fórmula',
      html: `La fórmula <strong>${row.nombre}</strong> es de demostración y no se elimina del servidor.`,
      icon: 'info',
      background: '#141a21',
      color: '#ffffff',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Entendido',
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

  setupFactoresPresupuestoDemo() {
    const all = [...FACTORES_PRESUPUESTO_DEMO];
    this.paginaActualDataFactores = all;

    this.listaFactoresDemo = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSizeFactoresDemo || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const slice = all.slice(skip, skip + take);
        return {
          data: slice,
          totalCount: all.length,
        };
      },
    });
  }

  setupFormulasPresupuestoDemo() {
    const all = [...FORMULAS_PRESUPUESTO_DEMO];
    this.paginaActualDataFormulas = all;

    this.listaFormulasDemo = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSizeFormulasDemo || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const slice = all.slice(skip, skip + take);
        return {
          data: slice,
          totalCount: all.length,
        };
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
      const extras = [normalizar(row?.id)];
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

  limpiarCampos() {
    this.dataGridFactores?.instance?.clearGrouping();
    this.dataGridFormulas?.instance?.clearGrouping();
    this.isGrouped = false;
    this.dataGridFactores?.instance?.refresh();
    this.dataGridFormulas?.instance?.refresh();
  }

  toggleExpandGroups() {
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
      this.autoExpandAllGroups = !this.autoExpandAllGroups;
      inst.refresh();
      this.dataGridFormulas?.instance?.refresh();
    }
  }
}
