import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaClientesComponent } from './lista-clientes/lista-clientes.component';
import { AgregarClienteComponent } from './agregar-cliente/agregar-cliente.component';
import { AuthGuard } from '../authentication/side-login/Guard/auth.guard';

const routes: Routes = 
[
  { path: '',
    component: ListaClientesComponent,
    canActivate: [AuthGuard],
  },
  { path: 'agregar-cliente',
    component: AgregarClienteComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'editar-cliente/:idCliente',
    component: AgregarClienteComponent,
    canActivate: [AuthGuard]
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientesRoutingModule { }
