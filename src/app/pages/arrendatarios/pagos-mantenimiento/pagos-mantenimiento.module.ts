import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { OperacionPagosHubModule } from 'src/app/shared/operacion-pagos-hub/operacion-pagos-hub.module';
import { PagosMantenimientoComponent } from './pagos-mantenimiento.component';
import { ListaHistoricoPagosMantenimientoComponent } from './lista-historico-pagos-mantenimiento/lista-historico-pagos-mantenimiento.component';
import { ListaMantenimientoActualComponent } from './lista-mantenimiento-actual/lista-mantenimiento-actual.component';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

import { PortalBodyDirective } from 'src/app/shared/portal-body.directive';

@NgModule({
  declarations: [
    PagosMantenimientoComponent,
    ListaMantenimientoActualComponent,
    ListaHistoricoPagosMantenimientoComponent,
  ],
  imports: [
    PortalBodyDirective,
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MaterialModule,
    DxDataGridModule,
    DxButtonModule,
    OperacionPagosHubModule,
  ],
  exports: [
    PagosMantenimientoComponent,
    ListaMantenimientoActualComponent,
    ListaHistoricoPagosMantenimientoComponent,
  ],
})
export class PagosMantenimientoModule {}
