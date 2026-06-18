import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaRegistroServiciosArrendatariosComponent } from './lista-registro-servicios-arrendatarios/lista-registro-servicios-arrendatarios.component';

const routes: Routes = [{ path: '', component: ListaRegistroServiciosArrendatariosComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RegistroServiciosArrendatariosRoutingModule {}
