import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';

export const routes: Routes = [
  // 👇 Redirección inicial: siempre caer en /authentication/login
  { path: '', pathMatch: 'full', redirectTo: '/login' },

  {
    path: '',
    component: BlankComponent, // Login y demás páginas "en blanco"
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
    component: FullComponent, // Tu layout principal
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
        path: 'dashboard',
        loadChildren: () =>
          import('./pages/dashboard/dashboard.module').then((m) => m.DashboardModule),
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
        path: 'monitoreo',
        loadChildren: () =>
          import('./pages/monitoreo/monitoreo.module').then((m) => m.MonitoreoModule),
      },
      {
        path: 'instalaciones-centrales',
        loadChildren: () =>
          import('./pages/instalaciones-centrales/instalaciones-centrales.module').then((m) => m.InstalacionesCentralesModule),
      },
      {
        path: 'instalaciones',
        loadChildren: () =>
          import('./pages/instalaciones/instalaciones.module').then((m) => m.InstalacionesModule),
      },
    ],
  },

  { path: '**', redirectTo: 'authentication/error' },
];
