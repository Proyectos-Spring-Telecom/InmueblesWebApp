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
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';


import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [
    ListaInstalacionesCentralesComponent,
    AgregarInstalacionCentralComponent
  ],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
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
