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
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [ListaPagosServiciosActualesComponent],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
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
