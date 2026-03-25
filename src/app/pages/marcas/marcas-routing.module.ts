import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaMarcasComponent } from './lista-marcas/lista-marcas.component';
import { AgregarMarcaComponent } from './agregar-marca/agregar-marca.component';

const routes: Routes = [
  { 
    path: '',
    component:ListaMarcasComponent
  },
  { path: 'agregar-marca',
    component: AgregarMarcaComponent
  },
  {
    path: 'editar-marca/:idMarca',
    component: AgregarMarcaComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MarcasRoutingModule { }
