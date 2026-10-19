# Qué cambió en el sistema (cambios de la API de Inmuebles)

Guía rápida. Cada punto dice: **dónde está**, **qué es**, **cómo se usa** y **qué debe pasar**.

---

## Resumen en tabla

| # | Qué se hizo | Ubicación exacta | Cómo funciona | Resultado |
|---|---|---|---|---|
| 1 | **Pago parcial** | Arrendatarios → Pago Renta y Mantto → Pagos del mes → **Acciones → Registrar pago**. También: Estado de cuenta → Lo que debe → **Pagar**, y Rent Rol → fila amarilla → 💵 | Escribes el **Monto recibido** y cuánto **Aplicar** a cada concepto, o usas **Saldar**. Para completar después, se registra otro pago en la misma renta | Si pagas menos del saldo, la renta queda **Parcial** con lo que falta. Al llegar a $0 pasa a **Pagado** |
| 2 | **¿Marcar renta como pagada?** | Ventana **Registrar pago** (solo aparece si hay rentas en la lista) | Por defecto **No**. **Sí** solo sirve en pagos parciales | **Sí** + pago parcial: la renta queda pagada. Si el monto ya cubre todo el saldo, la renta queda pagada sola (aviso en verde) |
| 3 | **Columnas Pagado, Saldo y Estatus** | Pago Renta y Mantto → Pagos del mes y Historial de pagos | Se muestran solas con lo que manda la API | Ves cuánto se ha pagado y cuánto falta de cada renta |
| 4 | **Menú Acciones** en rentas | Pagos del mes → columna **Opciones** → **Acciones ▾** | Editar (azul), Registrar pago (ámbar), Marcar como pagada (verde), Duplicar al mes siguiente (morado) | Cada acción hace lo mismo que antes, en un solo botón |
| 5 | **Menú Acciones** en mantenimiento | Pago Renta y Mantto → Mantenimiento → **Opciones → Acciones ▾** | Editar y Registrar pago | Igual que en rentas |
| 6 | **Marcar como pagada** | Acciones → **Marcar como pagada** | Pide confirmación | Registra un pago con fecha de hoy por lo que falte y la renta pasa a **Pagado** |
| 7 | **Estado de cuenta** (pantalla nueva) | Lista de Arrendatarios → ⋮ de la fila → **Estado de cuenta** | Arriba: Debe en total y % cobrado. Tarjetas: Vencido, Del mes actual, Saldo a favor y Pagos recibidos. Dos pestañas: **Lo que debe** y **Lo que ha pagado** | Ves en un solo lugar cuánto debe y qué ha pagado |
| 8 | **Agregar cargo de servicio** | Estado de cuenta → Lo que debe → botón arriba de la tabla | Eliges servicio, fecha y total. Si pones el subtotal, se calcula el IVA | Se crea una deuda nueva (sube lo que debe) y aparece como **Pendiente** |
| 9 | **Pagar** un cargo | Estado de cuenta → Lo que debe → **Pagar** | Abre Registrar pago con ese cargo primero en la lista | Baja lo que debe (pago completo o parcial) |
| 10 | **Ver** un cargo | Estado de cuenta → Lo que debe → **Ver** | Muestra subtotal, IVA, total, pagado, saldo y los pagos aplicados | Solo consulta. "IVA calculado" = IVA estimado (total ÷ 1.16) |
| 11 | **Cancelar cargo** | Estado de cuenta → Lo que debe → **Cancelar** (solo si no tiene pagos) | Pide motivo obligatorio | Deja de contar como deuda y queda **Cancelado**, no se borra. No se puede deshacer |
| 12 | **Ver** un pago | Estado de cuenta → Lo que ha pagado → **Ver** | Muestra a qué cargos se aplicó el pago | Solo consulta, más el botón **Quitar de este cargo** |
| 13 | **Quitar de este cargo** | Lo que ha pagado → Ver → botón en cada aplicación | Para un pago aplicado al cargo equivocado | El dinero regresa como saldo a favor |
| 14 | **Usar saldo** | Estado de cuenta → Lo que ha pagado → **Usar saldo** (solo si le sobró dinero) | Repartes el sobrante entre cargos con saldo | Baja lo que debe y baja el saldo a favor |
| 15 | **Cancelar pago** | Estado de cuenta → Lo que ha pagado → **Cancelar** | Pide motivo y lista qué cargos vuelven a deber | Los cargos vuelven a deber y el pago queda **Cancelado**. No se puede deshacer |
| 16 | **Incremento en Rent Rol** | Rent Rol → columna **Concepto** | Etiqueta **↑ Incremento** bajo el concepto, en lugar de pintar la fila de rojo | Se distingue sin agregar columnas |
| 17 | **Fechas correctas** | Rentas, Historial, Mantenimiento, Rent Rol, Monitoreo | Se muestran tal como vienen, sin cambiar de zona horaria | Ya no aparece un día antes o después |
| 18 | **IVA de contratos** | Alta y edición de Arrendatario (contrato) y Captura rápida de Rent Rol | IVA = subtotal × 0.16 redondeado; total = subtotal + IVA | Los contratos nuevos cuadran al centavo |
| 19 | **Seguridad** | Editar arrendatario, arrendador o inmueble; Cambio de contraseña | Registro de otro cliente → "Registro no encontrado". Contraseña de otro → mensaje 403 | No se ven ni se modifican datos ajenos |
| 20 | **Tarjeta de Débito** | Cualquier lista de "Método de pago" | Viene de la API | Aparece como opción de pago |

