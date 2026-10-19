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
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [
    ListaPermisosComponent,
    AgregarPermisoComponent
  ],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
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
