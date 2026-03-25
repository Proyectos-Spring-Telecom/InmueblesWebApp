import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaClientesComponent } from './lista-clientes/lista-clientes.component';
import { AgregarClienteComponent } from './agregar-cliente/agregar-cliente.component';

const routes: Routes = 
[
  { path: '',
    component: ListaClientesComponent
  },
  { path: 'agregar-cliente',
    component: AgregarClienteComponent
  },
  {
    path: 'editar-cliente/:idCliente',
    component: AgregarClienteComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientesRoutingModule { }
