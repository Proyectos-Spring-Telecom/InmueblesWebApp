import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { DocumentoPreviewModule } from 'src/app/shared/documento-preview/documento-preview.module';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { RegistroServiciosArrendatariosRoutingModule } from './registro-servicios-arrendatarios-routing.module';
import { ListaRegistroServiciosArrendatariosComponent } from './lista-registro-servicios-arrendatarios/lista-registro-servicios-arrendatarios.component';

@NgModule({
  declarations: [ListaRegistroServiciosArrendatariosComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    DxDataGridModule,
    MaterialModule,
    DocumentoPreviewModule,
    HasPermissionDirective,
    RegistroServiciosArrendatariosRoutingModule,
  ],
})
export class RegistroServiciosArrendatariosModule {}
