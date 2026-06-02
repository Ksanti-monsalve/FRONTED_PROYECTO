document.addEventListener('DOMContentLoaded', () => {
    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'presupuestos' });
    if (!ctx) return;
    const { api, utils } = ctx;
    const container = document.getElementById('table-container');
    const messageEl = document.getElementById('page-message');
    const paginationEl = document.getElementById('pagination-bar');
    const reloadBtn = document.getElementById('btn-reload');
    let currentPage = 1;
    const pageSize = window.APP_CONFIG?.pagination?.defaultPageSize ?? 20;

    const ESTADO_MAP = { 0:'Borrador', 1:'En Revisión', 2:'Aprobado Jefe', 3:'Aprobado Cliente', 4:'Rechazado', 5:'Completado' };
    const BADGE_MAP = { 0:'badge-pendiente', 1:'badge-proceso', 2:'badge-aprobada', 3:'badge-finalizada', 4:'badge-cancelada', 5:'badge-ok' };

    async function load() {
        utils.setLoading(container, true);
        try {
            const { items, total } = await api.presupuestos.list({ pagina: currentPage, tamano: pageSize });
            renderTable(container, items, utils);
            renderPagination(paginationEl, currentPage, pageSize, total, p => { currentPage = p; load(); });
        } catch (err) {
            container.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    function renderTable(container, items, utils) {
        if (!items?.length) { container.innerHTML = '<p class="table-empty">No hay presupuestos registrados.</p>'; return; }
        const rows = items.map(p => {
            const estado = p.estado ?? p.Estado ?? 0;
            const badge = BADGE_MAP[estado] ?? 'badge-pendiente';
            const estadoLabel = ESTADO_MAP[estado] ?? String(estado);
            return `<tr>
                <td>${utils.escapeHtml(p.numeroMiniOrden ?? p.id ?? '—')}</td>
                <td>${utils.escapeHtml(p.numeroOrden ?? '—')}</td>
                <td>${utils.escapeHtml(p.descripcion ?? '—')}</td>
                <td><span class="badge ${badge}">${estadoLabel}</span></td>
                <td>$${Number(p.total ?? 0).toLocaleString('es-CO')}</td>
                <td>${utils.formatDate(p.creadoEn)}</td>
            </tr>`;
        }).join('');
        container.innerHTML = `<table class="data-table"><thead><tr>
            <th>N° Presupuesto</th><th>Orden</th><th>Descripción</th><th>Estado</th><th>Total</th><th>Fecha</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
    }

    function renderPagination(el, page, size, total, onChange) {
        if (!el) return;
        const totalPages = Math.max(1, Math.ceil(total / size));
        el.innerHTML = `<span>${total} presupuestos</span>
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
