import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EquiposRoutingModule } from './equipos-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ListaEquipoComponent } from './lista-equipo/lista-equipo.component';
import { AgregarEquipoComponent } from './agregar-equipo/agregar-equipo.component';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';


@NgModule({
  declarations: [
    ListaEquipoComponent,
    AgregarEquipoComponent
  ],
  imports: [
    ModuleHeroComponent,
    CommonModule,
    EquiposRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective
  ]
})
export class EquiposModule { }
