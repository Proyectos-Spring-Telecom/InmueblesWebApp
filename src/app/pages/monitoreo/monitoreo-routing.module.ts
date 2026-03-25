import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MonitoreoComponent } from './monitoreo.component';
import { MonitoreoInstalacionComponent } from './monitoreo-instalacion/monitoreo-instalacion.component';

const routes: Routes = [
  {
    path: '',
    component: MonitoreoComponent
  },
  { 
    path: 'instalacion/:numeroSerie',
    component: MonitoreoInstalacionComponent
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MonitoreoRoutingModule { }
