document.addEventListener('DOMContentLoaded', () => {
    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'clientes' });
    if (!ctx) return;

    const { api, utils } = ctx;
    const container = document.getElementById('table-container');
    const messageEl = document.getElementById('page-message');
    const paginationEl = document.getElementById('pagination-bar');
    const reloadBtn = document.getElementById('btn-reload');

    let currentPage = 1;
    const pageSize = window.APP_CONFIG?.pagination?.defaultPageSize ?? 20;

    async function load() {
        utils.setLoading(container, true);
        utils.setPageMessage(messageEl, 'info', '');

        try {
            const { items, total } = await api.clientes.list({
                pagina: currentPage,
                tamano: pageSize,
            });

            renderTable(container, items, utils);
            renderPagination(paginationEl, currentPage, pageSize, total, (page) => {
                currentPage = page;
                load();
            });
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
        container.innerHTML = '<p class="table-empty">No hay clientes registrados.</p>';
        return;
    }

    const rows = items.map((c) => `
        <tr>
            <td>${utils.escapeHtml(String(c.numero ?? c.id ?? '—'))}</td>
            <td>${utils.escapeHtml(`${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim() || '—')}</td>
            <td>${utils.escapeHtml(c.numeroDocumento ?? '—')}</td>
            <td>${utils.escapeHtml(c.tipoDocumento ?? '—')}</td>
            <td>${c.activo !== false ? 'Activo' : 'Inactivo'}</td>
            <td>${utils.formatDate(c.creadoEn)}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Registro</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderPagination(el, page, size, total, onChange) {
    if (!el) return;
    const totalPages = Math.max(1, Math.ceil(total / size));

    el.innerHTML = `
        <span>${total} registros · Página ${page} de ${totalPages}</span>
        <div class="pagination-actions">
            <button type="button" class="btn-dashboard" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
            <button type="button" class="btn-dashboard" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
    `;

    el.querySelectorAll('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const next = parseInt(btn.getAttribute('data-page'), 10);
            if (next >= 1 && next <= totalPages) onChange(next);
        });
    });
}
