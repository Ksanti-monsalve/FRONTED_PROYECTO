document.addEventListener('DOMContentLoaded', () => {
    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'ordenes' });
    if (!ctx) return;

    const { api, utils } = ctx;
    const container = document.getElementById('table-container');
    const messageEl = document.getElementById('page-message');
    const paginationEl = document.getElementById('pagination-bar');
    const reloadBtn = document.getElementById('btn-reload');

    let ultimoId = 0;
    const pageSize = window.APP_CONFIG?.pagination?.defaultPageSize ?? 20;

    async function load() {
        utils.setLoading(container, true);
        utils.setPageMessage(messageEl, 'info', '');

        try {
            const { items, total } = await api.ordenes.list({
                tamano: pageSize,
                ultimoId,
            });

            renderTable(container, items, utils);
            if (paginationEl) {
                paginationEl.innerHTML = `<span>${total} órdenes en el sistema · Mostrando ${items.length} registros</span>`;
            }
        } catch (err) {
            container.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    reloadBtn?.addEventListener('click', load);
    load();
});

function renderTable(container, items, utils) {
    if (!items?.length) {
        container.innerHTML = '<p class="table-empty">No hay órdenes activas.</p>';
        return;
    }

    const rows = items.map((raw) => {
        const o = utils.mapOrden(raw);
        return `
        <tr>
            <td>#${utils.escapeHtml(o.ordenId)}</td>
            <td>${utils.escapeHtml(o.cliente)}</td>
            <td>${utils.escapeHtml(o.marcaModelo)}</td>
            <td>${utils.escapeHtml(o.vin)}</td>
            <td><span class="badge">${utils.escapeHtml(o.estado)}</span></td>
            <td>${utils.escapeHtml(o.prioridad)}</td>
            <td>${utils.escapeHtml(o.mecanico)}</td>
            <td>${utils.formatDate(o.fechaIngreso)}</td>
        </tr>
    `;
    }).join('');

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Vehículo</th>
                    <th>VIN</th>
                    <th>Estado</th>
                    <th>Prioridad</th>
                    <th>Mecánico</th>
                    <th>Ingreso</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}
