# Contexto actual del proyecto

## Stack y arquitectura

- Framework: Angular 20.
- UI: Angular Material + DevExtreme + Bootstrap + SCSS.
- Organizacion: modulos por dominio bajo `src/app/pages`.
- Enrutamiento principal: `src/app/app.routes.ts`.
- Modulos cargados lazy por ruta (ejemplo: `permisos`, `contratos`, `factores`).

## Convencion de modulos (patron repetido)

Cada modulo suele contener:

- `X.module.ts`
- `X-routing.module.ts`
- `lista-x/` (vista de grid/listado)
- `agregar-x/` (alta/edicion de formulario)
- `*.service.ts` en `src/app/services/moduleService` (cuando ya existe backend)

## Estado de Factores hoy

Modulo: `src/app/pages/factores`.

Ya existe:

- Vista de listado con dos grids: Factores y Formulas.
- Rutas de formulario separadas para factores y formulas.
- Formulario de Factor alineado al grid de factores (`variable`, `valor`, `descripcion`).
- Formulario de Formula separado (base demo local).

Pendiente natural para cerrar ciclo:

- Servicio backend para Formulas (si el backend aun no esta implementado).
