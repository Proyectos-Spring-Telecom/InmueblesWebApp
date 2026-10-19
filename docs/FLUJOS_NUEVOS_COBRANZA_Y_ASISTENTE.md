# Flujos nuevos: Cobranza y Asistente (Claudia)

Este documento cubre **solo lo nuevo** que se implementó en el front a partir de tres guías:

| Guía | Qué se implementó |
|---|---|
| `cambios_api_inmuebles_front.md` | Cobranza nueva: pagos parciales, estado de cuenta, saldo a favor, correcciones, cargos de servicio, fechas, IVA y seguridad |
| `agente_consumo_front.md` | Asistente conversacional **Claudia** (burbuja de chat) |
| `analisis_capacidades_agente_inmuebles.md` | Alcance del asistente: **solo consulta**, sin modificar datos |

**Conceptos clave**
- **Cargo** = lo que el arrendatario **debe** (renta, mantenimiento, recibo de luz…).
- **Pago** = el dinero que **entregó**.
- **Aplicar** = decidir a qué cargo va ese dinero. Lo que no se aplica queda como **saldo a favor**.
- **Estados de un cargo:** Pendiente → **Parcial** (pagó una parte) → Pagado. También puede quedar **Cancelado**.

**Cómo leer las ubicaciones**
- **Menú:** barra lateral izquierda → sección → opción.
- **URL:** dirección que aparece en el navegador.
- **Zona:** parte de la pantalla donde está el botón o la columna.

---

## Mapa de ubicaciones

| Pantalla | Menú lateral | URL | Qué se hace ahí (nuevo) | Para qué sirve |
|---|---|---|---|---|
| **Pagos del mes · Rentas** | Operación → **Arrendatarios** → **Pago Renta y Mantto** → pestaña **Rentas** | `/arrendatarios/pagos-mes/renta` | Registrar pago (total o parcial), Marcar como pagada, Abono general, ver Pagado y Saldo | Cobrar las rentas del mes y saber cuánto falta de cada una |
| **Pagos del mes · Mantenimientos** | Operación → **Arrendatarios** → **Pago Renta y Mantto** → pestaña **Mantenimientos** | `/arrendatarios/pagos-mes/mantenimiento` | Menú **Acciones ▾** (Editar y Registrar pago) | Corregir o cobrar las cuotas de mantenimiento desde un solo botón |
| **Histórico de pagos · Rentas** | Operación → **Arrendatarios** → **Historial de Pagos** → pestaña **Rentas** | `/arrendatarios/pagos-historico/renta` | Ver rentas pagadas por completo, con columna Pagado | Consultar las rentas que ya quedaron liquidadas |
| **Lista de Arrendatarios** | Operación → **Arrendatarios** → **Lista de Arrendatarios** | `/arrendatarios` | Entrada al **Estado de cuenta** | Llegar a la situación financiera de un arrendatario |
| **Estado de cuenta** (nueva) | Lista de Arrendatarios → fila → columna **Opciones** → **Acciones ▾** → **Estado de cuenta** | `/arrendatarios/estado-cuenta/{id}` | Cargos, pagos, saldo a favor, correcciones y cargos de servicio | Ver en un solo lugar cuánto debe, qué pagó y corregir errores |
| **Rent Rol** | Operación → **Rent Rol** | `/arrendatarios/rent-rol` | Registrar pago desde filas amarillas y etiqueta de incremento | Cobrar sin salir del Rent Rol e identificar rentas que subieron de precio |
| **Asistente Claudia** | Burbuja flotante, esquina **inferior derecha**, en todas las pantallas | — | Consultas en lenguaje natural | Obtener datos (quién debe, cobrado, contratos por vencer) sin buscar en pantallas |

---

## Parte 1 · Cobranza

### La ventana "Registrar pago" (se usa en F1, F2, F3 y F5)

De arriba hacia abajo:

