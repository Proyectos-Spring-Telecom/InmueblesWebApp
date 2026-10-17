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
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

@NgModule({
  declarations: [
    ListaProspectosComponent,
    AgregarProspectoComponent,
  ],
  imports: [
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
