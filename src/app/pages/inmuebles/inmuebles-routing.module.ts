import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AgregarInmuebleComponent } from './agregar-inmueble/agregar-inmueble.component';
import { ListaInmueblesComponent } from './lista-inmuebles/lista-inmuebles.component';

const routes: Routes = [
  { path: '', component: ListaInmueblesComponent },
  { path: 'agregar-inmueble', component: AgregarInmuebleComponent },
  { path: 'editar-inmueble/:idInmueble', component: AgregarInmuebleComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InmueblesRoutingModule {}
