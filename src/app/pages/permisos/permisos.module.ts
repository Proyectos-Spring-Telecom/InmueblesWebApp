import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PermisosRoutingModule } from './permisos-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxDataGridModule, DxButtonModule } from 'devextreme-angular'; // 👈 AQUI
import { ListaPermisosComponent } from './lista-permisos/lista-permisos.component';
import { MaterialModule } from 'src/app/material.module';
import { AgregarPermisoComponent } from './agregar-permiso/agregar-permiso.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';

@NgModule({
  declarations: [
    ListaPermisosComponent,
    AgregarPermisoComponent
  ],
  imports: [
    CommonModule,
    PermisosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective
  ],
})
export class PermisosModule {}
