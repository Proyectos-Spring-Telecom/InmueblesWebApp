import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { AuthGuard } from './pages/authentication/side-login/Guard/auth.guard';
import { NoAuthGuard } from './pages/authentication/side-login/Guard/no-auth.guard';

export const routes: Routes = [
  // Redirección inicial al login
  { path: '', pathMatch: 'full', redirectTo: '/login' },

  {
    path: '',
    component: BlankComponent,
    canActivate: [NoAuthGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes
          ),
      },
    ],
  },

  {
    path: '',
    component: FullComponent,
    canActivate: [AuthGuard],      // Protege el componente padre
    canActivateChild: [AuthGuard], // Protege cada ruta hija individualmente
    children: [
      {
        path: '',
        redirectTo: '/starter',
        pathMatch: 'full',
      },
      {
        path: 'starter',
        loadChildren: () =>
          import('./pages/pages.routes').then((m) => m.PagesRoutes),
      },
      {
        path: 'permisos',
        loadChildren: () =>
          import('./pages/permisos/permisos.module').then((m) => m.PermisosModule),
      },
      {
        path: 'bitacora',
        loadChildren: () =>
          import('./pages/bitacora/bitacora.module').then((m) => m.BitacoraModule),
      },
      {
        path: 'modulos',
        loadChildren: () =>
          import('./pages/modulos/modulos.module').then((m) => m.ModulosModule),
      },
      {
        path: 'roles',
        loadChildren: () =>
          import('./pages/roles/roles.module').then((m) => m.RolesModule),
      },
      {
        path: 'usuarios',
        loadChildren: () =>
          import('./pages/usuarios/usuarios.module').then((m) => m.UsuariosModule),
      },
      {
        path: 'clientes',
        loadChildren: () =>
          import('./pages/clientes/clientes.module').then((m) => m.ClientesModule),
      },
      {
        path: 'sample-page',
        loadChildren: () =>
          import('./pages/pages.routes').then((m) => m.PagesRoutes),
      },
      {
        path: 'productos',
        loadChildren: () =>
          import('./pages/productos/productos.module').then((m) => m.ProductosModule),
      },
      {
        path: 'marcas',
        loadChildren: () =>
          import('./pages/marcas/marcas.module').then((m) => m.MarcasModule),
      },
      {
        path: 'modelos',
        loadChildren: () =>
          import('./pages/modelos/modelos.module').then((m) => m.ModelosModule),
      },
      {
        path: 'equipos',
        loadChildren: () =>
          import('./pages/equipos/equipos.module').then((m) => m.EquiposModule),
      },
      {
        path: 'departamentos',
        loadChildren: () =>
          import('./pages/departamentos/departamentos.module').then((m) => m.DepartamentosModule),
      },
      {
        path: 'contratos',
        loadChildren: () =>
          import('./pages/contratos/contratos.module').then((m) => m.ContratosModule),
      },
      {
        path: 'incrementos',
        loadChildren: () =>
          import('./pages/incrementos/incrementos.module').then((m) => m.IncrementosModule),
      },
      {
        path: 'factores',
        loadChildren: () =>
          import('./pages/factores/factores.module').then((m) => m.FactoresModule),
      },
      {
        path: 'servicios',
        loadChildren: () =>
          import('./pages/servicios/servicios.module').then((m) => m.ServiciosModule),
      },
      {
        path: 'metodos-pago',
        loadChildren: () =>
          import('./pages/metodos-pago/metodos-pago.module').then((m) => m.MetodosPagoModule),
      },
      {
        path: 'monitoreo',
        loadChildren: () =>
          import('./pages/monitoreo/monitoreo.module').then((m) => m.MonitoreoModule),
      },
      {
        path: 'arrendatarios',
        loadChildren: () =>
          import('./pages/arrendatarios/arrendatarios.module').then((m) => m.ArrendatariosModule),
      },
      {
        path: 'inmuebles',
        loadChildren: () =>
          import('./pages/inmuebles/inmuebles.module').then((m) => m.InmueblesModule),
      },
      {
        path: 'instalaciones-centrales',
        loadChildren: () =>
          import('./pages/instalaciones-centrales/instalaciones-centrales.module').then(
            (m) => m.InstalacionesCentralesModule
          ),
      },
      {
        path: 'instalaciones',
        loadChildren: () =>
          import('./pages/instalaciones/instalaciones.module').then((m) => m.InstalacionesModule),
      },
      {
        path: 'estacionamiento',
        loadChildren: () =>
          import('./pages/estacionamiento/estacionamiento.module').then(
            (m) => m.EstacionamientoModule
          ),
      },
      {
        path: 'registro-servicios-inmuebles',
        loadChildren: () =>
          import('./pages/registro-servicios-inmuebles/registro-servicios-inmuebles.module').then(
            (m) => m.RegistroServiciosInmueblesModule,
          ),
      },
      {
        path: 'registro-servicios-arrendatarios',
        loadChildren: () =>
          import('./pages/registro-servicios-arrendatarios/registro-servicios-arrendatarios.module').then(
            (m) => m.RegistroServiciosArrendatariosModule,
          ),
      },
    ],
  },

  { path: '**', redirectTo: '/login' },
];