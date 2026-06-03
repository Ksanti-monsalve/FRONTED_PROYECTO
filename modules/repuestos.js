document.addEventListener('DOMContentLoaded', () => {
    // AlmacenOTaller: Admin, JefeTaller, JefeAlmacen, JefeBodega, Mecánico (y subtipos)
    if (!window.AppAuth?.requireRole('admin', 'jefetaller', 'almacen', 'bodega', 'mecan')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'repuestos' });
    if (!ctx) return;

    const { api, utils, user } = ctx;
    const container = document.getElementById('table-container');
    const criticalContainer = document.getElementById('critical-container');
    const messageEl = document.getElementById('page-message');
    const reloadBtn = document.getElementById('btn-reload');

    const pageSize = window.APP_CONFIG?.pagination?.defaultPageSize ?? 20;
    const canCritical = utils.hasRole(user?.roles, 'admin', 'jefetaller', 'almacen', 'bodega', 'mecan');
    const canCreate   = utils.hasRole(user?.roles, 'admin', 'recep');

    // Mostrar botón crear solo para Admin y Recepcionista
    if (canCreate) document.getElementById('btn-nuevo-repuesto').style.display = '';

    async function load() {
        utils.setLoading(container, true);
        utils.setPageMessage(messageEl, 'info', '');

        try {
            const listPromise = api.repuestos.list({ pagina: 1, tamano: pageSize });
            const criticalPromise = canCritical
                ? api.repuestos.stockCritico().catch(() => [])
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

    // ── Modal Nuevo Repuesto ──────────────────────────────────────────────────
    if (canCreate) {
        const modal = document.getElementById('modal-nuevo-repuesto');
        let categoriasCache = [];

        let tiposServCache = [];

        async function abrirModalRepuesto() {
            ['rep-codigo','rep-nombre','rep-descripcion','rep-unidad'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            document.getElementById('rep-precio-compra').value = '';
            document.getElementById('rep-precio-venta').value  = '';
            document.getElementById('rep-stock-actual').value  = '0';
            document.getElementById('rep-stock-minimo').value  = '1';
            modal.classList.add('open');

            // Cargar categorías y tipos de servicio en paralelo
            const [cats, tipos] = await Promise.all([
                categoriasCache.length ? Promise.resolve(categoriasCache) :
                    api.catalogos.categoriasRepuesto().then(r => {
                        categoriasCache = Array.isArray(r?.data ?? r) ? (r?.data ?? r) : [];
                        return categoriasCache;
                    }).catch(() => []),
                tiposServCache.length ? Promise.resolve(tiposServCache) :
                    api.catalogos.tiposServicio().then(r => {
                        tiposServCache = Array.isArray(r?.data ?? r) ? (r?.data ?? r) : [];
                        return tiposServCache;
                    }).catch(() => []),
            ]);

            const selCat = document.getElementById('rep-categoria');
            selCat.innerHTML = '<option value="">— Seleccionar categoría —</option>' +
                cats.map(c => `<option value="${c.id??c.Id}">${utils.escapeHtml(c.nombre??c.Nombre??'')}</option>`).join('');

            const selTipo = document.getElementById('rep-tipo-servicio');
            selTipo.innerHTML = '<option value="">General (aplica a todos)</option>' +
                tipos.map(t => `<option value="${t.id??t.Id}">${utils.escapeHtml(t.nombre??t.Nombre??'')}</option>`).join('');
        }

        document.getElementById('btn-nuevo-repuesto')?.addEventListener('click', abrirModalRepuesto);
        document.getElementById('rep-close')?.addEventListener('click', () => modal.classList.remove('open'));
        document.getElementById('rep-cancel')?.addEventListener('click', () => modal.classList.remove('open'));
        modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

        document.getElementById('rep-guardar')?.addEventListener('click', async () => {
            const codigo      = document.getElementById('rep-codigo').value.trim();
            const nombre      = document.getElementById('rep-nombre').value.trim();
            const descripcion = document.getElementById('rep-descripcion').value.trim() || null;
            const categoriaId = document.getElementById('rep-categoria').value;
            const precioC     = parseFloat(document.getElementById('rep-precio-compra').value);
            const precioV     = parseFloat(document.getElementById('rep-precio-venta').value);
            const stockAct    = parseInt(document.getElementById('rep-stock-actual').value);
            const stockMin    = parseInt(document.getElementById('rep-stock-minimo').value);
            const unidad      = document.getElementById('rep-unidad').value.trim() || null;

            if (!codigo || !nombre || !categoriaId || isNaN(precioC) || isNaN(precioV) || isNaN(stockAct) || isNaN(stockMin)) {
                alert('Completa todos los campos obligatorios (*).');
                return;
            }

            const tipoServId = document.getElementById('rep-tipo-servicio')?.value || null;

            try {
                document.getElementById('rep-guardar').disabled = true;
                document.getElementById('rep-guardar').textContent = 'Guardando...';
                await api.repuestos.create({
                    Codigo: codigo, Nombre: nombre, Descripcion: descripcion,
                    CategoriaRepuestoId: categoriaId,
                    TipoServicioId: tipoServId || null,
                    PrecioCompra: precioC, PrecioVenta: precioV,
                    StockActual: stockAct, StockMinimo: stockMin,
                    Unidad: unidad,
                });
                modal.classList.remove('open');
                utils.setPageMessage(messageEl, 'success', `✓ Repuesto "${nombre}" creado exitosamente.`);
                load();
            } catch (err) {
                utils.setPageMessage(messageEl, 'error', err.message);
                modal.classList.remove('open');
            } finally {
                document.getElementById('rep-guardar').disabled = false;
                document.getElementById('rep-guardar').textContent = 'Guardar Repuesto';
            }
        });
    }
});

function renderTable(container, items, utils) {
    if (!items?.length) {
        container.innerHTML = '<p class="table-empty">No hay repuestos en inventario.</p>';
        return;
    }

    const rows = items.map((r) => {
        const stock = r.stockActual ?? r.cantidadStock ?? 0;
        const minimo = r.stockMinimo ?? 0;
        const critico = stock <= minimo;
        const precio = r.precioVenta ?? r.precioUnitario ?? r.precioCompra ?? 0;
        return `
        <tr class="${critico ? 'row-warning' : ''}">
            <td>${utils.escapeHtml(r.codigo ?? '—')}</td>
            <td>${utils.escapeHtml(r.nombre ?? r.descripcion ?? '—')}</td>
            <td>${utils.escapeHtml(r.categoria ?? '—')}</td>
            <td>${utils.escapeHtml(String(stock))} / ${utils.escapeHtml(String(minimo))}</td>
            <td>$${Number(precio).toLocaleString('es-CO')}</td>
            <td>${critico ? 'Crítico' : 'OK'}</td>
        </tr>
    `}).join('');

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
            ${list.map((r) => {
                const stock = r.stockActual ?? r.cantidadStock ?? 0;
                const min   = r.stockMinimo ?? 0;
                return `
                <li>
                    <strong>${utils.escapeHtml(r.codigo ?? '—')}</strong>
                    — ${utils.escapeHtml(r.nombre ?? r.descripcion ?? '—')}
                    <span>(${utils.escapeHtml(String(stock))} / mín ${utils.escapeHtml(String(min))})</span>
                </li>
            `}).join('')}
        </ul>
    `;
}
