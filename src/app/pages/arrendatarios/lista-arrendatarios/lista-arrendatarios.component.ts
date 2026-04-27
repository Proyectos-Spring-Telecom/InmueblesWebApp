import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular/ui/data-grid';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import {
  ArrendatarioLocalGridRow,
  buildArrendatariosLocalesRows,
} from '../arrendatarios-demo.data';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-lista-arrendatarios',
  templateUrl: './lista-arrendatarios.component.html',
  styleUrl: './lista-arrendatarios.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaArrendatariosComponent implements OnInit {
  public rows: ArrendatarioLocalGridRow[] = [];
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por dicha columna';
  public autoExpandAllGroups: boolean = true;
  public isGrouped: boolean = false;
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid: DxDataGridComponent;

  @ViewChild('dataGridRef', { static: false })
  dataGridRef!: DxDataGridComponent;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.rows = buildArrendatariosLocalesRows();
  }

  agregarArrendatario(): void {
    this.router.navigateByUrl('/arrendatarios/agregar-arrendatario');
  }

  limpiarVista(): void {
    const inst = this.dataGridRef?.instance;
    if (!inst) return;
    inst.clearFilter();
    inst.option('searchPanel.text', '');
    inst.refresh();
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
        text: 'Debes arrastar un encabezado de una columna para expandir o contraer grupos.',
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
