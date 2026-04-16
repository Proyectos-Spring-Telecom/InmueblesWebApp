import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaFactoresComponent } from './lista-factores/lista-factores.component';
import { AgregarFactorComponent } from './agregar-factor/agregar-factor.component';
import { AgregarFormulaComponent } from './agregar-formula/agregar-formula.component';

const routes: Routes = [
  { path: '', component: ListaFactoresComponent },
  { path: 'agregar-factor', component: AgregarFactorComponent },
  { path: 'editar-factor/:idFactor', component: AgregarFactorComponent },
  { path: 'agregar-formula', component: AgregarFormulaComponent },
  { path: 'editar-formula/:idFormula', component: AgregarFormulaComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FactoresRoutingModule {}
