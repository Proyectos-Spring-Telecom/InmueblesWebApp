# Mapa de que se toca y que no se toca

## Si el cambio es solo de UI del modulo Factores

Tocar:

- `src/app/pages/factores/lista-factores/lista-factores.component.html`
- `src/app/pages/factores/lista-factores/lista-factores.component.ts`
- `src/app/pages/factores/lista-factores/lista-factores.component.scss` (si hay estilo)

No tocar (salvo que el requerimiento lo pida):

- `src/app/services/moduleService/factores.service.ts`
- endpoints/backend
- rutas globales en `src/app/app.routes.ts`

## Si el cambio es de formularios Factores/Formulas

Tocar:

- `src/app/pages/factores/agregar-factor/*`
- `src/app/pages/factores/agregar-formula/*`
- `src/app/pages/factores/factores-routing.module.ts` (si hay rutas nuevas)
- `src/app/pages/factores/factores.module.ts` (si hay componentes nuevos)

No tocar:

- otros modulos no relacionados (`usuarios`, `clientes`, `contratos`, etc.)

## Si el cambio es contrato de datos

Tocar:

- `src/app/services/moduleService/factores.service.ts`
- interfaces de payload
- consumo en componentes del modulo

No tocar:

- estructura visual global del layout
- temas SCSS globales, excepto requerimiento explicito

## Regla operativa para futuros cambios

1. Definir primero si el cambio es UI, rutas o datos.
2. Limitar impacto al modulo objetivo (`factores`) mientras sea posible.
3. Copiar patron de `permisos` para mantener consistencia.
4. Solo escalar a rutas globales o servicios compartidos cuando sea estrictamente necesario.