| Zona | Campo o botón | Para qué |
|---|---|---|
| Encabezado | Título **Registrar pago** + nombre del arrendatario | Identifica a quién se le cobra |
| Fila 0 (solo en abono general) | **Arrendatario** | Elegir a quién se le registra el pago |
| Fila 1 | **Monto recibido** · **Fecha de pago** · **Método de pago** | Dinero entregado, fecha real (puede ser anterior) y forma de pago |
| Fila 2 | **Referencia** · **¿Marcar renta como pagada?** | Folio o SPEI para rastrear el pago (opcional) · Dar la renta por pagada aunque el pago sea parcial (solo aparece si hay rentas en la lista) |
| Fila 3 | **Comprobante de pago** → botón **Seleccionar** | Adjuntar la evidencia del pago: PDF, PNG o JPG, hasta 10 MB (opcional) |
| Sección **¿A qué se aplica el pago?** | Una tarjeta por concepto con saldo, con campo **Aplicar** y botón **Saldar** | Cuánto de este pago va a cada renta o servicio |
| Debajo de las tarjetas | Botón **Limpiar montos** | Borra lo escrito en Aplicar |
| Contadores | **Pago** · **Por aplicar** · **Quedará a favor** | Revisar antes de guardar: cuánto entró, cuánto se reparte y cuánto queda como saldo a favor |
| Pie | **Cancelar** · **Registrar pago** | Cerrar sin guardar · Guardar el pago y actualizar los saldos |

---

### F1. Pagar una renta completa

**Para qué sirve:** dejar una renta liquidada registrando el dinero recibido con su fecha real, método y comprobante.

**Ubicación:**
- Menú: Operación → Arrendatarios → **Pago Renta y Mantto** → pestaña **Rentas** (`/arrendatarios/pagos-mes/renta`).
- Zona: tabla → **primera columna "Opciones"** de la renta → botón **Acciones ▾** → opción **Registrar pago** (ícono de billete, color ámbar).

**Pasos:**
1. Se abre **Registrar pago** con esa renta primero en **¿A qué se aplica el pago?**.
2. Fila 1: **Monto recibido**, **Fecha de pago** y **Método de pago**.
3. En la tarjeta de la renta: botón **Saldar**, que llena el saldo completo.
4. Pie: **Registrar pago**.

**Resultado:**
- Columna **Estatus** = **Pagada**.
- La columna Opciones cambia a **"✓ Renta Pagada"** (ya sin Acciones).

**API:** `POST /pagos`.

---

### F2. Pago parcial y abonos posteriores

**Para qué sirve:** cobrar una renta en varias exhibiciones. El sistema lleva la cuenta de lo pagado y de lo que falta, sin perder ningún abono.

**Ubicación (cualquiera de las tres):**
- Pago Renta y Mantto → pestaña **Rentas** → columna **Opciones** → **Acciones ▾** → **Registrar pago**.
- Estado de cuenta → pestaña **Lo que debe** → columna **Acciones** de la fila → botón verde **Pagar**.
- Rent Rol → tabla → fila amarilla (**Por pagar**) → columna **Acciones** → botón de billete (💵 "Registrar pago").

**Pasos:**
1. **Primer abono:** **Monto recibido** menor al saldo (ej. $40,000 de $95,000) → mismo monto en **Aplicar** de la renta → **Registrar pago**.
   - Estatus **Parcial** · Pagado $40,000 · Saldo $55,000.
2. **Siguiente abono:** la renta sigue en la tabla → **Acciones ▾ → Registrar pago** otra vez → Monto $55,000 → **Saldar** → **Registrar pago**.
   - Estatus **Pagada**.
3. Se repite cuantas veces haga falta. Cada abono es un **pago nuevo**.

**Dónde se ve el avance:**
- Pago Renta y Mantto → pestaña Rentas → columnas **Pagado**, **Saldo** y **Estatus**.
- Estado de cuenta → Lo que debe → columna **Pagado** (con barra de avance) → botón **Ver** → sección **Historial de pagos aplicados**.

**API:** `POST /pagos` por cada abono.

---

### F3. Pago parcial dándola por pagada

**Para qué sirve:** cerrar una renta aunque el arrendatario haya pagado menos (por ejemplo, un descuento acordado). Por defecto no se marca, para no darla por pagada por error.

**Ubicación:** ventana **Registrar pago** → **Fila 2, a la derecha de Referencia** → campo **¿Marcar renta como pagada?**

