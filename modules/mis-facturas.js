document.addEventListener('DOMContentLoaded', () => {
    if (!window.AppAuth?.requireRole('cliente', 'admin', 'recep')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'mis-facturas' });
    if (!ctx) return;
    const { api, utils } = ctx;

    const container  = document.getElementById('table-container');
    const messageEl  = document.getElementById('page-message');
    const reloadBtn  = document.getElementById('btn-reload');
    let currentPage  = 1;
    const pageSize   = 10;

    // ── Cargar facturas del cliente ────────────────────────────────────────────

    async function load() {
        utils.setLoading(container, true);
        utils.setPageMessage(messageEl, 'info', '');
        try {
            const { items, total } = await api.facturas.misFacturas({ pagina: currentPage, tamano: pageSize });
            renderTable(items);
            renderPag(total);
        } catch (err) {
            container.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    function renderTable(items) {
        if (!items?.length) {
            container.innerHTML = '<p class="table-empty">No tienes facturas registradas aún.</p>';
            return;
        }
        const rows = items.map(f => {
            const pagada = f.pagada ?? f.Pagada ?? false;
            const total  = Number(f.total ?? 0);
            const fid    = f.id ?? f.Id ?? '';
            return `<tr>
                <td style="color:var(--champagne-gold);font-weight:500">${utils.escapeHtml(f.numeroFactura ?? '—')}</td>
                <td style="color:var(--bronze-gold)">${utils.escapeHtml(f.numeroOrden ?? '—')}</td>
                <td style="text-align:right">$${Number(f.subtotal ?? 0).toLocaleString('es-CO')}</td>
                <td style="text-align:right;color:var(--text-muted)">$${Number(f.impuestos ?? 0).toLocaleString('es-CO')}</td>
                <td style="text-align:right;font-weight:600">$${total.toLocaleString('es-CO')}</td>
                <td>${utils.escapeHtml(f.metodoPago ?? '—')}</td>
                <td><span class="badge ${pagada ? 'badge-pagada' : 'badge-pendiente'}">${pagada ? '✓ Pagada' : 'Pendiente'}</span></td>
                <td>${utils.formatDate(f.fechaEmision ?? f.creadoEn)}</td>
                <td>${!pagada
                    ? `<button class="btn-pagar-cli btn-dashboard btn-dashboard-primary"
                        data-id="${fid}" data-num="${utils.escapeHtml(f.numeroFactura ?? '')}" data-total="${total}"
                        style="font-size:11px;padding:4px 14px;">Pagar</button>`
                    : '<span style="color:var(--text-muted);font-size:11px">—</span>'}</td>
            </tr>`;
        }).join('');

        container.innerHTML = `<table class="data-table"><thead><tr>
            <th>N° Factura</th><th>Orden</th>
            <th style="text-align:right">Subtotal</th>
            <th style="text-align:right">IVA</th>
            <th style="text-align:right">Total</th>
            <th>Método</th><th>Estado</th><th>Fecha</th><th></th>
        </tr></thead><tbody>${rows}</tbody></table>`;

        container.querySelectorAll('.btn-pagar-cli').forEach(btn =>
            btn.addEventListener('click', () =>
                abrirMetodoPago(btn.dataset.id, btn.dataset.num, Number(btn.dataset.total))
            )
        );
    }

    function renderPag(total) {
        const paginEl = document.getElementById('pagination-bar');
        if (!paginEl) return;
        const tp = Math.max(1, Math.ceil(total / pageSize));
        paginEl.innerHTML = `<span>${total} factura(s)</span>
            <div class="pagination-actions">
                <button class="btn-dashboard" data-p="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
                <button class="btn-dashboard" data-p="${currentPage + 1}" ${currentPage >= tp ? 'disabled' : ''}>Siguiente</button>
            </div>`;
        paginEl.querySelectorAll('[data-p]').forEach(btn =>
            btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.p); load(); })
        );
    }

    reloadBtn?.addEventListener('click', () => { currentPage = 1; load(); });
    load();

    // ════════════════════════════════════════════════════════════════════════
    //  FLUJO DE PAGO
    // ════════════════════════════════════════════════════════════════════════

    let pagoFacturaId  = null;
    let pagoFacturaNum = '';
    let pagoTotal      = 0;

    // ── Modal: Selección de método ────────────────────────────────────────────
    const modalMetodo   = document.getElementById('modal-metodo');
    const modalEfectivo = document.getElementById('modal-efectivo');
    const modalTarjeta  = document.getElementById('modal-tarjeta');
    const modalPse      = document.getElementById('modal-pse');
    const modalToken    = document.getElementById('modal-token');

    function abrirMetodoPago(fid, fnum, ftotal) {
        pagoFacturaId  = fid;
        pagoFacturaNum = fnum;
        pagoTotal      = ftotal;
        document.getElementById('metodo-factura-num').textContent = fnum;
        document.getElementById('metodo-total').textContent = `$${ftotal.toLocaleString('es-CO')}`;
        modalMetodo.classList.add('open');
    }

    const cerrar = (m) => m?.classList.remove('open');

    document.getElementById('metodo-close')?.addEventListener('click', () => cerrar(modalMetodo));
    modalMetodo?.addEventListener('click', e => { if (e.target === modalMetodo) cerrar(modalMetodo); });

    document.getElementById('btn-metodo-efectivo')?.addEventListener('click', () => {
        cerrar(modalMetodo);
        document.getElementById('efectivo-monto').textContent = `$${pagoTotal.toLocaleString('es-CO')}`;
        document.getElementById('efectivo-obs').value = '';
        modalEfectivo.classList.add('open');
    });
    document.getElementById('btn-metodo-tarjeta')?.addEventListener('click', () => {
        cerrar(modalMetodo);
        resetTarjeta();
        document.getElementById('tarjeta-total').textContent = `$${pagoTotal.toLocaleString('es-CO')}`;
        modalTarjeta.classList.add('open');
    });
    document.getElementById('btn-metodo-pse')?.addEventListener('click', () => {
        cerrar(modalMetodo);
        document.getElementById('pse-total').textContent = `$${pagoTotal.toLocaleString('es-CO')}`;
        document.getElementById('pse-doc').value = '';
        document.querySelectorAll('.bank-item').forEach(b => b.classList.remove('selected'));
        modalPse.classList.add('open');
    });

    // ── Efectivo ──────────────────────────────────────────────────────────────
    document.getElementById('efectivo-close')?.addEventListener('click', () => cerrar(modalEfectivo));
    document.getElementById('efectivo-cancel')?.addEventListener('click', () => cerrar(modalEfectivo));
    modalEfectivo?.addEventListener('click', e => { if (e.target === modalEfectivo) cerrar(modalEfectivo); });

    document.getElementById('btn-confirmar-efectivo')?.addEventListener('click', async () => {
        const obs = document.getElementById('efectivo-obs').value.trim() || null;
        const btn = document.getElementById('btn-confirmar-efectivo');
        btn.disabled = true; btn.textContent = 'Enviando...';
        try {
            await api.facturas.iniciarPago(pagoFacturaId, 'Efectivo', null, obs);
            cerrar(modalEfectivo);
            mostrarToken('efectivo', null, obs);
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
            cerrar(modalEfectivo);
        } finally { btn.disabled = false; btn.textContent = 'Enviar solicitud'; }
    });

    // ── Tarjeta ───────────────────────────────────────────────────────────────
    document.getElementById('tarjeta-close')?.addEventListener('click', () => cerrar(modalTarjeta));
    document.getElementById('tarjeta-cancel')?.addEventListener('click', () => cerrar(modalTarjeta));
    modalTarjeta?.addEventListener('click', e => { if (e.target === modalTarjeta) cerrar(modalTarjeta); });

    function resetTarjeta() {
        ['card-numero','card-nombre','card-exp','card-cvv'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        document.getElementById('card-num-display').textContent  = '•••• •••• •••• ••••';
        document.getElementById('card-name-display').textContent = 'NOMBRE APELLIDO';
        document.getElementById('card-exp-display').textContent  = 'MM/AA';
    }

    // Actualizar preview de tarjeta en tiempo real
    document.getElementById('card-numero')?.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g,'').substring(0,16);
        e.target.value = v.replace(/(.{4})/g,'$1 ').trim();
        document.getElementById('card-num-display').textContent =
            (v + '•'.repeat(16-v.length)).replace(/(.{4})/g,'$1 ').trim();
    });
    document.getElementById('card-nombre')?.addEventListener('input', e => {
        document.getElementById('card-name-display').textContent =
            (e.target.value.toUpperCase() || 'NOMBRE APELLIDO').substring(0, 25);
    });
    document.getElementById('card-exp')?.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g,'');
        if (v.length >= 3) v = v.substring(0,2) + '/' + v.substring(2,4);
        e.target.value = v;
        document.getElementById('card-exp-display').textContent = v || 'MM/AA';
    });

    document.getElementById('btn-pagar-tarjeta')?.addEventListener('click', async () => {
        const numero = document.getElementById('card-numero').value.replace(/\s/g,'');
        const nombre = document.getElementById('card-nombre').value.trim();
        const exp    = document.getElementById('card-exp').value.trim();
        const cvv    = document.getElementById('card-cvv').value.trim();

        if (numero.length < 13 || !nombre || exp.length < 5 || cvv.length < 3) {
            alert('Completa todos los datos de la tarjeta correctamente.'); return;
        }

        const btn = document.getElementById('btn-pagar-tarjeta');
        btn.disabled = true; btn.textContent = 'Procesando...';

        // Simular procesamiento (1.5s)
        await new Promise(r => setTimeout(r, 1500));

        try {
            const ultimos4 = numero.slice(-4);
            const resp = await api.facturas.iniciarPago(
                pagoFacturaId, 'Tarjeta', `****${ultimos4}`, `Titular: ${nombre}`
            );
            cerrar(modalTarjeta);
            mostrarToken('tarjeta', resp?.data?.token ?? resp?.token, `****${ultimos4}`);
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
            cerrar(modalTarjeta);
        } finally { btn.disabled = false; btn.textContent = 'Pagar ahora'; }
    });

    // ── PSE ───────────────────────────────────────────────────────────────────
    document.getElementById('pse-close')?.addEventListener('click', () => cerrar(modalPse));
    document.getElementById('pse-cancel')?.addEventListener('click', () => cerrar(modalPse));
    modalPse?.addEventListener('click', e => { if (e.target === modalPse) cerrar(modalPse); });

    let bancoSeleccionado = '';
    document.querySelectorAll('.bank-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.bank-item').forEach(b => b.classList.remove('selected'));
            item.classList.add('selected');
            bancoSeleccionado = item.dataset.banco;
        });
    });

    document.getElementById('btn-pagar-pse')?.addEventListener('click', async () => {
        if (!bancoSeleccionado) { alert('Selecciona un banco.'); return; }
        const doc = document.getElementById('pse-doc').value.trim();
        if (!doc) { alert('Ingresa tu número de documento.'); return; }
        const tipo = document.getElementById('pse-tipo-persona').value;
        const tdoc = document.getElementById('pse-tipo-doc').value;

        const btn = document.getElementById('btn-pagar-pse');
        btn.disabled = true; btn.textContent = 'Conectando con el banco...';

        // Simular redirección bancaria (2s)
        await new Promise(r => setTimeout(r, 2000));

        try {
            const ref = `${bancoSeleccionado} · ${tdoc} ${doc} · ${tipo}`;
            const resp = await api.facturas.iniciarPago(pagoFacturaId, 'PSE', bancoSeleccionado, ref);
            cerrar(modalPse);
            mostrarToken('pse', resp?.data?.token ?? resp?.token, bancoSeleccionado);
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
            cerrar(modalPse);
        } finally { btn.disabled = false; btn.textContent = 'Continuar al banco'; }
    });

    // ── Modal Token / Confirmación ────────────────────────────────────────────
    document.getElementById('token-close')?.addEventListener('click', () => cerrar(modalToken));
    document.getElementById('token-ok')?.addEventListener('click',    () => { cerrar(modalToken); load(); });
    modalToken?.addEventListener('click', e => { if (e.target === modalToken) cerrar(modalToken); });

    function mostrarToken(tipo, token, referencia) {
        const tituloEl  = document.getElementById('token-titulo');
        const contentEl = document.getElementById('token-content');

        if (tipo === 'efectivo') {
            tituloEl.innerHTML = '✓ Solicitud enviada <button class="modal-close" id="token-close2">✕</button>';
            contentEl.innerHTML = `
                <div class="efectivo-info" style="text-align:left">
                    <p style="font-size:13px;color:var(--text-ivory);margin-bottom:8px">
                        Tu solicitud de pago en <strong>efectivo</strong> fue enviada correctamente.
                    </p>
                    <p style="color:var(--text-muted);font-size:12px">
                        Dirígete a la recepción del taller con el monto exacto:
                    </p>
                    <div class="monto">$${pagoTotal.toLocaleString('es-CO')}</div>
                    <p style="color:var(--text-muted);font-size:11px">
                        La factura aparecerá como pagada una vez el recepcionista confirme el pago.
                    </p>
                    ${referencia ? `<p style="font-size:11px;color:var(--text-muted)">Nota: ${utils.escapeHtml(referencia)}</p>` : ''}
                </div>`;
        } else {
            const icono = tipo === 'tarjeta' ? '💳' : '🏦';
            const medio = tipo === 'tarjeta' ? 'Tarjeta' : 'PSE / Banco';
            tituloEl.innerHTML = `✓ Pago aprobado <button class="modal-close" id="token-close2">✕</button>`;
            contentEl.innerHTML = `
                <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
                    ${icono} Tu pago con <strong style="color:var(--text-ivory)">${medio}</strong> fue procesado exitosamente.
                </p>
                <div class="token-display">
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;letter-spacing:.1em">NÚMERO DE APROBACIÓN</div>
                    <div class="token-code">${utils.escapeHtml(token ?? 'N/A')}</div>
                    <div style="font-size:11px;color:var(--text-muted)">Guarda este código como comprobante de pago</div>
                </div>
                ${referencia ? `<p style="font-size:12px;color:var(--text-muted)">Medio: ${utils.escapeHtml(referencia)}</p>` : ''}
                <p style="font-size:12px;color:var(--text-muted)">Total cobrado: <strong style="color:var(--champagne-gold)">$${pagoTotal.toLocaleString('es-CO')}</strong></p>`;
        }

        document.getElementById('token-close2')?.addEventListener('click', () => { cerrar(modalToken); load(); });
        modalToken.classList.add('open');
    }
});
