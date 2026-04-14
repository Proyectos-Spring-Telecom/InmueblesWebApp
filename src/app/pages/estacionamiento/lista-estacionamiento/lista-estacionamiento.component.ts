import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import { routeAnimation } from 'src/app/pipe/module-open.animation';

@Component({
  selector: 'app-lista-estacionamiento',
  templateUrl: './lista-estacionamiento.component.html',
  styleUrl: './lista-estacionamiento.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaEstacionamientoComponent implements OnInit {
  public mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public showFilterRow = true;
  public showHeaderFilter = true;
  public autoExpandAllGroups = true;
  public pageSize = 20;
  public listaEstacionamientos: any[] = [];
  public filtroActivo = '';
  @ViewChild(DxDataGridComponent, { static: false })
  dataGrid!: DxDataGridComponent;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.listaEstacionamientos = [
      {
        id: 1,
        nombre: 'Juan Pérez',
        numeroTarjeta: 'TAR-1001',
        arrendatario: 'Santory',
        estatus: 1,
      },
      {
        id: 2,
        nombre: 'María Gómez',
        numeroTarjeta: 'TAR-1002',
        arrendatario: 'Spring Telecom México',
        estatus: 0,
      },
    ];
  }

  agregarEstacionamiento(): void {
    this.router.navigateByUrl('/estacionamiento/agregar-estacionamiento');
  }

  actualizarEstacionamiento(idEstacionamiento: number): void {
    this.router.navigateByUrl(
      '/estacionamiento/editar-estacionamiento/' + idEstacionamiento,
    );
  }

  activar(rowData: any): void {
    rowData.estatus = 1;
    this.dataGrid?.instance?.refresh();
  }

  desactivar(rowData: any): void {
    rowData.estatus = 0;
    this.dataGrid?.instance?.refresh();
  }

  onPageIndexChanged(_e: any): void {}

  onGridOptionChanged(e: any): void {
    if (e.fullName === 'searchPanel.text') {
      this.filtroActivo = (e.value ?? '').toString();
    }
  }

  limpiarCampos(): void {
    this.dataGrid?.instance?.clearGrouping();
    this.dataGrid?.instance?.clearFilter();
    this.dataGrid?.instance?.searchByText('');
  }

  toggleExpandGroups(): void {
    this.autoExpandAllGroups = !this.autoExpandAllGroups;
    this.dataGrid?.instance?.refresh();
  }
}

