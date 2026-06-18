import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaRegistroServiciosInmueblesComponent } from './lista-registro-servicios-inmuebles/lista-registro-servicios-inmuebles.component';

const routes: Routes = [{ path: '', component: ListaRegistroServiciosInmueblesComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RegistroServiciosInmueblesRoutingModule {}
