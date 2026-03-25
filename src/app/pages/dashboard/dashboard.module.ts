import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxChartModule, DxDataGridModule, DxDateBoxModule, DxPieChartModule } from 'devextreme-angular';
import { DashboardComponent } from './dashboard.component';
import { MaterialModule } from 'src/app/material.module';
import { MatCardModule } from '@angular/material/card';
import { DxiValueAxisModule } from 'devextreme-angular/ui/nested';


@NgModule({
  declarations: [DashboardComponent],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    DxPieChartModule,
    MaterialModule,
    MatCardModule,
    DxDateBoxModule,
    DxChartModule,
    DxiValueAxisModule
  ]
})
export class DashboardModule { }
