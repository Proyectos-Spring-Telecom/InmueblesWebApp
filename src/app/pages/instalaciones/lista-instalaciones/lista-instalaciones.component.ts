import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { InstalacionService } from 'src/app/services/moduleService/instalaciones.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-lista-instalaciones',
  templateUrl: './lista-instalaciones.component.html',
  styleUrl: './lista-instalaciones.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaInstalacionesComponent implements OnInit {
  public mensajeAgrupar: string =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public listaInstalaciones: any;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loading: boolean;
  public loadingMessage: string = 'Cargando...';
  public showExportGrid: boolean;
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

  mostrarModalMapa = false;
  instalacionSeleccionada: any = null;
  map: any = null;
  marker: any = null;

  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';
  private readonly PIN_URL = 'assets/images/logos/marker_spring.webp';

  constructor(
    private router: Router,
    private instalacionService: InstalacionService
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    this.obtenerInstalaciones();
  }

  obtenerInstalaciones() {
    this.loading = true;
    this.instalacionService.obtenerInstalaciones().subscribe((response: any[]) => {
      this.loading = false;
      this.listaInstalaciones = response;
    });
  }

  agregarInstalacion() {
    this.router.navigateByUrl('/instalaciones/agregar-instalacion');
  }

  actualizarInstalacion(idInstalacion: Number) {
    this.router.navigateByUrl('/instalaciones/editar-instalacion/' + idInstalacion);
  }

  verInstalacion(numeroSerie: any) {
    this.router.navigateByUrl('/monitoreo/instalacion/' + numeroSerie);
  }

  activar(rowData: any) {
    Swal.fire({
      title: '¡Activar!',
      html: `¿Está seguro que requiere activar la instalación?`,
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
        this.instalacionService.activar(rowData.id).subscribe(
          () => {
            Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Confirmación Realizada!',
              html: `La instalación ha sido activada.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });

            this.obtenerInstalaciones();
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
          }
        );
      }
    });
  }

  desactivar(rowData: any) {
    Swal.fire({
      title: '¡Desactivar!',
      html: `¿Está seguro que requiere desactivar la instalación?`,
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
        this.instalacionService.desactivar(rowData.id).subscribe(
          () => {
            Swal.fire({
              title: '¡Confirmación Realizada!',
              html: `La instalación ha sido desactivada.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
              background: '#141a21',
              color: '#ffffff',
            });
            this.obtenerInstalaciones();
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
          }
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

    this.listaInstalaciones = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.instalacionService.obtenerInstalacionesData(page, take)
          );
          this.loading = false;

          const rows: any[] = Array.isArray(resp?.data)
            ? resp.data
            : Array.isArray(resp?.items)
            ? resp.items
            : [];

          const meta = resp?.paginated ??
            resp?.meta ?? {
              total: resp?.total,
              page: resp?.page,
              lastPage: resp?.lastPage ?? resp?.pages,
              perPage: resp?.perPage ?? resp?.limit,
            };

          const totalRegistros =
            toNum(meta?.total) ?? toNum(resp?.total) ?? rows.length;

          const paginaActual = toNum(meta?.page) ?? toNum(resp?.page) ?? page;

          const totalPaginas =
            toNum(meta?.lastPage) ??
            toNum(resp?.pages) ??
            Math.max(1, Math.ceil((totalRegistros ?? 0) / take));

          const dataTransformada = rows.map((item: any) => ({
            ...item,
            estatusTexto:
              item?.estatus === 1
                ? 'Activo'
                : item?.estatus === 0
                ? 'Inactivo'
                : null,
          }));

          this.totalRegistros = totalRegistros ?? 0;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginas;
          this.paginaActualData = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros ?? 0,
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
      grid?.option('dataSource', this.listaInstalaciones);
      return;
    }
    this.filtroActivo = texto;
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
        normalizar(row?.[df]).includes(texto)
      );
      const extras = [normalizar(row?.id), normalizar(row?.estatusTexto)];

      return hitEnColumnas || extras.some((s) => s.includes(texto));
    });
    grid?.option('dataSource', dataFiltrada);
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
    this.dataGrid.instance.clearGrouping();
    this.dataGrid.instance.pageIndex(0);
    this.dataGrid.instance.refresh();
    this.isGrouped = false;
  }

  verMapaInstalacion(instalacion: any) {
    this.instalacionSeleccionada = instalacion;
    this.mostrarModalMapa = true;

    if (!this.instalacionSeleccionada?.lat || !this.instalacionSeleccionada?.lng) {
      return;
    }

    setTimeout(() => {
      this.loadGoogleMaps()
        .then(() => this.initMapInstalacion())
        .catch(err => console.error('No se pudo cargar Google Maps', err));
    }, 0);
  }

  cerrarModalMapa() {
    this.mostrarModalMapa = false;
    this.instalacionSeleccionada = null;
    this.map = null;
    this.marker = null;
  }

  loadGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as any;

      if (w.google && w.google.maps) {
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[data-gmaps="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', e => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', 'true');
      script.onload = () => resolve();
      script.onerror = e => reject(e);
      document.head.appendChild(script);
    });
  }

  initMapInstalacion(): void {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const w = window as any;
    if (!w.google || !w.google.maps) return;

    const lat = Number(this.instalacionSeleccionada.lat);
    const lng = Number(this.instalacionSeleccionada.lng);

    this.map = new w.google.maps.Map(mapElement, {
      center: { lat, lng },
      zoom: 15
    });

    const iconUrl = this.PIN_URL;

    this.marker = new w.google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      icon: {
        url: iconUrl,
        scaledSize: new w.google.maps.Size(70, 70),
        anchor: new w.google.maps.Point(35, 70)
      }
    });
  }
}
