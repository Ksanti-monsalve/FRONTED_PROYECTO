document.addEventListener('DOMContentLoaded', () => {
    // StaffOnly (sin Cliente): Admin, Recepcionista, JefeTaller, Mecánico (y subtipos)
    if (!window.AppAuth?.requireRole('admin', 'recep', 'jefetaller', 'mecan')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'vehiculos' });
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
            const { items, total } = await api.vehiculos.list({ pagina: currentPage, tamano: pageSize });
            renderTable(container, items, utils);
            renderPagination(paginationEl, currentPage, pageSize, total, p => { currentPage = p; load(); });
        } catch (err) {
            container.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    reloadBtn?.addEventListener('click', load);
    load();
});

function renderTable(container, items, utils) {
    if (!items?.length) { container.innerHTML = '<p class="table-empty">No hay vehículos registrados.</p>'; return; }
    const estadoBadge = (activo) => activo !== false
        ? '<span class="badge badge-ok">Activo</span>'
        : '<span class="badge badge-cancelada">Inactivo</span>';
    const rows = items.map(v => `
        <tr>
            <td>${utils.escapeHtml(v.placa ?? '—')}</td>
            <td>${utils.escapeHtml(v.marca ?? '—')} ${utils.escapeHtml(v.modelo ?? '')}</td>
            <td>${utils.escapeHtml(String(v.anio ?? '—'))}</td>
            <td>${utils.escapeHtml(v.color ?? '—')}</td>
            <td>${utils.escapeHtml(v.vin ?? '—')}</td>
            <td>${utils.escapeHtml(String(v.kilometrajeActual ?? 0))}</td>
            <td>${estadoBadge(v.activo)}</td>
        </tr>`).join('');
    container.innerHTML = `<table class="data-table"><thead><tr>
        <th>Placa</th><th>Marca / Modelo</th><th>Año</th><th>Color</th><th>VIN</th><th>Km</th><th>Estado</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPagination(el, page, size, total, onChange) {
    if (!el) return;
    const totalPages = Math.max(1, Math.ceil(total / size));
    el.innerHTML = `<span>${total} registros · Página ${page} de ${totalPages}</span>
    <div class="pagination-actions">
        <button class="btn-dashboard" data-page="${page-1}" ${page<=1?'disabled':''}>Anterior</button>
        <button class="btn-dashboard" data-page="${page+1}" ${page>=totalPages?'disabled':''}>Siguiente</button>
    </div>`;
    el.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => {
        const next = parseInt(btn.dataset.page, 10);
        if (next >= 1 && next <= totalPages) onChange(next);
    }));
}
