import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { DocumentoPreviewModule } from 'src/app/shared/documento-preview/documento-preview.module';
import { RegistroServiciosInmueblesRoutingModule } from './registro-servicios-inmuebles-routing.module';
import { ListaRegistroServiciosInmueblesComponent } from './lista-registro-servicios-inmuebles/lista-registro-servicios-inmuebles.component';

@NgModule({
  declarations: [ListaRegistroServiciosInmueblesComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    DxDataGridModule,
    MaterialModule,
    DocumentoPreviewModule,
    RegistroServiciosInmueblesRoutingModule,
  ],
})
export class RegistroServiciosInmueblesModule {}
