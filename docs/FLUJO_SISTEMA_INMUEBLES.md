# Inmuebles Web — Cómo funciona y cómo se ve el sistema

> Documento funcional y visual de **Inmuebles Web** (Spring Telecom). Describe el flujo completo del sistema, sus pantallas, botones, formularios, modales, roles y permisos, y el sistema de diseño (colores, tipografías y componentes).
> Está elaborado a partir del código fuente del front-end (`src/app`). Donde algo depende del back-end se indica el servicio que se consume.

---

## Índice

1. [Qué es el sistema](#1-qué-es-el-sistema)
2. [Mapa general del flujo de negocio](#2-mapa-general-del-flujo-de-negocio)
3. [Acceso al sistema (login, sesión y contraseña)](#3-acceso-al-sistema)
4. [Estructura de la pantalla (layout)](#4-estructura-de-la-pantalla)
5. [Sistema de diseño (colores, tipografías y componentes)](#5-sistema-de-diseño)
6. [Roles y permisos](#6-roles-y-permisos)
7. [Menú completo](#7-menú-completo)
8. [Módulos de operación](#8-módulos-de-operación)
9. [Módulos comerciales (Prospectos, Clientes, Embudo, Generar Contrato)](#9-módulos-comerciales)
10. [Reportes](#10-reportes)
11. [Administración y catálogos](#11-administración-y-catálogos)
12. [Ajustes (perfil y cierre de sesión)](#12-ajustes)
13. [Estados y colores semánticos](#13-estados-y-colores-semánticos)
14. [Patrones de interacción comunes](#14-patrones-de-interacción-comunes)
15. [Integraciones técnicas](#15-integraciones-técnicas)
16. [Pantallas y rutas fuera del menú](#16-pantallas-y-rutas-fuera-del-menú)

---

## 1. Qué es el sistema

**Inmuebles Web** es una aplicación web para la **administración integral de propiedades en renta**. Permite:

- Registrar **arrendadores** (dueños o administradores de inmuebles) y sus **inmuebles**, divididos en **zonas** y **locales**.
- Registrar **arrendatarios** (inquilinos), sus **contratos** y los locales que ocupan.
- Controlar los **pagos del mes** (renta, mantenimiento y servicios), su **histórico** y el **Rent Rol**.
- Ver las propiedades en un **mapa** (Google Maps) y en un **plano de locales** editable.
- Llevar el proceso **comercial**: prospectos, embudo de ventas, clientes y generación de contratos de subarrendamiento en PDF.
- Administrar **usuarios, roles, permisos, módulos**, la **bitácora** y catálogos financieros (INPC, factores, fórmulas, servicios y métodos de pago).

| Dato | Valor |
|---|---|
| Nombre en pantalla | Inmuebles Web |
| Empresa | Spring Telecom (ventas@springtelecom.mx · +52 56 60 04 02 20) |
| Framework | Angular 20 (módulos con carga diferida) |
| UI | Angular Material 20 + Bootstrap 5.3 + DevExtreme 24.1 (grids) |
| API | `https://springtelecom.mx/inmueblesAPI/api` |
| Tema inicial | Siempre **oscuro**; el usuario puede cambiar a claro durante la sesión |

---

## 2. Mapa general del flujo de negocio

```text
                           ┌────────────────────────── COMERCIAL ──────────────────────────┐
                           │                                                                 │
   Prospecto ──► Embudo de ventas (Registro → Seguimiento → Finalizado) ──► "Pasar a cliente" │
      │              eventos: llamada / correo / visita + conclusiones          │             │
      │                                                                          ▼             │
      └──────────────────────────────────────────────────────────────►  Cliente             │
                                                                                               │
   Generar Contrato (plantilla de subarrendamiento → vista previa en vivo → PDF guardado)      │
                           └─────────────────────────────────────────────────────────────────┘

                           ┌────────────────────────── OPERACIÓN ──────────────────────────┐
   Arrendador ──► Inmueble ──► Zonas ──► Locales (Disponible / Ocupado / Apartado / Baja)    │
       │             │  ├─ Servicios del inmueble (agua, luz, internet…) + pagos             │
       │             │  ├─ Documentos e imágenes · Socios · Ubicación en mapa               │
       │             ▼                                                                       │
       │        Arrendatario ──► Contrato(s) ──► Local(es) rentados                          │
       │             │                                                                       │
       │             ▼                                                                       │
       │        Pagos del mes: Renta · Mantenimiento · Servicios ──► Histórico de pagos      │
       │             │                                                                       │
       │             ▼                                                                       │
       │        Rent Rol (concentrado mensual por arrendatario)                              │
       ▼                                                                                     │
   Propiedades (mapa): arrendadores → inmuebles → zonas/locales → detalle del local          │
                           └─────────────────────────────────────────────────────────────────┘

   Centro de notificaciones (header): contratos por vencer · pagos de servicios · pagos de arrendatarios
```

**Orden lógico de captura** para dar de alta una operación nueva:

1. Catálogos base (Administración): servicios, métodos de pago, INPC, factores y fórmulas.
2. **Arrendador** (Lista Arrendadores → Agregar).
3. **Inmueble** del arrendador, con zonas, locales, servicios y documentos.
4. **Arrendatario**, con su contrato, locales, servicios y documentos.
5. **Pagos del mes**: registrar renta, mantenimiento y servicios; marcarlos como pagados.
6. Consultar **Histórico de pagos**, **Rent Rol** y los **reportes** de servicios.

---

## 3. Acceso al sistema

### 3.1 Pantalla de inicio de sesión (`/login`)

Pantalla dividida en dos paneles con animación de entrada:

- **Panel izquierdo (marca):** logotipo vertical de Spring, el titular *"Control total de tus propiedades"*, el texto *"Supervisa, administra y optimiza cada inmueble desde un solo lugar."* y tres mosaicos flotantes decorativos: **Inmuebles · Gestión integral**, **Arrendatarios · Control de ocupación** y **Procesos · Flujo optimizado**.
- **Panel derecho (tarjeta de acceso):**
  - Encabezado: *Bienvenido* / **Iniciar sesión** / *Ingresa tus credenciales para continuar.*
  - Campo **Correo** (`correo@dominio.com`).
  - Campo **Contraseña** con botón de **ojo** para mostrar u ocultar.
  - Enlace **"¿Olvidaste tu contraseña?"** → `/solicitud-cambio-password`.
  - Botón **Iniciar sesión** de ancho completo, con brillo animado y spinner (*"cargando..."*) mientras valida.

**Qué pasa al entrar:**

1. Se envía `POST /login`; después se pide el perfil con `GET /login/me` (datos del usuario, rol y **permisos**).
2. Si es correcto: notificación **toastr** verde *"¡Credenciales Correctas!" — "Bienvenido al Sistema."*.
3. **Redirección según permisos:** con el permiso **34 (Consultar arrendadores en mapa)** entra a **Propiedades** (`/monitoreo`); sin él, a **Perfil de Usuario**.
4. Se ejecuta una animación de "revelado" de la aplicación y, si el centro de notificaciones tiene pendientes, suena un **sonido de bienvenida**.
5. Si falla: toastr rojo *"¡Ops!"* con el mensaje del servidor.

### 3.2 Recuperar y cambiar contraseña

| Pantalla | Ruta | Contenido |
|---|---|---|
| Recupera tu acceso | `/solicitud-cambio-password` | Campo de correo y botón de envío; el back-end manda un enlace por correo. |
| Nueva contraseña | `/cambio-password?token=…` | Correo, nueva contraseña y confirmación (con botón de ojo). |

Las tres pantallas comparten el mismo diseño de dos paneles.

### 3.3 Sesión y seguridad

- La sesión vive en **sessionStorage**, por pestaña. Los tokens viejos de `localStorage` de otra visita **no** reabren la app: hay que volver a iniciar sesión.
- **AuthGuard:** protege todo el layout principal. Sin sesión redirige a `/login`. **NoAuthGuard:** si ya hay sesión, impide volver al login.
- **Renovación automática del token:** ante un `401/403` el interceptor llama `POST /login/refresh` y reintenta la petición. Si la renovación falla, cierra la sesión.
- **Cierre de sesión:** `POST /login/logout`, limpieza de credenciales y regreso a `/login`.
- Las rutas desconocidas (`**`) redirigen al login.

---

## 4. Estructura de la pantalla

```text
┌──────────────┬───────────────────────────────────────────────────────────────────────┐
│              │ HEADER: ☰  🔍   [📄 Contratos][🧾 Servicios][👥 Arrendatarios]   ☀/🌙  👤 │
│   SIDEBAR    ├───────────────────────────────────────────────────────────────────────┤
│  (perfil +   │  ┌─ Encabezado de sección ────────────────────────────── Ruta ─────┐  │
│   menú)      │  │ [ícono] Sección / Título                        Admin / Módulo  │  │
│              │  └─────────────────────────────────────────────────────────────────┘  │
│              │   Contenido (grid, formulario, tablero, mapa…)                         │
│              │                                                          (💬 Asistente)│
│              ├───────────────────────────────────────────────────────────────────────┤
│              │ FOOTER: Inmuebles Web · ventas@springtelecom.mx · +52 56 60 04 02 20    │
└──────────────┴───────────────────────────────────────────────────────────────────────┘
```

### 4.1 Sidebar (menú lateral)

- **Logotipo:** el del arrendador del usuario si tiene uno (`user.logo`); si no, el de Spring.
- **Tarjeta de usuario:** fondo geométrico rojo vino con la foto redonda, la etiqueta *Usuario*, el nombre completo y el correo con ícono.
- **Menú agrupado** en: **Menú**, **Operación**, **Reportes** y **Ajustes** (ver [sección 7](#7-menú-completo)).
- Solo aparecen las opciones para las que el usuario tiene **al menos un permiso**. Si un grupo se queda sin hijos visibles, se oculta.
- Puede colapsarse a modo íconos (botón ☰). En pantallas pequeñas se abre como panel sobrepuesto.

### 4.2 Header (barra superior)

En tema oscuro va sobre el fondo del contenido; en tema claro es **vino sólido (#681330)** con íconos blancos.

| Elemento | Función |
|---|---|
| ☰ | Colapsa o expande el sidebar (en móvil abre el menú). |
| 🔍 | Abre el **Panel de Accesos**: un diálogo con todas las opciones del menú permitidas, cada una con su descripción corta. |
| **Cápsula 1 — Contratos** (ícono de documento) | Contador de **vencimientos y renovaciones de contratos**. |
| **Cápsula 2 — Inmuebles** (ícono de recibo) | Contador de **pagos de servicios de inmuebles**. |
| **Cápsula 3 — Arrendatarios** (ícono de personas) | Contador de **pagos y seguimiento de arrendatarios**. |
| ☀ / 🌙 | Cambia entre tema claro y oscuro con una transición animada. |
| 👤 Perfil | Menú con nombre completo, **rol** (en verde) y correo; opciones **Perfil de Usuario** y **Cerrar Sesión**. |

**Centro de notificaciones.** Cada cápsula abre un panel con:

- Encabezado con ícono, título (p. ej. *Contratos — Vencimientos y Renovaciones*) y métrica de **pendientes**.
- Lista desplazable de avisos. En contratos, cada aviso trae inmueble, arrendatario, fecha de término y días faltantes, con un **tono de color según la urgencia** (ver [sección 13](#13-estados-y-colores-semánticos)).
- Al hacer clic en un recibo se abre un diálogo con el **detalle del contrato** (tabla clave–valor).
- Botón **Ver todo**, que lleva a **Contratos**, **Lista Inmuebles** o **Arrendatarios** según la cápsula.
- La cápsula con pendientes se muestra **"viva"** (con brillo) y con un badge numérico.
- Los datos vienen de `GET /notificaciones` y se recargan solos tras altas o ediciones relevantes.

### 4.3 Asistente (botón flotante 💬)

Botón circular en la esquina inferior derecha que abre un chat con **"Claudia Robles — En línea"**:

- Opciones rápidas: *Resumen de ocupación por inmueble*, *Contratos próximos a vencer (30 días)* y *Revisar arrendatario + historial*.
- Campo *"Escribe un mensaje…"* (máximo 600 caracteres) con indicador de "escribiendo".
- ⚠️ Actualmente las respuestas son **simuladas** dentro del front-end (no hay un servicio de IA conectado).

### 4.4 Footer

Etiqueta **Inmuebles Web**, el correo y teléfono de ventas, y *"Spring Telecom — Todos los derechos reservados"* con enlace a springtelecom.mx.

---

## 5. Sistema de diseño

### 5.1 Tipografías

| Uso | Fuente |
|---|---|
| Fuente principal de la app | **Poppins** (300–700), cargada de Google Fonts |
| Fuente secundaria cargada | Plus Jakarta Sans (300–700) |
| Íconos | **Material Icons** (`mat-icon`), **Tabler Icons** (menú y header) y **Font Awesome 4** (`fa fa-*`, en botones) |
| Respaldo | Roboto / Helvetica Neue |

**Escala de texto típica:**

| Elemento | Tamaño | Peso |
|---|---|---|
| Título de sección | 24 px | 500 |
| *Eyebrow* ("Sección") | 13 px | normal |
| Títulos de tarjeta | 0.95–1.25 rem | 600–800 |
| Etiquetas de campo | 0.8 rem | 600 |
| Textos secundarios y ayudas | 0.7–0.8 rem | normal |

### 5.2 Paleta de colores

**Colores de marca y del sistema** (`_variables.scss`):

| Token | Color | Uso |
|---|---|---|
| Primario | `#60a5fa` (azul) | Elementos de Material (focus, enlaces) |
| **Secundario / marca** | `#681330` (**vino**) | Header en tema claro, diagonal del encabezado de sección, botón **Agregar** (`bg-secondary`) |
| Acento | `#f43f5e` (rosa) | Detalles |
| Éxito | `#37a316` (verde) | Estados activos, botón **Limpiar** (`bg-success`) |
| Advertencia | `#f59e0b` (ámbar) | Pendientes y avisos |
| Error | `#dc2626` (rojo) | Eliminaciones y errores |

**Fondos del tema oscuro (predeterminado):**

| Uso | Color |
|---|---|
| Fondo general y paneles | `#141a21` |
| Tarjetas elevadas | `#1c252e` |
| Bordes y contornos | `#2e3f50` |
| Hover de menús | `#19212a` |
| Texto | `#e6f1ff` (secundario al 70 %) |

**Tema claro:** el contenido pasa a blanco y gris claro (`#ffffff`, `#f1f5f9`, `#e2e8f0`) con texto oscuro (`#1e293b`). **Header y sidebar se quedan oscuros**; el header se vuelve vino sólido.

**Paleta de los módulos nuevos** (Embudo, Generar Contrato):

| Token | Color | Uso |
|---|---|---|
| Acento azul → violeta | `#5d87ff` → `#7c5cff` | Degradado de botones primarios, pasos activos, íconos |
| Verde de éxito | `#22b07d` | Completado, realizado, finalizado |
| Ámbar | `#f0a33a` | Pendiente, primera etapa |
| Rojo suave | `#ff6b6f` | Error, atrasado |

### 5.3 Botones

**Botones de barra de herramientas** (Material `mat-flat-button` con clases de color translúcido y borde claro):

| Clase | Color | Uso típico |
|---|---|---|
| `bg-secondary` | Vino translúcido, borde rosado | **+ Agregar** |
| `bg-success` | Verde translúcido | **Limpiar**, **Actualizar** |
| `bg-warn` | Azul translúcido | **Contraer / Expandir grupos** |
| `bg-info` | Turquesa translúcido | **Exportar** (Excel) |
| `bg-warning` | Ámbar translúcido | Acciones de advertencia |
| `bg-error` | Rojo translúcido | Acciones destructivas |

**Botones de acción en filas** (`btnAcciones`): cuadrados de **36 px**, radio de 12 px, fondo gris translúcido con borde claro. Al pasar el mouse se elevan 1 px y se iluminan. Cada uno tiene su color por función:

| Botón | Ícono | Color |
|---|---|---|
| Editar | ✏️ `fa-edit` | Azul |
| Eliminar o desactivar | ⬇ / 🗑 | Rojo |
| Activar | ⬆ | Verde |
| Ubicación, ocupación, dashboard | 🗺 / 📊 | Turquesa |

**Botones de formulario:** `button-success` (verde con borde verde claro) para **Guardar** y `button-danger` (rojo con borde rosado) para **Cancelar**.

### 5.4 Encabezado de sección (`perm-head`)

Todas las pantallas empiezan con la misma cabecera:

- A la izquierda, un **ícono** en caja redondeada.
- Al centro, la etiqueta pequeña **"Sección"** y debajo el **título** (24 px).
- A la derecha, la **ruta** en forma de migas, en píldoras (p. ej. *Administración / Inmuebles*).
- Al fondo, una **franja diagonal vino** (degradado de `#681330`) que cubre el 42 % derecho.
- Al cambiar de pantalla, el panel entra con una animación de opacidad (`routeAnimation`).

### 5.5 Grids (tablas DevExtreme)

Todas las listas usan **DevExtreme DataGrid** con el mismo comportamiento:

- **Barra superior:** botones **Agregar** (si hay permiso), **Limpiar**, **Contraer/Expandir grupos** y **Exportar** a Excel.
- **Búsqueda** en el panel de búsqueda (*"Buscar…"*), **fila de filtros** por columna y **filtro de encabezado**.
- **Panel de agrupación:** *"Arrastre un encabezado de columna aquí para agrupar por esa columna"*.
- **Paginación** del lado del servidor, de 20 en 20, con el texto *"Página X de Y"*.
- Filas alternadas, ordenamiento múltiple y **columnas que se ocultan** en pantallas angostas (se ven con el botón "…" de la fila).
- **Detalle desplegable** (*master-detail*) en Arrendadores, Inmuebles y Arrendatarios: al hacer clic en la fila se abre un panel con pestañas en forma de píldora (Documentos, Socios, Zonas, Locales, Servicios, Contratos…).
- **Estatus** como píldora: **Activo** (verde) o **Inactivo** (rojo).
- **Exportar a Excel** genera un `.xlsx` con ExcelJS, respetando columnas y filtros.

### 5.6 Formularios

Patrón estándar (`perm-ig`) en las pantallas de alta y edición:

- **Etiqueta** arriba (asterisco rojo en obligatorios).
- **Grupo de entrada grande**: a la izquierda una caja de color con un **ícono Material** (badge, call, mail, event, payments…) y a la derecha un campo con **etiqueta flotante** que muestra un ejemplo (*"Ej.: 55 1234 5678"*).
- Se acomodan con la rejilla de Bootstrap: `col-12 / col-md-6 / col-lg-4`.
- **Cargadores de archivos** ("Sube tu PDF", "Sube imagen"): tarjeta con insignia de formato (*"PDF · Máx. 3 MB"*), nombre del archivo y botones **Seleccionar / Ver**.
- **Botonera final:** **Cancelar** (rojo) y **Guardar/Actualizar** (verde), que muestra *"Cargando…"* mientras guarda.
- **Llenado automático con OCR:** en Arrendador, Cliente, Prospecto, Inmueble y Arrendatario, al entrar el sistema pregunta *"¿Quieres intentar completar el formulario con un archivo?"*. Se sube la **Constancia de Situación Fiscal (PDF)** y se envía a `POST /pdf-ocr/constancia-fiscal`, que llena RFC, nombre o razón social y domicilio. Aparece un toast *"Información aplicada en formulario."*.
- **Validación:** si falta algo, una alerta **"¡Faltan campos obligatorios!"** o **"¡Revise el formulario!"** lista los campos.
- **Archivos muy pesados:** si el servidor responde 413, se muestra un aviso específico.

### 5.7 Modales

Dos estilos:

1. **Modal de documentos** (`docs-modal`): fondo oscuro con desenfoque, ventana redondeada de 18 px con borde azul, *eyebrow* (*"Documento del cliente"*), título, botón **✕** y pie con **Abrir en nueva pestaña** y **Cerrar**. Se usa para ver PDFs e imágenes, dashboards y ocupación.
2. **Modal de contrato/pago** (`contract-docs-modal mono-pago-modal`): mismo marco, con una capa que oscurece la página y animaciones de entrada (`contractModalAnim`). Se usa para registrar pagos, ver detalle y para Embudo y Generar Contrato.

### 5.8 Alertas y notificaciones

- **SweetAlert2** para confirmaciones y resultados:
  - Fondo `#141a21` y texto blanco (en tema claro, fondo blanco y texto oscuro).
  - Botón confirmar **azul `#3085d6`** y botón cancelar **rojo `#d33`**.
  - Títulos estándar: **"¡Operación Exitosa!"**, **"¡Ops!"**, **"¡Eliminar …!"**, **"¡Activar!"**, **"¡Desactivar!"**, **"¡Confirmación Realizada!"**, **"¡Revise el formulario!"**.
  - Las operaciones largas muestran **"Cargando…"** con spinner y sin poder cerrarse.
- **Toastr** (esquina) en el login y en mensajes breves.

### 5.9 Animaciones

- Entrada de pantalla con un *fade* (`routeAnimation`).
- Paneles y modales con desplazamiento y escala suaves.
- Transición animada al cambiar de tema.
- Respetan *prefers-reduced-motion* en los módulos nuevos.

---

## 6. Roles y permisos

### 6.1 Cómo funcionan

1. Un **Módulo** agrupa funciones (p. ej. *Inmuebles*).
2. Un **Permiso** pertenece a un módulo (p. ej. *Consultar inmuebles*).
3. Un **Rol** (p. ej. *SA — Gestor de todo el sistema*) concentra permisos.
4. Un **Usuario** tiene un rol y pertenece a un **Arrendador**.
5. Al iniciar sesión, `GET /login/me` devuelve los permisos del usuario y se guardan en la sesión.

**Dónde se aplican:**

- **Menú lateral:** cada opción declara los permisos que requiere y basta con tener **uno**.
- **Directiva `*appHasPermission`:** oculta botones o columnas (p. ej. *Agregar*, *Acciones*, *Editar*, *Eliminar*) si falta el permiso.
- **Reglas por rol** dentro de módulos:
  - **Embudo de ventas:** solo el **rol 8** puede ver el detalle, registrar o actualizar eventos y mover etapas. Otro rol ve *"¡Acceso restringido!"*.
  - **Arrendatarios:** el botón **Dar de alta arrendatario** (reactivar uno inactivo) solo aparece para el **rol 1**.
- **Redirección de entrada:** el permiso 34 decide si el usuario entra a Propiedades o a su Perfil.

### 6.2 Catálogo de permisos

| ID | Permiso | ID | Permiso |
|---|---|---|---|
| 1 | Consulta arrendadores | 31 | Actualizar rol |
| 2 | Actualizar arrendadores | 32 | Consultar roles |
| 3 | Agregar arrendador | 33 | Eliminar rol |
| 4 | Eliminar arrendador | 34 | **Consultar arrendadores en mapa** (Propiedades) |
| 5 | Consultar usuario | 35 | Agregar servicio |
| 6 | Agregar usuario | 36 | Actualizar servicio |
| 7 | Actualizar usuario | 37 | Consultar servicios |
| 8 | Eliminar usuario | 38 | Eliminar servicio |
| 9 | Agregar módulo | 39 | Consultar métodos de pago |
| 10 | Actualizar módulo | 40 | Consultar tablero |
| 11 | Consultar módulo | 41 | Consultar inmuebles |
| 12 | Eliminar módulo | 42 | Actualizar inmueble |
| 13 | Agregar permiso | 43 | Agregar inmueble |
| 14 | Actualizar permiso | 44 | Eliminar inmueble |
| 15 | Consultar permisos | 45 | Consultar servicios de inmuebles |
| 16 | Eliminar permiso | 46 | Actualizar arrendatarios |
| 17 | Agregar INPC | 47 | Agregar arrendatarios |
| 18 | Actualizar INPC | 48 | Eliminar arrendatarios |
| 19 | Consultar INPC | 49 | Consultar arrendatarios |
| 20 | Eliminar INPC | 50 | Consultar servicios de arrendatarios |
| 21 | Agregar factores | 51 | Consultar clientes |
| 22 | Actualizar factor | 52 | Actualizar cliente |
| 23 | Consultar factores | 53 | Agregar cliente |
| 24 | Eliminar factor | 54 | Eliminar cliente |
| 25 | Agregar fórmula | 55 | Reservado Rent Rol |
| 26 | Actualizar fórmula | 56 | Consultar prospectos |
| 27 | Consultar fórmulas | 57 | Actualizar prospecto |
| 28 | Eliminar fórmula | 58 | Agregar prospecto |
| 29 | Consultar bitácora | 59 | Eliminar prospecto |
| 30 | Agregar rol | 60 | Consultar embudos |

---

## 7. Menú completo

| Grupo | Opción | Ruta | Permisos requeridos (cualquiera) |
|---|---|---|---|
| **Menú** | **Administración** › Módulos | `/modulos` | 9–12 |
| | › Permisos | `/permisos` | 13–16 |
| | › Bitácora | `/bitacora` | 29 |
| | › INPC | `/incrementos` | 17–20 |
| | › Factores | `/factores` | 21–24 |
| | › Servicios | `/servicios` | 35–38 |
| | › Métodos de pago | `/metodos-pago` | 39 |
| | **Usuarios** › Agregar Usuario / Lista Usuarios | `/usuarios/agregar-usuario`, `/usuarios` | 6 / 5 |
| | **Prospectos** › Agregar Prospecto / Lista Prospectos | `/prospectos/agregar-prospecto`, `/prospectos` | 58 / 56 |
| | **Clientes** › Agregar Cliente / Lista Clientes | `/clientes-inmuebles/…` | 53 / 51 |
| | **Embudo** | `/embudo` | 60 |
| | **Generar Contrato** | `/generar-contrato` | (sin permiso, visible para todos) |
| | **Roles** › Agregar Rol / Lista Roles | `/roles/agregar-rol`, `/roles` | 30 / 32 |
| **Operación** | **Propiedades** (mapa) | `/monitoreo` | 34 o 1–4 |
| | **Lista Arrendadores** | `/clientes` | 1–4 |
| | **Lista Inmuebles** | `/inmuebles` | 41–44 |
| | **Arrendatarios** › Lista de Arrendatarios | `/arrendatarios` | 49 |
| | › Pagos Del Mes | `/arrendatarios/pagos-mes` | 49 |
| | › Histórico De Pagos | `/arrendatarios/pagos-historico` | 49 |
| | **Rent Rol** | `/arrendatarios/rent-rol` | 55 o 49 |
| **Reportes** | Servicios Inmuebles | `/registro-servicios-inmuebles` | 45 |
| | Servicios Arrendatarios | `/registro-servicios-arrendatarios` | 50 |
| **Ajustes** | Perfil Usuario | `/usuarios/perfil-usuario` | — |
| | Cerrar Sesión | `/login` | — |

---

## 8. Módulos de operación

### 8.1 Propiedades — Monitoreo en mapa (`/monitoreo`)

La pantalla principal tras el login. El flujo es por niveles, con animación de avance y retroceso:

1. **Arrendadores:** lista con buscador (*"Buscar arrendador"*). Al elegir uno se cargan sus inmuebles.
2. **Inmuebles del arrendador**, en dos paneles:
   - **Izquierdo:** tarjetas por inmueble con nombre, píldora de estatus (Activo/Inactivo), tipo (Rentado/Propio) y *"N zona(s) · N servicio(s)"*. Botones por tarjeta: **Centrar** (lo enfoca en el mapa), **Estacionamientos**, **Zonas** e **Información**.
   - **Derecho:** **Google Maps** con un marcador por inmueble. Al pasar o hacer clic se abre una ventana de información con estilo propio.
   - Botones de cabecera: **Inmuebles** (violeta) y **Arrendadores** (ámbar) para regresar de nivel.
3. **Zonas y locales del inmueble:**
   - Lista de locales con el estatus de color de cada uno y el botón **Información**.
   - **Locales del Inmueble — plano editable:** un diagrama con zoom (rueda del mouse) y arrastre donde se acomodan los locales; **Renombrar** en línea, **Guardar** (`Guardando…`) y **Restaurar** al último guardado. Si el inmueble no tiene zonas aparece *"Sin zonas ni locales"*.
   - Botón **Volver al diagrama**.
4. **Detalle del local o inmueble** (`/monitoreo/instalacion/:id`), con secciones:
   - Datos generales y **contratos vinculados** (*"N contratos registrados"*).
   - **Documentos e imágenes** del inmueble y **Documentos del local** (Visualizar / Descargar).
   - **Servicios** y **Pagos**: grid con *Concepto, Número de contrato, Fecha de pago, Fecha límite, Monto, Método y Estatus*, filtro por **fecha inicio y fin** (**Consultar / Restablecer**), **Agregar Pago** (servicio, concepto, fecha, monto, método y comprobante obligatorio) y **Cambiar estatus** del pago.
   - **Zonas**, **StreetView** y **Galería** de fotos con carrusel ‹ ›.
   - Íconos con tooltip: *Ubicación del inmueble*, *Licencia o uso de suelo* y *Street View del inmueble*.

### 8.2 Lista Arrendadores (`/clientes`)

**Grid:** Acciones · Imagen (logotipo) · Arrendador · Teléfono · RFC · Correo · Tipo Persona (Física/Moral) · Nombre, Teléfono y Email del Encargado · Dirección · Estatus. Las columnas ocultables son Resumen, Documentos y Socios.

- **Acciones por fila:** Editar, Activar o Eliminar (con confirmación) y **Ver logotipo**.
- **Detalle desplegable:** pestañas **Documentos (N)** (Ver / Descarga / Eliminar) y **Socios Arrendadores (N)**.

**Formulario (Agregar / Editar arrendador):**

- **Generales:** Cliente encargado (arrendador padre), RFC, Tipo de persona, Nombre o Razón social, Apellidos (solo persona física).
- **Contacto:** Teléfono y Correo.
- **Domicilio:** Estado, Municipio, Colonia, Calle, Entre calles, C.P., Número exterior e interior.
- **Representante legal:** nombre, teléfono y correo. También Sitio web.
- **Documentos e imágenes:** Logotipo, Constancia de Situación Fiscal, Comprobante de domicilio fiscal, Licencia de funcionamiento y Constancia de protección civil.
- **Socios:** lista dinámica con **Agregar / Eliminar socio**.
- Llenado automático con OCR desde la Constancia Fiscal.

### 8.3 Lista Inmuebles (`/inmuebles`)

**Barra:** selector **"Todos los arrendadores / Buscar arrendador"** para filtrar, **Agregar**, **Limpiar** y **Exportar**.

**Grid:** Acciones · Inmueble · Arrendador · Dirección fiscal · Vigencia (con chips) · Representante legal · Estatus.

**Acciones por fila:**

| Botón | Qué hace |
|---|---|
| Editar | Abre el formulario del inmueble. |
| Activar / Eliminar | Con confirmación. |
| **Ubicación** | Lo muestra en el mapa. |
| **Dashboard** | Modal *Dashboard del inmueble*: filtro **Desde/Hasta**, tarjetas de **Total locales, Ocupados, Libres e Ingreso mensual estimado**, tabla de arrendatarios y pagos. |
| **Ocupación del inmueble** | Modal con **Total inmueble / Ocupado / Disponible** en m² y la **ocupación por zona**. |

**Detalle desplegable** con pestañas:

- **Zonas (N) · Locales (N):** buscador de locales y cambio de **estado del local** (*"¡Actualizar Estado Del Local!"*).
- **Servicios (N):** con su comprobante de pago.
- **Documentos (N):** Ver / Descarga / Eliminar.

**Formulario del inmueble**, por secciones:

1. **Inmueble:** nombre, arrendador, dirección fiscal, **estatus (Rentado / Propio)**, inicio y fin de vigencia, representante legal (nombre, teléfono y correo), **renta (MXN)**, tiempo de renta (años) y **Ubicación** (botón *Seleccionar ubicación* sobre el mapa).
2. **Servicios:** tipo, número de contrato, fecha de pago, último día de pago y comprobante. Botones **Agregar / Eliminar servicio**.
3. **Zonas:** zona principal, superficie de zona (m²) y superficie disponible del predio. Botones **Agregar / Eliminar zona**.
4. **Locales de la zona:** nombre, área (m²), **estatus** (*Fuera de servicio / Disponible para renta*), renta y mantenimiento **sin IVA**, **Aplica IVA**, renta y mantenimiento **con IVA** (calculados), giro y **fachada** (imagen).
5. **Pagos:** concepto, fecha y monto (MXN).
6. **Documentos e imágenes** y **Socios** (nombre y RFC).

### 8.4 Arrendatarios (`/arrendatarios`)

**Barra:** filtro **"Todos los inmuebles / Buscar inmueble"**, **Agregar**, **Limpiar** y **Exportar**.

**Grid:** Acciones · Arrendatario · Tipo persona · RFC · Renta · Vigencia · Arrendador · Inmueble · Dirección del inmueble · Representante legal · Estatus · Registro.

**Acciones por fila:**

| Botón | Qué hace |
|---|---|
| Editar | Abre el formulario del arrendatario. |
| Eliminar | Con confirmación. |
| Ubicación | Lo muestra en el mapa. |
| **Dashboard** | Modal *Dashboard del arrendatario* con filtro Desde/Hasta: **Contratos en el periodo**, **Estado de rentas**, **Renta del mes y del periodo**, **Mensualidad por local**, **Pagos registrados** y **Pagos del arrendatario**. |
| **Dar de alta arrendatario** | Reactiva uno inactivo. Solo para el **rol 1**. |

**Detalle desplegable** con pestañas:

- **Contratos (N):** con botón **Cancelar contrato** y confirmación *"¡Cancelación de contrato!"*.
- **Locales (N)**, **Servicios (N)**, **Documentos (N)** y **Socios (N)**.

**Formulario del arrendatario:**

1. **Generales:** nombre, arrendador, tipo de persona, RFC y representante legal (nombre, teléfono y correo).
2. **Datos del contrato:** botones **Agregar contrato / Eliminar contrato**.
   - Inmueble, **local(es)**, fecha de inicio y término, moneda, metros rentados y costo por m².
   - **¿Incluye mantenimiento?** y % de mantenimiento.
   - Meses y monto de depósito, meses y monto de adelanto, años forzosos del arrendador y del arrendatario, observaciones.
   - **Totales calculados:** subtotal, IVA y total de renta y de mantenimiento.
3. **Servicios**, **Documentos e imágenes** (incluye fachada) y **Socios**.
4. OCR desde la Constancia Fiscal.

### 8.5 Pagos Del Mes (`/arrendatarios/pagos-mes`)

Concentrador **"Pagos Del Mes En Curso"** con tres pestañas: **Rentas**, **Mantenimientos** y **Servicios**. Todas comparten filtros en cascada: **arrendador → inmueble**, y **Limpiar**.

#### Rentas actuales

- **Grid:** Vigencia · Fecha de creación · Arrendatario · Contrato · Total · Desglose · Monto final · Factor · Fórmula · Usó fórmula · Estatus (**Pagada / Pendiente**).
- **Acciones:** **Editar**, **Marcar como pagada** (*"¡Marcar Renta Como Pagada!"*) y **Duplicar al mes siguiente** (*"¿Duplicar renta al mes siguiente?"*). Una renta pagada queda bloqueada (*"La renta ya fue pagada y no admite cambios"*).
- **Registrar pago de renta** (modal por bloques):
  1. **Arrendatario y contrato.**
  2. **Vigencia del pago:** *Mes actual (una fecha)* o *Rango (desde → hasta)*.
  3. **Forma de cálculo:**
     - **Fórmula guardada:** se elige una fórmula del catálogo y se calcula con el servicio `evaluar`.
     - **INPC directo:** mes desde/hasta, INPC numerador y denominador → factor INPC.
     - **% anual directo.**
     - Botones **Consultar** y **Aplicar**.
  4. **Importes y factor:** total, monto final, total y monto final de mantenimiento, factor de fórmula o INPC, "usó fórmula".
  5. **Resumen / Vista previa del pago** y **Guardar**.

#### Mantenimiento actual

- **Grid:** Periodo · Registro · Arrendatario · Contrato · Total · Monto a cobrar · Factor · Fórmula · Usó fórmula · Estatus.
- **Registrar pago mantenimiento:** arrendatario, contrato, fórmula, total, monto final, factor y "usó fórmula".
- **Registrar pago** (marcar como pagado).

#### Pagos de servicios

- Resumen de **pagados vs. pendientes**.
- **Grid:** Ver detalle · Cambiar estatus.
- **Registrar pago servicio:** arrendatario, tipo de servicio, concepto (*"Ej.: Agua potable"*), fecha de pago, monto, **método de pago** y **comprobante obligatorio**.

### 8.6 Histórico De Pagos (`/arrendatarios/pagos-historico`)

Concentrador **"Histórico de pagos"** con pestañas **Rentas** y **Mantenimientos**:

- **Filtros:** mes o rango de fechas y arrendatario; **Filtrar / Limpiar / Exportar**.
- **Grid:** Periodo · Registro · Arrendatario · Contrato · Total · Desglose · Monto final · Factor · Fórmula · Usó fórmula · Estatus.
- **Ver detalle:** modal *"Detalle del pago — Información del pago — Desglose"*.

### 8.7 Rent Rol (`/arrendatarios/rent-rol`)

Concentrado mensual del ingreso por arrendatario.

- **Filtros:** **Mes** (obligatorio), arrendatario y contrato, con **Filtrar**.
- **Grid:** Arrendatario · Inmueble · Locales · Metros rentados · Costo por m² · Concepto · Sub-total · IVA · Total · Inicio y término del contrato · **Pagada**.
- **Exportar:** **Exportar grid a Excel** y **Exportar PDF** (con jsPDF).
- **Agregar Arrendatario:** modal *"Capturar registro"* que da de alta el arrendatario y su contrato con cálculo automático de totales:
  - Datos del arrendatario.
  - **Inmueble y locales.**
  - Fechas, metros, costo por m², mantenimiento (sí/no y %), subtotales, IVA y totales.

### 8.8 Contratos (`/contratos`)

> Pantalla a la que lleva el **Ver todo** de las notificaciones de contratos.

- **Grid:** Contrato · Tipo · Arrendador · Arrendatario · Inmueble(s) · Inicio · Término · Moneda · Renta total · Mantenimiento total · **PDF**.
- **Formulario:**
  - **Tipo de modificación:** *Por renovación / Por revisión / Por prórroga / Otro*.
  - Número de contrato (*"Ej.: PC-0006"*), arrendador, arrendatario, **inmueble(s)**, fechas y moneda (*Peso MXN / Dólar USD*).
  - Metros, costo por m², depósito, % de mantenimiento, años forzosos, adelanto y observaciones.
  - **Totales calculados (IVA 16 %)** y **Documento (PDF)**.

### 8.9 Estacionamientos (`/estacionamiento`)

Se entra desde **Propiedades → Estacionamientos** del inmueble.

- **Lista:** Nombre · Número de tarjeta · Arrendatario · Estatus.
- **Formulario** *"Estacionamiento de Inmueble: {nombre}"* con dos pestañas:
  - **Estacionamiento:** nombre del pensionado, número de tarjeta (*"TAR-1001"*) y arrendatario del predio.
  - **Entradas y Salidas:** grid de boleto, entrada, salida, total y registro; carga masiva con **Sube tu Excel**, con validación de tipo y tamaño.

---

## 9. Módulos comerciales

### 9.1 Prospectos (`/prospectos`)

Es el mismo CRUD que Clientes, pero de **prospectos**:

- La lista se obtiene de `GET /clientes/prospectos/{page}/{limit}`.
- El formulario envía **`esProspecto = true`** (con los datos, documentos y OCR de un cliente).
- **Botón "Pasar a cliente"** (👤+): pregunta *"¡Pasar a Cliente!… Esta acción no se puede revertir, ya no podrá regresar a prospecto"* y llama `PATCH /clientes/prospecto/{id}`.
- **Permisos:** 58 Agregar, 57 Editar y Pasar a cliente, 59 Activar/Desactivar.

### 9.2 Clientes (`/clientes-inmuebles`)

- **Grid:** Imagen · Acta constitutiva · Comprobante de domicilio · Constancia fiscal (botones **Observar** con visor) · Nombre · Teléfono · RFC · Correo · Tipo persona · Encargado · Dirección · Estatus.
- **Formulario:** cuenta padre, tipo de persona, RFC, datos de contacto, domicilio, encargado, sitio web, logotipo y documentos, con OCR.

### 9.3 Embudo de ventas (`/embudo`)

Seguimiento visual de prospectos con el estilo azul–violeta de los módulos nuevos.

**1. Portada con indicadores**

- Título *"Seguimiento de prospectos"*.
- **Barra de distribución por etapa:** naranja Registro, azul Seguimiento y verde Finalizado, con leyenda y conteos.
- **Indicadores:**
  - Prospectos activos.
  - Eventos pendientes.
  - **Atrasados** (se pinta en rojo si hay alguno).
  - **Anillo de % finalizado** (*"1 de 6"*).
  - **Próximo evento** más cercano (nombre, fecha y *"en 14 h"*).

**2. Herramientas**

- Buscador por prospecto, vendedor, correo, teléfono o RFC.
- **Filtros rápidos con contador:** Todos · Con pendientes · Atrasados · Sin evento.
- Botón **Actualizar**.

**3. Tablero Kanban de 3 etapas: Registro → Seguimiento → Finalizado**

- Cada columna tiene ícono de color, *"% del embudo"*, barra de proporción y estado vacío ilustrado.
- **Arrastrar y soltar** una tarjeta a otra columna llama `PATCH /embudo-ventas/estatus/{id}` y muestra *"{Nombre} ahora se encuentra en la etapa de {Etapa}"*.
- Las tres etapas siempre se ven lado a lado; en celular las tarjetas se compactan a un resumen con íconos.

**4. Tarjeta del prospecto**

- Avatar con iniciales en un color fijo por nombre, nombre y vendedor.
- **Bloque de próximo evento:** ícono del medio (📞 Llamada, ✉️ Correo, 🚶 Visita), fecha y tiempo relativo. Si ya pasó sin conclusión se pone **rojo**: *"Evento atrasado · hace 3 días"*.
- Teléfono y correo, y contadores de **pendientes** (ámbar) y **realizados** (verde).
- **Acciones:** 👁 Ver detalle · 📅 Programar evento · 👤+ Pasar a cliente.

**5. Detalle (modal)**

- Perfil con avatar y chips de etapa, tipo y vendedor.
- Indicadores (pendientes, realizados y fecha de registro) e información de contacto.
- **Próximo evento destacado**, con el editor de conclusión en línea.
- **Historial como línea de tiempo.**
- Pie con **Pasar a cliente** y **Programar evento**.

**6. Registrar conclusión** (en línea, sin alerta)

- Un campo de texto con **Cancelar / Confirmar** (*Ctrl+Enter* / *Esc*). Llama `PATCH /embudo-ventas/eventos/{id}`.
- Después pregunta *"¿Desea registrar un nuevo evento para este embudo?"*:
  - **Sí, registrar** abre el formulario de evento.
  - **No** cierra el detalle.

**7. Programar evento (modal)**

- Medio de comunicación elegido con **tarjetas** (Llamada, Correo, Visita).
- **Atajos de fecha:** *Hoy, Mañana 10:00, En 3 días, En una semana*.
- Fecha y hora con su confirmación (*"16 oct 2026, 10:00 a.m. · en 13 h"*).
- Comentario opcional (contador de 500 caracteres).
- Llama `POST /embudo-ventas/{id}/eventos`.

**Regla de rol:** detalle, eventos, conclusiones y cambio de etapa son solo para el **rol 8**.

### 9.4 Generar Contrato (`/generar-contrato`)

**Portada**

- *Plantilla de contrato — "Contrato de subarrendamiento de local comercial"*.
- Pasos *Captura → Vista previa en vivo → Guarda y descarga en PDF*.
- Botón **Generar Contrato** y datos de **contratos guardados** y **último registro**.
- Ilustración de un contrato con sello.

**Grid de contratos generados** (`GET /contratos/generados`)

- Columnas: Nombre · Clave · Registrado por · Fecha de registro · Última actualización (24 h).
- Acción **Editar** (abre el contrato guardado).

**Espacio de trabajo**, dentro de una sola card:

- **Encabezado:** botón de regresar, título *"Captura la información del contrato"* (o *"Edita…"*), **anillo de avance** (*"x/55 campos"*) y **Generar Vista Previa** (se habilita con todo completo).
- **Formulario** (`col-lg-6`):
  - Pasos numerados con estado (activo, completo o con error): Documento, Subarrendador, Inmueble, Subarrendatario, Obligado solidario, Condiciones, Cuenta de pago, y Estacionamiento y giro.
  - **Cancelar** pide confirmación solo si hay datos escritos.
  - Cada sección tiene ícono, descripción y barra de avance.
  - Los campos van **3 por fila** desde `lg` y llevan ejemplos, adornos (`$`, `%`, `m²`, `meses`, `días`) y validaciones: RFC, CURP, CLABE de 18 dígitos, C.P. de 5, teléfono de 10, porcentajes de 0 a 100 y día de pago de 1 a 31.
- **Vista previa en vivo** (`col-lg-6`):
  - El PDF se regenera solo, alrededor de un segundo después de dejar de escribir (`POST …/vista-previa`).
  - Se dibuja con **pdf.js** sin parpadeo y conservando la página.
  - Herramientas: zoom, actualizar y abrir en pestaña, con estado *Actualizando…* o *Actualizado HH:MM*.
  - En pantallas menores a `lg` se alterna con el selector **Formulario | Vista previa**.
- **Visor final:** el PDF completo con **Cancelar** (regresar a modificar o cancelar todo) y **Guardar**.
  - Guardar muestra *"Cargando…"*, guarda con `POST /contratos/generados` o `PATCH /contratos/generados/{id}` si se está editando, **descarga el PDF** y confirma *"¡Operación Exitosa!"*.
- **Protección al salir:** si hay al menos un campo escrito y se cambia de módulo, pregunta *"¿Desea salir del contrato? Si sale, se perderán los datos llenados"*.

---

## 10. Reportes

### 10.1 Servicios Inmuebles (`/registro-servicios-inmuebles`)

- **Filtros:** fecha inicio y fin (obligatorias), inmueble y estatus; **Buscar / Limpiar / Exportar**.
- **Grid:** Inmueble · Concepto · Fecha de pago · Monto · Método · Estatus, con las acciones **Ver detalle** y **Cambiar estatus**.
- **Registrar pago:** inmueble, servicio del inmueble, concepto, fecha, monto, método y **comprobante obligatorio**.

### 10.2 Servicios Arrendatarios (`/registro-servicios-arrendatarios`)

Es igual al anterior, pero por **arrendatario** y **tipo de servicio**.

---

## 11. Administración y catálogos

Todos siguen el patrón **Lista (grid) + Formulario** con **Agregar / Limpiar / Exportar** y **Activar / Desactivar**.

| Módulo | Grid | Formulario |
|---|---|---|
| **Usuarios** | Imagen · Nombre · Teléfono · Correo · Rol · Arrendador · Estatus | Arrendador, nombre y apellidos, correo (usuario), teléfono, **rol**, contraseña y confirmación, imagen de perfil |
| **Roles** | Nombre · Descripción · Estatus | Nombre (*"Ej.: SA"*) y descripción (*"Gestor de todo el sistema"*) |
| **Permisos** | Id · Nombre · Descripción · Módulo · Estatus | Módulo, nombre y descripción |
| **Módulos** | Nombre · Estatus | Nombre y descripción |
| **Bitácora** | Fecha · Usuario · Módulo · Acción · Descripción | Solo consulta, con filtro de fechas obligatorio |
| **INPC** (`/incrementos`) | Fecha · Origen · Índice INPC · % Anual · % Acumulado anual | Año, mes, valor INPC y % anual. Consulta por rango de fechas. |
| **Factores** | Pestañas **Factores** (Variable · Mes · Año · Valor · Descripción) y **Fórmulas** (Nombre · Fórmula · Tipo de resultado · Registro · Actualización) | **Factor:** variable, periodo INPC (con **Consultar INPC**), valor y descripción. **Fórmula:** nombre, **tipo de resultado** (monto o porcentaje), descripción y **editor de expresión** con teclado numérico, variables y ⌫. |
| **Servicios** | Nombre · Estatus | Nombre (*"Ej.: Internet"*) |
| **Métodos de pago** | Nombre · Estatus | Nombre (*"Ej.: Transferencia bancaria"*) |

> Las **fórmulas** se usan en *Pagos Del Mes* para calcular rentas y mantenimientos actualizados (por INPC, % anual o una expresión personalizada).

---

## 12. Ajustes

### 12.1 Perfil Usuario (`/usuarios/perfil-usuario`)

- Datos del usuario: foto, nombre, correo, rol, arrendador, último acceso, etc.
- Tarjetas de acción:
  - **Cambiar Contraseña — Actualiza tu acceso:** modal con contraseña actual, nueva y confirmación.
  - **Cerrar Sesión — Salir del sistema.**

### 12.2 Cerrar sesión

Disponible en el menú lateral, en el menú de perfil del header y en el Panel de Accesos. Cierra la sesión en el servidor y regresa al login.

---

## 13. Estados y colores semánticos

| Concepto | Estados → color |
|---|---|
| Estatus de registro (catálogos, usuarios, inmuebles…) | **Activo** verde · **Inactivo** rojo |
| Local (monitoreo) | 0 **Baja** · 1 **Disponible** · 2 **Ocupado** · 3 **Apartado** |
| Local (alta del inmueble) | *Fuera de servicio* / *Disponible para renta* |
| Inmueble (tipo) | **Rentado** / **Propio** |
| Renta y mantenimiento | **Pagada** (verde) / **Pendiente** (ámbar) |
| Pago de servicio | **Pagado** / **Pendiente** |
| Notificación de contrato, según días faltantes | > 15 días **verde** · 7–15 **amarillo** · 3–6 **ámbar** · 0–2 **rojo** · vencido **rojo intenso** |
| Embudo — etapa | Registro **ámbar** · Seguimiento **azul–violeta** · Finalizado **verde** |
| Embudo — evento | Pendiente **ámbar** · Realizado **verde** · Atrasado **rojo** |
| Generar Contrato — paso | Activo **azul–violeta** · Completo **verde** · Con error **rojo** |

---

## 14. Patrones de interacción comunes

1. **Agregar:** botón vino **+ Agregar** → formulario → **Guardar** → *"¡Operación Exitosa!"* → regreso a la lista.
2. **Editar:** botón ✏️ de la fila → mismo formulario con los datos cargados (título *"Actualizar …"*).
3. **Activar / Desactivar / Eliminar:** SweetAlert con el nombre del registro en negritas → **Confirmar** (azul) o **Cancelar** (rojo) → *"¡Confirmación Realizada!"* o *"¡Eliminado!"*.
4. **Ver detalle:** clic en la fila (detalle desplegable) o botón 👁 (modal).
5. **Documentos:** botón **Ver** abre el visor (PDF o imagen) con *Abrir en nueva pestaña* y *Cerrar*; **Descarga** baja el archivo.
6. **Filtros en cascada:** *Todos los arrendadores → Todos los inmuebles → arrendatario*, con **Limpiar** para reiniciar.
7. **Exportar:** botón turquesa **Exportar** → archivo `.xlsx` del grid (en Rent Rol también PDF).
8. **Errores del servidor:** alerta *"¡Ops!"* con el mensaje del back-end.
9. **Archivos:** solo se aceptan los formatos indicados (PDF o imagen); si no, *"Formato no permitido"* o *"Solo se acepta PDF"*.

---

## 15. Integraciones técnicas

| Integración | Uso |
|---|---|
| **API REST** `inmueblesAPI/api` | Toda la información (CRUD, pagos, notificaciones, contratos, embudo…) |
| **Login / refresh / logout / me** | Autenticación con access y refresh token |
| **Google Maps JS API** | Mapa de propiedades, marcadores, ventanas de información, StreetView y selección de ubicación |
| **OCR de Constancia Fiscal** `POST /pdf-ocr/constancia-fiscal` | Llenado automático de formularios |
| **pdf.js** (`pdfjs-dist`) | Dibujo de PDFs (vista previa en vivo y visor de contratos) |
| **ExcelJS / file-saver** | Exportación de grids a Excel |
| **jsPDF + autotable** | Exportación del Rent Rol a PDF |
| **Socket.IO** | Canal en tiempo real hacia la API (servicio `SocketService`) |
| **DevExtreme** | Grids, paginación, filtros y exportación |
| **SweetAlert2 / ngx-toastr** | Alertas y notificaciones |
| **Angular CDK Drag & Drop** | Tablero del Embudo de ventas |

---

## 16. Pantallas y rutas fuera del menú

Existen en el sistema pero **no aparecen en el menú lateral**; se accede a ellas desde otras pantallas o directamente por URL:

| Ruta | Acceso |
|---|---|
| `/contratos` | Desde **Ver todo** en las notificaciones de contratos |
| `/estacionamiento` | Desde **Propiedades → Estacionamientos** |
| `/monitoreo/instalacion/:id` | Desde **Información** de un local o inmueble en Propiedades |
| `/equipos`, `/instalaciones`, `/instalaciones-centrales`, `/departamentos`, `/marcas`, `/modelos`, `/productos` | Catálogos de una versión anterior (equipos con N° de serie e IP, oficinas centrales, pisos y departamentos). Siguen siendo navegables por URL, pero no están en el menú actual. |
| `/register`, `/error`, `/starter`, `/sample-page` | Pantallas de plantilla base, sin uso en la operación |

---

*Documento generado a partir del código fuente del repositorio `InmueblesWebApp` (rama `dev-evera`).*
