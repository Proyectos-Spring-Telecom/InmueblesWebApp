import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaPermisosComponent } from './lista-permisos/lista-permisos.component';
import { AgregarPermisoComponent } from './agregar-permiso/agregar-permiso.component';

const routes: Routes = [
  { 
    path: '',
    component:ListaPermisosComponent
  },
  { path: 'agregar-permiso',
    component: AgregarPermisoComponent
  },
  {
    path: 'editar-permiso/:idPermiso',
    component: AgregarPermisoComponent,
  },
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PermisosRoutingModule {}
