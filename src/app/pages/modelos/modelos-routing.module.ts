import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaModelosComponent } from './lista-modelos/lista-modelos.component';
import { AgregarModeloComponent } from './agregar-modelo/agregar-modelo.component';

const routes: Routes = [
  { 
    path: '',
    component:ListaModelosComponent
  },
  { path: 'agregar-modelo',
    component: AgregarModeloComponent
  },
  {
    path: 'editar-modelo/:idModelo',
    component: AgregarModeloComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ModelosRoutingModule { }
