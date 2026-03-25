import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { InstalacionesRoutingModule } from './instalaciones-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ListaInstalacionesComponent } from './lista-instalaciones/lista-instalaciones.component';
import { AgregarInstalacionComponent } from './agregar-instalacion/agregar-instalacion.component';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';


@NgModule({
  declarations: [ListaInstalacionesComponent, AgregarInstalacionComponent],
  imports: [
    CommonModule,
    InstalacionesRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective
  ]
})
export class InstalacionesModule { }
