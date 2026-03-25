import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MonitoreoRoutingModule } from './monitoreo-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxChartModule, DxDataGridModule, DxDateBoxModule, DxPieChartModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MonitoreoComponent } from './monitoreo.component';
import { MatCardModule } from '@angular/material/card';
import { DxiValueAxisModule } from 'devextreme-angular/ui/nested';
import { MonitoreoInstalacionComponent } from './monitoreo-instalacion/monitoreo-instalacion.component';


@NgModule({
  declarations: [MonitoreoComponent, MonitoreoInstalacionComponent],
  imports: [
    CommonModule,
    MonitoreoRoutingModule,
    MatIconModule,
    DxDataGridModule,
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
