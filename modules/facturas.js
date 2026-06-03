document.addEventListener('DOMContentLoaded', () => {
    // RecepcionOnly + Reportes: Admin, Recepcionista, JefeTaller, JefeAlmacen, JefeBodega
    if (!window.AppAuth?.requireRole('admin', 'recep', 'jefetaller', 'almacen', 'bodega')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'facturas' });
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
            const { items, total } = await api.facturas.list({ pagina: currentPage, tamano: pageSize });
            renderTable(container, items, utils);
            renderPagination(paginationEl, currentPage, pageSize, total, p => { currentPage = p; load(); });
        } catch (err) {
            container.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    function renderTable(container, items, utils) {
        if (!items?.length) { container.innerHTML = '<p class="table-empty">No hay facturas registradas.</p>'; return; }
        const rows = items.map(f => `<tr>
            <td>${utils.escapeHtml(f.numeroFactura ?? f.numero ?? '—')}</td>
            <td>${utils.escapeHtml(f.clienteNombre ?? f.cliente ?? '—')}</td>
            <td>${utils.escapeHtml(f.ordenNumero ?? f.numeroOrden ?? '—')}</td>
            <td>$${Number(f.subtotal ?? 0).toLocaleString('es-CO')}</td>
            <td>$${Number(f.impuestos ?? 0).toLocaleString('es-CO')}</td>
            <td>$${Number(f.total ?? 0).toLocaleString('es-CO')}</td>
            <td>${utils.escapeHtml(f.metodoPago ?? f.metodo ?? '—')}</td>
            <td>${utils.formatDate(f.creadoEn ?? f.fechaEmision)}</td>
        </tr>`).join('');
        container.innerHTML = `<table class="data-table"><thead><tr>
            <th>N° Factura</th><th>Cliente</th><th>Orden</th><th>Subtotal</th><th>IVA</th><th>Total</th><th>Método Pago</th><th>Fecha</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
    }

    function renderPagination(el, page, size, total, onChange) {
        if (!el) return;
        const totalPages = Math.max(1, Math.ceil(total / size));
        el.innerHTML = `<span>${total} facturas</span>
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
