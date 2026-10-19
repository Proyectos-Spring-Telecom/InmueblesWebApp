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
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';


import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [ListaInstalacionesComponent, AgregarInstalacionComponent],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
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