**Pasos:**
1. Por defecto **No, queda con su saldo pendiente**.
2. Elegir **Sí, marcar como pagada** con un pago parcial → **Registrar pago**.
3. Si el monto ya cubre todo el saldo:
   - debajo del campo aparece en verde *"Con este monto la renta queda liquidada…"*;
   - no hace falta elegir Sí.
4. El campo **no aparece** si solo hay servicios en la lista (predial, luz…).

**Resultado:** la renta queda **Pagada** aunque el pago haya sido menor.
**API:** `POST /pagos` y, si quedó saldo, `PATCH /renta-actual/:id/pagada`.

---

### F4. Marcar como pagada (rápido)

**Para qué sirve:** liquidar una renta con un clic cuando no hace falta capturar fecha, método ni comprobante.

**Ubicación:**
- Pago Renta y Mantto → pestaña **Rentas** → columna **Opciones** → **Acciones ▾** → **Marcar como pagada** (ícono ✔, color verde).
- Rent Rol → fila amarilla → columna **Acciones** → botón ✔ "Marcar como pagada".

**Pasos:** confirmar en la ventana de aviso.

**Resultado:** se registra un pago **con fecha de hoy** por el saldo pendiente y la renta pasa a **Pagada**.
**API:** `PATCH /renta-actual/:id/pagada`.

---

### F5. Abono general (sin elegir una renta)

**Para qué sirve:** registrar un pago que el arrendatario entregó para varias rentas o servicios a la vez, repartiéndolo en una sola captura.

**Ubicación:** Pago Renta y Mantto → pestaña **Rentas** → barra de botones **arriba de la tabla** → botón azul **Registrar abono / pago parcial**. Es el segundo botón, junto a "Registrar pago de renta".

**Pasos:**
1. Fila 0: elegir el **Arrendatario**.
2. En **¿A qué se aplica el pago?** aparecen todos sus cargos con saldo.
3. Fila 1: **Monto recibido**, **Fecha de pago** y **Método de pago**.
4. Repartir con **Aplicar** o **Saldar** en cada tarjeta → **Registrar pago**.

**Resultado:** bajan los saldos de los cargos elegidos. Lo no aplicado queda como **saldo a favor**.
**API:** `GET /cargos?idArrendatario&estado=CON_SALDO` y `POST /pagos`.

> **No confundir:** el botón rojo **Registrar pago de renta** de esa misma barra **crea la renta del mes** (el cargo), no registra dinero.

---

### F6. Pago con excedente y uso del saldo a favor

**Para qué sirve:** no perder el dinero que el arrendatario pagó de más: queda guardado y después se usa para pagar otra renta o servicio.

**Ubicación:**
1. Al registrar: ventana **Registrar pago** → contador **Quedará a favor** (abajo de las tarjetas).
2. Para verlo: Estado de cuenta → tarjeta **Saldo a favor** (tercera tarjeta, ícono de alcancía).
3. Para usarlo: Estado de cuenta → pestaña **Lo que ha pagado** → columna **Acciones** del pago → botón verde **Usar saldo**.

**Pasos:**
1. Registrar un pago mayor a lo aplicado (ej. pagan $10,000 y se aplican $8,000 → **Quedará a favor $2,000**).
2. En **Lo que ha pagado**, en ese pago → **Usar saldo** → repartir entre cargos con saldo → guardar.

**Resultado:** baja el saldo del cargo y baja la tarjeta **Saldo a favor**.
**API:** `GET /pagos?conDisponible=true` y `POST /pagos/:id/aplicaciones`.

---

### F7. Cobrar un servicio (luz, agua, predial…)

**Para qué sirve:** anotar lo que el arrendatario debe de un recibo de servicio, para luego cobrarlo completo o en partes.

**Ubicación:**
- Estado de cuenta → pestaña **Lo que debe** → barra **arriba de la tabla, a la derecha** → botón azul **+ Agregar cargo de servicio**, junto a "Solo con saldo" y el buscador.
- Para pagarlo: misma pestaña → fila del cargo → columna **Acciones** → **Pagar**.

**Pasos:**
1. Ventana **Registrar cargo de servicio**:
   - **Tipo de servicio**, **Fecha** y **Total**;
   - si se captura el subtotal, el IVA se calcula solo;
   - **Servicio del arrendatario** (opcional): liga el cargo al contrato de ese servicio. Solo se habilita si el arrendatario lo tiene registrado.
