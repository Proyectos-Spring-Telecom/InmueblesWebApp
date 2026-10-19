import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { DxButtonModule, DxDataGridModule, DxDateBoxModule, DxSelectBoxModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { OperacionPagosHubModule } from 'src/app/shared/operacion-pagos-hub/operacion-pagos-hub.module';
import { PagosRentaComponent } from './pagos-renta.component';
import { ListaHistoricoPagosRentaComponent } from './lista-historico-pagos-renta/lista-historico-pagos-renta.component';
import { ListaRentasActualesComponent } from './lista-rentas-actuales/lista-rentas-actuales.component';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';
import { RegistrarPagoModalComponent } from '../cobranza/registrar-pago-modal/registrar-pago-modal.component';
import { PortalBodyDirective } from 'src/app/shared/portal-body.directive';

import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [
    PagosRentaComponent,
    ListaRentasActualesComponent,
    ListaHistoricoPagosRentaComponent,
  ],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
    RegistrarPagoModalComponent,
    PortalBodyDirective,
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MaterialModule,
    DxDataGridModule,
    DxDateBoxModule,
    DxSelectBoxModule,
    DxButtonModule,
    OperacionPagosHubModule,
  ],
  exports: [
    PagosRentaComponent,
    ListaRentasActualesComponent,
    ListaHistoricoPagosRentaComponent,
  ],
})
export class PagosRentaModule {}
