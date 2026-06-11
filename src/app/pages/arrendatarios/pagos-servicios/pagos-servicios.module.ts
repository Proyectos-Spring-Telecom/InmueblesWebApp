import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { DocumentoPreviewModule } from 'src/app/shared/documento-preview/documento-preview.module';
import { OperacionPagosHubModule } from 'src/app/shared/operacion-pagos-hub/operacion-pagos-hub.module';
import { ListaPagosServiciosActualesComponent } from './lista-pagos-servicios-actuales/lista-pagos-servicios-actuales.component';

@NgModule({
  declarations: [ListaPagosServiciosActualesComponent],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MaterialModule,
    DxDataGridModule,
    DxButtonModule,
    OperacionPagosHubModule,
    DocumentoPreviewModule,
  ],
  exports: [ListaPagosServiciosActualesComponent],
})
export class PagosServiciosModule {}
