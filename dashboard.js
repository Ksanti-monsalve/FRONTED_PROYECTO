document.addEventListener('DOMContentLoaded', async () => {
    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'dashboard' });
    if (!ctx) return;

    const { api, utils, user } = ctx;
    const modulesGrid = document.getElementById('modules-grid');

    if (modulesGrid) {
        modulesGrid.innerHTML = buildModuleCards(user?.roles, api)
            .map((mod) => `
                <a class="module-tile module-tile-link" href="${mod.href}">
                    <h3>${utils.escapeHtml(mod.title)}</h3>
                    <p>${utils.escapeHtml(mod.description)}</p>
                    <span class="module-endpoint">${utils.escapeHtml(mod.endpoint)}</span>
                </a>
            `)
            .join('');
    }

    await loadDashboardData(api, utils, user);
});

function buildModuleCards(roles, api) {
    const modules = [
        {
            title: 'Clientes',
            description: 'Listado y registro vía API.',
            route: 'clientes',
            endpoint: 'GET /api/Clientes',
            roles: ['admin', 'recep', 'mecan'],
        },
        {
            title: 'Órdenes de servicio',
            description: 'Órdenes activas del taller.',
            route: 'ordenes',
            endpoint: 'GET /api/OrdenesServicio',
            roles: ['admin', 'recep', 'mecan'],
        },
        {
            title: 'Repuestos',
            description: 'Inventario y stock crítico.',
            route: 'repuestos',
            endpoint: 'GET /api/Repuestos',
            roles: ['admin', 'recep', 'mecan'],
        },
        {
            title: 'Configuración',
            description: 'Parámetros del sistema (Admin).',
            route: 'configuracion',
            endpoint: 'GET /api/Configuracion',
            roles: ['admin'],
        },
    ];

    return modules
        .filter((m) => utils.hasRole(roles, ...m.roles))
        .map((m) => ({
            ...m,
            href: api.getRoute(m.route),
        }));
}

async function loadDashboardData(api, utils, user) {
    const statClientes = document.getElementById('stat-clientes');
    const statOrdenes = document.getElementById('stat-ordenes');
    const statRepuestos = document.getElementById('stat-repuestos');
    const recentActivity = document.getElementById('recent-activity');

    const canClientes = utils.hasRole(user?.roles, 'admin', 'recep', 'mecan');
    const canOrdenes = utils.hasRole(user?.roles, 'admin', 'recep', 'mecan');
    const canRepuestos = utils.hasRole(user?.roles, 'admin', 'mecan');

    const tasks = [];

    if (canClientes) {
        tasks.push(
            api.clientes.list({ pagina: 1, tamano: 5 })
                .then((res) => {
                    if (statClientes) statClientes.textContent = String(res.total);
                    return res.items;
                })
                .catch((err) => {
                    if (statClientes) statClientes.textContent = '!';
                    return { error: err.message, type: 'clientes' };
                })
        );
    } else if (statClientes) {
        statClientes.textContent = 'N/A';
    }

    if (canOrdenes) {
        tasks.push(
            api.ordenes.list({ pagina: 1, tamano: 5, ultimoId: 0 })
                .then((res) => {
                    if (statOrdenes) statOrdenes.textContent = String(res.total);
                    renderRecentOrders(recentActivity, res.items, utils);
                    return res.items;
                })
                .catch((err) => {
                    if (statOrdenes) statOrdenes.textContent = '!';
                    utils.setPageMessage(recentActivity, 'error', err.message);
                    return { error: err.message, type: 'ordenes' };
                })
        );
    } else {
        if (statOrdenes) statOrdenes.textContent = 'N/A';
        if (recentActivity) {
            recentActivity.innerHTML = '<p class="table-empty">Sin permisos para ver órdenes.</p>';
        }
    }

    if (canRepuestos) {
        tasks.push(
            api.repuestos.stockCritico()
                .then((items) => {
                    const list = Array.isArray(items) ? items : [];
                    if (statRepuestos) statRepuestos.textContent = String(list.length);
                    return list;
                })
                .catch((err) => {
                    if (statRepuestos) statRepuestos.textContent = '!';
                    return { error: err.message, type: 'repuestos' };
                })
        );
    } else if (statRepuestos) {
        statRepuestos.textContent = 'N/A';
    }

    await Promise.all(tasks);
}

function renderRecentOrders(container, items, utils) {
    if (!container) return;

    if (!items?.length) {
        container.innerHTML = '<p class="table-empty">No hay órdenes recientes.</p>';
        return;
    }

    const rows = items.map((raw) => {
        const orden = utils.mapOrden(raw);
        return `
        <tr>
            <td>#${utils.escapeHtml(orden.ordenId)}</td>
            <td>${utils.escapeHtml(orden.cliente)}</td>
            <td>${utils.escapeHtml(orden.vin)}</td>
            <td><span class="badge">${utils.escapeHtml(orden.estado)}</span></td>
            <td>${utils.escapeHtml(orden.mecanico)}</td>
        </tr>
    `;
    }).join('');

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>VIN</th>
                    <th>Estado</th>
                    <th>Mecánico</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}
