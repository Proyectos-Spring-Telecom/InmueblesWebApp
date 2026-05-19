import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MetodosPagoRoutingModule } from './metodos-pago-routing.module';
import { ListaMetodosPagoComponent } from './lista-metodos-pago/lista-metodos-pago.component';
import { AgregarMetodoPagoComponent } from './agregar-metodo-pago/agregar-metodo-pago.component';

@NgModule({
  declarations: [ListaMetodosPagoComponent, AgregarMetodoPagoComponent],
  imports: [
    CommonModule,
    MetodosPagoRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
  ],
})
export class MetodosPagoModule {}