---

## 1. Pagar una renta en partes (pago parcial)

- **Dónde:** Arrendatarios → Pago Renta y Mantto → pestaña Rentas.
  - Botón azul de arriba: **"Registrar abono / pago parcial"**.
  - O en cada renta: **Opciones → Acciones → Registrar pago**.
- **Qué es:** registrar dinero recibido aunque no cubra toda la renta.
- **Cómo se usa:**
  1. Escribe el **Monto recibido**, la **Fecha**, el **Método** y la **Referencia** (el comprobante es opcional).
  2. Abajo aparecen las rentas y servicios que debe. En cada uno escribe cuánto se paga, o da clic en **Saldar**.
  3. Clic en **Registrar pago**.
- **Qué debe pasar:**
  - Si pagó menos de lo que debía, la renta queda en **Parcial** (ámbar) y muestra cuánto falta.
  - Si pagó todo, queda en **Pagada** (verde).
  - Si pagó de más, lo que sobra queda como **saldo a favor**.

## 2. Columnas nuevas en Rentas

- **Dónde:** Pago Renta y Mantto → pestaña Rentas.
- **Qué es:** las columnas **Pagado** y **Saldo**, y el estatus **Parcial**.
- **Qué debe pasar:** ves cuánto se ha pagado y cuánto falta de cada renta.

## 3. Marcar como pagada

- **Dónde:** Pago Renta y Mantto → Opciones → Acciones → **Marcar como pagada**. También en Rent Rol (✔).
- **Qué es:** paga en un clic lo que falta, con la fecha de hoy.
- **Qué debe pasar:** la renta queda **Pagada** y pasa al Historial.

## 4. Pagar desde Rent Rol

- **Dónde:** Rent Rol → filas amarillas (Por pagar) → botón 💵.
- **Qué es:** el mismo "Registrar pago" del punto 1.
- **Qué debe pasar:** igual que el punto 1. Una renta en **Parcial** no deja cerrar el mes.

## 5. Historial de pagos

- **Dónde:** Arrendatarios → Historial de Pagos.
- **Qué es:** la columna nueva **Pagado**.
- **Qué debe pasar:** solo aparecen las rentas pagadas completas.

## 6. Estado de cuenta (pantalla nueva)

- **Dónde:** Lista de Arrendatarios → ⋮ de la fila → **Estado de cuenta**.
- **Qué es:** en un solo lugar, cuánto debe el arrendatario y qué ha pagado.
- **Qué ves:**
  - Arriba: nombre, **Debe en total** y el **% cobrado**.
  - Tarjetas: **Vencido**, **Del mes actual**, **Saldo a favor** y **Pagos recibidos**.
  - Pestaña **Lo que debe**: cada renta o servicio con lo pagado y el saldo.
  - Pestaña **Lo que ha pagado**: cada pago, lo aplicado y lo que quedó a favor.
