import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DxDataGridComponent, DxDataGridModule } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ContratosService } from 'src/app/services/moduleService/contratos.service';
import {
  COSTOS_ACTUALES_RESUMEN_VACIO,
  CostosActualesResumen,
  extraerFilasRentRolApi,
  extraerMetaPaginacionRentRol,
  extraerResumenCostosActuales,
  flattenRentRolRowsToGridLines,
  mapCostosActualesApiToRentRolRow,
  RENT_ROL_FILAS_GRID_POR_PAGINA,
  RentRolGridLine,
} from '../rent-rol/rent-rol-list.mapper';

/**
 * Rent Rol (header): costos vigentes por contrato
 * (`GET /contratos/costos-actuales/paginated`). Sin estado de pago.
 */
@Component({
  selector: 'app-rent-rol-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, DxDataGridModule],
  templateUrl: './rent-rol-grid.component.html',
  styleUrl: './rent-rol-grid.component.scss',
  animations: [routeAnimation],
})
export class RentRolGridComponent implements OnInit {
  readonly filasPorPagina = RENT_ROL_FILAS_GRID_POR_PAGINA;
  readonly showFilterRow = true;

  @ViewChild(DxDataGridComponent, { static: false })
  dataGrid?: DxDataGridComponent;

  listaCostos: CustomStore | null = null;
  resumen: CostosActualesResumen = { ...COSTOS_ACTUALES_RESUMEN_VACIO };
  cargando = false;
  errorCarga: string | null = null;
  busqueda = '';
  busquedaAplicada = '';

  constructor(private contratosService: ContratosService) {}

  ngOnInit(): void {
    this.setupDataSource();
  }

  get cantidadRelaciones(): number {
    return this.resumen.cantidadRelaciones;
  }

  aplicarBusqueda(): void {
    this.busquedaAplicada = this.busqueda.trim().slice(0, 100);
    void this.dataGrid?.instance?.refresh();
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
    if (!this.busquedaAplicada) return;
    this.busquedaAplicada = '';
    void this.dataGrid?.instance?.refresh();
  }

  private setupDataSource(): void {
    this.listaCostos = new CustomStore({
      key: 'gridKey',
      load: async (loadOptions) => {
        const take = Number(loadOptions?.take) || this.filasPorPagina;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        this.cargando = true;
        this.errorCarga = null;
        try {
          const resp = await lastValueFrom(
            this.contratosService.obtenerCostosActualesPaginated({
              page,
              limit: take,
              busqueda: this.busquedaAplicada || null,
            }),
          );
          this.resumen = extraerResumenCostosActuales(resp);
          const meta = extraerMetaPaginacionRentRol(resp, page, take);
          const rows = extraerFilasRentRolApi(resp)
            .map((item) => mapCostosActualesApiToRentRolRow(item))
            .filter((r): r is NonNullable<typeof r> => r != null);
          const data: RentRolGridLine[] = flattenRentRolRowsToGridLines(rows);
          return { data, totalCount: meta.total };
        } catch (err) {
          console.error('Error al cargar costos actuales (Rent Rol):', err);
          this.resumen = { ...COSTOS_ACTUALES_RESUMEN_VACIO };
          this.errorCarga = 'No se pudieron cargar los costos vigentes.';
          return { data: [], totalCount: 0 };
        } finally {
          this.cargando = false;
        }
      },
    });
  }
}
