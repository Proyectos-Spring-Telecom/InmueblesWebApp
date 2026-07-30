import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { ClientesInmueblesRoutingModule } from './clientes-inmuebles-routing.module';
import { ListaClientesInmueblesComponent } from './lista-clientes-inmuebles/lista-clientes-inmuebles.component';
import { AgregarClienteInmuebleComponent } from './agregar-cliente-inmueble/agregar-cliente-inmueble.component';

@NgModule({
  declarations: [
    ListaClientesInmueblesComponent,
    AgregarClienteInmuebleComponent,
  ],
  imports: [
    CommonModule,
    ClientesInmueblesRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
  ],
})
export class ClientesInmueblesModule {}
