import { NavItem } from './nav-item/nav-item';
import { Permiso } from 'src/app/entities/permiso.enum';

const permisosArrendadores = [
  Permiso.CONSULTA_ARRENDADORES,
  Permiso.ACTUALIZAR_ARRENDADORES,
  Permiso.AGREGAR_ARRENDADOR,
  Permiso.ELIMINAR_ARRENDADOR,
];

const permisosInmuebles = [
  Permiso.CONSULTAR_INMUEBLES,
  Permiso.ACTUALIZAR_INMUEBLE,
  Permiso.AGREGAR_INMUEBLE,
  Permiso.ELIMINAR_INMUEBLE,
];

const permisosArrendatarios = [
  Permiso.CONSULTAR_ARRENDATARIOS,
  Permiso.ACTUALIZAR_ARRENDATARIOS,
  Permiso.AGREGAR_ARRENDATARIOS,
  Permiso.ELIMINAR_ARRENDATARIOS,
];

export const navItems: NavItem[] = [
  {
    navCap: 'Menú',
  },
  {
    displayName: 'Administración',
    iconName: 'box-multiple',
    route: '/menu-level',
    permission: [
      Permiso.CONSULTAR_MODULO,
      Permiso.AGREGAR_MODULO,
      Permiso.ACTUALIZAR_MODULO,
      Permiso.ELIMINAR_MODULO,
      Permiso.CONSULTAR_PERMISOS,
      Permiso.AGREGAR_PERMISO,
      Permiso.ACTUALIZAR_PERMISO,
      Permiso.ELIMINAR_PERMISO,
      Permiso.CONSULTAR_INPC,
      Permiso.AGREGAR_INPC,
      Permiso.ACTUALIZAR_INPC,
      Permiso.ELIMINAR_INPC,
      Permiso.CONSULTAR_FACTORES,
      Permiso.AGREGAR_FACTORES,
      Permiso.ACTUALIZAR_FACTOR,
      Permiso.ELIMINAR_FACTOR,
      Permiso.CONSULTAR_SERVICIOS,
      Permiso.AGREGAR_SERVICIO,
      Permiso.ACTUALIZAR_SERVICIO,
      Permiso.ELIMINAR_SERVICIO,
      Permiso.CONSULTAR_METODOS_DE_PAGO,
    ],
    children: [
      {
        displayName: 'Módulos',
        route: '/modulos',
        permission: [
          Permiso.CONSULTAR_MODULO,
          Permiso.AGREGAR_MODULO,
          Permiso.ACTUALIZAR_MODULO,
          Permiso.ELIMINAR_MODULO,
        ],
      },
      {
        displayName: 'Permisos',
        route: '/permisos',
        permission: [
          Permiso.CONSULTAR_PERMISOS,
          Permiso.AGREGAR_PERMISO,
          Permiso.ACTUALIZAR_PERMISO,
          Permiso.ELIMINAR_PERMISO,
        ],
      },
      {
        displayName: 'INPC',
        route: '/incrementos',
        permission: [
          Permiso.CONSULTAR_INPC,
          Permiso.AGREGAR_INPC,
          Permiso.ACTUALIZAR_INPC,
          Permiso.ELIMINAR_INPC,
        ],
      },
      {
        displayName: 'Factores',
        route: '/factores',
        permission: [
          Permiso.CONSULTAR_FACTORES,
          Permiso.AGREGAR_FACTORES,
          Permiso.ACTUALIZAR_FACTOR,
          Permiso.ELIMINAR_FACTOR,
        ],
      },
      {
        displayName: 'Servicios',
        route: '/servicios',
        permission: [
          Permiso.CONSULTAR_SERVICIOS,
          Permiso.AGREGAR_SERVICIO,
          Permiso.ACTUALIZAR_SERVICIO,
          Permiso.ELIMINAR_SERVICIO,
        ],
      },
      {
        displayName: 'Métodos de pago',
        route: '/metodos-pago',
        permission: Permiso.CONSULTAR_METODOS_DE_PAGO,
      },
    ],
  },
  {
    displayName: 'Usuarios',
    iconName: 'users',
    route: '/menu-level',
    permission: [
      Permiso.CONSULTAR_USUARIO,
      Permiso.AGREGAR_USUARIO,
      Permiso.ACTUALIZAR_USUARIO,
      Permiso.ELIMINAR_USUARIO,
    ],
    children: [
      {
        displayName: 'Agregar Usuario',
        route: '/usuarios/agregar-usuario',
        permission: Permiso.AGREGAR_USUARIO,
      },
      {
        displayName: 'Lista Usuarios',
        route: '/usuarios',
        permission: Permiso.CONSULTAR_USUARIO,
      },
    ],
  },
  {
    displayName: 'Roles',
    iconName: 'user-cog',
    route: '/menu-level',
    permission: [
      Permiso.CONSULTAR_ROLES,
      Permiso.AGREGAR_ROL,
      Permiso.ACTUALIZAR_ROL,
      Permiso.ELIMINAR_ROL,
    ],
    children: [
      {
        displayName: 'Agregar Rol',
        route: '/roles/agregar-rol',
        permission: Permiso.AGREGAR_ROL,
      },
      {
        displayName: 'Lista Roles',
        route: '/roles',
        permission: Permiso.CONSULTAR_ROLES,
      },
    ],
  },
  {
    navCap: 'Operación',
  },
  {
    displayName: 'Arrendadores',
    iconName: 'building',
    route: '/monitoreo',
    permission: [
      Permiso.CONSULTAR_ARRENDADORES_MAPA,
      ...permisosArrendadores,
    ],
  },
  {
    displayName: 'Gestión',
    iconName: 'address-book',
    route: '/menu-level',
    permission: [
      ...permisosArrendadores,
      ...permisosInmuebles,
      ...permisosArrendatarios,
      Permiso.PERMISO_RESERVADO_RENT_ROL,
    ],
    children: [
      {
        displayName: 'Lista Arrendadores',
        route: '/clientes',
        permission: permisosArrendadores,
      },
      {
        displayName: 'Lista Inmuebles',
        route: '/inmuebles',
        permission: permisosInmuebles,
      },
      {
        displayName: 'Arrendatarios',
        route: '/menu-level',
        permission: permisosArrendatarios,
        children: [
          {
            displayName: 'Lista de Arrendatarios',
            route: '/arrendatarios',
            permission: Permiso.CONSULTAR_ARRENDATARIOS,
          },
          {
            displayName: 'Pagos del mes',
            route: '/arrendatarios/pagos-mes',
            permission: Permiso.CONSULTAR_ARRENDATARIOS,
          },
          {
            displayName: 'Histórico de pagos',
            route: '/arrendatarios/pagos-historico',
            permission: Permiso.CONSULTAR_ARRENDATARIOS,
          },
        ],
      },
      {
        displayName: 'Rent Rol',
        route: '/arrendatarios/rent-rol',
        permission: [
          Permiso.PERMISO_RESERVADO_RENT_ROL,
          Permiso.CONSULTAR_ARRENDATARIOS,
        ],
      },
    ],
  },
  {
    navCap: 'Reportes',
  },
  {
    displayName: 'Servicios Inmueble',
    iconName: 'building',
    route: '/registro-servicios-inmuebles',
    permission: Permiso.CONSULTAR_SERVICIOS_INMUEBLES,
  },
  {
    displayName: 'Servicios Arrendatarios',
    iconName: 'users',
    route: '/registro-servicios-arrendatarios',
    permission: Permiso.CONSULTAR_SERVICIOS_ARRENDATARIOS,
  },
  {
    navCap: 'Ajustes',
  },
  {
    displayName: 'Perfil Usuario',
    iconName: 'user',
    route: '/usuarios/perfil-usuario',
  },
  {
    displayName: 'Cerrar Sesión',
    iconName: 'lock',
    route: '/login',
  },
];
