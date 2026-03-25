import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule, DxPopupModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ListaInstalacionesCentralesComponent } from './lista-instalaciones-centrales/lista-instalaciones-centrales.component';
import { InstalacionesCentralesRoutingModule } from './instalaciones-centrales-routing.module';
import { AgregarInstalacionCentralComponent } from './agregar-instalacion-central/agregar-instalacion-central.component';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';


@NgModule({
  declarations: [
    ListaInstalacionesCentralesComponent,
    AgregarInstalacionCentralComponent
  ],
  imports: [
    CommonModule,
    InstalacionesCentralesRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    DxPopupModule,
    HasPermissionDirective
  ]
})
export class InstalacionesCentralesModule { }
