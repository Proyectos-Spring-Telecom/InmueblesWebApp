import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EstacionamientoRoutingModule } from './estacionamiento-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { ListaEstacionamientoComponent } from './lista-estacionamiento/lista-estacionamiento.component';
import { AgregarEstacionamientoComponent } from './agregar-estacionamiento/agregar-estacionamiento.component';

@NgModule({
  declarations: [ListaEstacionamientoComponent, AgregarEstacionamientoComponent],
  imports: [
    CommonModule,
    EstacionamientoRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
  ],
})
export class EstacionamientoModule {}

