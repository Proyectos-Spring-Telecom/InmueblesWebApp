import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaServiciosComponent } from './lista-servicios/lista-servicios.component';
import { AgregarServicioComponent } from './agregar-servicio/agregar-servicio.component';

const routes: Routes = [
  { path: '', component: ListaServiciosComponent },
  { path: 'agregar-servicio', component: AgregarServicioComponent },
  { path: 'editar-servicio/:idServicio', component: AgregarServicioComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ServiciosRoutingModule {}
