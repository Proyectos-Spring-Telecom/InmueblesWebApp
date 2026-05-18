import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ServiciosRoutingModule } from './servicios-routing.module';
import { ListaServiciosComponent } from './lista-servicios/lista-servicios.component';
import { AgregarServicioComponent } from './agregar-servicio/agregar-servicio.component';

@NgModule({
  declarations: [ListaServiciosComponent, AgregarServicioComponent],
  imports: [
    CommonModule,
    ServiciosRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
  ],
})
export class ServiciosModule {}
