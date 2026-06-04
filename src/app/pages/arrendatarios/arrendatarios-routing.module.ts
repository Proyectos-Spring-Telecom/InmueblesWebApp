import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaArrendatariosComponent } from './lista-arrendatarios/lista-arrendatarios.component';
import { AgregarArrendatarioComponent } from './agregar-arrendatario/agregar-arrendatario.component';
import { PagosRentaComponent } from './pagos-renta/pagos-renta.component';
import { ListaRentasActualesComponent } from './pagos-renta/lista-rentas-actuales/lista-rentas-actuales.component';
import { ListaHistoricoPagosRentaComponent } from './pagos-renta/lista-historico-pagos-renta/lista-historico-pagos-renta.component';
import { PagosMantenimientoComponent } from './pagos-mantenimiento/pagos-mantenimiento.component';
import { ListaMantenimientoActualComponent } from './pagos-mantenimiento/lista-mantenimiento-actual/lista-mantenimiento-actual.component';
import { ListaHistoricoPagosMantenimientoComponent } from './pagos-mantenimiento/lista-historico-pagos-mantenimiento/lista-historico-pagos-mantenimiento.component';

const routes: Routes = [
  { path: '', component: ListaArrendatariosComponent },
  {
    path: 'pagos-renta',
    component: PagosRentaComponent,
    children: [
      { path: '', redirectTo: 'actual', pathMatch: 'full' },
      {
        path: 'actual',
        component: ListaRentasActualesComponent,
        data: { hubEmbebido: true },
      },
      {
        path: 'historico',
        component: ListaHistoricoPagosRentaComponent,
        data: { hubEmbebido: true },
      },
    ],
  },
  {
    path: 'pagos-mantenimiento',
    component: PagosMantenimientoComponent,
    children: [
      { path: '', redirectTo: 'actual', pathMatch: 'full' },
      {
        path: 'actual',
        component: ListaMantenimientoActualComponent,
        data: { hubEmbebido: true },
      },
      {
        path: 'historico',
        component: ListaHistoricoPagosMantenimientoComponent,
        data: { hubEmbebido: true },
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