2. Guardar → aparece en **Lo que debe** como **Pendiente**.
3. Cuando paga: **Pagar** en esa fila (como en F1 y F2).

**Diferencia clave:**
- **Agregar cargo** = lo que **debe** (sube la deuda).
- **Pagar** = lo que **entregó** (baja la deuda).

**API:** `POST /cargos` y `POST /pagos`.

---

### F8. Pago aplicado al cargo equivocado

**Para qué sirve:** corregir un pago que se asignó a la renta o servicio incorrecto, sin cancelarlo ni volver a capturarlo.

**Ubicación:** Estado de cuenta → pestaña **Lo que ha pagado** → columna **Acciones** del pago → botón azul **Ver** → ventana **Detalle del pago** → sección **Aplicaciones** → botón **Quitar de este cargo**, dentro de la tarjeta de la aplicación equivocada.

**Pasos:**
1. **Quitar de este cargo** → confirmar.
2. El dinero regresa como **saldo a favor** y el cargo vuelve a deber.
3. Aplicarlo al correcto con **Usar saldo** (F6).

**API:** `DELETE /pagos/:id/aplicaciones/:idAplicacion`.

---

### F9. Cancelar un pago mal capturado

**Para qué sirve:** anular un pago con monto, fecha o arrendatario equivocado. Queda el registro y el motivo para auditoría.

**Ubicación:** Estado de cuenta → pestaña **Lo que ha pagado** → columna **Acciones** del pago → botón rojo **Cancelar**. Solo aparece si el pago no está cancelado.

**Pasos:**
1. La ventana muestra **qué cargos vuelven a deber**.
2. Escribir el **motivo** (obligatorio) → **Sí, cancelar pago**.

**Resultado:**
- El pago queda **Cancelado**: tachado, no se borra.
- Los cargos recuperan su saldo.
- **No se puede deshacer.**

**API:** `PATCH /pagos/:id/cancelar`.

---

### F10. Cancelar un cargo creado por error

**Para qué sirve:** quitar una deuda que no corresponde (duplicada o mal capturada) sin borrarla del historial.

**Ubicación:** Estado de cuenta → pestaña **Lo que debe** → columna **Acciones** del cargo → botón rojo **Cancelar**. Solo aparece si el cargo **no tiene pagos**.

**Pasos:** escribir el **motivo** (obligatorio) → **Sí, cancelar cargo**.

**Resultado:**
- El cargo queda **Cancelado** y deja de contar como deuda.
- **No se puede deshacer.**
- Si ya tiene pagos, primero se quitan (F8) o se cancelan (F9).

**API:** `PATCH /cargos/:id/cancelar`.

---

### F11. Estado de cuenta (pantalla nueva)

**Para qué sirve:** ver en una sola pantalla la situación completa de un arrendatario (cuánto debe, desde cuándo, qué ha pagado y si tiene saldo a favor) y operar desde ahí.

**Ubicación:**
- Menú: Operación → Arrendatarios → **Lista de Arrendatarios** (`/arrendatarios`).
- Zona: fila del arrendatario → **primera columna "Opciones"** → botón **Acciones ▾** → opción **Estado de cuenta**.
- URL resultante: `/arrendatarios/estado-cuenta/{id}`.

**Distribución de la pantalla (de arriba hacia abajo):**

