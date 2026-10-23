import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../authentication/side-login/Guard/auth.guard';
import { AgregarProspectoComponent } from './agregar-prospecto/agregar-prospecto.component';
import { ListaProspectosComponent } from './lista-prospectos/lista-prospectos.component';

const routes: Routes = [
  {
    path: '',
    component: ListaProspectosComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'agregar-prospecto',
    component: AgregarProspectoComponent,
    canActivate: [AuthGuard],
    // Con el modal obligatorio abierto (usuario pendiente), no se puede abandonar el alta.
    canDeactivate: [
      (component: AgregarProspectoComponent) => component.puedeSalirDeAltaProspecto(),
    ],
  },
  {
    path: 'editar-prospecto/:idCliente',
    component: AgregarProspectoComponent,
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProspectosRoutingModule {}
