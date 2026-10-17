import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IncrementosRoutingModule } from './incrementos-routing.module';
import { ListaIncrementosComponent } from './lista-incrementos/lista-incrementos.component';
import { AgregarIncrementoComponent } from './agregar-incremento/agregar-incremento.component';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

@NgModule({
  declarations: [ListaIncrementosComponent, AgregarIncrementoComponent],
  imports: [
    ModuleHeroComponent,
    CommonModule,
    IncrementosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
  ],
})
export class IncrementosModule {}
