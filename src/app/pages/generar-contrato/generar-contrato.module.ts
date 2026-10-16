import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { GenerarContratoRoutingModule } from './generar-contrato-routing.module';
import { GenerarContratoComponent } from './generar-contrato.component';
import { PdfPaginasComponent } from './pdf-paginas/pdf-paginas.component';

@NgModule({
  declarations: [GenerarContratoComponent, PdfPaginasComponent],
  imports: [
    CommonModule,
    GenerarContratoRoutingModule,
    MatIconModule,
    DxDataGridModule,
    MaterialModule,
    ReactiveFormsModule,
  ],
})
export class GenerarContratoModule {}
