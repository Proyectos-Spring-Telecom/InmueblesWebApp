import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BitacoraRoutingModule } from './bitacora-routing.module';
import { ListaBitacoraComponent } from './lista-bitacora/lista-bitacora.component';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

@NgModule({
  declarations: [ListaBitacoraComponent],
  imports: [
    ModuleHeroComponent,
    CommonModule,
    BitacoraRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
  ],
})
export class BitacoraModule {}
