import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxDataGridModule, DxDateBoxModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { RentRolRoutingModule } from './rent-rol-routing.module';
import { RentRolComponent } from './rent-rol.component';

@NgModule({
  declarations: [RentRolComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RentRolRoutingModule,
    MatIconModule,
    MaterialModule,
    DxDataGridModule,
    DxDateBoxModule,
  ],
})
export class RentRolModule {}