| Zona | Contenido | Para qué sirve |
|---|---|---|
| 1. Encabezado | Título **Estado de cuenta** | Identificar la pantalla |
| 2. Recuadro del arrendatario | Nombre, RFC, botón **Regresar** (vuelve a la lista), recuadro **Debe en total** (verde con "Está al corriente" si es $0) y círculo **% cobrado** | Saber de un vistazo cuánto debe en total y qué porcentaje ya se cobró |
| 3. Tarjetas | **Vencido** (roja) · **Del mes actual** (azul) · **Saldo a favor** (verde) · **Pagos recibidos** (morada) | Separar la deuda atrasada de la del mes, ver el dinero sin usar y lo cobrado en el periodo |
| 4. Filtro | **Desde** · **Hasta** · botón **Buscar** · botón **Limpiar** | Limitar tarjetas y tablas a un periodo, o volver a ver todo |
| 5. Pestañas (izquierda) | **Lo que debe** (con contador) · **Lo que ha pagado** (con contador) | Cambiar entre deudas y pagos |
| 5. Herramientas (derecha) | **+ Agregar cargo de servicio** (solo en Lo que debe) · casilla **Solo con saldo** · buscador **Buscar…** | Crear una deuda de servicio, ocultar lo ya pagado y encontrar un registro por texto |
| 6a. Tabla "Lo que debe" | Periodo · Concepto · Total · Pagado (con barra) · Saldo · Estado · **Acciones: Ver · Pagar · Cancelar** | Revisar cada deuda y su avance. **Ver**: desglose · **Pagar**: cobrarla · **Cancelar**: anular si fue un error |
| 6b. Tabla "Lo que ha pagado" | Fecha · Método / referencia · Monto · Aplicado · A favor · Estatus · **Acciones: Ver · Usar saldo · Cancelar** | Revisar cada pago. **Ver**: a qué se aplicó · **Usar saldo**: aplicar el sobrante · **Cancelar**: anular si se capturó mal |

- Cada fila tiene una raya de color a la izquierda: verde pagado, ámbar parcial, rojo sin pago, gris cancelado.
- Los botones **solo aparecen cuando aplican**.
- **Ver** en un cargo abre **Detalle del cargo**: Resumen, Conceptos (subtotal, IVA, total, pagado, saldo; "IVA calculado" = estimado ÷ 1.16) e Historial de pagos aplicados.
- **Ver** en un pago abre **Detalle del pago**: datos del pago, Aplicaciones (con **Quitar de este cargo**) y "¿Qué puedes hacer?".

**API:** `GET /arrendatarios/:id/estado-cuenta`, `GET /cargos/:id` y `GET /pagos/:id`.

---

### F12. Cambios en pantallas existentes

| Qué cambió | Ubicación exacta | Para qué sirve / resultado |
|---|---|---|
| Columnas **Pagado** y **Saldo** y estatus Pendiente / Parcial / Pagada | Pago Renta y Mantto → pestaña **Rentas** → tabla. Orden de columnas: Opciones, Vigencia, Fecha de creación, Estatus, Arrendatario, Desglose, Monto final, Pagado, Saldo, Contrato | Ver cuánto se ha pagado y cuánto falta de cada renta, y si va parcial |
| Botón **Acciones ▾**: Editar (azul), Registrar pago (ámbar), Marcar como pagada (verde), Duplicar al mes siguiente (morado) | Pago Renta y Mantto → pestaña **Rentas** → **primera columna "Opciones"**. Las rentas pagadas muestran "✓ Renta Pagada" | Todas las acciones de una renta en un solo botón, cada una con su color para no confundirlas. Las pagadas ya no se pueden modificar |
| Botón **Registrar abono / pago parcial** | Pago Renta y Mantto → pestaña **Rentas** → barra de botones arriba de la tabla | Registrar un pago repartido entre varias rentas del arrendatario |
| Botón **Acciones ▾**: Editar y Registrar pago | Pago Renta y Mantto → pestaña **Mantenimientos** → **primera columna "Opciones"** | Mismo funcionamiento que en rentas: editar o registrar el pago desde un solo botón |
| Columna **Pagado** y estatus | Historial de Pagos → pestaña **Rentas** (solo rentas pagadas por completo) | Confirmar cuánto se pagó de cada renta liquidada |
| Botón 💵 **Registrar pago** | Rent Rol → tabla → filas amarillas (Por pagar) → columna **Acciones**, entre ✏ Editar y ✔ Marcar como pagada | Registrar pagos totales o parciales con fecha, método y comprobante sin salir del Rent Rol |
| Etiqueta **↑ Incremento** (en lugar de pintar la fila de rojo) | Rent Rol → tabla → columna **Concepto**, debajo de la etiqueta Renta. Leyenda en los chips de arriba de la tabla | Identificar las rentas que subieron de precio sin agregar columnas ni pintar la fila |
| Fechas sin cambio de zona (ya no salen un día antes) | Pago Renta y Mantto (Vigencia, Fecha de creación), Historial de Pagos, Mantenimientos, Rent Rol, Lista Inmuebles y Monitoreo | Las fechas se ven igual que en el sistema; ya no aparecen un día antes |
| IVA = redondeo(subtotal × 0.16) y total = subtotal + IVA | Lista de Arrendatarios → **Agregar / Editar arrendatario** → sección del contrato. Rent Rol → botón **Agregar arrendatario** (captura rápida) | Que subtotal + IVA = total cuadre al centavo en los contratos nuevos |
| "Registro no encontrado" al abrir un registro de otro cliente | Editar arrendatario (`/arrendatarios/editar-arrendatario/{id}`), Editar arrendador (`/clientes/editar-cliente/{id}`), Editar inmueble (`/inmuebles/editar-inmueble/{id}`) y Estado de cuenta. En arrendatario y arrendador regresa a la lista | Evitar ver o modificar información de otro cliente |
| "Sólo puedes cambiar tu propia contraseña" (403) | Pantalla **Cambio de contraseña** (enlace del correo de recuperación: `/cambio-password?token=…`) | Evitar que un usuario cambie la contraseña de otro |
| **Tarjeta de Débito** | Campo **Método de pago** de la ventana Registrar pago y demás listas de método de pago (viene de la API) | Registrar pagos hechos con tarjeta de débito |

