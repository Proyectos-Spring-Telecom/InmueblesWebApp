import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { ProspectosRoutingModule } from './prospectos-routing.module';
import { ListaProspectosComponent } from './lista-prospectos/lista-prospectos.component';
import { AgregarProspectoComponent } from './agregar-prospecto/agregar-prospecto.component';
import { CrearUsuarioProspectoModalComponent } from './crear-usuario-prospecto-modal/crear-usuario-prospecto-modal.component';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [
    ListaProspectosComponent,
    AgregarProspectoComponent,
    CrearUsuarioProspectoModalComponent,
  ],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
    CommonModule,
    ProspectosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
  ],
})
export class ProspectosModule {}
