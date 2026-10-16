import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MaterialModule } from 'src/app/material.module';
import { EmbudoVentasRoutingModule } from './embudo-ventas-routing.module';
import { EmbudoVentasComponent } from './embudo-ventas.component';

@NgModule({
  declarations: [EmbudoVentasComponent],
  imports: [
    CommonModule,
    EmbudoVentasRoutingModule,
    DragDropModule,
    MatIconModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
  ],
})
export class EmbudoVentasModule {}
