/**
 * Copia este archivo como config.js y ajusta los valores.
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
