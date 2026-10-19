import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ClientesRoutingModule } from './clientes-routing.module';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { DxAccordionModule } from 'devextreme-angular/ui/accordion';
import { ListaClientesComponent } from './lista-clientes/lista-clientes.component';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgregarClienteComponent } from './agregar-cliente/agregar-cliente.component';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { DocumentoPreviewModule } from 'src/app/shared/documento-preview/documento-preview.module';
import { ListaClientesDetalleComponent } from './lista-clientes-detalle/lista-clientes-detalle.component';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';

@NgModule({
  declarations: [ListaClientesComponent, AgregarClienteComponent, ListaClientesDetalleComponent],
  imports: [
    CampoFechaComponent,
    CampoSelectComponent,
    ModuleHeroComponent,
    CommonModule,
    ClientesRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    DxAccordionModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
    DocumentoPreviewModule,
  ]
})
export class ClientesModule { }
