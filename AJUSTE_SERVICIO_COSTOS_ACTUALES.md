# Ajuste al servicio — Costos actuales (Rent Rol)

> **Para:** backend
> **Servicio:** `GET /contratos/costos-actuales/paginated`
> **Referencia:** `SERVICIO_COSTOS_ACTUALES_RENT_ROL.md` (propuesta original)
> **Prioridad:** alta — la pantalla **Rent Rol** (botón del header) sale vacía.

## 1. Problema

El servicio ya existe y responde `200` con la forma correcta (`data` + `paginated` + `resumen`), pero **siempre regresa la lista vacía**:

```json
{
  "data": [],
  "paginated": { "total": 0, "page": 1, "lastPage": 1 },
  "resumen": { "cantidadRelaciones": 0, "totalRenta": 0, "...": 0, "granTotal": 0 }
}
```

**Causa:** la regla **RN-02** de la propuesta original (solo contratos con `fechaInicioContrato ≤ hoy ≤ fechaTerminoContrato`). Hoy todos los contratos activos tienen la fecha de término vencida o no tienen fechas, así que ninguno pasa el filtro.

Contratos activos (`estatus = 1`) al **04/11/2026**:

| Contrato | Arrendatario | Inicio | Término | Resultado con RN-02 |
|---|---|---|---|---|
| 69 | Suburbia | 2026-07-30 | 2026-08-31 | Excluido (vencido) |
| 71 | Nutrisa | 2026-08-01 | 2026-08-31 | Excluido (vencido) |
| 54 | Cinepolis | 2026-08-15 | 2026-08-22 | Excluido (vencido) |
| 70 | Tapiocas MX | 2026-08-01 | 2026-09-30 | Excluido (vencido) |
| 68 | Smart Fit | 2026-08-29 | 2026-09-05 | Excluido (vencido) |
| 40 | Coppel D10 | 2026-08-01 | 2026-08-29 | Excluido (vencido) |
| 74 | Paletas | `null` | `null` | Excluido (sin fechas) |

Estos contratos **siguen operando**: tienen rentas generándose cada mes en `/renta-actual`. El negocio necesita ver su costo actual aunque la fecha de término haya pasado.

## 2. Cambio solicitado

### 2.1 Nueva regla RN-02 (reemplaza a la anterior)

Una relación aparece en el servicio si su contrato está **activo**:

- `contrato.estatus = 1`, y
- el contrato **no está cancelado ni dado de baja** (`fechaBaja` es `null`).

Las fechas del contrato **ya no excluyen** registros: solo sirven para informar (ver 2.2). Los contratos con fechas en `null` **sí aparecen**.

### 2.2 Campos nuevos en cada fila

| Campo | Tipo | Descripción |
|---|---|---|
| `vigencia` | `string` | Estado de la vigencia según la fecha de hoy: `"VIGENTE"` (inicio ≤ hoy ≤ término), `"VENCIDO"` (término < hoy), `"POR_INICIAR"` (inicio > hoy) o `"SIN_FECHAS"` (inicio o término en `null`). |
| `diasParaVencer` | `number \| null` | Días que faltan para `fechaTerminoContrato`. Negativo si ya venció (ej. `-65`). `null` si no hay fecha de término. |

Ejemplo:

```json
{
  "idContrato": 69,
  "arrendatario": "Suburbia",
  "fechaInicioContrato": "2026-07-30",
  "fechaTerminoContrato": "2026-08-31",
  "vigencia": "VENCIDO",
  "diasParaVencer": -65,
  "...": "resto de campos igual que la propuesta original (sección 5.2)"
}
```

### 2.3 Filtro opcional nuevo

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `vigencia` | `string` | No | Filtra por uno de los valores de 2.2 (`VIGENTE`, `VENCIDO`, `POR_INICIAR`, `SIN_FECHAS`). Si no se manda, devuelve **todos** los contratos activos. Afecta a `data` y a `resumen`. |

### 2.4 Lo que no cambia

- Ruta, método, autenticación y paginación.
- Forma de la respuesta: `data` + `paginated` + `resumen`.
- Todos los campos de la fila de la propuesta original (desglose, locales, locales vacíos, `totalGeneral`, etc.).
- El `resumen` suma **todas** las filas que cumplan los filtros (no solo la página).

## 3. Criterios de aceptación

1. **Dado** un contrato activo con fecha de término vencida, **cuando** se consulta el servicio sin filtros, **entonces** aparece con `vigencia: "VENCIDO"` y `diasParaVencer` negativo.
2. **Dado** un contrato activo sin fechas (contrato 74, Paletas), **cuando** se consulta, **entonces** aparece con `vigencia: "SIN_FECHAS"` y `diasParaVencer: null`.
3. **Dado** un contrato cancelado o con `fechaBaja`, **cuando** se consulta, **entonces** **no** aparece.
4. **Dado** `?vigencia=VIGENTE`, **cuando** se consulta, **entonces** solo salen los contratos dentro de su vigencia y el `resumen` suma solo esos.
5. **Dado** los 7 contratos activos de la tabla de la sección 1, **cuando** se consulta sin filtros, **entonces** `paginated.total` es `7` y `resumen.cantidadRelaciones` es `7`.

## 4. Pedido adicional

En cuanto esté el cambio, compartir una **respuesta real** (una página con 2–3 filas) para validar en el front que cada fila trae los campos de la propuesta original: `desglose.renta`, `desglose.mantenimiento`, `incluyeMantenimiento`, `locales`, `localesVacios`, `tieneLocalesVacios`, `cantidadLocalesVacios`, `totalGeneral`, `representanteLegal` y `telefonoRepresentante`.
