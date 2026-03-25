import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaEquipoComponent } from './lista-equipo/lista-equipo.component';
import { AgregarEquipoComponent } from './agregar-equipo/agregar-equipo.component';

const routes: Routes = [
  { 
    path: '',
    component:ListaEquipoComponent
  },
  { path: 'agregar-equipo',
    component: AgregarEquipoComponent
  },
  {
    path: 'editar-equipo/:idEquipo',
    component: AgregarEquipoComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EquiposRoutingModule { }