---

### Validaciones y errores en cobranza

| Dónde | Qué valida o muestra | Para qué sirve |
|---|---|---|
| Ventana **Registrar pago** → al pulsar **Registrar pago** | Monto mayor a 0, fecha y método obligatorios; no aplicar más que el pago ni más que el saldo de cada concepto. Muestra la ventana "Revisa la captura" con la lista de errores | Evitar pagos con datos incompletos o que repartan más dinero del que entró |
| Cualquier operación de cobranza | Si el servidor rechaza (400, 409…), muestra su **mensaje real**, por ejemplo *"El cargo tiene pagos aplicados…"* | Que el usuario sepa exactamente por qué no se guardó |
| Registrar pago con "Sí, marcar como pagada" | Si el pago se guarda pero falla el marcado, se avisa por separado. El pago **no se pierde** | Saber que el dinero sí quedó registrado y solo falta marcar la renta |

---

## Parte 2 · Asistente Claudia (agente conversacional)

**Qué es:** chat de **solo consulta** sobre los datos reales de Inmuebles.
- Usa la misma sesión del usuario: solo ve lo que ese usuario tiene permitido.
- **No registra, modifica ni cancela nada.**

**Ubicación:** botón flotante redondo en la **esquina inferior derecha**, en todas las pantallas del sistema (después de iniciar sesión).

**Distribución del panel:**

| Zona | Contenido | Para qué sirve |
|---|---|---|
| Encabezado, izquierda | Nombre **Claudia Robles** y estado: **"Consultas · en línea"** o **"Asistente no disponible"** | Saber si el asistente puede responder en ese momento |
| Encabezado, derecha | Botón **Historial** (conversaciones anteriores) · botón **Nueva conversación** · botón **Cerrar** | Retomar conversaciones anteriores, empezar una nueva u ocultar el panel |
| Debajo del encabezado | Atajos: ¿Quién me debe? · Cobrado del mes · Contratos por vencer · Rentas del mes · Saldo a favor · Ocupación | Hacer las preguntas más comunes con un clic |
| Centro | Mensajes de la conversación | Leer preguntas y respuestas |
| Pie | Caja **"Escribe un mensaje…"** y botón **Enviar** (ícono de avión de papel; en espera muestra la cuenta regresiva) | Escribir cualquier pregunta en lenguaje natural |

### F13. Abrir el asistente

**Para qué sirve:** tener a la mano, en cualquier pantalla, un asistente que responde preguntas sobre la información del sistema.

**Ubicación:** botón flotante, esquina inferior derecha.

1. Clic en el botón: se abre el panel.
2. El sistema revisa si el asistente está en línea y lo indica bajo el nombre.
3. Muestra el saludo de Claudia y los atajos.

**API:** `GET /health`.

---

### F14. Hacer una pregunta

**Para qué sirve:** obtener al momento datos como quién debe, cuánto se cobró o qué contratos vencen, sin navegar por varias pantallas ni armar reportes.

