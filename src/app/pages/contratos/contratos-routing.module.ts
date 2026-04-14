import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaContratosComponent } from './lista-contratos/lista-contratos.component';
import { AgregarContratoComponent } from './agregar-contrato/agregar-contrato.component';

const routes: Routes = [
  { path: '', component: ListaContratosComponent },
  { path: 'agregar-contrato', component: AgregarContratoComponent },
  { path: 'editar-contrato/:idContrato', component: AgregarContratoComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ContratosRoutingModule {}
