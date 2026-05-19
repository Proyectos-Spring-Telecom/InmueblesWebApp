import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaMetodosPagoComponent } from './lista-metodos-pago/lista-metodos-pago.component';
import { AgregarMetodoPagoComponent } from './agregar-metodo-pago/agregar-metodo-pago.component';

const routes: Routes = [
  { path: '', component: ListaMetodosPagoComponent },
  { path: 'agregar-metodo-pago', component: AgregarMetodoPagoComponent },
  { path: 'editar-metodo-pago/:idMetodoPago', component: AgregarMetodoPagoComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MetodosPagoRoutingModule {}
