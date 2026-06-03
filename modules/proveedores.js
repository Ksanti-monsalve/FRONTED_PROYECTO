document.addEventListener('DOMContentLoaded', () => {
    // Proveedores: Admin y Recepcionista
    if (!window.AppAuth?.requireRole('admin', 'recep')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'proveedores' });
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
        try {
            const { items, total } = await api.proveedores.list({ pagina: currentPage, tamano: pageSize });
            renderTable(container, items, utils);
            renderPagination(paginationEl, currentPage, pageSize, total, p => { currentPage = p; load(); });
        } catch (err) {
            container.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    function renderTable(container, items, utils) {
        if (!items?.length) { container.innerHTML = '<p class="table-empty">No hay proveedores registrados.</p>'; return; }
        const rows = items.map(p => `<tr>
            <td>${utils.escapeHtml(p.nombre ?? p.razonSocial ?? '—')}</td>
            <td>${utils.escapeHtml(p.nit ?? p.ruc ?? '—')}</td>
            <td>${utils.escapeHtml(p.contacto ?? p.nombreContacto ?? '—')}</td>
            <td>${utils.escapeHtml(p.telefono ?? '—')}</td>
            <td>${utils.escapeHtml(p.email ?? '—')}</td>
            <td>${p.activo !== false ? '<span class="badge badge-ok">Activo</span>' : '<span class="badge badge-cancelada">Inactivo</span>'}</td>
        </tr>`).join('');
        container.innerHTML = `<table class="data-table"><thead><tr>
            <th>Nombre / Razón Social</th><th>NIT</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>Estado</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
    }

    function renderPagination(el, page, size, total, onChange) {
        if (!el) return;
        const totalPages = Math.max(1, Math.ceil(total / size));
        el.innerHTML = `<span>${total} proveedores</span>
        <div class="pagination-actions">
            <button class="btn-dashboard" data-page="${page-1}" ${page<=1?'disabled':''}>Anterior</button>
            <button class="btn-dashboard" data-page="${page+1}" ${page>=totalPages?'disabled':''}>Siguiente</button>
        </div>`;
        el.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => {
            const next = parseInt(btn.dataset.page, 10);
            if (next >= 1 && next <= totalPages) onChange(next);
        }));
    }

    reloadBtn?.addEventListener('click', load);
    load();
});
