import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { PagosMantenimientoComponent } from './pagos-mantenimiento.component';
import { ListaHistoricoPagosMantenimientoComponent } from './lista-historico-pagos-mantenimiento/lista-historico-pagos-mantenimiento.component';
import { ListaMantenimientoActualComponent } from './lista-mantenimiento-actual/lista-mantenimiento-actual.component';

@NgModule({
  declarations: [
    PagosMantenimientoComponent,
    ListaMantenimientoActualComponent,
    ListaHistoricoPagosMantenimientoComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MaterialModule,
    DxDataGridModule,
    DxButtonModule,
  ],
  exports: [
    PagosMantenimientoComponent,
    ListaMantenimientoActualComponent,
    ListaHistoricoPagosMantenimientoComponent,
  ],
})
export class PagosMantenimientoModule {}
