document.addEventListener('DOMContentLoaded', async () => {
    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'dashboard' });
    if (!ctx) return;

    const { api, utils, user } = ctx;
    const roles = user?.roles ?? [];

    // ── Permisos basados en políticas del backend ──────────────────────────────
    const isAdmin        = utils.hasRole(roles, 'admin');
    const isJefeTaller   = utils.hasRole(roles, 'jefetaller');
    const isMecanico     = utils.hasRole(roles, 'mecan');          // Mecánico, MecanicoDiagnostico, MecanicoArea
    const isRecep        = utils.hasRole(roles, 'recep');
    const isAlmacen      = utils.hasRole(roles, 'almacen', 'bodega');
    const isCliente      = utils.hasRole(roles, 'cliente');

    const canVerClientes  = isAdmin || isRecep || isJefeTaller;    // RecepcionOnly
    const canVerOrdenes   = isAdmin || isRecep || isJefeTaller || isMecanico; // StaffOnly
    const canVerInventario = isAdmin || isJefeTaller || isAlmacen || isMecanico; // AlmacenOTaller
    const canVerFacturas  = isAdmin || isRecep || isJefeTaller || isAlmacen;   // Reportes + RecepcionOnly
    const canVerReportes  = isAdmin || isJefeTaller || isAlmacen;              // Reportes

    // ── Tarjetas de módulos ────────────────────────────────────────────────────
    const modulesGrid = document.getElementById('modules-grid');
    if (modulesGrid) {
        modulesGrid.innerHTML = buildModuleCards(roles, api, utils)
            .map((mod) => `
                <a class="module-tile module-tile-link" href="${mod.href}">
                    <h3>${utils.escapeHtml(mod.title)}</h3>
                    <p>${utils.escapeHtml(mod.description)}</p>
                    <span class="module-endpoint">${utils.escapeHtml(mod.endpoint)}</span>
                </a>
            `)
            .join('');
    }

    // ── Stats del dashboard ────────────────────────────────────────────────────
    await loadDashboardData(api, utils, {
        canVerClientes, canVerOrdenes, canVerInventario, canVerFacturas, canVerReportes, isCliente,
    });
});

function buildModuleCards(roles, api, utils) {
    const all = [
        {
            title: 'Clientes',
            description: 'Gestión de clientes registrados.',
            route: 'clientes',
            endpoint: 'GET /api/Clientes',
            roles: ['admin', 'recep', 'jefetaller'],
        },
        {
            title: 'Vehículos',
            description: 'Vehículos registrados en el sistema.',
            route: 'vehiculos',
            endpoint: 'GET /api/Vehiculos',
            roles: ['admin', 'recep', 'jefetaller', 'mecan'],
        },
        {
            title: 'Órdenes de Servicio',
            description: 'Órdenes activas del taller.',
            route: 'ordenes',
            endpoint: 'GET /api/Ordenes',
            roles: ['admin', 'recep', 'mecan', 'jefetaller'],
        },
        {
            title: 'Presupuestos',
            description: 'Diagnósticos y aprobaciones.',
            route: 'presupuestos',
            endpoint: 'GET /api/MiniOrdenes',
            roles: ['admin', 'recep', 'mecan', 'jefetaller', 'cliente'],
        },
        {
            title: 'Mecánicos',
            description: 'Personal técnico del taller.',
            route: 'empleados',
            endpoint: 'GET /api/Empleados',
            roles: ['admin', 'jefetaller'],
        },
        {
            title: 'Inventario',
            description: 'Repuestos y stock crítico.',
            route: 'repuestos',
            endpoint: 'GET /api/Repuestos',
            roles: ['admin', 'mecan', 'almacen', 'bodega', 'jefetaller'],
        },
        {
            title: 'Proveedores',
            description: 'Gestión de proveedores.',
            route: 'proveedores',
            endpoint: 'GET /api/Proveedores',
            roles: ['admin', 'recep'],
        },
        {
            title: 'Facturas',
            description: 'Facturación y reportes.',
            route: 'facturas',
            endpoint: 'GET /api/Facturas',
            roles: ['admin', 'recep', 'jefetaller', 'almacen', 'bodega'],
        },
        {
            title: 'Configuración',
            description: 'Parámetros del sistema.',
            route: 'configuracion',
            endpoint: 'GET /api/Configuracion',
            roles: ['admin'],
        },
    ];

    return all
        .filter((m) => utils.hasRole(roles, ...m.roles))
        .map((m) => ({ ...m, href: api.getRoute(m.route) }));
}

