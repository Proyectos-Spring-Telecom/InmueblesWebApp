import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ModelosRoutingModule } from './modelos-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ListaModelosComponent } from './lista-modelos/lista-modelos.component';
import { AgregarModeloComponent } from './agregar-modelo/agregar-modelo.component';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';


import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [
    ListaModelosComponent,
    AgregarModeloComponent
  ],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
    CommonModule,
    ModelosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective
  ]
})
export class ModelosModule { }
