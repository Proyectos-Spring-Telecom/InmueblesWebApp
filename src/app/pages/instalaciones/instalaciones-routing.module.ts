import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaInstalacionesComponent } from './lista-instalaciones/lista-instalaciones.component';
import { AgregarInstalacionComponent } from './agregar-instalacion/agregar-instalacion.component';
import { MonitoreoInstalacionComponent } from '../monitoreo/monitoreo-instalacion/monitoreo-instalacion.component';

const routes: Routes = 
[
  { 
    path: '',
    component:ListaInstalacionesComponent
  },
  { path: 'agregar-instalacion',
    component: AgregarInstalacionComponent
  },
  {
    path: 'editar-instalacion/:idInstalacion',
    component: AgregarInstalacionComponent,
  },
  { 
    path: 'monitoreo/instalacion/:numeroSerie',
    component: MonitoreoInstalacionComponent
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InstalacionesRoutingModule { }
