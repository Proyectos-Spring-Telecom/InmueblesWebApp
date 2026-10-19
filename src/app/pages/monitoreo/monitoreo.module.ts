import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MonitoreoRoutingModule } from './monitoreo-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxAccordionModule, DxButtonModule, DxChartModule, DxDataGridModule, DxDateBoxModule, DxPieChartModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MonitoreoComponent } from './monitoreo.component';
import { MatCardModule } from '@angular/material/card';
import { DxiValueAxisModule } from 'devextreme-angular/ui/nested';
import { MonitoreoInstalacionComponent } from './monitoreo-instalacion/monitoreo-instalacion.component';
import { MonitoreoLocalesPlanoComponent } from './locales-plano/monitoreo-locales-plano.component';
import { DocumentoPreviewModule } from 'src/app/shared/documento-preview/documento-preview.module';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';


import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [MonitoreoComponent, MonitoreoInstalacionComponent, MonitoreoLocalesPlanoComponent],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
    CommonModule,
    MonitoreoRoutingModule,
    DocumentoPreviewModule,
    MatIconModule,
    DxDataGridModule,
    DxAccordionModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,


        DxPieChartModule,
        MatCardModule,
        DxDateBoxModule,
        DxChartModule,
        DxiValueAxisModule
  ]
})
export class MonitoreoModule { }
