import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BitacoraRoutingModule } from './bitacora-routing.module';
import { ListaBitacoraComponent } from './lista-bitacora/lista-bitacora.component';

@NgModule({
  declarations: [ListaBitacoraComponent],
  imports: [
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
