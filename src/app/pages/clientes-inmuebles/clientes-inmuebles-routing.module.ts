import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../authentication/side-login/Guard/auth.guard';
import { AgregarClienteInmuebleComponent } from './agregar-cliente-inmueble/agregar-cliente-inmueble.component';
import { ListaClientesInmueblesComponent } from './lista-clientes-inmuebles/lista-clientes-inmuebles.component';

const routes: Routes = [
  {
    path: '',
    component: ListaClientesInmueblesComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'agregar-cliente-inmueble',
    component: AgregarClienteInmuebleComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'editar-cliente-inmueble/:idCliente',
    component: AgregarClienteInmuebleComponent,
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ClientesInmueblesRoutingModule {}
