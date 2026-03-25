import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaInstalacionesCentralesComponent } from './lista-instalaciones-centrales/lista-instalaciones-centrales.component';
import { AgregarInstalacionCentralComponent } from './agregar-instalacion-central/agregar-instalacion-central.component';

const routes: Routes = 
[
  { 
    path: '',
    component:ListaInstalacionesCentralesComponent
  },
  { path: 'agregar-instalacion-central',
    component: AgregarInstalacionCentralComponent
  },
  {
    path: 'editar-instalacion-central/:idSedeCentral',
    component: AgregarInstalacionCentralComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InstalacionesCentralesRoutingModule { }
