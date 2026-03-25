import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaModulosComponent } from './lista-modulos/lista-modulos.component';
import { AgregarModuloComponent } from './agregar-modulo/agregar-modulo.component';

const routes: Routes = 
[
  { 
    path: '',
    component:ListaModulosComponent
  },
  { path: 'agregar-modulo',
    component: AgregarModuloComponent
  },
  {
    path: 'editar-modulo/:idModulo',
    component: AgregarModuloComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ModulosRoutingModule { }
