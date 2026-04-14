import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaEstacionamientoComponent } from './lista-estacionamiento/lista-estacionamiento.component';
import { AgregarEstacionamientoComponent } from './agregar-estacionamiento/agregar-estacionamiento.component';

const routes: Routes = [
  {
    path: '',
    component: ListaEstacionamientoComponent,
  },
  {
    path: 'agregar-estacionamiento',
    component: AgregarEstacionamientoComponent,
  },
  {
    path: 'editar-estacionamiento/:idEstacionamiento',
    component: AgregarEstacionamientoComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EstacionamientoRoutingModule {}

