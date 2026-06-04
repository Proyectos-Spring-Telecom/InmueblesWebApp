import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { PagosRentaComponent } from './pagos-renta.component';
import { ListaHistoricoPagosRentaComponent } from './lista-historico-pagos-renta/lista-historico-pagos-renta.component';
import { ListaRentasActualesComponent } from './lista-rentas-actuales/lista-rentas-actuales.component';

@NgModule({
  declarations: [
    PagosRentaComponent,
    ListaRentasActualesComponent,
    ListaHistoricoPagosRentaComponent,
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
    PagosRentaComponent,
    ListaRentasActualesComponent,
    ListaHistoricoPagosRentaComponent,
  ],
})
export class PagosRentaModule {}
