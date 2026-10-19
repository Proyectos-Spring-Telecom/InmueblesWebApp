import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxDataGridModule, DxDateBoxModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { RentRolRoutingModule } from './rent-rol-routing.module';
import { RentRolComponent } from './rent-rol.component';
import { PagosRentaModule } from '../pagos-renta/pagos-renta.module';

import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [RentRolComponent],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    PagosRentaModule,
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
