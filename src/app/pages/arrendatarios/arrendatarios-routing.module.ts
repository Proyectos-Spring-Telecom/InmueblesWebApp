import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaArrendatariosComponent } from './lista-arrendatarios/lista-arrendatarios.component';
import { AgregarArrendatarioComponent } from './agregar-arrendatario/agregar-arrendatario.component';

const routes: Routes = [
  { path: '', component: ListaArrendatariosComponent },
  { path: 'agregar-arrendatario', component: AgregarArrendatarioComponent },
  { path: 'editar-arrendatario/:idArrendatario', component: AgregarArrendatarioComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ArrendatariosRoutingModule {}
