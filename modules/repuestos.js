document.addEventListener('DOMContentLoaded', () => {
    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'repuestos' });
    if (!ctx) return;

    const { api, utils, user } = ctx;
    const container = document.getElementById('table-container');
    const criticalContainer = document.getElementById('critical-container');
    const messageEl = document.getElementById('page-message');
    const reloadBtn = document.getElementById('btn-reload');

    const pageSize = window.APP_CONFIG?.pagination?.defaultPageSize ?? 20;
    const canCritical = utils.hasRole(user?.roles, 'admin', 'mecan');

    async function load() {
        utils.setLoading(container, true);
        utils.setPageMessage(messageEl, 'info', '');

        try {
            const listPromise = api.repuestos.list({ pagina: 1, tamano: pageSize });
            const criticalPromise = canCritical
                ? api.repuestos.stockCritico()
                : Promise.resolve([]);

            const [{ items }, critical] = await Promise.all([listPromise, criticalPromise]);

            renderTable(container, items, utils);
            renderCritical(criticalContainer, critical, utils, canCritical);
        } catch (err) {
            container.innerHTML = '';
            if (criticalContainer) criticalContainer.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    reloadBtn?.addEventListener('click', load);
    load();
});

function renderTable(container, items, utils) {
    if (!items?.length) {
        container.innerHTML = '<p class="table-empty">No hay repuestos en inventario.</p>';
        return;
    }

    const rows = items.map((r) => `
        <tr class="${r.bajoStockMinimo ? 'row-warning' : ''}">
            <td>${utils.escapeHtml(r.codigo)}</td>
            <td>${utils.escapeHtml(r.descripcion)}</td>
            <td>${utils.escapeHtml(r.categoria)}</td>
            <td>${utils.escapeHtml(r.cantidadStock)} / ${utils.escapeHtml(r.stockMinimo)}</td>
            <td>$${Number(r.precioUnitario).toLocaleString('es-CO')}</td>
            <td>${r.bajoStockMinimo ? 'Crítico' : 'OK'}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Stock / Mín</th>
                    <th>Precio</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderCritical(container, items, utils, canView) {
    if (!container) return;

    if (!canView) {
        container.innerHTML = '<p class="table-empty">Sin permisos para stock crítico.</p>';
        return;
    }

    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
        container.innerHTML = '<p class="table-empty">No hay repuestos en stock crítico.</p>';
        return;
    }

    container.innerHTML = `
        <ul class="critical-list">
            ${list.map((r) => `
                <li>
                    <strong>${utils.escapeHtml(r.codigo)}</strong>
                    — ${utils.escapeHtml(r.descripcion)}
                    <span>(${utils.escapeHtml(r.cantidadStock)} / mín ${utils.escapeHtml(r.stockMinimo)})</span>
                </li>
            `).join('')}
        </ul>
    `;
}
