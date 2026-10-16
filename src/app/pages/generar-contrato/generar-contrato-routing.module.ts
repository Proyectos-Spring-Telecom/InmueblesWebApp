import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../authentication/side-login/Guard/auth.guard';
import { GenerarContratoComponent } from './generar-contrato.component';
import { formularioContratoGuard } from './formulario-contrato.guard';

const routes: Routes = [
  {
    path: '',
    component: GenerarContratoComponent,
    canActivate: [AuthGuard],
    canDeactivate: [formularioContratoGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GenerarContratoRoutingModule {}
