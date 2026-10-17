import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ContratosRoutingModule } from './contratos-routing.module';
import { ListaContratosComponent } from './lista-contratos/lista-contratos.component';
import { AgregarContratoComponent } from './agregar-contrato/agregar-contrato.component';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

@NgModule({
  declarations: [ListaContratosComponent, AgregarContratoComponent],
  imports: [
    ModuleHeroComponent,
    CommonModule,
    ContratosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
  ],
})
export class ContratosModule {}
