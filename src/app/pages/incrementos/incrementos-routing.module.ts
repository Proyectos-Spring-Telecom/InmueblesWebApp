import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaIncrementosComponent } from './lista-incrementos/lista-incrementos.component';
import { AgregarIncrementoComponent } from './agregar-incremento/agregar-incremento.component';

const routes: Routes = [
  { path: '', component: ListaIncrementosComponent },
  { path: 'agregar-incremento', component: AgregarIncrementoComponent },
  { path: 'editar-incremento/:idIncremento', component: AgregarIncrementoComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IncrementosRoutingModule {}
