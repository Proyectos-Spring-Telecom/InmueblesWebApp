import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { DxAccordionModule } from 'devextreme-angular/ui/accordion';
import { MaterialModule } from 'src/app/material.module';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { DocumentoPreviewModule } from 'src/app/shared/documento-preview/documento-preview.module';
import { ArrendatariosRoutingModule } from './arrendatarios-routing.module';
import { ListaArrendatariosDetalleComponent } from './lista-arrendatarios-detalle/lista-arrendatarios-detalle.component';
import { ListaArrendatariosComponent } from './lista-arrendatarios/lista-arrendatarios.component';
import { AgregarArrendatarioComponent } from './agregar-arrendatario/agregar-arrendatario.component';
import { PagosRentaModule } from './pagos-renta/pagos-renta.module';
import { PagosMantenimientoModule } from './pagos-mantenimiento/pagos-mantenimiento.module';
import { OperacionPagosHubModule } from 'src/app/shared/operacion-pagos-hub/operacion-pagos-hub.module';

@NgModule({
  declarations: [
    ListaArrendatariosComponent,
    ListaArrendatariosDetalleComponent,
    AgregarArrendatarioComponent,
  ],
  imports: [
    CommonModule,
    ArrendatariosRoutingModule,
    PagosRentaModule,
    PagosMantenimientoModule,
    OperacionPagosHubModule,
    MatIconModule,
    DxDataGridModule,
    DxAccordionModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
    DocumentoPreviewModule,
  ],
})
export class ArrendatariosModule {}
