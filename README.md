# AutoTallerManager — Frontend

> Interfaz de usuario para el sistema de gestión de talleres automotrices. Construida con JavaScript vanilla (ES6+), CSS3 personalizado y diseño responsivo.

**Repositorio Backend:** [AutoTallerManager API](https://github.com/TU_USUARIO/AutoTallerManager)

---

## Tabla de contenidos

1. [Descripción general](#descripción-general)
2. [Stack tecnológico](#stack-tecnológico)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Módulos disponibles](#módulos-disponibles)
5. [Sistema de roles y navegación](#sistema-de-roles-y-navegación)
6. [Arquitectura del cliente HTTP](#arquitectura-del-cliente-http)
7. [Sistema de autenticación](#sistema-de-autenticación)
8. [Diseño y estilos](#diseño-y-estilos)
9. [Configuración](#configuración)
10. [Instalación y ejecución](#instalación-y-ejecución)
11. [Usuarios de prueba](#usuarios-de-prueba)

---

## Descripción general

Frontend de AutoTallerManager: una SPA (Single Page Application) ligera sin frameworks, que se comunica con la API REST del backend. Implementa un sistema completo de roles, flujos de aprobación de presupuestos, gestión de órdenes de servicio, inventario, facturación consolidada y un portal de pagos para clientes.

---

## Stack tecnológico

| Categoría | Tecnología |
|-----------|-----------|
| Lenguaje | JavaScript ES6+ (Vanilla, sin frameworks) |
| Estilos | CSS3 con sistema de diseño personalizado |
| Tipografías | Google Fonts: Outfit + Plus Jakarta Sans |
| HTTP Client | Fetch API con wrapper personalizado |
| Sesiones | localStorage / sessionStorage (JWT) |
| Servidor dev | `serve` (npm/pnpm) |
| Build | Sin bundler — archivos servidos directamente |

---

## Estructura del proyecto

```
FRONTED_PROYECTO/
│
├── Index.html              ← Pantalla de login (luxury design)
├── register.html           ← Registro de cliente desde portal público
├── dashboard.html          ← Panel principal con módulos por rol
│
├── style.css               ← Sistema de estilos global (diseño luxury + responsive)
├── config.js               ← URL de la API, rutas y parámetros de paginación
├── api.js                  ← Cliente HTTP: tokens, refresh, todos los endpoints
├── auth-guard.js           ← Protección de rutas y verificación de roles
├── layout.js               ← Header compartido, navegación, hamburger menu
├── utils.js                ← Utilidades: fechas, roles, escapeHtml, paginación
├── Diseño.js               ← Lógica de la pantalla de login (animaciones, chips)
├── dashboard.js            ← Lógica del panel principal y estadísticas
│
└── modules/                ← Módulos de funcionalidad (un HTML + un JS por módulo)
    ├── clientes.html / clientes.js
    ├── vehiculos.html / vehiculos.js
    ├── ordenes.html / ordenes.js
    ├── presupuestos.html / presupuestos.js
    ├── empleados.html / empleados.js
    ├── repuestos.html / repuestos.js
    ├── proveedores.html / proveedores.js
    ├── facturas.html / facturas.js
    ├── mis-facturas.html / mis-facturas.js
    └── configuracion.html / configuracion.js
```

---

## Módulos disponibles

### Login (`Index.html`)
- Pantalla de acceso con diseño luxury (fondo de taller + gradiente dorado)
- Chips de acceso rápido para todos los roles del sistema
- Animación typewriter al seleccionar un rol
- Efecto de partículas de polvo dorado en el panel visual

### Dashboard (`dashboard.html`)
- Panel principal filtrado por rol del usuario autenticado
- Estadísticas en tiempo real: clientes, vehículos, órdenes activas, facturación mensual
- Accesos directos a los módulos habilitados para cada rol

### Clientes (`clientes.js`)
- Listado con búsqueda en tiempo real **insensible a mayúsculas y tildes**
- Paginación configurable
- Acceso: Admin, Recepcionista, Jefe de Taller

### Vehículos (`vehiculos.js`)
- Catálogo de vehículos del taller
- Registro de nuevos vehículos con marca, modelo, año, combustible y color
- Acceso: Staff en general

### Órdenes de Servicio (`ordenes.js`)
- Listado con filtro por estado (Pendiente, Aprobada, En Proceso, Finalizada, Cancelada)
- Flujo completo de estados desde el frontend:
  - **Aprobar** (Jefe de Taller)
  - **Asignar Mecánico** — muestra primero los especializados en el tipo de servicio
  - **Finalizar** (Mecánico / Jefe)
  - **Cancelar** (Recepcionista / Jefe)
  - **Eliminar** (soft delete, Admin / Jefe)
- Modal de detalle: tabla de repuestos con cantidades y precios, mano de obra
- Modal de agregar repuesto / mano de obra (desde orden existente)
- **Generar Factura Consolidada**: agrupa todas las órdenes finalizadas del cliente en una sola factura y muestra el desglose por orden

### Presupuestos — Flujo M-J-C (`presupuestos.js`)
**Vista Staff (Admin, Mecánico, Jefe, Recepcionista):**
- Crear presupuesto con selección de tipo de servicio desde catálogo
- Agregar repuestos del inventario directamente (select con código, nombre y precio)
- El precio base del servicio se suma automáticamente como mano de obra
- Flujo completo de estados en botones: Enviar al Jefe → Aprobar/Rechazar → Enviar al Cliente
- Modal de detalle con tablas de repuestos y mano de obra

**Portal del Cliente:**
- Vista de tarjetas por servicio pendiente de aprobación
- Cada tarjeta muestra el desglose completo: repuestos (código, cantidad, precio) y mano de obra
- Botones ✓ / ✗ por servicio
- Resumen de selección antes de confirmar

### Empleados (`empleados.js`)
- Directorio de mecánicos y técnicos
- Acceso: Admin, Jefe de Taller

### Repuestos / Inventario (`repuestos.js`)
- Listado de repuestos con stock actual
- Panel de stock crítico (piezas por debajo del mínimo)
- Crear nuevo repuesto con asociación a tipo de servicio (facilita el filtrado en presupuestos)
- Acceso: Admin, Mecánico, Almacén, Bodega, Jefe

### Proveedores (`proveedores.js`)
- Directorio de proveedores con datos de contacto
- Acceso: Admin, Recepcionista

### Facturas (`facturas.js`)
**Vista Admin / Recepcionista / Jefe:**
- Tabla completa de facturas con: número, cliente, órdenes incluidas, subtotal, IVA, descuento, total, método de pago y estado
- Sección de **Solicitudes de Pago Pendientes** (actualización automática cada 30s):
  - Muestra cobros en efectivo que el cliente ya inició
  - Botón "Confirmar cobro" para marcar como pagado

**Desde el módulo de Órdenes:**
- Botón "Factura" en órdenes finalizadas → abre modal con desglose por orden (repuestos + mano de obra)
- Genera factura consolidada con todas las órdenes pendientes del cliente

### Mis Facturas (`mis-facturas.js`) — Portal del Cliente
- Lista de facturas del cliente autenticado con estado de pago
- Botón **"Pagar"** en facturas pendientes → selección de método de pago:
  - **Efectivo**: envía solicitud al taller, el recepcionista confirma el cobro
  - **Tarjeta de crédito/débito**: simulador con preview visual de tarjeta en tiempo real (número, nombre, vencimiento, CVV) → genera token de aprobación `CARD-XXXXXXXX-HHMMSS`
  - **PSE / Banco**: selector de banco, tipo de persona y documento → genera token `PSE-XXXXXXXX-HHMMSS`
- Modal de confirmación con el número de aprobación como comprobante

### Configuración (`configuracion.js`)
- Tabla de parámetros del sistema agrupados por categoría
- Edición inline con botón "Guardar" por fila
- Acceso: Admin únicamente

---

## Sistema de roles y navegación

### Roles y patrones de matching

El sistema usa **coincidencia parcial por prefijo** (sin distinguir mayúsculas ni tildes):

| Patrón | Roles que coinciden |
|--------|---------------------|
| `'admin'` | Admin |
| `'jefetaller'` | JefeTaller |
| `'mecan'` | Mecánico, MecanicoDiagnostico, MecanicoArea |
| `'recep'` | Recepcionista |
| `'almacen'` | JefeAlmacen |
| `'bodega'` | JefeBodega |
| `'cliente'` | Cliente |

```javascript
// Ejemplo de uso
utils.hasRole(user.roles, 'admin', 'jefetaller') // true si el usuario es Admin o Jefe
utils.hasRole(user.roles, 'mecan')               // true para cualquier tipo de mecánico
```

### Navegación por rol

| Módulo | Admin | Jefe | Mecánico | Recepcionista | Almacén | Bodega | Cliente |
|--------|:-----:|:----:|:--------:|:-------------:|:-------:|:------:|:-------:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Clientes | ✓ | ✓ | — | ✓ | — | — | — |
| Vehículos | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Órdenes | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Presupuestos | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Empleados | ✓ | ✓ | — | — | — | — | — |
| Inventario | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| Proveedores | ✓ | — | — | ✓ | — | — | — |
| Facturas | ✓ | ✓ | — | ✓ | ✓ | ✓ | — |
| Mis Facturas | — | — | — | — | — | — | ✓ |
| Config | ✓ | — | — | — | — | — | — |

---

## Arquitectura del cliente HTTP

### `api.js` — Wrapper de Fetch

Todos los módulos consumen la API a través de un cliente centralizado que maneja:

- **Renovación automática de tokens** (refresh token transparente)
- **Gestión de almacenamiento** (localStorage persistente vs. sessionStorage por sesión)
- **Formato de respuesta estándar** `{ exito, data, mensaje, errores }`
- **Paginación** con header `X-Total-Count`
- **Redirección automática** al login si la sesión expira

```javascript
// Objeto api disponible en todos los módulos via AppLayout
const { api } = ctx;

// Clientes
api.clientes.list({ busqueda: 'garcia', pagina: 1, tamano: 20 })
api.clientes.create({ Nombres, Apellidos, Email, NumeroDocumento, TipoDocumento })

// Vehículos (filtro por propietario)
api.vehiculos.list({ clienteId: '...', placa: 'ABC' })

// Órdenes
api.ordenes.list({ estado: 1, pagina: 1 })
api.ordenes.addDetalle(ordenId, { RepuestoId, Cantidad, PrecioUnitario })
api.ordenes.finalizar(ordenId)

// Presupuestos M-J-C
api.presupuestos.crear({ ClienteId, VehiculoId, Descripcion, TipoServicioId, Detalles })
api.presupuestos.aprobarJefe(id, true, 'observación')
api.presupuestos.aprobarCliente(id, true, 'observación')

// Facturación
api.facturas.consolidada(clienteId, descuento, metodoPago)
api.facturas.misFacturas()
api.facturas.iniciarPago(facturaId, 'Tarjeta', '****4532', null)
api.facturas.confirmarEfectivo(solicitudId, observaciones)

// Catálogos
api.catalogos.tiposServicio()
api.catalogos.categoriasRepuesto()
api.catalogos.metodosPago()
```

### Formato de respuesta del backend

```javascript
// Éxito con lista paginada
{ exito: true, data: { items: [...], totalCount: 42 } }

// Éxito con objeto único
{ exito: true, data: { id: '...', nombre: '...' } }

// Error de dominio
{ exito: false, mensaje: 'Descripción del error', errores: [] }

// Error de validación
{ exito: false, mensaje: 'Errores de validación', errores: ['Campo requerido'] }
```

---

## Sistema de autenticación

### Claves de almacenamiento

| Clave | Contenido |
|-------|-----------|
| `atm_access_token` | JWT de acceso (expira en 60 min) |
| `atm_refresh_token` | Token de renovación automática |
| `atm_user` | JSON con `{ nombreUsuario, roles, expiracion }` |
| `atm_remember` | Flag `'1'` si el usuario eligió "Recordarme" |

### Flujo de renovación

```
Request HTTP
  → Token válido → continúa normalmente
  → Token expirado (401) → tryRefreshToken()
      → Refresh válido → nuevo JWT → reintenta request
      → Refresh inválido → clearSession() → redirige al login
```

### Protección de rutas (`auth-guard.js`)

```javascript
// En cada módulo, al inicio del DOMContentLoaded:
if (!window.AppAuth?.requireRole('admin', 'jefetaller')) return;
// Si el usuario no tiene ninguno de estos roles → redirige al dashboard
```

---

## Diseño y estilos

### Paleta de colores

| Token CSS | Color | Uso |
|-----------|-------|-----|
| `--champagne-gold` | `#D4AF37` | Títulos, valores destacados |
| `--bronze-gold` | `#C5A059` | Iconos, etiquetas, nav activo |
| `--bg-obsidian` | `#060708` | Fondo base |
| `--card-bg` | `rgba(10,11,14,0.6)` | Cards y paneles |
| `--text-ivory` | `#E4E4E7` | Texto principal |
| `--text-muted` | `#8E8E93` | Texto secundario / labels |

### Fondo temático

Imagen de taller automotriz (Unsplash) con overlay `rgba(6,7,8, 0.88→0.92)` para mantener el contraste. Efecto parallax con `background-attachment: fixed`.

### Responsividad

| Breakpoint | Comportamiento |
|------------|---------------|
| `> 1024px` | Layout completo de escritorio |
| `768–1024px` | Tablet: padding reducido, 2 columnas en stats |
| `< 768px` | Móvil: hamburger menu, modales full-screen desde abajo, tablas con scroll horizontal |
| `< 480px` | Mobile pequeño: todo en 1 columna |

### Header sticky

El header usa `position: sticky; top: 0` con `backdrop-filter: blur(12px)` y fondo sólido `rgba(6,7,8,0.97)` para cubrir el contenido al hacer scroll sin perder el efecto glassmorphism.

### Hamburger menu (móvil)

Inyectado dinámicamente por `layout.js`. Al activarse, el menú de navegación se despliega verticalmente con animación desde el header, con fondo blur y overlay oscuro.

---

## Configuración

### `config.js`

```javascript
window.APP_CONFIG = {
    apiBaseUrl: 'http://localhost:5000',  // ← URL del backend
    routes: {
        login:          '/Index.html',
        dashboard:      '/dashboard.html',
        clientes:       '/modules/clientes.html',
        vehiculos:      '/modules/vehiculos.html',
        ordenes:        '/modules/ordenes.html',
        presupuestos:   '/modules/presupuestos.html',
        empleados:      '/modules/empleados.html',
        repuestos:      '/modules/repuestos.html',
        proveedores:    '/modules/proveedores.html',
        facturas:       '/modules/facturas.html',
        'mis-facturas': '/modules/mis-facturas.html',
        configuracion:  '/modules/configuracion.html',
    },
    redirectDelayMs: 1400,
    pagination: { defaultPageSize: 20 },
};
```

Para apuntar a un backend en producción, cambia solo `apiBaseUrl`.

---

## Instalación y ejecución

### Prerrequisitos

- [Node.js](https://nodejs.org/) 18+ (para el servidor de desarrollo)
- [pnpm](https://pnpm.io/) (o npm)
- El **backend debe estar corriendo** en `http://localhost:5000`

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/Ksanti-monsalve/FRONTED_PROYECTO.git
cd FRONTED_PROYECTO

# 2. Instalar dependencias
pnpm install
# o: npm install

# 3. Iniciar el servidor de desarrollo
pnpm dev
# o: npm run dev

# La app queda disponible en:
# http://localhost:5500
```

> **Importante:** El frontend debe servirse con un servidor HTTP (no abrir los archivos HTML directamente con doble clic) para que las peticiones CORS funcionen correctamente.

### CORS en el backend

El backend ya tiene configurado `AllowAll` en desarrollo. Si necesitas ajustarlo para producción, usa el snippet en `integracion/appsettings.cors.snippet.json`.

---

## Usuarios de prueba

Accede desde la pantalla de login y usa los **chips de rol** para autocompletar las credenciales:

| Chip | Rol | Email | Contraseña |
|------|-----|-------|------------|
| Administrador | Admin | admin@autotaller.com | Admin@123 |
| Jefe Taller | JefeTaller | jefe@autotaller.com | Jefe@123 |
| Mecánico | Mecánico | mecanico@autotaller.com | Mecanico@123 |
| Recepcionista | Recepcionista | recepcion@autotaller.com | Recepcion@123 |
| Jefe Almacén | JefeAlmacen | almacen@autotaller.com | Almacen@123 |
| Jefe Bodega | JefeBodega | bodega@autotaller.com | Bodega@123 |
| Mec. Diagnóstico | MecanicoDiagnostico | diagnostico@autotaller.com | Diagnostico@123 |
| Mec. Área | MecanicoArea | mecanicoArea@autotaller.com | MecArea@123 |

> El rol **Cliente** se accede registrando una cuenta nueva desde el formulario de registro (`/register.html`), o creando un cliente desde el módulo de Clientes.

---

## Características destacadas

- **Sin frameworks**: JavaScript puro con módulos ES6, sin React, Vue ni Angular — mínima huella y máximo control
- **Refresh token transparente**: si el JWT expira durante el uso, se renueva automáticamente sin interrumpir al usuario
- **Portal de pagos completo**: simuladores de PSE y tarjeta de crédito con preview en tiempo real, generación de tokens y flujo de efectivo con confirmación del recepcionista
- **Presupuestos con desglose**: el cliente ve exactamente qué repuestos se usarán y a qué precio antes de aprobar
- **Factura consolidada**: una sola factura agrupa todas las órdenes de trabajo del cliente
- **Filtro de mecánicos por especialidad**: al asignar trabajo, el sistema muestra primero los técnicos especializados en ese tipo de servicio
- **Diseño responsivo completo**: funciona en escritorio, tablet y móvil con menú hamburger adaptativo

---

*Desarrollado con Vanilla JavaScript · CSS3 · Sin frameworks — Conectado a AutoTallerManager API (ASP.NET Core 9)*

---

## Autores

| Nombre | Rol |
|--------|-----|
| **Kevin Santiago Sierra León** | Desarrollo Backend — Arquitectura, API, Base de datos |
| **Kevin Santiago Pinto Monsalve** | Desarrollo Frontend — Interfaz, UX, Integración |
