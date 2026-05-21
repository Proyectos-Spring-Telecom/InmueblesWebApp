import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { EstacionamientoService } from 'src/app/services/moduleService/estacionamiento.service';
import Swal from 'sweetalert2';

/** Fila del grid en lista de estacionamientos (alineada con el API). */
interface EstacionamientoListaFila {
  id: number;
  nombrePensionado?: string;
  numeroTarjeta?: string;
  arrendatario?: string;
  estatus?: number;
}

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
  public listaEstacionamientos: EstacionamientoListaFila[] = [];
  public filtroActivo = '';
  @ViewChild(DxDataGridComponent, { static: false })
  dataGrid!: DxDataGridComponent;

  constructor(
    private router: Router,
    private estacionamientoService: EstacionamientoService,
  ) {}

  ngOnInit(): void {
    this.listaEstacionamientos = [
      {
        id: 1,
        nombrePensionado: 'Juan Pérez',
        numeroTarjeta: 'TAR-1001',
        arrendatario: 'Santory',
        estatus: 1,
      },
      {
        id: 2,
        nombrePensionado: 'María Gómez',
        numeroTarjeta: 'TAR-1002',
        arrendatario: 'Spring Telecom México',
        estatus: 0,
      },
    ];
  }

  /** API devuelve `estatus` numérico (0 | 1); misma lectura que en alta por inmueble. */
  numEstatus(val: unknown): 0 | 1 {
    if (val === 0 || val === '0') return 0;
    if (val === 1 || val === '1') return 1;
    const n = Number(val);
    if (n === 0) return 0;
    if (n === 1) return 1;
    return 1;
  }

  agregarEstacionamiento(): void {
    this.router.navigateByUrl('/estacionamiento/agregar-estacionamiento');
  }

  actualizarEstacionamiento(idEstacionamiento: number): void {
    this.router.navigateByUrl(
      '/estacionamiento/editar-estacionamiento/' + idEstacionamiento,
    );
  }

  activar(rowData: EstacionamientoListaFila): void {
    const nombre = (rowData.nombrePensionado ?? 'este estacionamiento').trim();
    void Swal.fire({
      title: '¡Activar!',
      html: `¿Está seguro que requiere activar el estacionamiento: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.value) return;
      this.estacionamientoService
        .actualizarEstatus(rowData.id, { estatus: 1 })
        .subscribe({
          next: () => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Confirmación realizada!',
              html: `El estacionamiento ha sido activado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            rowData.estatus = 1;
            this.dataGrid?.instance?.refresh();
          },
          error: (err: unknown) => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Ops!',
              html: this.mensajeErrorHttp(err),
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          },
        });
    });
  }

  desactivar(rowData: EstacionamientoListaFila): void {
    const nombre = (rowData.nombrePensionado ?? 'este estacionamiento').trim();
    void Swal.fire({
      title: '¡Desactivar!',
      html: `¿Está seguro que requiere desactivar el estacionamiento: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.value) return;
      this.estacionamientoService
        .actualizarEstatus(rowData.id, { estatus: 0 })
        .subscribe({
          next: () => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Confirmación realizada!',
              html: `El estacionamiento ha sido dado de baja.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            rowData.estatus = 0;
            this.dataGrid?.instance?.refresh();
          },
          error: (err: unknown) => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Ops!',
              html: this.mensajeErrorHttp(err),
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          },
        });
    });
  }

  private mensajeErrorHttp(err: unknown): string {
    if (
      err != null &&
      typeof err === 'object' &&
      'error' in err &&
      err.error &&
      typeof err.error === 'object' &&
      'message' in err.error &&
      typeof (err.error as { message?: unknown }).message === 'string'
    ) {
      return String((err.error as { message: string }).message);
    }
    return 'No se pudo actualizar el estatus. Intente nuevamente.';
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