- **Todo se hace desde la tabla** (columna **Acciones** de cada fila):

| Pestaña | Botón | Para qué |
|---|---|---|
| Lo que debe | **Agregar cargo de servicio** (arriba de la tabla) | Anotar un cobro nuevo: luz, agua, etc. |
| Lo que debe | **Ver** | Ver el desglose (subtotal, IVA, pagado) y qué pagos tiene |
| Lo que debe | **Pagar** | Registrar el dinero que entregó para ese cargo (completo o parcial) |
| Lo que debe | **Cancelar** | Solo si el cargo se creó por error y no tiene pagos |
| Lo que ha pagado | **Ver** | Ver a qué cargos se aplicó el pago |
| Lo que ha pagado | **Usar saldo** | Usar lo que sobró de ese pago en otro cargo |
| Lo que ha pagado | **Cancelar** | Si el pago se capturó mal (monto, fecha o arrendatario) |

- Los botones solo aparecen cuando aplican (por ejemplo, **Pagar** no sale si el cargo ya está pagado).

## 7. Diferencia: Agregar cargo de servicio vs Pagar

- **Agregar cargo de servicio** = **lo que DEBE**. Anota una deuda nueva (ej. recibo de luz por $1,500). Hace que suba lo que debe.
- **Pagar** = **lo que ENTREGÓ**. Registra el dinero que el arrendatario pagó. Hace que baje lo que debe.
- Orden normal: primero se agrega el cargo y después, cuando paga, se usa **Pagar**.

## 8. Usar saldo a favor

- **Dónde:** Lo que ha pagado → **Usar saldo** (solo en pagos con dinero sobrante).
- **Resultado:** baja lo que se debe y baja el saldo a favor.

## 9. Corregir errores

- **Cargo creado por error:** Lo que debe → **Cancelar**. Pide un motivo; queda como **Cancelado** (no se borra).
- **Pago mal capturado:** Lo que ha pagado → **Cancelar**. Pide un motivo; los cargos vuelven a deber y el pago queda como **Cancelado**.
- **Pago aplicado al cargo equivocado:** Lo que ha pagado → **Ver** → **Quitar de este cargo**. El dinero regresa como saldo a favor y se usa en el correcto con **Usar saldo**.
- **Nota:** "IVA calculado" = el IVA se estimó (total ÷ 1.16).

## 10. Agregar cargo de servicio (luz, agua, etc.)

- **Dónde:** Lo que debe → **Agregar cargo de servicio**.
- **Cómo:** eliges el servicio, la fecha y el total. Si pones el subtotal, el sistema calcula el IVA.
- **Resultado:** aparece en **Lo que debe** como **Pendiente** y se paga con **Pagar**.

## 11. Fechas y horas correctas

- **Dónde:**
  - Columnas de fecha de Rentas, Historial, Mantenimiento y Rent Rol.
  - Propiedades.
  - Dashboard del arrendatario.
- **Qué es:** antes algunas fechas salían un día antes y algunas horas 6 horas antes.
- **Qué debe pasar:** se ven igual que en la base de datos.

## 12. IVA de los contratos

- **Dónde:** alta y edición de Arrendatario (cálculo del contrato) y Captura rápida de Rent Rol.
- **Qué es:** el IVA se calcula como subtotal × 16 % (redondeado) y el total como subtotal + IVA.
- **Qué debe pasar:** subtotal + IVA = total, exacto al centavo.

## 13. Seguridad

- **Registro de otro cliente:** al abrir Editar de un arrendatario, arrendador o inmueble que no es tuyo, sale **"Registro no encontrado"** y en arrendatario y arrendador te regresa a la lista.
- **Contraseña de otro usuario:** en la pantalla de cambio de contraseña sale **"Sólo puedes cambiar tu propia contraseña."**
- **Bitácora:** sin cambios; ya enviaba la sesión.

## 14. Tarjeta de Débito

- **Dónde:** cualquier lista de "Método de pago".
- **Qué debe pasar:** aparece sola, porque viene de la API.

---

### No se hizo (opcional en la guía de la API)
- En **Pagos de servicios** no se agregaron las columnas Saldo y Estado.
- En **Rent Rol** las filas siguen mostrando el monto total, no el saldo restante.
