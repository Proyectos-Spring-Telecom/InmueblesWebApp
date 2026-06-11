import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HUB_PAGOS_HISTORICO, HUB_PAGOS_MES } from 'src/app/shared/operacion-pagos-hub/operacion-pagos-hub.configs';
import { OperacionPagosHubComponent } from 'src/app/shared/operacion-pagos-hub/operacion-pagos-hub.component';
import { ListaArrendatariosComponent } from './lista-arrendatarios/lista-arrendatarios.component';
import { AgregarArrendatarioComponent } from './agregar-arrendatario/agregar-arrendatario.component';
import { ListaRentasActualesComponent } from './pagos-renta/lista-rentas-actuales/lista-rentas-actuales.component';
import { ListaHistoricoPagosRentaComponent } from './pagos-renta/lista-historico-pagos-renta/lista-historico-pagos-renta.component';
import { ListaMantenimientoActualComponent } from './pagos-mantenimiento/lista-mantenimiento-actual/lista-mantenimiento-actual.component';
import { ListaHistoricoPagosMantenimientoComponent } from './pagos-mantenimiento/lista-historico-pagos-mantenimiento/lista-historico-pagos-mantenimiento.component';
import { ListaPagosServiciosActualesComponent } from './pagos-servicios/lista-pagos-servicios-actuales/lista-pagos-servicios-actuales.component';

const routes: Routes = [
  { path: '', component: ListaArrendatariosComponent },
  {
    path: 'pagos-mes',
    component: OperacionPagosHubComponent,
    data: { operacionHub: HUB_PAGOS_MES },
    children: [
      { path: '', redirectTo: 'renta', pathMatch: 'full' },
      {
        path: 'renta',
        component: ListaRentasActualesComponent,
        data: { hubEmbebido: true },
      },
      {
        path: 'mantenimiento',
        component: ListaMantenimientoActualComponent,
        data: { hubEmbebido: true },
      },
      {
        path: 'servicios',
        component: ListaPagosServiciosActualesComponent,
        data: { hubEmbebido: true },
      },
    ],
  },
  {
    path: 'pagos-historico',
    component: OperacionPagosHubComponent,
    data: { operacionHub: HUB_PAGOS_HISTORICO },
    children: [
      { path: '', redirectTo: 'renta', pathMatch: 'full' },
      {
        path: 'renta',
        component: ListaHistoricoPagosRentaComponent,
        data: { hubEmbebido: true },
      },
      {
        path: 'mantenimiento',
        component: ListaHistoricoPagosMantenimientoComponent,
        data: { hubEmbebido: true },
      },
    ],
  },
  { path: 'pagos-renta', redirectTo: 'pagos-mes/renta', pathMatch: 'full' },
  { path: 'pagos-renta/actual', redirectTo: 'pagos-mes/renta', pathMatch: 'full' },
  { path: 'pagos-renta/historico', redirectTo: 'pagos-historico/renta', pathMatch: 'full' },
  { path: 'pagos-mantenimiento', redirectTo: 'pagos-mes/mantenimiento', pathMatch: 'full' },
  { path: 'pagos-mantenimiento/actual', redirectTo: 'pagos-mes/mantenimiento', pathMatch: 'full' },
  { path: 'pagos-mantenimiento/historico', redirectTo: 'pagos-historico/mantenimiento', pathMatch: 'full' },
  { path: 'pagos-servicios', redirectTo: 'pagos-mes/servicios', pathMatch: 'full' },
  { path: 'pagos-servicios/actual', redirectTo: 'pagos-mes/servicios', pathMatch: 'full' },
  { path: 'rentas', redirectTo: 'pagos-mes/renta', pathMatch: 'full' },
  { path: 'historico-pagos-renta', redirectTo: 'pagos-historico/renta', pathMatch: 'full' },
  { path: 'agregar-arrendatario', component: AgregarArrendatarioComponent },
  { path: 'agregar-arrendatario/:id', component: AgregarArrendatarioComponent },
  { path: 'editar-arrendatario/:idArrendatario', component: AgregarArrendatarioComponent },
  {
    path: 'rent-rol',
    loadChildren: () =>
      import('./rent-rol/rent-rol.module').then((m) => m.RentRolModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ArrendatariosRoutingModule {}
