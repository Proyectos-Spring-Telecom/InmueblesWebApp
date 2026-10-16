import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../authentication/side-login/Guard/auth.guard';
import { EmbudoVentasComponent } from './embudo-ventas.component';

const routes: Routes = [
  {
    path: '',
    component: EmbudoVentasComponent,
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EmbudoVentasRoutingModule {}
