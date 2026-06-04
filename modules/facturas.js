document.addEventListener('DOMContentLoaded', () => {
    // RecepcionOnly + Reportes: Admin, Recepcionista, JefeTaller, JefeAlmacen, JefeBodega
    if (!window.AppAuth?.requireRole('admin', 'recep', 'jefetaller', 'almacen', 'bodega')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'facturas' });
    if (!ctx) return;
    const { api, utils, user } = ctx;
    const roles = user?.roles ?? [];
    const puedeRegistrarPago = utils.hasRole(roles, 'admin', 'recep');

    const container = document.getElementById('table-container');
    const messageEl = document.getElementById('page-message');
    const paginationEl = document.getElementById('pagination-bar');
    const reloadBtn = document.getElementById('btn-reload');
    let currentPage = 1;
    const pageSize = window.APP_CONFIG?.pagination?.defaultPageSize ?? 20;
    let metodosPagoCache = [];

    // ── Solicitudes pendientes de pago (admin/recep) ──────────────────────────
    if (puedeRegistrarPago) {
        const secSol   = document.getElementById('solicitudes-section');
        const conSol   = document.getElementById('solicitudes-container');
        const cntBadge = document.getElementById('solicitudes-count');
        if (secSol) secSol.style.display = '';

        async function cargarSolicitudes() {
            try {
                const { items } = await api.facturas.solicitudesPago({ estado: 'Pendiente', tamano: 50 });
                if (cntBadge) cntBadge.textContent = items.length;
                if (!items.length) {
                    conSol.innerHTML = '<p class="table-empty">Sin solicitudes pendientes.</p>';
                    return;
                }
                conSol.innerHTML = `<table class="data-table"><thead><tr>
                    <th>Factura</th><th>Cliente</th><th>Tipo</th><th style="text-align:right">Monto</th>
                    <th>Fecha</th><th>Obs.</th><th></th>
                </tr></thead><tbody>${items.map(s => `<tr>
                    <td style="color:var(--champagne-gold)">${utils.escapeHtml(s.numeroFactura ?? '—')}</td>
                    <td>${utils.escapeHtml(s.clienteNombre ?? '—')}</td>
                    <td><span class="badge ${s.tipoPago==='Efectivo'?'badge-pendiente':'badge-aprobada'}">${utils.escapeHtml(s.tipoPago)}</span></td>
                    <td style="text-align:right;font-weight:600">$${Number(s.monto).toLocaleString('es-CO')}</td>
                    <td>${utils.formatDate(s.fechaSolicitud)}</td>
                    <td style="font-size:11px;color:var(--text-muted)">${utils.escapeHtml((s.observaciones||'').substring(0,40))}</td>
                    <td>${s.tipoPago === 'Efectivo'
                        ? `<button class="btn-conf-efectivo btn-accion" data-id="${s.id}"
                            style="border-color:#4ade80;color:#4ade80">Confirmar cobro</button>`
                        : `<span style="font-size:10px;color:var(--text-muted)">Procesado auto</span>`}
                    </td>
                </tr>`).join('')}</tbody></table>`;

                conSol.querySelectorAll('.btn-conf-efectivo').forEach(btn =>
                    btn.addEventListener('click', async () => {
                        if (!confirm('¿Confirmar que recibiste el pago en efectivo de este cliente?')) return;
                        try {
                            await api.facturas.confirmarEfectivo(btn.dataset.id, null);
                            utils.setPageMessage(messageEl, 'success', '✓ Pago en efectivo confirmado. Factura marcada como pagada.');
                            await Promise.all([cargarSolicitudes(), load()]);
                        } catch (err) { utils.setPageMessage(messageEl, 'error', err.message); }
                    })
                );
            } catch { conSol.innerHTML = '<p class="table-empty">Error al cargar solicitudes.</p>'; }
        }

        cargarSolicitudes();
        setInterval(cargarSolicitudes, 30000); // auto-refresh cada 30s
    }

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
        const rows = items.map(f => {
            const fid       = f.id ?? f.Id ?? '';
            const subtotal  = Number(f.subtotal  ?? 0);
            const impuestos = Number(f.impuestos ?? 0);
            const descuento = Number(f.descuento ?? 0);
            const total     = Number(f.total     ?? 0);
            const pagada    = f.pagada ?? f.Pagada ?? false;
            const btnPago   = (!pagada && puedeRegistrarPago)
                ? `<button class="btn-pagar btn-accion" data-id="${fid}" data-total="${total}"
                    style="border-color:#4ade80;color:#4ade80;font-size:11px">Registrar Pago</button>`
                : '';
            return `<tr>
                <td style="color:var(--champagne-gold);font-weight:500">${utils.escapeHtml(f.numeroFactura ?? '—')}</td>
                <td>${utils.escapeHtml(f.clienteNombre ?? '—')}</td>
                <td style="color:var(--bronze-gold)">${utils.escapeHtml(
                    (f.numerosOrdenes && f.numerosOrdenes.length > 1)
                        ? `${f.numerosOrdenes.length} órdenes`
                        : (f.numeroOrden ?? f.numerosOrdenes?.[0] ?? '—')
                )}</td>
                <td style="text-align:right">$${subtotal.toLocaleString('es-CO')}</td>
                <td style="text-align:right;color:var(--text-muted)">$${impuestos.toLocaleString('es-CO')}</td>
                ${descuento > 0 ? `<td style="text-align:right;color:#4ade80">-$${descuento.toLocaleString('es-CO')}</td>` : '<td style="text-align:right;color:var(--text-muted)">—</td>'}
                <td style="text-align:right;font-weight:600">$${total.toLocaleString('es-CO')}</td>
                <td>${utils.escapeHtml(f.metodoPago ?? '—')}</td>
                <td><span class="badge ${pagada ? 'badge-finalizada' : 'badge-pendiente'}">${pagada ? 'Pagada' : 'Pendiente'}</span></td>
                <td>${utils.formatDate(f.fechaEmision ?? f.creadoEn)}</td>
                <td>${btnPago}</td>
            </tr>`;
        }).join('');
        container.innerHTML = `<table class="data-table"><thead><tr>
            <th>N° Factura</th><th>Cliente</th><th>Orden</th>
            <th style="text-align:right">Subtotal</th>
            <th style="text-align:right">IVA 19%</th>
            <th style="text-align:right">Descuento</th>
            <th style="text-align:right">Total</th>
            <th>Método Pago</th><th>Estado</th><th>Fecha</th><th></th>
        </tr></thead><tbody>${rows}</tbody></table>`;

        // Evento botón pagar
        container.querySelectorAll('.btn-pagar').forEach(btn =>
            btn.addEventListener('click', () => abrirModalPago(btn.dataset.id, Number(btn.dataset.total)))
        );
    }

    // ── Modal Registrar Pago ──────────────────────────────────────────────────
    const modalPago = document.getElementById('modal-pago');
    let facturaIdPago = null;

    async function abrirModalPago(facturaId, totalFactura) {
        facturaIdPago = facturaId;
        document.getElementById('pago-monto').value = totalFactura;
        document.getElementById('pago-referencia').value = '';
        modalPago.classList.add('open');

        // Cargar métodos de pago del catálogo si no están en caché
        if (!metodosPagoCache.length) {
            try {
                const resp = await api.catalogos.metodosPago();
                metodosPagoCache = Array.isArray(resp?.data ?? resp) ? (resp?.data ?? resp) : [];
            } catch { metodosPagoCache = []; }
        }

        const sel = document.getElementById('pago-metodo');
        sel.innerHTML = metodosPagoCache.length
            ? metodosPagoCache.map(m => `<option value="${m.id ?? m.Id}">${utils.escapeHtml(m.nombre ?? m.Nombre ?? '')}</option>`).join('')
            : '<option value="">Sin métodos disponibles</option>';
    }

    document.getElementById('pago-close')?.addEventListener('click', () => modalPago.classList.remove('open'));
    document.getElementById('pago-cancel')?.addEventListener('click', () => modalPago.classList.remove('open'));
    modalPago?.addEventListener('click', e => { if (e.target === modalPago) modalPago.classList.remove('open'); });

    document.getElementById('btn-confirmar-pago')?.addEventListener('click', async () => {
        const metodoPagoId = document.getElementById('pago-metodo').value;
        const monto        = parseFloat(document.getElementById('pago-monto').value);
        const referencia   = document.getElementById('pago-referencia').value.trim() || null;

        if (!metodoPagoId || isNaN(monto) || monto <= 0) {
            alert('Selecciona un método de pago y un monto válido.');
            return;
        }

        const btn = document.getElementById('btn-confirmar-pago');
        btn.disabled = true; btn.textContent = 'Procesando...';
        try {
            const resp = await api.facturas.pagar(facturaIdPago, metodoPagoId, monto, referencia);
            const f = resp?.data ?? resp;
            modalPago.classList.remove('open');
            utils.setPageMessage(messageEl, 'success',
                `✓ Pago de $${Number(f?.total ?? monto).toLocaleString('es-CO')} registrado con ${f?.metodoPago ?? 'éxito'}.`);
            currentPage = 1; load();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
            modalPago.classList.remove('open');
        } finally {
            btn.disabled = false; btn.textContent = 'Confirmar Pago';
        }
    });

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
