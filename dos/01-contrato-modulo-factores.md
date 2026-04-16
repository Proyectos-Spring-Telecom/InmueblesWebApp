# Contrato del modulo Factores (hoy)

## Rutas

Archivo fuente: `src/app/pages/factores/factores-routing.module.ts`.

Rutas activas:

- `/factores` -> `ListaFactoresComponent`
- `/factores/agregar-factor` -> `AgregarFactorComponent`
- `/factores/editar-factor/:idFactor` -> `AgregarFactorComponent`
- `/factores/agregar-formula` -> `AgregarFormulaComponent`
- `/factores/editar-formula/:idFormula` -> `AgregarFormulaComponent`

## Pantalla de listado

Archivo fuente: `src/app/pages/factores/lista-factores/lista-factores.component.html`.

Contrato de UI:

- Dos columnas principales:
  - Grid Factores
  - Grid Formulas
- Cada grid tiene 3 botones independientes:
  - Agregar
  - Limpiar
  - Expandir/Contraer grupos

## Contrato de datos (front)

### Grid Factores (demo)

Fuente: `src/app/pages/factores/factores-presupuesto-demo.data.ts`.

Campos del row:

- `id`
- `variable`
- `valor`
- `descripcion`
- `estatus`

### Grid Formulas (demo)

Fuente: `src/app/pages/factores/formulas-presupuesto-demo.data.ts`.

Campos del row:

- `id`
- `nombre`
- `formula`
- `estatus`

## Servicios de Factores

Fuente: `src/app/services/moduleService/factores.service.ts`.

Endpoints existentes:

- `GET /cat-factores/paginated?page=&limit=`
- `GET /cat-factores/:id`
- `POST /cat-factores`
- `PATCH /cat-factores/:id`
- `PATCH /cat-factores/activar/:id`
- `PATCH /cat-factores/desactivar/:id`

Payload tipado actual:

- `nombre: string`
- `valor: number`
- `descripcion?: string | null`
- `categoria?: string | null`
- `zonaReferencia?: string | null`
- `unidad?: string | null`

Nota:

- El formulario de Factor esta orientado a `variable`, `valor`, `descripcion` y mapea `variable -> nombre` para compatibilidad con el servicio actual.
