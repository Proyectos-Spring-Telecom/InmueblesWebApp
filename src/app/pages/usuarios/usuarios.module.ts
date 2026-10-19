import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UsuariosRoutingModule } from './usuarios-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { ListaUsuariosComponent } from './lista-usuarios/lista-usuarios.component';
import { AgregarUsuarioComponent } from './agregar-usuario/agregar-usuario.component';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { PerfilUsuarioComponent } from './perfil-usuario/perfil-usuario.component';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';


import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [
    ListaUsuariosComponent,
    AgregarUsuarioComponent,
    PerfilUsuarioComponent
  ],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
    CommonModule,
    UsuariosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
  ]
})
export class UsuariosModule { }