async function loadDashboardData(api, utils, perms) {
    const { canVerClientes, canVerOrdenes, canVerInventario, canVerFacturas, canVerReportes, isCliente } = perms;

    const statClientes   = document.getElementById('stat-clientes');
    const statOrdenes    = document.getElementById('stat-ordenes');
    const statRepuestos  = document.getElementById('stat-repuestos');
    const statFacturas   = document.getElementById('stat-facturas');
    const recentActivity = document.getElementById('recent-activity');

    // Cliente: solo ve sus presupuestos, sin stats de gestión
    if (isCliente && !canVerClientes) {
        if (statClientes)  statClientes.textContent  = 'N/A';
        if (statOrdenes)   statOrdenes.textContent   = 'N/A';
        if (statRepuestos) statRepuestos.textContent = 'N/A';
        if (statFacturas)  statFacturas.textContent  = 'N/A';
        if (recentActivity) {
            recentActivity.innerHTML = '<p class="table-empty">Usa el módulo Presupuestos para ver el estado de tu vehículo.</p>';
        }
        return;
    }

    const tasks = [];

    // Intenta primero el endpoint consolidado del dashboard
    if (canVerReportes) {
        tasks.push(
            api.dashboardApi.resumen()
                .then((res) => {
                    const d = res?.data ?? res ?? {};
                    if (statClientes)   statClientes.textContent   = String(d.totalClientes   ?? '—');
                    if (statOrdenes)    statOrdenes.textContent    = String(d.ordenesActivas  ?? '—');
                    if (statRepuestos)  statRepuestos.textContent  = String(d.repuestosCriticos ?? '—');
                    if (statFacturas)   statFacturas.textContent   = `$${Number(d.facturacionMensual ?? 0).toLocaleString('es-CO')}`;
                })
                .catch(() => loadStatsFallback(api, utils, perms, { statClientes, statOrdenes, statRepuestos, statFacturas }))
        );
    } else {
        tasks.push(loadStatsFallback(api, utils, perms, { statClientes, statOrdenes, statRepuestos, statFacturas }));
    }

    // Órdenes recientes
    if (canVerOrdenes && recentActivity) {
        tasks.push(
            api.ordenes.list({ pagina: 1, tamano: 5 })
                .then((res) => renderRecentOrders(recentActivity, res.items, utils))
                .catch((err) => utils.setPageMessage(recentActivity, 'error', err.message))
        );
    } else if (recentActivity) {
        recentActivity.innerHTML = '<p class="table-empty">Sin permisos para ver órdenes.</p>';
    }

    await Promise.all(tasks);
}

async function loadStatsFallback(api, utils, perms, els) {
    const { canVerClientes, canVerOrdenes, canVerInventario, canVerFacturas } = perms;
    const { statClientes, statOrdenes, statRepuestos, statFacturas } = els;

    const tasks = [];

    if (canVerClientes && statClientes) {
        tasks.push(
            api.clientes.list({ pagina: 1, tamano: 1 })
                .then((r) => { statClientes.textContent = String(r.total); })
                .catch(() => { if (statClientes) statClientes.textContent = '!'; })
        );
    } else if (statClientes) statClientes.textContent = 'N/A';

    if (canVerOrdenes && statOrdenes) {
        tasks.push(
            api.ordenes.list({ pagina: 1, tamano: 1 })
                .then((r) => { statOrdenes.textContent = String(r.total); })
                .catch(() => { if (statOrdenes) statOrdenes.textContent = '!'; })
        );
    } else if (statOrdenes) statOrdenes.textContent = 'N/A';

    if (canVerInventario && statRepuestos) {
        tasks.push(
            api.repuestos.stockCritico()
                .then((items) => { statRepuestos.textContent = String(Array.isArray(items) ? items.length : 0); })
                .catch(() => { if (statRepuestos) statRepuestos.textContent = '!'; })
        );
    } else if (statRepuestos) statRepuestos.textContent = 'N/A';

    if (canVerFacturas && statFacturas) {
        tasks.push(
            api.facturas.list({ pagina: 1, tamano: 1 })
                .then((r) => { statFacturas.textContent = String(r.total); })
                .catch(() => { if (statFacturas) statFacturas.textContent = '!'; })
        );
    } else if (statFacturas) statFacturas.textContent = 'N/A';

    await Promise.all(tasks);
}

function renderRecentOrders(container, items, utils) {
    if (!container) return;
    if (!items?.length) {
        container.innerHTML = '<p class="table-empty">No hay órdenes recientes.</p>';
        return;
    }

    const rows = items.map((raw) => {
        const o = utils.mapOrden(raw);
        return `
        <tr>
            <td>#${utils.escapeHtml(o.ordenId)}</td>
            <td>${utils.escapeHtml(o.cliente)}</td>
            <td>${utils.escapeHtml(o.vin)}</td>
            <td><span class="badge">${utils.escapeHtml(o.estado)}</span></td>
            <td>${utils.escapeHtml(o.mecanico)}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>ID</th><th>Cliente</th><th>Placa</th><th>Estado</th><th>Mecánico</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}
