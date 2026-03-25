import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-lista-usuarios',
  templateUrl: './lista-usuarios.component.html',
  styleUrl: './lista-usuarios.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaUsuariosComponent implements OnInit {
  isLoading: boolean = false;
  listaUsuarios: any;
  public grid: boolean = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public loading: boolean;
  public loadingMessage: string = 'Cargando...';
  @ViewChild(DxDataGridComponent, { static: false })
  dataGrid: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  public registros: any[] = [];

  constructor(private usuService: UsuariosService, private route: Router) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    this.setupDataSource();
  }

  agregarUsuario() {
    this.route.navigateByUrl('/usuarios/agregar-usuario');
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  onGridOptionChanged(e: any) {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGrid?.instance;
    const qRaw = (e.value ?? '').toString().trim();
    if (!qRaw) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaUsuarios);
      return;
    }
    this.filtroActivo = qRaw;

    const norm = (v: any) =>
      (v == null ? '' : String(v))
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

    const q = norm(qRaw);

    let columnas: any[] = [];
    try {
      const colsOpt = grid?.option('columns');
      if (Array.isArray(colsOpt) && colsOpt.length) columnas = colsOpt;
    } catch {}
    if (!columnas.length && grid?.getVisibleColumns) {
      columnas = grid.getVisibleColumns();
    }

    const dataFields: string[] = columnas
      .map((c: any) => c?.dataField)
      .filter((df: any) => typeof df === 'string' && df.trim().length > 0);

    const getByPath = (obj: any, path: string) =>
      !obj || !path
        ? undefined
        : path.split('.').reduce((acc, k) => acc?.[k], obj);

    let qStatusNum: number | null = null;
    if (q === '1' || q === 'Activo') qStatusNum = 1;
    else if (q === '0' || q === 'Inactivo') qStatusNum = 0;

    const dataFiltrada = (this.paginaActualData || []).filter((row: any) => {
      const hitCols = dataFields.some((df) =>
        norm(getByPath(row, df)).includes(q)
      );

      const estNum = Number(row?.Estatus ?? row?.estatus);
      const estHit =
        Number.isFinite(estNum) &&
        (qStatusNum !== null
          ? estNum === qStatusNum
          : String(estNum).toLowerCase().includes(q));

      const hitExtras = [
        norm(row?.Id),
        norm(row?.id),
        norm(row?.NombreCompleto),
        norm(row?.UserName),
        norm(row?.Telefono),
        norm(row?.RolNombre),
      ].some((s) => s.includes(q));

      return hitCols || estHit || hitExtras;
    });

    grid?.option('dataSource', dataFiltrada);
  }

  setupDataSource() {
    this.loading = true;

    const defaultPageSize = this.pageSize || 10;

    this.listaUsuarios = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const skipValue = Number(loadOptions?.skip) || 0;
        const takeValue = Number(loadOptions?.take) || defaultPageSize;
        const page = Math.floor(skipValue / takeValue) + 1;

        try {
          const response: any = await lastValueFrom(
            this.usuService.obtenerUsuariosData(page, takeValue)
          );

          this.loading = false;

          const paginated = response?.paginated ?? {};
          const data = Array.isArray(response?.data) ? response.data : [];

          const totalRegistros = Number(paginated.total ?? data.length ?? 0);
          const paginaActual = Number(paginated.page ?? page);
          const limite = Number(paginated.limit ?? takeValue);

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = limite;

          const dataTransformada = data.map((item: any) => {
            const nombre = item?.Nombre ?? item?.nombre ?? '';
            const paterno =
              item?.ApellidoPaterno ?? item?.apellidoPaterno ?? '';
            const materno =
              item?.ApellidoMaterno ?? item?.apellidoMaterno ?? '';

            return {
              ...item,
              id: Number(item?.Id ?? item?.id),
              idRol: Number(item?.IdRol ?? item?.idRol),
              idCliente: Number(item?.IdCliente ?? item?.idCliente),
              NombreCompleto: [nombre, paterno, materno]
                .filter(Boolean)
                .join(' '),
            };
          });

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
  }

  toNum(v: any): number {
    const n = Number((v ?? '').toString().trim());
    return Number.isFinite(n) ? n : 0;
  }

  actualizarUsuario(idUsuario: number) {
    this.route.navigateByUrl('/usuarios/editar-usuario/' + idUsuario);
  }

  eliminarUsuario(usuario: any) {
    Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: '¡Eliminar Usuario!',
      html: `¿Está seguro que requiere eliminar el usuario: <br> ${usuario.NombreCompleto}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.value) {
        this.usuService.eliminarUsuario(usuario.Id).subscribe(
          (response) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Eliminado!',
              html: `El usuario ha sido eliminado de forma exitosa.`,
              icon: 'success',
              showCancelButton: false,
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.setupDataSource();
          },
          (error) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Ops!',
              html: `Error al intentar eliminar el usuario.`,
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
      color: '#ffffff',
      background: '#141a21',
      title: '¡Activar!',
      html: `¿Está seguro que requiere activar el usuario: <br> <strong>${rowData.NombreCompleto}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.value) {
        this.usuService.updateEstatus(rowData.id, 1).subscribe(
          (response) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Confirmación Realizada!',
              html: `El usuario ha sido activado.`,
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
              color: '#ffffff',
              background: '#141a21',
              title: '¡Ops!',
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
      color: '#ffffff',
      background: '#141a21',
      title: '¡Desactivar!',
      html: `¿Está seguro que requiere desactivar el usuario:<br> <strong>${rowData.NombreCompleto}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.value) {
        this.usuService.updateEstatus(rowData.id, 0).subscribe(
          (response) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Confirmación Realizada!',
              html: `El usuario ha sido desactivado.`,
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
              color: '#ffffff',
              background: '#141a21',
              title: '¡Ops!',
              html: `${error}`,
              icon: 'error',
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
        color: '#ffffff',
        background: '#141a21',
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
    this.dataGrid.instance.clearGrouping();
    this.dataGrid.instance.pageIndex(0);
    this.dataGrid.instance.refresh();
    this.isGrouped = false;
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }1
}
