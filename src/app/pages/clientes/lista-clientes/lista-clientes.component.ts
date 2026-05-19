import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { AuthenticationService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';
import {
  ClienteGridRow,
  mapClientesApiToGridRows,
} from '../clientes-list.mapper';

@Component({
  selector: 'app-lista-clientes',
  templateUrl: './lista-clientes.component.html',
  styleUrl: './lista-clientes.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaClientesComponent implements OnInit {
  isLoading: boolean = false;
  listaClientes: any;
  public grid: boolean = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
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
  public paginaActualData: ClienteGridRow[] = [];
  public filtroActivo: string = '';

  constructor(
    private cliService: ClientesService,
    private route: Router,
    private auth: AuthenticationService
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    if (!this.auth.isAuthenticated() || this.auth.isRefreshBlocked()) {
      return;
    }
    this.setupDataSource();
  }

  agregarCliente() {
    this.route.navigateByUrl('/clientes/agregar-cliente');
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  setupDataSource() {
    this.loading = true;
    this.listaClientes = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        if (!this.auth.isAuthenticated() || this.auth.isRefreshBlocked()) {
          return { data: [], totalCount: 0 };
        }

        const skip = Number(loadOptions?.skip) || 0;
        const take = Number(loadOptions?.take) || this.pageSize;
        const page = Math.floor(skip / take) + 1;

        try {
          const response: any = await lastValueFrom(
            this.cliService.obtenerClientesData(page, take)
          );

          this.loading = false;

          const meta = response?.paginated || {};
          const totalRegistros =
            Number(meta.total) || Number(response?.total) || 0;
          const paginaActual =
            Number(meta.page) || Number(response?.page) || page;
          const totalPaginas =
            Number(meta.lastPage) ||
            Number(response?.pages) ||
            (take > 0 ? Math.ceil(totalRegistros / take) : 0);

          this.paginaActual = paginaActual;
          this.totalRegistros = totalRegistros;
          this.totalPaginas = totalPaginas;

          const raw = Array.isArray(response?.data) ? response.data : [];
          const dataTransformada = mapClientesApiToGridRows(raw);

          this.paginaActualData = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros,
          };
        } catch (error) {
          this.loading = false;
          console.error('Error en la solicitud de datos:', error);
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
      grid?.option('dataSource', this.listaClientes);
      return;
    }
    this.filtroActivo = texto;

    let columnas: { dataField?: string }[] = [];
    try {
      const colsOpt = grid?.option('columns') as unknown;
      if (Array.isArray(colsOpt) && colsOpt.length) columnas = colsOpt as { dataField?: string }[];
    } catch {
      /* noop */
    }
    if (!columnas.length && grid?.getVisibleColumns) {
      columnas = grid.getVisibleColumns() as { dataField?: string }[];
    }
    const dataFields: string[] = columnas
      .map((c) => c?.dataField)
      .filter((df): df is string => typeof df === 'string' && df.trim().length > 0);

    const normalizar = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      return String(val)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
    };

    const dataFiltrada = (this.paginaActualData || []).filter((row: ClienteGridRow) => {
      const hitEnColumnas = dataFields.some((df) =>
        normalizar((row as unknown as Record<string, unknown>)?.[df]).includes(
          texto,
        ),
      );
      const extras = [
        normalizar(row.etiquetaBusqueda),
        normalizar(row.NombreCompleto),
        normalizar(row.rfc),
        normalizar(row.correo),
        normalizar(row.telefono),
        normalizar(row.tipoPersona),
        normalizar(row.nombreEncargado),
        normalizar(row.direccionCompleta),
        normalizar(row.id),
      ];
      return hitEnColumnas || extras.some((s) => s.includes(texto));
    });

    grid?.option('dataSource', dataFiltrada);
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  actualizarCliente(cliente: ClienteGridRow) {
    this.route.navigate(
      ['/clientes/editar-cliente', cliente.id],
      { state: { cliente: cliente.detalle ?? cliente } }
    );
  }

  eliminarCliente(cliente: any) {
    Swal.fire({
      title: '¡Eliminar Arrendador!',
      html: `Está seguro que requiere eliminar el arrendador: <br> ${cliente.NombreCompleto}?`,
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
        this.cliService.eliminarCliente(cliente.id).subscribe(
          (response) => {
            Swal.fire({
              background: '#141a21',
        color: '#ffffff',
              title: '¡Eliminado!',
              html: `El arrendador ha sido eliminado de forma exitosa.`,
              icon: 'success',
              showCancelButton: false,
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.setupDataSource();
          },
          (error) => {
            Swal.fire({
              background: '#141a21',
              title: '¡Ops!',
              html: `Error al intentar eliminar el arrendador.`,
              icon: 'error',
              showCancelButton: false,
            });
          }
        );
      }
    });
  }

  activar(rowData: any) {
    Swal.fire({
      title: '¡Activar!',
      background: '#141a21',
      color: '#ffffff',
      html: `¿Está seguro que requiere activar el arrendador: <strong>${rowData.nombre}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.value) {
        this.cliService.updateEstatus(rowData.id, 1).subscribe(
          (response) => {
            Swal.fire({
              background: '#141a21',
        color: '#ffffff',
              title: '¡Confirmación Realizada!',
              html: `El arrendador ha sido activado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });

            this.setupDataSource();
            this.dataGrid.instance.refresh();
            // this.obtenerListaModulos();
          },
          (error) => {
            Swal.fire({
              title: '¡Ops!',
              background: '#141a21',
        color: '#ffffff',
              html: `${error}`,
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          }
        );
      }
    });
  }

  desactivar(rowData: any) {
    Swal.fire({
      title: '¡Desactivar!',
      html: `¿Está seguro que requiere desactivar el arrendador: <strong>${rowData.nombre}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      background: '#141a21',
        color: '#ffffff',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.value) {
        this.cliService.updateEstatus(rowData.id, 0).subscribe(
          (response) => {
            Swal.fire({
              background: '#141a21',
        color: '#ffffff',
              title: '¡Confirmación Realizada!',
              html: `El arrendador ha sido desactivado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.setupDataSource();
            this.dataGrid.instance.refresh();
            // this.obtenerListaModulos();
          },
          (error) => {
            Swal.fire({
              title: '¡Ops!',
              html: `${error}`,
              icon: 'error',
              background: '#141a21',
        color: '#ffffff',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          }
        );
      }
    });
    // console.log('Desactivar:', rowData);
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

  limpiarCampos() {
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    inst.clearGrouping();
    inst.clearFilter();
    inst.pageIndex(0);
    inst.option('searchPanel.text', '');
    this.filtroActivo = '';
    inst.option('dataSource', this.listaClientes);
    inst.refresh();
    this.isGrouped = false;
  }

}
