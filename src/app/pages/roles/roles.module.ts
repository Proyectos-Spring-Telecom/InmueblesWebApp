import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RolesRoutingModule } from './roles-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { ListaRolesComponent } from './lista-roles/lista-roles.component';
import { AgregarRolComponent } from './agregar-rol/agregar-rol.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';


@NgModule({
  declarations: [
    ListaRolesComponent,
    AgregarRolComponent
  ],
  imports: [
    CommonModule,
    RolesRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    ReactiveFormsModule,
    MaterialModule,
    HasPermissionDirective
  ]
})
export class RolesModule { }
