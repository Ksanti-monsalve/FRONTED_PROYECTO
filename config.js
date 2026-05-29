/**
 * Configuración del frontend → backend AutoTallerManager.API
 *
 * 1. Copia integracion/appsettings.cors.snippet.json al appsettings.json del backend.
 * 2. Ejecuta el backend: dotnet run (carpeta AutoTallerManager.API)
 * 3. Ejecuta el frontend: npm run dev
 */
window.APP_CONFIG = {
    apiBaseUrl: 'http://localhost:5000',

    routes: {
        login: '/Index.html',
        dashboard: '/dashboard.html',
        clientes: '/modules/clientes.html',
        ordenes: '/modules/ordenes.html',
        repuestos: '/modules/repuestos.html',
        configuracion: '/modules/configuracion.html',
    },

    redirectDelayMs: 1400,

    pagination: {
        defaultPageSize: 20,
    },
};
