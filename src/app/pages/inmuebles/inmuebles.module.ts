import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxTreeListModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { AgregarInmuebleComponent } from './agregar-inmueble/agregar-inmueble.component';
import { InmueblesRoutingModule } from './inmuebles-routing.module';
import { ListaInmueblesComponent } from './lista-inmuebles/lista-inmuebles.component';

@NgModule({
  declarations: [ListaInmueblesComponent, AgregarInmuebleComponent],
  imports: [
    CommonModule,
    InmueblesRoutingModule,
    MatIconModule,
    DxTreeListModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
  ],
})
export class InmueblesModule {}
