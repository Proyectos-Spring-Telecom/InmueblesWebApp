import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { forkJoin, lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { ContratosService } from 'src/app/services/moduleService/contratos.service';
import { InstalacionService } from 'src/app/services/moduleService/instalaciones.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-lista-contratos',
  templateUrl: './lista-contratos.component.html',
  styleUrl: './lista-contratos.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaContratosComponent implements OnInit {
  public mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public listaContratos: any;
  public showFilterRow = true;
  public showHeaderFilter = true;
  public pageSize = 20;
  public paginaActualData: any[] = [];
  @ViewChild(DxDataGridComponent, { static: false })
  dataGrid!: DxDataGridComponent;
  public autoExpandAllGroups = true;
  isGrouped = false;

  private nombresCliente = new Map<number, string>();
  private nombresInmueble = new Map<number, string>();

  constructor(
    private router: Router,
    private contratosService: ContratosService,
    private clientesService: ClientesService,
    private instalacionService: InstalacionService,
  ) {}

  ngOnInit() {
    forkJoin({
      clientes: this.clientesService.obtenerClientes(),
      instalaciones: this.instalacionService.obtenerInstalaciones(),
    }).subscribe({
      next: ({ clientes, instalaciones }) => {
        const rowsC = clientes?.data ?? clientes ?? [];
        (Array.isArray(rowsC) ? rowsC : []).forEach((c: any) => {
          const id = Number(c?.id);
          if (!Number.isFinite(id)) return;
          const t = [c?.nombre, c?.apellidoPaterno, c?.apellidoMaterno]
            .filter(Boolean)
            .join(' ')
            .trim();
          this.nombresCliente.set(id, t || String(id));
        });
        const rowsI = instalaciones?.data ?? instalaciones ?? [];
        (Array.isArray(rowsI) ? rowsI : []).forEach((i: any) => {
          const id = Number(i?.id);
          if (!Number.isFinite(id)) return;
          const t =
            i?.nombreInstalacion ?? i?.nombre ?? i?.clave ?? `#${id}`;
          this.nombresInmueble.set(id, String(t));
        });
        this.setupDataSource();
      },
      error: () => this.setupDataSource(),
    });
  }

  agregarContrato() {
    this.router.navigateByUrl('/contratos/agregar-contrato');
  }

  actualizarContrato(id: number) {
    this.router.navigateByUrl('/contratos/editar-contrato/' + id);
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    e.component.refresh();
  }

  private parseIdsInmuebles(raw: unknown): number[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
      return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
    }
    if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw);
        return this.parseIdsInmuebles(p);
      } catch {
        return raw
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n));
      }
    }
    return [];
  }

  private textoInmuebles(ids: number[]): string {
    if (!ids.length) return '';
    return ids
      .map((id) => this.nombresInmueble.get(id) ?? String(id))
      .join(', ');
  }

  setupDataSource() {
    this.listaContratos = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp: any = await lastValueFrom(
            this.contratosService.obtenerContratosData(page, take),
          );
          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            Number(meta.total) ||
            Number(resp?.total) ||
            rows.length ||
            0;

          const dataTransformada = rows.map((item: any) => {
            const idsI = this.parseIdsInmuebles(
              item?.idInmuebles ?? item?.idsInmuebles,
            );
            const idA = Number(item?.idArrendador);
            const idT = Number(item?.idArrendatario);
            return {
              ...item,
              nombreArrendador:
                item?.nombreArrendador ??
                (Number.isFinite(idA)
                  ? this.nombresCliente.get(idA)
                  : undefined) ??
                item?.idArrendador,
              nombreArrendatario:
                item?.nombreArrendatario ??
                (Number.isFinite(idT)
                  ? this.nombresCliente.get(idT)
                  : undefined) ??
                item?.idArrendatario,
              inmueblesTexto:
                item?.inmueblesTexto ?? this.textoInmuebles(idsI),
            };
          });

          this.paginaActualData = dataTransformada;
          return { data: dataTransformada, totalCount: totalRegistros };
        } catch {
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
      grid?.option('dataSource', this.listaContratos);
      return;
    }
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
      const extras = [normalizar(row?.id)];
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
