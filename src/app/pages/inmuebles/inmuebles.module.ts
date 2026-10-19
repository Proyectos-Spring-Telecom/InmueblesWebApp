import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxChartModule, DxDataGridModule, DxPieChartModule } from 'devextreme-angular';
import { DxAccordionModule } from 'devextreme-angular/ui/accordion';
import { MaterialModule } from 'src/app/material.module';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { DocumentoPreviewModule } from 'src/app/shared/documento-preview/documento-preview.module';
import { AgregarInmuebleComponent } from './agregar-inmueble/agregar-inmueble.component';
import { InmueblesRoutingModule } from './inmuebles-routing.module';
import { ListaInmueblesDetalleComponent } from './lista-inmuebles-detalle/lista-inmuebles-detalle.component';
import { ListaInmueblesComponent } from './lista-inmuebles/lista-inmuebles.component';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';
import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [
    ListaInmueblesComponent,
    ListaInmueblesDetalleComponent,
    AgregarInmuebleComponent,
  ],
  imports: [
    ModuleHeroComponent,
    CampoFechaComponent,
    CampoSelectComponent,
    CommonModule,
    InmueblesRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    DxAccordionModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
    DocumentoPreviewModule,
    DxPieChartModule,
    DxChartModule,
  ],
})
export class InmueblesModule {}
