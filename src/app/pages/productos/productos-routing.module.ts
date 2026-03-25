import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaProductosComponent } from './lista-productos/lista-productos.component';
import { AgregarProductoComponent } from './agregar-producto/agregar-producto.component';

const routes: Routes = [
  { 
    path: '',
    component:ListaProductosComponent
  },
  { path: 'agregar-producto',
    component: AgregarProductoComponent
  },
  {
    path: 'editar-producto/:idProducto',
    component: AgregarProductoComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductosRoutingModule { }
