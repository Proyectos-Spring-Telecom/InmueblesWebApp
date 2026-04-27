import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule } from 'devextreme-angular/ui/button';
import { DxDataGridModule } from 'devextreme-angular/ui/data-grid';
import { MaterialModule } from 'src/app/material.module';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { ArrendatariosRoutingModule } from './arrendatarios-routing.module';
import { ListaArrendatariosComponent } from './lista-arrendatarios/lista-arrendatarios.component';
import { AgregarArrendatarioComponent } from './agregar-arrendatario/agregar-arrendatario.component';

@NgModule({
  declarations: [ListaArrendatariosComponent, AgregarArrendatarioComponent],
  imports: [
    CommonModule,
    ArrendatariosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
  ],
})
export class ArrendatariosModule {}
