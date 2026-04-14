import { NavItem } from './nav-item/nav-item';
import { Permiso } from 'src/app/entities/permiso.enum';

export const navItems: NavItem[] = [
  {
    navCap: 'Menú',
  },
  // {
  //   displayName: 'Tablero',
  //   iconName: 'home',
  //   route: '/dashboard',
  // },
  {
    displayName: 'Administración',
    iconName: 'box-multiple',
    route: '/menu-level',
    // Mostrar si tiene al menos un permiso de administración
    permission: [
      Permiso.CONSULTAR_MODULO,
      Permiso.CONSULTAR_PERMISOS,
      Permiso.CONSULTAR_PRODUCTOS,
      Permiso.CONSULTAR_MARCAS,
      Permiso.CONSULTAR_MODELOS,
      Permiso.CONSULTAR_EQUIPOS,
      Permiso.CONSULTAR_DEPARTAMENTOS,
      Permiso.CONSULTAR_INCREMENTOS,
      Permiso.CONSULTAR_FACTORES,
    ],
    children: [
      {
        displayName: 'Módulos',
        // iconName: 'puzzle',
        route: '/modulos',
        permission: Permiso.CONSULTAR_MODULO,
      },
      {
        displayName: 'Permisos',
        // iconName: 'shield-lock',
        route: '/permisos',
        permission: Permiso.CONSULTAR_PERMISOS,
      },
      {
        displayName: 'Productos',
        route: '/productos',
        // Mostrar si tiene al menos un permiso de productos
        permission: Permiso.CONSULTAR_PRODUCTOS,
      },
      {
        displayName: 'Marcas',
        route: '/marcas',
        permission: Permiso.CONSULTAR_MARCAS,
      },
      {
        displayName: 'Modelos',
        route: '/modelos',
        permission: Permiso.CONSULTAR_MODELOS,
      },
      {
        displayName: 'Equipos',
        route: '/equipos',
        permission: Permiso.CONSULTAR_EQUIPOS,
      },
      
      {
        displayName: 'INPC',
        route: '/incrementos',
        /* permission: [
          Permiso.CONSULTAR_DEPARTAMENTOS,
          Permiso.CONSULTAR_INCREMENTOS,
        ], */
      },
      {
        displayName: 'Factores',
        route: '/factores',
        /* permission: [
          Permiso.CONSULTAR_DEPARTAMENTOS,
          Permiso.CONSULTAR_FACTORES,
        ], */
      },
      // {
      //   displayName: 'Bitácora',
      //   iconName: 'date',
      //   permission: Permiso.CONSULTAR_BITACORA,
      // },
    ],
  },
  {
    displayName: 'Arrendadores',
    iconName: 'address-book',
    route: '/menu-level',
    // Mostrar si tiene al menos un permiso de clientes
    permission: [
      Permiso.CONSULTA_CLIENTE,
      Permiso.AGREGAR_CLIENTE,
      Permiso.ACTUALIZAR_CLIENTES,
      Permiso.ELIMINAR_CLIENTE,
    ],
    children: [
      {
        displayName: 'Agregar Arrendador',
        // iconName: 'user-cog',
        route: '/clientes/agregar-cliente',
        permission: Permiso.AGREGAR_CLIENTE,
      },
      {
        displayName: 'Lista Arrendadores',
        // iconName: 'user-cog',
        route: '/clientes',
        permission: Permiso.CONSULTA_CLIENTE,
      },
    ],
  },
  {
    displayName: 'Usuarios',
    iconName: 'users',
    route: '/menu-level',
    // Mostrar si tiene al menos un permiso de usuarios
    permission: [
      Permiso.CONSULTAR_USUARIO,
      Permiso.AGREGAR_USUARIO,
      Permiso.ACTUALIZAR_USUARIO,
      Permiso.ELIMINAR_USUARIO,
    ],
    children: [
      {
        displayName: 'Agregar Usuario',
        // iconName: 'user-cog',
        route: '/usuarios/agregar-usuario',
        permission: Permiso.AGREGAR_USUARIO,
      },
      {
        displayName: 'Lista Usuarios',
        // iconName: 'user-cog',
        route: '/usuarios',
        permission: Permiso.CONSULTAR_USUARIO,
      },
    ],
  },
  {
    displayName: 'Roles',
    iconName: 'user-cog',
    route: '/menu-level',
    // Mostrar si tiene al menos un permiso de roles
    permission: [
      Permiso.CONSULTAR_ROLES,
      Permiso.AGREGAR_ROL,
      Permiso.ACTUALIZAR_ROL,
      Permiso.ELIMINAR_ROL,
    ],
    children: [
      {
        displayName: 'Agregar Rol',
        // iconName: 'user-cog',
        route: '/roles/agregar-rol',
        permission: Permiso.AGREGAR_ROL,
      },
      {
        displayName: 'Lista Roles',
        // iconName: 'user-cog',
        route: '/roles',
        permission: Permiso.CONSULTAR_ROLES,
      },
    ],
  },
  {
    navCap: 'Operación',
  },
  {
    displayName: 'Monitoreo',
    iconName: 'chart-line',
    route: '/monitoreo',
    permission: Permiso.CONSULTAR_MONITOREO,
  },
  {
    displayName: 'Oficinas Centrales',
    iconName: 'antenna',
    route: '/instalaciones-centrales',
    permission: Permiso.CONSULTAR_OFICINA_CENTRAL,
  },
  {
    displayName: 'Estacionamiento',
    iconName: 'parking',
    route: '/estacionamiento',
  },
  /* {
    displayName: 'Instalaciones',
    iconName: 'building-warehouse',
    route: '/instalaciones',
    permission: Permiso.CONSULTAR_INSTALACIONES_GRID,
  },
  {
    displayName: 'Departamentos',
    iconName: 'building-community',
    route: '/departamentos',
    permission: Permiso.CONSULTAR_DEPARTAMENTOS,
  }, */
  /* {
    displayName: 'Contratos',
    iconName: 'file-text',
    route: '/contratos',
    permission: Permiso.CONSULTAR_DEPARTAMENTOS,
  }, */
  //{
  //  navCap: 'Reportes',
  //},
  // {
  //   displayName: 'Incidencias',
  //   iconName: 'alert-triangle',
  //   permission: Permiso.CONSULTAR_INCIDENCIAS,
  // },
  // {
  //   displayName: 'Dashboard',
  //   iconName: 'home',
  //   route: '/dashboard',
  //   permission: Permiso.CONSULTAR_TABLERO,
  // },

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
    // Sin permiso requerido - siempre visible
  },
  // {
  //   displayName: 'Register',
  //   iconName: 'user-edit',
  //   route: '/authentication/register',
  // },
  // {
  //   navCap: 'Other',
  // },

  // {
  //   displayName: 'Chip',
  //   iconName: 'mood-smile',
  //   route: '/',
  //   chip: true,
  //   chipClass: 'bg-secondary text-white',
  //   chipContent: '9',
  // },
  // {
  //   displayName: 'Outlined',
  //   iconName: 'mood-smile',
  //   route: '/',
  //   chip: true,
  //   chipClass: 'b-1 border-secondary text-secondary',
  //   chipContent: 'outlined',
  // },
  // {
  //   displayName: 'External Link',
  //   iconName: 'star',
  //   route: 'https://www.google.com/',
  //   external: true,
  // },
];