**Ubicación:** panel del asistente → **atajos** (arriba) o **caja de texto** (pie).

1. Pulsar un atajo, o escribir y presionar **Enter** (Shift+Enter hace salto de línea).
2. Mientras responde aparece **"Escribiendo…"** y no se puede enviar otra pregunta.
3. La respuesta llega con formato (negritas y listas), **sanitizado**.
4. **Seguimiento:** recuerda la conversación ("¿cuánto me pagaron este mes?" → "¿y el mes pasado?").

**Qué se puede preguntar:** cobranza, quién debe, estado de cuenta, saldos a favor, rentas del mes, inmuebles y ocupación, locales libres, arrendatarios, contratos por vencer y arrendadores.

**API:** `POST /chat`. La conversación se mantiene al navegar entre pantallas.

---

### F15. Nueva conversación

**Para qué sirve:** cambiar de tema sin que el asistente mezcle la pregunta con la conversación anterior.

**Ubicación:** panel del asistente → encabezado, derecha → botón **Nueva conversación**.
**Resultado:** se limpia el hilo; la siguiente pregunta empieza de cero.

---

### F16. Historial de conversaciones

**Para qué sirve:** recuperar consultas hechas antes y continuarlas, o borrar las que ya no se necesitan.

**Ubicación:** panel del asistente → encabezado, derecha → botón **Historial**. Se abre la lista **"Historial"** dentro del panel.

1. Cada conversación muestra su título (la primera pregunta) y su fecha en hora local.
2. **Abrir:** clic en la conversación → carga sus mensajes y se puede **seguir preguntando**.
3. **Borrar:** botón **×** a la derecha de cada conversación. Si era la abierta, el chat empieza de cero.

**API:** `GET /conversations`, `GET /conversations/:id` y `DELETE /conversations/:id`.

---

### F17. Errores del asistente (se muestran como mensaje en el chat)

**Para qué sirve:** que el usuario siempre sepa qué pasó y qué hacer, en lugar de quedarse esperando sin respuesta.

| Situación | Qué hace el front |
|---|---|
| Mensaje vacío o de más de 4000 caracteres | No se envía |
| Sesión vencida (401) | "Tu sesión expiró. Vuelve a iniciar sesión." |
| Conversación inexistente o borrada (404) | Empieza una conversación nueva y reenvía la pregunta sola |
| Demasiadas preguntas (429) | "Espera un momento…" y el botón **Enviar** muestra la cuenta regresiva |
| Asistente caído, sin conexión o 503 | "El asistente no está disponible…" y el encabezado cambia a **"Asistente no disponible"** |
| Sin respuesta en 60 s | Se trata como no disponible |

---

### F18. Cierre de sesión

**Para qué sirve:** proteger la privacidad: otra persona que entre en el mismo equipo no ve las consultas anteriores.

**Ubicación:** menú lateral → Ajustes → **Cerrar Sesión**.
**Resultado:** se borra la conversación activa. El siguiente usuario empieza de cero.

---

## Parte 3 · Alcance definido por el análisis de capacidades

| Punto del análisis | Cómo quedó en el front |
|---|---|
| Consulta datos reales según permisos | Sí: usa la sesión del usuario |
| Mantiene conversación y seguimiento | Sí (F14 y F16) |
| Menú de ayuda y capacidades | Sí: el saludo de Claudia explica el alcance y ofrece atajos; si el usuario escribe "hola" o "¿qué puedes hacer?", el agente responde con su menú |
| Solo lectura | Sí: el saludo lo indica; registrar o modificar se hace en las pantallas de Parte 1 |
| Explicar pantallas o procesos ("¿cómo registro un contrato?") | **No incluido**: el agente no tiene base de conocimiento funcional |

---

## Pendiente / fuera de alcance

- **Pago de Servicios** (Operación → Arrendatarios → Pago de Servicios): no se agregaron columnas Saldo y Estado (era opcional en la guía).
- **Rent Rol:** las filas muestran el monto total, no el saldo restante.
- **Servicio del arrendatario** (F7): depende de que la API mande el tipo de cada servicio registrado.
- **Pruebas:** todo se validó con datos simulados y compilación de producción. **Falta la prueba completa contra la API real.**
