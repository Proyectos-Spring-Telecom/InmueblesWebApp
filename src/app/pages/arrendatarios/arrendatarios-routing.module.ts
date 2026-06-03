import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OperacionPagosHubComponent } from 'src/app/shared/operacion-pagos-hub/operacion-pagos-hub.component';
import { ListaArrendatariosComponent } from './lista-arrendatarios/lista-arrendatarios.component';
import { ListaRentasArrendatariosComponent } from './lista-rentas-arrendatarios/lista-rentas-arrendatarios.component';
import { ListaHistoricoPagosRentaComponent } from './lista-historico-pagos-renta/lista-historico-pagos-renta.component';
import { AgregarArrendatarioComponent } from './agregar-arrendatario/agregar-arrendatario.component';
import {
  OPERACION_PAGO_MANTENIMIENTO,
  OPERACION_PAGO_RENTA,
} from './operacion-pago-dominio.config';
import { PAGOS_MANTENIMIENTO_HUB_CONFIG } from './pagos-mantenimiento-hub.config';
import { PAGOS_RENTA_HUB_CONFIG } from './pagos-renta-hub.config';

const routes: Routes = [
  { path: '', component: ListaArrendatariosComponent },
  {
    path: 'pagos-renta',
    component: OperacionPagosHubComponent,
    data: { operacionHub: PAGOS_RENTA_HUB_CONFIG },
    children: [
      { path: '', redirectTo: 'actual', pathMatch: 'full' },
      {
        path: 'actual',
        component: ListaRentasArrendatariosComponent,
        data: { hubEmbebido: true, operacionPagoDominio: OPERACION_PAGO_RENTA },
      },
      {
        path: 'historico',
        component: ListaHistoricoPagosRentaComponent,
        data: { hubEmbebido: true, operacionPagoDominio: OPERACION_PAGO_RENTA },
      },
    ],
  },
  {
    path: 'pagos-mantenimiento',
    component: OperacionPagosHubComponent,
    data: { operacionHub: PAGOS_MANTENIMIENTO_HUB_CONFIG },
    children: [
      { path: '', redirectTo: 'actual', pathMatch: 'full' },
      {
        path: 'actual',
        component: ListaRentasArrendatariosComponent,
        data: {
          hubEmbebido: true,
          operacionPagoDominio: OPERACION_PAGO_MANTENIMIENTO,
        },
      },
      {
        path: 'historico',
        component: ListaHistoricoPagosRentaComponent,
        data: {
          hubEmbebido: true,
          operacionPagoDominio: OPERACION_PAGO_MANTENIMIENTO,
        },
      },
    ],
  },
  { path: 'rentas', redirectTo: 'pagos-renta/actual', pathMatch: 'full' },
  { path: 'historico-pagos-renta', redirectTo: 'pagos-renta/historico', pathMatch: 'full' },
  { path: 'agregar-arrendatario', component: AgregarArrendatarioComponent },
  { path: 'agregar-arrendatario/:id', component: AgregarArrendatarioComponent },
  { path: 'editar-arrendatario/:idArrendatario', component: AgregarArrendatarioComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ArrendatariosRoutingModule {}
