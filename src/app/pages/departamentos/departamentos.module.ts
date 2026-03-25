import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DepartamentosRoutingModule } from './departamentos-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ListaDepartamentosComponent } from './lista-departamentos/lista-departamentos.component';
import { AgregarDepartamentoComponent } from './agregar-departamento/agregar-departamento.component';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';


@NgModule({
  declarations: [
    ListaDepartamentosComponent,
    AgregarDepartamentoComponent
  ],
  imports: [
    CommonModule,
    DepartamentosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective
  ]
})
export class DepartamentosModule { }

