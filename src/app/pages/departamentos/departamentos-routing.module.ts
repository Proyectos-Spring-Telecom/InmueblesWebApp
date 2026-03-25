import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaDepartamentosComponent } from './lista-departamentos/lista-departamentos.component';
import { AgregarDepartamentoComponent } from './agregar-departamento/agregar-departamento.component';

const routes: Routes = [
  { 
    path: '',
    component: ListaDepartamentosComponent
  },
  { 
    path: 'agregar-departamento',
    component: AgregarDepartamentoComponent
  },
  {
    path: 'editar-departamento/:idDepartamento',
    component: AgregarDepartamentoComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DepartamentosRoutingModule { }

