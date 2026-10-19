# Documentación funcional del sistema — InmueblesWebApp

> **Alcance:** solo funcionalidad (qué hace el sistema, pantallas, flujos, reglas de negocio desde la perspectiva del usuario).  
> **Organización:** basada en el **sidebar vertical**.  
> **Énfasis especial:** módulo **Arrendatarios** (todos los subítems) y **Rent Rol**.  
> **Fecha de referencia del análisis:** 2026-10-17.  
> **Fuente principal de menú:** `src/app/layouts/full/vertical/sidebar/sidebar-data.ts`.

---

## Índice

1. [Visión general del sistema](#1-visión-general-del-sistema)
2. [Autenticación, sesión y layout](#2-autenticación-sesión-y-layout)
3. [Modelo de permisos y visibilidad del menú](#3-modelo-de-permisos-y-visibilidad-del-menú)
4. [Inventario completo del sidebar](#4-inventario-completo-del-sidebar)
5. [Cap Menú — Administración](#5-cap-menú--administración)
6. [Cap Menú — Usuarios, Prospectos, Clientes, Embudo, Contrato, Roles](#6-cap-menú--usuarios-prospectos-clientes-embudo-contrato-roles)
7. [Cap Operación — Propiedades, Arrendadores, Inmuebles](#7-cap-operación--propiedades-arrendadores-inmuebles)
8. [Cap Operación — Arrendatarios (detalle exhaustivo)](#8-cap-operación--arrendatarios-detalle-exhaustivo)
9. [Cap Operación — Rent Rol (detalle exhaustivo)](#9-cap-operación--rent-rol-detalle-exhaustivo)
10. [Cap Ajustes](#10-cap-ajustes)
11. [Flujos transversales](#11-flujos-transversales)
12. [Glosario de entidades](#12-glosario-de-entidades)
13. [Mapa mental de cobros](#13-mapa-mental-de-cobros)

---

## 1. Visión general del sistema

InmueblesWebApp es una aplicación web de **gestión inmobiliaria operativa** orientada a:

- Administrar **arrendadores** (propietarios), **inmuebles**, **zonas/locales** y su ocupación.
- Administrar **arrendatarios** (inquilinos), sus **contratos**, **documentos**, **servicios** y **socios**.
- Operar el ciclo de **cobro de rentas y mantenimiento** del mes en curso y su **histórico**.
- Registrar **pagos de servicios** (agua, luz, etc.) tanto a nivel inmueble como a nivel arrendatario.
- Soportar un proceso comercial: **prospectos → clientes → embudo → generar contrato**.
- Administrar seguridad: **usuarios**, **roles**, **módulos**, **permisos**, **bitácora**.
- Mantener catálogos de apoyo: **INPC**, **factores/fórmulas**, **tipos de servicio**, **métodos de pago**.

### Qué no es (aclaración importante)

**Rent Rol no es un portal del arrendatario.**  
No existe en este frontend un login diferenciado para inquilinos, ni pantallas de “mi cuenta / pagar mi renta” self-service.  
**Rent Rol** es una pantalla **administrativa de rent roll** (consulta y operación de rentas del mes), visible para usuarios internos con el permiso correspondiente.

---

## 2. Autenticación, sesión y layout

### 2.1 Pantallas públicas (sin sesión)

| Ruta | Función |
|------|---------|
| `/login` | Inicio de sesión (email + contraseña) |
| `/register` | Registro de usuario |
| `/solicitud-cambio-password` | Solicitar enlace de recuperación |
| `/cambio-password` | Cambiar contraseña con token |
| `/error` | Página de error |

Si el usuario **ya tiene sesión**, el `NoAuthGuard` evita que vuelva a ver login/registro.

### 2.2 Tras iniciar sesión

1. El sistema autentica y carga el perfil + **lista de permisos numéricos**.
2. Redirección típica:
   - Si tiene permiso de mapa de arrendadores → `/monitoreo` (Propiedades).
   - Si no → `/usuarios/perfil-usuario`.
3. La sesión se mantiene con JWT + refresh ante 401.
4. Logout limpia sesión local e invalida refresh en servidor; navega a `/login`.

### 2.3 Layout autenticado (Full)

- **Sidebar vertical** filtrado por permisos.
- **Header:** tema claro/oscuro, accesos rápidos, búsqueda/diálogo, **notificaciones**.
- Branding, avatar/nombre del usuario.
- Responsive: overlay en móvil; sidebar colapsable.
- Al navegar, el contenido hace scroll al top.

### 2.4 Notificaciones (header)

Tres bandejas alimentadas por API:

1. **Vencimientos de renovación de contrato** (inmueble, arrendatario, fecha término, semáforo por días).
2. **Pagos de servicios de inmuebles**.
3. **Pagos de seguimiento** (arrendatarios/predios).

Hay contadores en el ícono y sonido opcional tras login si hay pendientes.

---

## 3. Modelo de permisos y visibilidad del menú

### 3.1 Cómo funciona

1. Cada ítem del menú puede declarar uno o varios **IDs de permiso**.
2. El ítem se muestra si el usuario tiene **al menos uno** (lógica **OR**).
3. Si no declara `permission`, es visible para **cualquier autenticado**.
4. Los padres y secciones (`navCap`) se ocultan si no queda ningún hijo visible.
5. En pantallas, botones sensibles usan la directiva `*appHasPermission` con la misma lógica OR.
6. **Importante:** las rutas de arrendatarios **no** tienen guard por permiso de ruta; la restricción es de **menú + botones**. Solo hay `AuthGuard` (sesión válida).

### 3.2 Roles vs permisos

- Existe un catálogo de **Roles** (`/roles`) asignables al usuario.
- Los **permisos finos** se asignan en el formulario de **Usuario** (matriz por módulo).
- Casos hardcodeados por `idRol` en UI:
  - Embudo: operar eventos/etapa exige `idRol === 8` (además del permiso de consulta).
  - Lista arrendatarios: “Dar de alta” solo con `rol === 1` + registro inactivo.

### 3.3 Permisos del dominio Arrendatarios / Rent Rol

| ID | Nombre enum | Uso típico |
|----|-------------|------------|
| 46 | `ACTUALIZAR_ARRENDATARIOS` | Editar arrendatario |
| 47 | `AGREGAR_ARRENDATARIOS` | Botón Agregar / alta |
| 48 | `ELIMINAR_ARRENDATARIOS` | Eliminar (soft-delete) |
| 49 | `CONSULTAR_ARRENDATARIOS` | Ver lista, pagos mes, histórico, y también Rent Rol (OR) |
| 50 | `CONSULTAR_SERVICIOS_ARRENDATARIOS` | Pago de servicios de arrendatarios |
| 55 | `PERMISO_RESERVADO_RENT_ROL` | Ver ítem Rent Rol (OR con 49) |

---

## 4. Inventario completo del sidebar

### Cap: Menú

| Ítem | Ruta | Notas de permiso |
|------|------|------------------|
| **Administración** (padre) | `/menu-level` | Módulos, permisos, bitácora, INPC, factores, servicios, métodos de pago |
| → Módulos | `/modulos` | CRUD módulos |
| → Permisos | `/permisos` | CRUD permisos |
| → Bitácora | `/bitacora` | Solo consulta |
| → INPC | `/incrementos` | CRUD INPC |
| → Factores | `/factores` | Factores + fórmulas |
| → Servicios | `/servicios` | Catálogo tipos de servicio |
| → Métodos de pago | `/metodos-pago` | Catálogo métodos |
| **Usuarios** | `/menu-level` | |
| → Agregar Usuario | `/usuarios/agregar-usuario` | |
| → Lista Usuarios | `/usuarios` | |
| **Prospectos** | `/menu-level` | |
| → Agregar Prospecto | `/prospectos/agregar-prospecto` | |
| → Lista Prospectos | `/prospectos` | |
| **Clientes** | `/menu-level` | Clientes comerciales (`/clientes-inmuebles`) |
| → Agregar Cliente | `/clientes-inmuebles/agregar-cliente-inmueble` | |
| → Lista Clientes | `/clientes-inmuebles` | |
| **Embudo** | `/embudo` | Kanban ventas |
| **Generar Contrato** | `/generar-contrato` | Sin permiso (cualquier autenticado) |
| **Roles** | `/menu-level` | |
| → Agregar Rol | `/roles/agregar-rol` | |
| → Lista Roles | `/roles` | |

### Cap: Operación

| Ítem | Ruta | Notas |
|------|------|-------|
| **Propiedades** | `/monitoreo` | Mapa / plano arrendadores→inmuebles→locales |
| **Lista Arrendadores** | `/clientes` | Propietarios (no confundir con Clientes comerciales) |
| **Inmuebles** (padre) | `/menu-level` | |
| → Lista Inmuebles | `/inmuebles` | |
| → Pago de Servicios | `/registro-servicios-inmuebles` | Servicios a nivel inmueble |
| **Arrendatarios** (padre) | `/menu-level` | Ver §8 |
| → Lista de Arrendatarios | `/arrendatarios` | |
| → Pago Renta y Mantto | `/arrendatarios/pagos-mes` | |
| → Pago de Servicios | `/registro-servicios-arrendatarios` | |
| → Historial de Pagos | `/arrendatarios/pagos-historico` | |
| **Rent Rol** | `/arrendatarios/rent-rol` | Ítem hermano (no anidado); ver §9 |

### Cap: Ajustes

| Ítem | Ruta |
|------|------|
| **Perfil Usuario** | `/usuarios/perfil-usuario` |
| **Cerrar Sesión** | `/login` (ejecuta logout) |

---

## 5. Cap Menú — Administración

### 5.1 Módulos (`/modulos`)

- **Lista:** grid paginado, filtros por columna, agrupación, búsqueda, export Excel.
- **Acciones:** agregar, editar, activar/desactivar.
- **Formulario:** nombre, descripción.
- **Para qué sirve:** catálogo de módulos del sistema a los que se asocian permisos.

### 5.2 Permisos (`/permisos`)

- **Lista:** grid paginado (~100), filtros, agrupación, Excel; agregar/editar/activar/desactivar.
- **Formulario:** módulo (select), nombre, descripción, estatus.
- **Para qué sirve:** define las acciones controlables que luego se asignan a usuarios y filtran el sidebar.

### 5.3 Bitácora (`/bitacora`)

- Solo **consulta** (sin alta/edición/borrado).
- **Filtro:** rango de fechas obligatorio (default: día 1 del mes → hoy).
- **Columnas:** fecha, usuario, módulo, acción, descripción.
- Grid con filtros, agrupación, Excel.

### 5.4 INPC (`/incrementos`)

- Histórico de índices INPC.
- **Filtro fechas** (default desde `2026-01-01` hasta hoy en la UI actual).
- **Columnas:** fecha, origen, índice, % anual, % acum. anual.
- **Formulario:** año (4 dígitos), mes, valor INPC, porcentaje anual opcional.
- **Uso:** base para incrementos de renta y factores presupuestales.

### 5.5 Factores (`/factores`)

Pantalla con **dos grids**:

**Factores presupuestales**

- Variable, valor (desde INPC o % anual del periodo), descripción, mes/año INPC.
- CRUD + activar/desactivar.
- Formulario: variable, selector periodo INPC, origen del valor (`inpc` | `porcentajeAnual`), descripción.

**Fórmulas**

- Nombre, expresión, descripción, tipo de resultado (`PORCENTAJE` | `MONTO`), preview al escribir.
- Usadas al calcular incrementos / montos de renta en el modal de pagos.
- Rutas: agregar/editar fórmula.

### 5.6 Servicios (`/servicios`)

- Catálogo de **tipos de servicio** (agua, luz, etc.).
- CRUD + activar/desactivar + Excel.
- Formulario: nombre (máx. 200).

### 5.7 Métodos de pago (`/metodos-pago`)

- Catálogo usado al registrar pagos de servicios y rentas.
- Mismo patrón: nombre, activar/desactivar, Excel; agregar/editar.

---

## 6. Cap Menú — Usuarios, Prospectos, Clientes, Embudo, Contrato, Roles

### 6.1 Usuarios

**Lista** (`/usuarios`): grid, Excel, agregar, editar, eliminar, activar, desactivar.

**Alta/edición:**

- Email (userName), contraseña + confirmación (alta), teléfono, nombre, apellidos, foto.
- Rol (`idRol`), email confirmado, estatus, cliente opcional (`idCliente`).
- **Matriz de permisos por módulo:** selección individual o “todos del módulo”; se envían `permisosIds`.

El rol etiqueta al usuario; los permisos granulares definen qué ve en el menú y qué puede hacer.

### 6.2 Prospectos

**Lista:** consulta, agregar, editar, eliminar, activar/desactivar, **convertir a cliente**.

**Formulario:** persona física/moral, RFC, nombre/apellidos, teléfono y correo obligatorios, domicilio, encargado, sitio web, documentos (logotipo, CSF, comprobante domicilio, acta), flag prospecto, padre opcional.

**Flujo:** prospecto → conversión a cliente comercial → seguimiento en Embudo / Clientes.

### 6.3 Clientes comerciales (`/clientes-inmuebles`)

Distinto de **Lista Arrendadores** (`/clientes`).

- CRUD completo.
- Formulario similar a prospectos (RFC, tipo persona, contacto, domicilio, documentos) **sin** conversión: cliente “cerrado” del negocio comercial.

### 6.4 Embudo (`/embudo`)

- Tablero Kanban: **Registro (1) → Seguimiento (2) → Finalizado (3)**.
- Drag & drop entre columnas.
- Filtros: texto libre + Todos | Con pendientes | Atrasados | Sin evento.
- Acciones por tarjeta (restringidas a `idRol === 8`): ver detalle/historial, registrar/actualizar evento (fecha próximo, medio, comentario), editar conclusión, cambiar etapa.
- Ver el embudo: permiso `CONSULTAR_EMBUDOS`; **operar** exige además rol 8.

### 6.5 Generar Contrato (`/generar-contrato`)

Accesible a cualquier autenticado (sin permiso en sidebar).

1. Plantilla dinámica de subarrendamiento (secciones: documento, subarrendador, inmueble, subarrendatario, obligado solidario, condiciones, pago, extras).
2. Formulario por pestañas con validaciones (montos, porcentajes ≤ 100, requeridos).
3. Vista previa PDF en vivo.
4. Guardar, listar históricos, editar previo, generar/descargar PDF.
5. Aviso al salir con datos sin guardar.

### 6.6 Roles

- Lista: consulta, agregar, editar, activar/desactivar.
- Formulario: nombre, descripción, estatus.
- Los permisos finos se gestionan en el usuario, no en el form de rol (en esta UI).

---

## 7. Cap Operación — Propiedades, Arrendadores, Inmuebles

### 7.1 Propiedades / Monitoreo (`/monitoreo`)

Vista operativa “Arrendadores” con recorrido jerárquico:

**arrendadores → inmuebles → locales**

Capacidades:

- Navegación geográfica (mapa Google) y/o plano de locales/zonas.
- Estados visuales de local: libre, ocupado, reservado, inactivo.
- Panel de ocupación: ocupante, mensualidad, giro, vigencia.
- Edición de layout de zonas/locales en canvas (mover, redimensionar, guardar).
- Detalle de instalación: `/monitoreo/instalacion/:numeroSerie` (expediente, documentos, checklist).

### 7.2 Lista Arrendadores (`/clientes`)

Propietarios del predio (no clientes comerciales).

**Lista:** Excel, agregar, editar, eliminar, activar/desactivar.

**Formulario rico:**

- Identidad: RFC, tipo persona, estatus, logotipo.
- Datos personales/contacto y domicilio completo.
- Encargado y sitio web.
- Documentos: CSF, comprobante domicilio, licencia, protección civil, uso de suelo, plano catastral, acta, poder, INE representante.
- **Socios dinámicos** (nombre, RFC, documentos); botón eliminar socio solo con ≥ 2 socios.

### 7.3 Lista Inmuebles (`/inmuebles`)

**Lista:** filtro por arrendador, grid, Excel (con hojas de detalle).

**Acciones:** editar, activar, eliminar, mapa, dashboard, ocupación.

**Vistas auxiliares:** dashboard (ocupación, mensualidades, rentas) y mapa de ocupación por zonas/locales.

**Alta/edición** — formulario extenso:

- Datos generales: nombre, dirección, arrendador, fechas, estatus; si estatus = RENTADO → renta MXN, años, contrato.
- Representante legal.
- Documentos del predio (escritura, predial, agua, licencia, uso suelo, fachada, plano, contrato, CSF, comprobantes, INE).
- Galería.
- Servicios del inmueble (tipo, contrato, fechas de pago, comprobante).
- Zonas con locales anidados (área, estatus, mensualidad, mantenimiento, IVA, giro, fachada).
- Estacionamientos, pagos, socios, coordenadas lat/lng.

### 7.4 Pago de Servicios de Inmuebles (`/registro-servicios-inmuebles`)

- Filtros: fechas, inmueble, estatus de pago.
- Grid paginado, Excel.
- Modal registrar/actualizar pago: servicio del inmueble, monto, método, comprobante (PDF/PNG/JPG).
- Modal de detalle/vista de pago.

---

## 8. Cap Operación — Arrendatarios (detalle exhaustivo)

### 8.1 Estructura del menú

Grupo **Arrendatarios** (icono `users`), visible con alguno de: 46, 47, 48, 49, 50.

| # | displayName | Ruta | Permiso de menú |
|---|-------------|------|-----------------|
| 1 | Lista de Arrendatarios | `/arrendatarios` | 49 |
| 2 | Pago Renta y Mantto | `/arrendatarios/pagos-mes` | 49 |
| 3 | Pago de Servicios | `/registro-servicios-arrendatarios` | 50 |
| 4 | Historial de Pagos | `/arrendatarios/pagos-historico` | 49 |

**Rutas adicionales** (no son subítems directos del menú, se alcanzan desde pantallas):

| Ruta | Función |
|------|---------|
| `/arrendatarios/agregar-arrendatario` | Alta |
| `/arrendatarios/editar-arrendatario/:idArrendatario` | Edición |
| `/arrendatarios/pagos-mes/renta` | Rentas del mes |
| `/arrendatarios/pagos-mes/servicios` | Servicios del mes |
| `/arrendatarios/pagos-mes/mantenimiento` | Mantto del mes (ruta viva; tab del hub comentada) |
| `/arrendatarios/pagos-historico/renta` | Histórico rentas |
| `/arrendatarios/pagos-historico/mantenimiento` | Histórico mantto (tab hub comentada) |

---

### 8.2 Subítem 1 — Lista de Arrendatarios (`/arrendatarios`)

#### Propósito

Listado maestro de inquilinos con expediente expandible, acciones de ciclo de vida y vistas de mapa/dashboard.

#### Toolbar y filtros

| Control | Qué hace |
|---------|----------|
| Buscar inmueble | Dropdown Todos / catálogo de inmuebles |
| **Agregar** | Solo con permiso `47` → navega a agregar |
| **Limpiar** | Limpia filtros/vista |
| **Exportar** | Excel del grid visible |
| Search panel | “Buscar arrendatario, arrendador, inmueble…” |
| Clic en fila | Expand/collapse del detalle maestro |

#### Columnas visibles

Opciones* | Arrendatario | Tipo persona | RFC | Renta | Vigencia (rango + chips de días) | Arrendador | Inmueble | Representante legal | Estatus

\*Columna Opciones visible si rol `1` o permisos 46/48/49.

Hay columnas ocultas usadas para búsqueda/export (servicios, docs, socios, contratos, dirección, etc.).

#### Menú de acciones por fila

| Acción | Cuándo aparece / regla | Comportamiento |
|--------|------------------------|----------------|
| **Dar de alta arrendatario** | Solo rol `1` + estatus inactivo | Modal: recuperar todo (`conDependientes: true`) vs solo arrendatario (`false`) → reactiva el registro |
| **Editar** | Permiso actualizar | Va a `/arrendatarios/editar-arrendatario/:id` |
| **Eliminar arrendatario** | Permiso eliminar | Confirmación → soft-delete |
| **Ubicación** | Si el registro tiene mapa | Modal Google Maps con lat/lng |
| **Dashboard** | Permiso consultar | Modal con métricas del arrendatario |

#### Modal Dashboard

- Filtro de fechas inicio/fin (recarga al cambiar).
- Stats: contratos, locales, renta del mes, monto de pagos.
- Info arrendatario / arrendador.
- Gráficas: estado renta (pagadas/pendientes), mensualidad, renta por periodo.
- Listas: contratos, rentas del periodo, pagos.

#### Detalle expandido (master-detail)

Cuatro pestañas:

**1. Contratos**

- Paneles con fechas, m², montos de renta/mantto, depósito, adelanto, años forzosos.
- Locales asociados (nombre, estatus, foto).
- Chip “Cancelado” cuando aplica.
- Botón **Cancelar Contrato** existe en código pero está **oculto en UI** (`*ngIf="false"`).

**2. Servicios**

- Tipo, fechas, número de contrato, ver comprobante.
- **Eliminar** permitido solo si el servicio **no** es Renta ni Mantenimiento (tipos fijos del sistema).

**3. Documentos**

- Preview, descarga y eliminar archivo del expediente.

**4. Socios**

- Nombre, RFC, documentos (CSF, comprobante, identificación).
- Eliminar socio; ver/descargar docs.

Al modificar el detalle, la lista se refresca.

---

### 8.3 Alta / Edición de Arrendatario

Componente único para ambas operaciones.

#### Botones globales

| Botón | Acción |
|-------|--------|
| Regresar | Sale del formulario |
| Guardar / Actualizar | Valida y envía multipart |
| Confirmar ubicación (mapa) | Persiste lat/lng |

#### Sección 1 — Datos generales

| Campo | Notas |
|-------|-------|
| Arrendatario * | Obligatorio |
| Arrendador * | Select de propietarios; obligatorio |
| Tipo persona | Física (1) / Moral (2) |
| RFC | Alfanumérico, máx. 13 |
| Representante legal | Nombre |
| Teléfono | Máx. 10 |
| Correo | Valida formato **solo si se llena** |

Validación efectiva al guardar del form grande: **nombre + arrendador + coordenadas del mapa**.

#### Sección 2 — Datos del Contrato (accordion / FormArray)

Por cada contrato:

- Inmueble (filtrado por arrendador).
- Local(es) multi-select (locales **libres** del inmueble).
- Fechas inicio / término.
- Tipo de moneda (default MXN).
- Metros rentados.
- Costo por m² (calculado).
- Switch de mantenimiento + porcentaje.
- Depósito y adelanto (meses + monto).
- Años forzosos arrendador / arrendatario.
- Observaciones.
- Bloque de cálculo: subtotal renta, IVA 16%, total renta; y si aplica, subtotal/IVA/total mantenimiento.

**Lógica de cálculo:**

1. Al capturar metros + subtotal renta → IVA 16%, total, costo/m².
2. Si incluye mantenimiento → % sobre renta → montos de mantto.

**Agregar / Eliminar contrato:**

- Alta: eliminar solo si hay ≥ 2 contratos.
- Edición: soft-delete en API si el contrato ya estaba persistido.

Avisos de UI: seleccionar arrendador; sin inmuebles; seleccionar inmueble; sin locales libres.

#### Sección 3 — Servicios (FormArray)

- Siempre se aseguran defaults de **Renta** y **Mantenimiento** (no eliminables como fijos).
- Campos: tipo de servicio, número de contrato, fecha de pago, último día de pago, comprobante (archivo).
- Se pueden agregar servicios adicionales del catálogo (agua, luz, etc.).
- En alta, eliminar extras respeta reglas de cantidad mínima de filas.

#### Sección 4 — Documentos e Imágenes

| Documento / recurso | Notas |
|---------------------|-------|
| Fachada | Imagen |
| Contrato de renta | Archivo |
| Constancia de situación fiscal (CSF) | Con **OCR** opcional |
| Comprobante de domicilio | |
| Galería de imágenes | FormArray; agregar/quitar |
| CSF representante legal | |
| INE / identificación oficial representante | |

Soporta drag & drop y preview remoto en edición.

**Flujo CSF / OCR:**

1. Al entrar puede preguntar si desea autocompletar con archivo.
2. Sube PDF de CSF → extracción OCR → mapea campos al form.
3. Si OCR falla: el PDF permanece adjunto y se captura manualmente.

#### Sección 5 — Socios (FormArray)

- Nombre, RFC.
- Archivos: CSF, comprobante domicilio, identificación oficial.
- Agregar / eliminar (eliminar solo con ≥ 2 socios, según contrato de botones del repo).

#### Sección 6 — Mapa

- Al entrar se abre modal de ubicación (punto inicial tipo Cuernavaca).
- Al guardar: si no hay lat/lng válidos → **obliga** a capturar en mapa.
- Click en mapa → coordenadas → confirmar.

#### Persistencia

- Alta: `POST /arrendatarios` (FormData multipart).
- Edición: `PUT` con envío preferente de lo modificado (snapshots).
- Payload conceptual: JSON del arrendatario + arrays `contratos[]`, `servicios[]`, `socios[]`, `archivos[]`, `imagenes[]`.

---

### 8.4 Subítem 2 — Pago Renta y Mantto (`/arrendatarios/pagos-mes`)

#### Hub

| Campo UI | Valor |
|----------|-------|
| Título | Pagos Del Mes En Curso |
| Migas | Operación → Arrendatarios → Pagos del mes |

**Tabs activos:**

| Tab | Destino | Descripción funcional |
|-----|---------|------------------------|
| **Rentas** | `/pagos-mes/renta` | Registrar/consultar pago de renta mensual |
| **Servicios** | `/pagos-mes/servicios` | Agua, luz, gas y otros con comprobante |

**Tab Mantenimientos:** comentada en la UI del hub (la ruta `/pagos-mes/mantenimiento` sigue existiendo).

Redirect por defecto del hub: `''` → `renta`.

---

#### 8.4.1 Rentas del mes

**Propósito:** administrar las rentas **pendientes del mes** (entidad `renta-actual`). Al marcarlas pagadas pasan al histórico.

**Filtros / toolbar (vista completa del hub):**

| Control | Acción |
|---------|--------|
| Filtro arrendador | Todos / lista |
| Filtro inmueble | Todos / lista (puede depender del arrendador) |
| Limpiar filtros | |
| **Registrar pago de renta** | Abre modal de alta |
| Limpiar vista grid | |
| Contraer / Expandir grupos | |
| Exportar Excel | Disabled sin datos |
| Search panel | “Buscar renta…” |
| Group panel / filter row / header filter | Sí |

**Columnas del grid:**

| Columna | Visible |
|--------|---------|
| Acciones | Sí |
| Vigencia (periodo) | Sí |
| Fecha de creación | Sí |
| Arrendatario | Sí |
| Contrato | Sí |
| Desglose (Renta / Mantenimiento) | Sí |
| Monto final | Sí |
| Factor | Oculta si embebido en hub |
| Fórmula | Oculta si hub |
| Usó fórmula | Oculta si hub |
| Estatus (Pagada / Pendiente) | Sí |
| ID | Oculta |

**Acciones por fila (si NO está pagada):**

| Botón | Regla | Qué hace |
|-------|-------|----------|
| **Editar** | UI visible; en lógica no aplica a pagos por **rango** (`fechaFin` presente) | Modal edición (arrendatario/contrato/fórmula disabled) |
| **Marcar pagada** | Siempre en pendientes del hub | Confirmación → pasa a histórico |
| **Duplicar mes** | Solo si NO es pago por rango | Genera la renta del mes siguiente |

Si ya está pagada: texto “Renta Pagada” (sin botones).

##### Modal Registrar / Editar Renta — campos

**Arrendatario y contrato**

- `idArrendatario` * (disabled en edición)
- `idContrato` * (disabled en edición)

**Vigencia** (aparece tras elegir contrato / en edición)

- Tipo: **Mes actual** | **Rango** (disabled en edición)
- Cuándo se registra * (date; solo lectura en edición)
- Fecha de vigencia (mes) o Desde/Hasta (rango; Hasta editable también en edición)
- Toggle **Captura manual** Sí/No

**Forma de cálculo** (alta, tras confirmar periodo; oculto si captura libre)

- Modos: **Fórmula** | **INPC** | **% Anual**
- Fórmula: select + evaluar
- INPC: meses numerador/denominador + Aplicar
- % Anual: periodo + porcentaje + Aplicar

**Montos**

- Total renta / Monto final renta (displays; editables en captura libre)
- Bloque mantenimiento si aplica: total mantto / monto final mantto
- Factor variable
- Indicador de si ocupó fórmula

**Footer:** Cancelar | Registrar / Guardar (disabled mientras envía o evalúa fórmula).

##### Flujo paso a paso — Marcar como pagada (desde Pagos del mes)

1. En una fila **Pendiente**, clic en check.
2. Confirmación: “¡Marcar Renta Como Pagada!” con arrendatario y periodo.
3. El sistema marca la renta como pagada.
4. Mensaje de éxito: queda registrada en el **histórico**.
5. Desaparece de pendientes / aparece como Pagada.

##### Flujo — Duplicar al mes siguiente

1. Solo si el pago es de **un mes** (no rango).
2. Confirmación.
3. Genera un nuevo registro pendiente en el mes siguiente.

---

#### 8.4.2 Servicios del mes (tab del hub)

- El usuario elige arrendatario → se cargan sus servicios.
- Registra pago: servicio, monto, método, fechas, **comprobante**.
- Puede ver detalle / comprobante.
- Opera sobre pagos de servicios del arrendatario (misma familia que el subítem 3).

#### 8.4.3 Mantenimiento del mes (ruta secundaria)

- Existe pantalla y servicio de mantenimiento actual (alta, editar, marcar pagada, paginado).
- **No aparece como tab** en el hub actual (comentada).
- El mantenimiento también se refleja desglosado dentro de las rentas y en Rent Rol (línea Mantto).

---

### 8.5 Subítem 3 — Pago de Servicios (`/registro-servicios-arrendatarios`)

#### Propósito

Reporte y registro de pagos de **servicios del arrendatario** (agua, luz, etc.) con comprobante y control de estatus. Requiere permiso **50**.

#### Filtros / toolbar

| Control | Notas |
|---------|-------|
| Fecha inicio * / Fecha fin * | Rango obligatorio |
| Arrendatario | Todos / uno |
| Estatus | null = todos |
| **Buscar** | Aplica filtros |
| **Registrar pago** | Permiso 50 |
| Limpiar / Expandir-Contraer / Exportar | |

#### Columnas

Acciones* | Arrendatario | Concepto | Fecha de pago | Monto | Método | Estatus

\*Acciones con permiso 50.

#### Acciones por fila

| Botón | Cuándo |
|-------|--------|
| Ver detalle | Con permiso |
| Cambiar estatus | Solo si el estatus **≠ Pagado** |

#### Modal Agregar Pago — campos

| Campo | Regla |
|-------|-------|
| Arrendatario * | Al cambiar, carga servicios del arrendatario |
| Servicio del arrendatario * | Select; puede autollenar concepto |
| Concepto | Texto |
| Fecha pago * | date |
| Monto * | moneda |
| Método de pago | catálogo |
| Estatus | default Pendiente |
| Comprobante * | Archivo obligatorio; drag & drop |

Validaciones típicas: completar arrendatario, fecha, monto y comprobante; el API exige el archivo.

#### Modal detalle

Datos del pago + ver comprobante + Cerrar.

#### Cambio de estatus

Diálogo de selección → actualiza estatus del pago (mapeo UI → valores numéricos, p.ej. Pagado = 1).

---

### 8.6 Subítem 4 — Historial de Pagos (`/arrendatarios/pagos-historico`)

#### Hub

| Campo | Valor |
|-------|-------|
| Título | Histórico de pagos |
| Vista activa | **Rentas** (pagos ya cerrados) |
| Mantto | Tab comentada |

#### Histórico de rentas

**Filtros / toolbar:**

| Control | Reglas |
|---------|--------|
| Mes * | Selector mes/año → consulta el mes completo |
| Arrendatario | Todos / uno |
| Contrato | Disabled hasta elegir arrendatario |
| **Filtrar** / **Limpiar** | |
| Contraer/Expandir grupos | |
| Exportar Excel | |
| Search | “Buscar en histórico…” |
| Empty | “Sin registros en el rango seleccionado” |

**Columnas:**

Acciones | Periodo | Registro | Arrendatario | Contrato | Total | Desglose | Monto final | Factor | Fórmula | Usó fórmula | Estatus (`Pagada`)

**Acciones:**

- **Ver detalle** → modal con resumen, desglose renta/mantto, monto final y campos adicionales; solo **Cerrar**.
- **Solo lectura:** no se edita ni se “desmarca” pago desde aquí.

También existe consulta de último pago de renta por arrendatario/contrato (uso interno de otros flujos).

---

### 8.7 Resumen de APIs funcionales del dominio Arrendatarios

| Capacidad funcional | Recurso conceptual |
|---------------------|--------------------|
| CRUD / listado / dashboard arrendatarios | `/arrendatarios` |
| Soft-delete contratos, servicios, socios, archivos | sub-recursos de arrendatarios |
| Dar de alta (reactivar) | `/arrendatarios/{id}/alta` |
| Rentas del mes (pendientes) | `/renta-actual` |
| Marcar renta pagada | `/renta-actual/{id}/pagada` |
| Duplicar al mes siguiente | `/renta-actual/{id}/siguiente-mes` |
| Histórico rentas | `/historico-pagos-renta` |
| Mantto actual / histórico | `/mantenimiento-actual`, `/historico-pagos-mantenimiento` |
| Pagos de servicios arrendatario | `/pagos-arrendatarios` (+ comprobante, estatus) |
| Cancelar contrato (desde detalle; UI oculto) | ContratosService |
| OCR CSF | PdfOcrService |
| Catálogos de apoyo | clientes/arrendadores, inmuebles, locales libres, tipos servicio, fórmulas, INPC |

---

## 9. Cap Operación — Rent Rol (detalle exhaustivo)

### 9.1 Qué es

| Concepto en UI | Qué es realmente |
|----------------|------------------|
| **Rent Rol** | Pantalla administrativa de **rent roll**: consulta/operación de rentas del mes |
| Ruta | `/arrendatarios/rent-rol` |
| Posición en menú | Ítem de **primer nivel** en Operación (hermano de Arrendatarios, no hijo) |
| Permisos de menú | `55` **o** `49` (OR) |
| Header / intención | Consulta del rent roll de arrendatarios |

**No es:** portal del inquilino, rol de aplicación llamado `"rent"`, ni experiencia self-service de pago.

### 9.2 Fuentes de datos de la pantalla

1. **Histórico del mes** → rentas ya pagadas.
2. **Pendientes del mes** → `renta-actual` con pagada = 0.
3. Cada registro se **aplana a 2 líneas de grid**: una de **Renta** y una de **Mantto** (con rowspan en columnas comunes).

### 9.3 Portada: avance y KPIs

**Barra de avance**

- Contador **Pagadas**.
- Contador **Pendientes** (azules + amarillas).
- **% cobrado** = pagadas / (pagadas + pendientes) × 100.

**KPIs “Totales cobrados”** (solo filas **pagadas**; las pendientes **no suman**):

| KPI | Contenido |
|-----|-----------|
| Renta cobrada | Total con IVA + hint de subtotal e IVA |
| Mantenimiento cobrado | Total con IVA + hint |
| Gran total cobrado | Suma renta + mantto con IVA + hints combinados |

Subtítulo contextual: `{mes} · solo pagos marcados como pagados`.

### 9.4 Botones de la portada

| Botón | Acción |
|-------|--------|
| **Registrar pago de renta** | Abre el mismo modal de Pagos del mes (`ListaRentasActuales` en modo solo-modal) |
| **Agregar arrendatario** | Abre modal de **captura rápida** (form reducido + mapa) |

### 9.5 Filtros y barra de periodo

| Control | Reglas |
|---------|--------|
| **Mes** * | DateBox mes/año; obligatorio; define `fechaInicio`/`fechaFin` del mes para el API |
| **Arrendatario** | Todos o uno; al cambiar resetea contratos del filtro |
| **Contrato** | Deshabilitado si no hay arrendatario; placeholder dinámico |
| **Buscar** (aplicar filtros) | Disabled mientras carga |
| **Apertura de Mes** | Ver §9.9; disabled si no `puedeAbrirMes` |
| **Cierre de Mes** | Ver §9.10; disabled si no `puedeCerrarMes` |

**`puedeAbrirMes`:** no está cargando, no hay búsqueda de texto activa, no está abriendo/cerrando, y hay al menos 1 renta **Editable** (azul).

Tooltips de bloqueo de apertura:

- Con búsqueda: “Limpia la búsqueda para abrir el mes.”
- Sin azules: “No hay rentas editables (azules) en el mes seleccionado.”

**`puedeCerrarMes`:** no cargando, no búsqueda, hay pagadas y **cero** pendientes.

Tooltips de bloqueo de cierre:

- Con búsqueda: “Limpia la búsqueda para cerrar el mes.”
- Con pendientes: indica cuántas rentas pendientes hay.
- Sin pagadas: “No hay rentas pagadas en el mes seleccionado.”

### 9.6 Búsqueda en tabla y exportación

| Control | Acción |
|---------|--------|
| Input búsqueda | Filtra en cliente (debounce); busca arrendatario, inmueble, local, montos, fechas, estatus |
| Limpiar (X) | Solo si hay texto |
| **Exportar** | Menú; disabled sin registros visibles |
| → Excel | Export propio del rent roll |
| → PDF | Export propio del rent roll |

**Leyenda de estados:** Pagada | Editable (azul) | Por pagar (amarillo) | Incremento.

**Empty states:**

- Con búsqueda: “Sin coincidencias para la búsqueda.”
- Sin datos: “Sin registros en el periodo seleccionado.”

**Paginación:** 20 registros lógicos → 40 filas de grid (2 líneas por registro). Sin selector de page size.

### 9.7 Columnas exactas del grid

| Columna | Contenido |
|---------|-----------|
| Arrendatario | Nombre + nota representante · teléfono |
| Inmueble | Nombre + zona |
| Locales | Módulo/local |
| Metros rentados | N M² |
| Costo M² | Moneda |
| Concepto | Pill **Renta** o **Mantto** |
| Sub-total | Moneda |
| IVA | Moneda |
| Total | Moneda |
| Fecha Inicio Contrato | |
| Fecha Termino Contrato | |
| Pagada | Tag según estado |
| Acciones | Según estado |

Rowspan visual en: nombre, inmueble, locales, metros, costo M², fechas, pagada, acciones.

### 9.8 Estados y acciones por fila

| Estado (label) | Condición | Acciones en grid |
|----------------|-----------|------------------|
| **Editable** (azul) | Pendiente en renta-actual y **no** abierta | Si es pago de un mes (no rango): botón **Editar**. Si es pago por rango: “—” con title “Los pagos por rango se editan en Pagos del mes” |
| **Por pagar** (amarillo) | Pendiente + marcada como abierta | Solo **Marcar como pagada** (check) |
| **Pagada** | Histórico / ya pagada | Texto “Renta Pagada” (sin botones) |

**Origen del flag “abierta”:** store local (`localStorage`, clave `rentRol.rentasAbiertas`).  
Es **por navegador**; **no hay endpoint de apertura de mes** en el API.  
Si el storage falla (p.ej. modo privado), se muestra error.

**Regla de duplicación / edición de mes:** no aplica a registros con rango (`fechaFin` presente).

Editar / marcar pagada **reutilizan** el componente de Pagos del mes en modo solo-modal. Tras el cambio, Rent Rol refresca grid y limpia caché de KPIs.

> Diferencia clave con el hub **Pago Renta y Mantto**:  
> - En el hub, se puede **pagar** cualquier pendiente y **editar** pendientes no-rango.  
> - En Rent Rol, **editar** solo azules (no abiertas) y **pagar** solo amarillas (abiertas).

---

### 9.9 Flujo paso a paso — Apertura de Mes

1. Seleccionar mes y aplicar filtros (**sin** texto de búsqueda activo).
2. Debe existir al menos 1 renta **Editable** (azul).
3. Clic en **Apertura de Mes**.
4. El sistema carga **todo** el mes (no solo la página visible).
5. Filtra azules: pendiente + no abierta + con id de renta actual.
6. Si no hay nada → mensaje informativo “Nada que abrir”.
7. Si hay → diálogo crítico con:
   - Pasos numerados (N rentas pasarán de Editable → Por pagar; ya no se editan; las nuevas seguirán en azul).
   - Aviso de irreversibilidad (en ese navegador).
   - Lista de nombres afectados.
   - **Casilla obligatoria:** “Entiendo que estas rentas ya no se podrán editar.”
   - Confirmar: “Sí, abrir mes”.
8. Guarda los IDs abiertos en `localStorage`.
9. Éxito: “¡Mes abierto!” + refresco. Esas filas pasan a **amarillo / Por pagar**.

**Efecto de negocio en UI:** congela la edición de esas rentas y deja solo la acción de cobro (marcar pagada).

---

### 9.10 Flujo paso a paso — Cierre de Mes

1. Mes sin búsqueda; **todas** las rentas del mes están pagadas (`pendientes = 0` y hay pagadas).
2. Clic en **Cierre de Mes**.
3. Recarga el mes completo; si aún hay pendientes → warning y aborta.
4. Agrupa pagadas por arrendatario + contrato (la última gana).
5. Consulta rentas actuales para:
   - Detectar cuáles **ya existen** en el mes siguiente (se omiten).
   - Obtener el id de renta del mes actual (solo periodos de un mes, no rango) para duplicar.
6. Si no hay nada que generar → “Ya está todo generado”.
7. Diálogo crítico: generará N rentas del mes siguiente en estado Editable; lista omitidas; casilla de aceptación; “Sí, cerrar mes”.
8. Spinner “Cerrando mes…”.
9. Por cada ítem:
   - Si tiene id de renta actual → duplicar al mes siguiente.
   - Si solo está en histórico → registrar renta nueva con payload proyectado al mes siguiente.
10. Resultado: éxito / warning parcial / error; opción de **ir al mes siguiente** o quedarse.

**Efecto de negocio:** cierra el ciclo del mes cobrado y deja preparadas las rentas del mes siguiente en azul (editables).

---

### 9.11 Flujo paso a paso — Marcar como pagada (desde Rent Rol)

1. Solo en filas **Por pagar** (amarillo) con id de renta actual.
2. Clic en check → mismo flujo de confirmación que en Pagos del mes.
3. Se marca pagada → pasa a histórico.
4. Rent Rol refresca: sale de pendientes, entra a pagadas y actualiza KPIs/%.

---

### 9.12 Flujo paso a paso — Captura rápida de arrendatario

Modal **“Capturar registro”** (no es el formulario completo de alta).

#### Campos

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| Arrendatario | Sí | |
| Arrendador | Sí | Al cambiar, carga inmuebles |
| Tipo persona | No | Física / Moral |
| RFC | No | Alfanumérico máx. 13 |
| Inmueble | Sí | Disabled hasta elegir arrendador |
| Local(es) | Sí | Multi-select de locales libres; chips para quitar |
| Fecha inicio / término | Sí | Término ≥ inicio |
| Metros rentados | Sí | > 0 |
| Costo por M² | Solo lectura | subtotal ÷ metros |
| Incluye mantenimiento | Sí (UI Sí/No) | Define si se cobra mantto aparte |
| % mantenimiento | Condicional | Requerido cuando aplica cobro de mantto |
| Subtotal renta | Sí | Moneda |
| IVA renta / Renta total | Calculados | 16% |
| Subtotal/IVA/Total mantto | Condicional | Calculados |

#### Botones del modal de captura

- **Cancelar** / **X** — cierra (bloqueado si está guardando).
- **Guardar** — valida → abre **modal de mapa**.

Validación con lista numerada de faltantes (arrendador, inmueble, locales, fechas, metros, subtotal, IVA/total, % y montos de mantto si aplica).

#### Modal mapa (obligatorio)

- Click en mapa → lat/lng.
- **Cancelar** / **Guardar** (Guardar disabled sin coordenadas).
- Al confirmar: crea el arrendatario (FormData) → loading → éxito/error.

---

### 9.13 Modal de registrar renta desde Rent Rol (reutilizado)

Además de los campos del hub, en alta desde Rent Rol puede aparecer el checkbox:

> “El pago ya se recibió: **marcar como pagada al registrar**”

Si se marca, al crear la renta intenta dejarla ya pagada (histórico) en el mismo flujo.

---

### 9.14 Relación Rent Rol ↔ resto de Arrendatarios

```text
Lista Arrendatarios ──► alta/edición completa (expediente)
        │
        ├── captura rápida ──► también desde Rent Rol
        │
Pago Renta y Mantto (hub) ◄──► mismo modal de renta ◄──► Rent Rol
        │                              │
        │                         apertura/cierre de mes
        │                         (solo Rent Rol + localStorage)
        ▼
Historial de Pagos  ◄── marcar pagada (desde hub o Rent Rol)
        │
Pago de Servicios (ruta aparte) ── pagos con comprobante (permiso 50)
```

---

### 9.15 Qué NO hace Rent Rol / rol “rent”

- No redefine el login.
- No redirige post-login a `/arrendatarios/rent-rol`.
- No hay guard de ruta específico del permiso 55.
- No hay portal “mi renta” para el inquilino autenticado.
- La “apertura de mes” **no** se persiste en servidor (solo `localStorage` del navegador).

---

## 10. Cap Ajustes

### 10.1 Perfil Usuario (`/usuarios/perfil-usuario`)

- Muestra nombre, rol, foto, datos de sesión/cliente asociados.
- **Cambio de contraseña** (modal): actual + nueva (7–15 caracteres, mayúscula, minúscula, número, especial) + confirmación.
- Puede cerrar sesión desde el perfil.

### 10.2 Cerrar Sesión

Navega a `/login` e invoca logout (invalida refresh y limpia sesión local).

---

## 11. Flujos transversales

| Flujo | Descripción |
|-------|-------------|
| Export Excel | Recurrente en listados DevExtreme y exports propios (Rent Rol Excel/PDF) |
| Confirmaciones | SweetAlert2 en activar/desactivar/eliminar/abrir mes/cerrar mes/marcar pagada |
| Preview documentos | PDF/imágenes en expedientes y comprobantes |
| Notificaciones | Vencimientos de contrato + pagos de servicios (inmuebles y seguimiento) |
| Tema claro/oscuro | Header |
| Asistente/chat | Presente en shared del layout |
| `/starter` | Página plantilla interna; no está en el sidebar operativo |

### Rutas existentes fuera del sidebar operativo

Hay módulos/rutas legadas o auxiliares (productos, marcas, modelos, equipos, departamentos, contratos, instalaciones, estacionamiento, etc.) que pueden existir en routing pero **no** aparecen como ítems del sidebar vertical actual.

---

## 12. Glosario de entidades

| Nombre en UI | Entidad de negocio |
|--------------|--------------------|
| Clientes (`/clientes-inmuebles`) | Clientes comerciales / cerrados |
| Prospectos | Leads previos a cliente comercial |
| Lista Arrendadores (`/clientes`) | Propietarios / arrendadores |
| Propiedades (`/monitoreo`) | Vista mapa/plano de arrendadores e inmuebles/locales |
| Arrendatarios | Inquilinos con contratos sobre locales |
| Rent Rol | Rent roll administrativo del mes (no portal inquilino) |
| Renta actual | Pago de renta pendiente del mes |
| Histórico de pagos de renta | Rentas ya marcadas como pagadas |
| Pago de servicios (arrendatario) | Cobros de agua/luz/etc. del inquilino |
| Pago de servicios (inmueble) | Cobros de servicios a nivel predio |
| INPC / Factores / Fórmulas | Base de cálculo de incrementos y montos |

---

## 13. Mapa mental de cobros

```text
Alta arrendatario
  (+ contratos, locales, servicios Renta/Mantto, docs, socios, mapa)
        │
        ▼
Pagos del mes  y/o  Rent Rol
        │
        ├── POST renta-actual (pendiente)
        │         │
        │         ├── [Rent Rol] Apertura de mes → azul → amarillo (solo UI/localStorage)
        │         │
        │         └── PATCH .../pagada
        │                   ▼
        │            historico-pagos-renta
        │
        ├── Duplicar / Cierre de mes → nueva renta-actual mes+1 (Editable)
        │
        └── Servicios
              ├── tab hub /pagos-mes/servicios
              └── /registro-servicios-arrendatarios
                        └── POST pagos-arrendatarios + comprobante
                              └── PATCH estatus
```

Mantto actual/histórico sigue el mismo patrón conceptual que renta, pero su tab en los hubs está deshabilitada en la UI actual; en Rent Rol el mantto se muestra como segunda línea del desglose.

---

## Apéndice A — Checklist funcional Arrendatarios + Rent Rol

### Lista

- [ ] Filtrar por inmueble / buscar
- [ ] Agregar (permiso 47)
- [ ] Editar / Eliminar / Dar de alta (reglas de rol/permiso)
- [ ] Ver mapa / dashboard
- [ ] Expandir detalle: contratos, servicios, documentos, socios
- [ ] Exportar Excel

### Formulario alta/edición

- [ ] Datos generales
- [ ] Contratos con locales libres y cálculo renta/mantto
- [ ] Servicios default Renta/Mantto + adicionales
- [ ] Documentos + OCR CSF
- [ ] Socios
- [ ] Mapa obligatorio al guardar

### Pago Renta y Mantto

- [ ] Registrar renta (mes/rango, fórmula/INPC/%/manual)
- [ ] Editar pendiente (no rango)
- [ ] Marcar pagada → histórico
- [ ] Duplicar mes siguiente
- [ ] Tab servicios del mes
- [ ] Exportar

### Pago de Servicios (arrendatarios)

- [ ] Filtrar por fechas / arrendatario / estatus
- [ ] Registrar con comprobante obligatorio
- [ ] Ver detalle / cambiar estatus
- [ ] Exportar

### Historial

- [ ] Filtrar mes / arrendatario / contrato
- [ ] Ver detalle
- [ ] Exportar
- [ ] Solo lectura

### Rent Rol

- [ ] Filtrar mes / arrendatario / contrato / búsqueda
- [ ] Ver KPIs y % cobrado (solo pagadas)
- [ ] Entender semáforo azul / amarillo / pagada
- [ ] Registrar pago / captura rápida
- [ ] Apertura de mes (congela edición)
- [ ] Marcar pagada solo amarillas
- [ ] Cierre de mes (genera mes siguiente)
- [ ] Export Excel / PDF

---

*Documento generado por análisis funcional del frontend. No describe implementación interna más allá de lo necesario para explicar el comportamiento visible.*
