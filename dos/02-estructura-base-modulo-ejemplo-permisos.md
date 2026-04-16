# Estructura base por modulo (ejemplo Permisos)

Objetivo: usar esta guia para crear o extender modulos nuevos conservando la misma estructura del proyecto.

## Referencia real: Permisos

Archivos de referencia:

- `src/app/pages/permisos/permisos.module.ts`
- `src/app/pages/permisos/permisos-routing.module.ts`
- `src/app/pages/permisos/lista-permisos/lista-permisos.component.ts`
- `src/app/pages/permisos/lista-permisos/lista-permisos.component.html`
- `src/app/pages/permisos/agregar-permiso/agregar-permiso.component.ts`
- `src/app/pages/permisos/agregar-permiso/agregar-permiso.component.html`

## Plantilla recomendada para cualquier modulo X

Ruta sugerida:

- `src/app/pages/x/`

Contenido minimo:

- `x.module.ts`
- `x-routing.module.ts`
- `lista-x/`
  - `lista-x.component.ts`
  - `lista-x.component.html`
  - `lista-x.component.scss`
- `agregar-x/`
  - `agregar-x.component.ts`
  - `agregar-x.component.html`
  - `agregar-x.component.scss`

Servicio (si aplica backend):

- `src/app/services/moduleService/x.service.ts`

## Patron de rutas

En `x-routing.module.ts`:

- `''` -> listado
- `'agregar-x'` -> formulario alta
- `'editar-x/:idX'` -> formulario edicion

## Patron de modulo

En `x.module.ts`:

- Declarar `ListaXComponent` y `AgregarXComponent`.
- Importar:
  - `CommonModule`
  - `XRoutingModule`
  - `MatIconModule`
  - `DxDataGridModule`
  - `DxButtonModule`
  - `MaterialModule`
  - `ReactiveFormsModule`
  - `FormsModule`
  - `HasPermissionDirective`

## Patron de permisos y acciones

- En listado, usar `*appHasPermission` para acciones sensibles.
- Mantener acciones de tabla consistentes:
  - editar
  - eliminar/activar/desactivar (si aplica)
- Mantener mismo estilo de confirmaciones con SweetAlert2.
