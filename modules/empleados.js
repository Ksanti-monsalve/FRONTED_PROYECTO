document.addEventListener('DOMContentLoaded', () => {
    // AdminOnly/JefeTallerOnly: solo Admin y JefeTaller gestionan empleados
    if (!window.AppAuth?.requireRole('admin', 'jefetaller')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'empleados' });
    if (!ctx) return;
    const { api, utils } = ctx;
    const container = document.getElementById('table-container');
    const messageEl = document.getElementById('page-message');
    const paginationEl = document.getElementById('pagination-bar');
    const reloadBtn = document.getElementById('btn-reload');
    let currentPage = 1;
    const pageSize = 50;

    const TIPO_MAP = { 0:'Mecánico', 1:'Eléctrico', 2:'Administrador', 3:'Recepcionista', 4:'Jefe Taller', 5:'Mecánico Diagnóstico', 6:'Mecánico Área', 7:'Jefe Almacén', 8:'Jefe Bodega' };

    async function load() {
        utils.setLoading(container, true);
        try {
            const { items, total } = await api.empleados.list({ pagina: currentPage, tamano: pageSize });
            renderTable(container, items, utils);
            renderPagination(paginationEl, currentPage, pageSize, total, p => { currentPage = p; load(); });
        } catch (err) {
            container.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    function renderTable(container, items, utils) {
        if (!items?.length) { container.innerHTML = '<p class="table-empty">No hay empleados registrados.</p>'; return; }
        const rows = items.map(e => `<tr>
            <td>${utils.escapeHtml(e.nombres ?? '')} ${utils.escapeHtml(e.apellidos ?? '')}</td>
            <td>${utils.escapeHtml(TIPO_MAP[e.tipoEmpleado] ?? String(e.tipoEmpleado))}</td>
            <td>${utils.escapeHtml(e.especialidad ?? '—')}</td>
            <td>${utils.escapeHtml(e.telefono ?? '—')}</td>
            <td>${utils.escapeHtml(e.email ?? '—')}</td>
            <td>${e.activo !== false ? '<span class="badge badge-ok">Activo</span>' : '<span class="badge badge-cancelada">Inactivo</span>'}</td>
        </tr>`).join('');
        container.innerHTML = `<table class="data-table"><thead><tr>
            <th>Nombre</th><th>Tipo</th><th>Especialidad</th><th>Teléfono</th><th>Email</th><th>Estado</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
    }

    function renderPagination(el, page, size, total, onChange) {
        if (!el) return;
        const totalPages = Math.max(1, Math.ceil(total / size));
        el.innerHTML = `<span>${total} empleados</span>
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
