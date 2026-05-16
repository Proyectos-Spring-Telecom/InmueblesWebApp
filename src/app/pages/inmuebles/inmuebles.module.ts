import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { DocumentoPreviewModule } from 'src/app/shared/documento-preview/documento-preview.module';
import { AgregarInmuebleComponent } from './agregar-inmueble/agregar-inmueble.component';
import { InmueblesRoutingModule } from './inmuebles-routing.module';
import { ListaInmueblesDetalleComponent } from './lista-inmuebles-detalle/lista-inmuebles-detalle.component';
import { ListaInmueblesComponent } from './lista-inmuebles/lista-inmuebles.component';

@NgModule({
  declarations: [
    ListaInmueblesComponent,
    ListaInmueblesDetalleComponent,
    AgregarInmuebleComponent,
  ],
  imports: [
    CommonModule,
    InmueblesRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
    DocumentoPreviewModule,
  ],
})
export class InmueblesModule {}
