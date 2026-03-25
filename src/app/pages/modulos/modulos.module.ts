import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ModulosRoutingModule } from './modulos-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { ListaModulosComponent } from './lista-modulos/lista-modulos.component';
import { MaterialModule } from 'src/app/material.module';
import { AgregarModuloComponent } from './agregar-modulo/agregar-modulo.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';


@NgModule({
  declarations: [
    ListaModulosComponent,
    AgregarModuloComponent
  ],
  imports: [
    CommonModule,
    ModulosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective
  ]
})
export class ModulosModule { }
