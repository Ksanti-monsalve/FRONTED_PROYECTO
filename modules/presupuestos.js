document.addEventListener('DOMContentLoaded', () => {
    if (!window.AppAuth?.requireRole('admin', 'mecan', 'jefetaller', 'recep', 'cliente')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'presupuestos' });
    if (!ctx) return;

    const { api, utils, user } = ctx;
    const roles = user?.roles ?? [];

    // ── Permisos ──────────────────────────────────────────────────────────────
    const esMecanico  = utils.hasRole(roles, 'mecan');
    const esJefe      = utils.hasRole(roles, 'jefetaller');
    const esCliente   = utils.hasRole(roles, 'cliente');
    const esAdmin     = utils.hasRole(roles, 'admin');
    const esRecep     = utils.hasRole(roles, 'recep');

    // Admin, JefeTaller y Mecánicos pueden crear mini-órdenes (MecanicoOnly policy)
    const puedeCriar  = esAdmin || esJefe || esMecanico;
    // Admin y Jefe pueden aprobar directamente como Jefe (JefeTallerOnly policy)
    const puedeAprJefe = esAdmin || esJefe;
    // Admin, Recep y Cliente pueden aprobar como cliente (ClienteOrAdmin policy)
    const puedeAprCli = esAdmin || esRecep || esCliente;

    // ── Vista: cliente tiene portal de tarjetas; staff tiene tabla ────────────
    const vistaStaff   = document.getElementById('vista-staff');
    const vistaCliente = document.getElementById('vista-cliente');

    if (esCliente && !esAdmin && !esRecep && !esJefe && !esMecanico) {
        document.getElementById('page-title').textContent = 'Mis Servicios Pendientes';
        vistaCliente.style.display = '';
        iniciarPortalCliente();
    } else {
        vistaStaff.style.display = '';
        iniciarVistaStaff();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PORTAL DEL CLIENTE — tarjetas por servicio
    // ════════════════════════════════════════════════════════════════════════

    function iniciarPortalCliente() { cargarServiciosCliente(); }

    let serviciosState = {};  // { [id]: { id, decision: 'si'|'no'|null, data } }

    async function cargarServiciosCliente() {
        const loading = document.getElementById('portal-loading');
        const vacio   = document.getElementById('portal-vacio');
        const grid    = document.getElementById('servicios-grid');
        const resumen = document.getElementById('portal-resumen');
        const msgEl   = document.getElementById('page-message');

        loading.style.display = ''; vacio.style.display = 'none';
        grid.style.display    = 'none'; resumen.style.display = 'none';
        utils.setPageMessage(msgEl, 'info', '');

        try {
            const { items } = await api.presupuestos.list({ tamano: 50, estado: 3 });
            loading.style.display = 'none';

            if (!items?.length) { vacio.style.display = ''; return; }

            serviciosState = {};
            items.forEach(p => { serviciosState[p.id ?? p.Id] = { id: p.id ?? p.Id, decision: null, data: p }; });

            grid.innerHTML = '';
            items.forEach(p => grid.appendChild(crearTarjetaServicio(p.id ?? p.Id, p)));
            grid.style.display = ''; resumen.style.display = '';
            actualizarResumen();
        } catch (err) {
            loading.style.display = 'none';
            utils.setPageMessage(msgEl, 'error', `No se pudieron cargar los servicios: ${err.message}`);
        }
    }

    function crearTarjetaServicio(id, p) {
        const total    = Number(p.total ?? p.Total ?? 0);
        const mat      = Number(p.totalMateriales ?? p.TotalMateriales ?? 0);
        const mano     = Number(p.totalManoObra   ?? p.TotalManoObra   ?? 0);
        const desc     = p.descripcion ?? p.Descripcion ?? '(sin descripción)';
        const obs      = p.observaciones ?? p.Observaciones ?? '';
        const mecanico = p.mecanicoNombre ?? p.MecanicoNombre ?? 'Taller';
        const detalles = p.detalles   ?? p.Detalles   ?? [];
        const manosObra= p.manosObra  ?? p.ManosObra  ?? [];

        // Tabla de repuestos (visible al cliente)
        const tablaRep = detalles.length ? `
            <div style="margin-bottom:10px">
                <div style="font-size:10px;color:var(--bronze-gold);letter-spacing:.1em;margin-bottom:6px;font-weight:600">REPUESTOS E INSUMOS</div>
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <thead><tr>
                        <th style="text-align:left;color:var(--text-muted);padding:2px 6px;font-weight:500">Repuesto</th>
                        <th style="text-align:center;color:var(--text-muted);padding:2px 6px;font-weight:500">Cant.</th>
                        <th style="text-align:right;color:var(--text-muted);padding:2px 6px;font-weight:500">P. Unit.</th>
                        <th style="text-align:right;color:var(--text-muted);padding:2px 6px;font-weight:500">Subtotal</th>
                    </tr></thead>
                    <tbody>
                    ${detalles.map(d => {
                        const nombre = d.repuestoNombre ?? d.RepuestoNombre ?? '—';
                        const cod    = d.repuestoCodigo ?? d.RepuestoCodigo ?? '';
                        const cant   = d.cantidad ?? d.Cantidad ?? 0;
                        const precio = d.precioUnitario ?? d.PrecioUnitario ?? 0;
                        const sub    = d.subtotal ?? d.Subtotal ?? cant * precio;
                        return `<tr style="border-bottom:1px solid rgba(255,255,255,.04)">
                            <td style="padding:4px 6px">${cod ? `<span style="color:var(--text-muted);font-size:10px">[${utils.escapeHtml(cod)}]</span> ` : ''}${utils.escapeHtml(nombre)}</td>
                            <td style="text-align:center;padding:4px 6px">${cant}</td>
                            <td style="text-align:right;padding:4px 6px">$${Number(precio).toLocaleString('es-CO')}</td>
                            <td style="text-align:right;padding:4px 6px;color:var(--champagne-gold)">$${Number(sub).toLocaleString('es-CO')}</td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table>
            </div>` : '';

        // Tabla de mano de obra
        const tablaMO = manosObra.length ? `
            <div style="margin-bottom:10px">
                <div style="font-size:10px;color:var(--bronze-gold);letter-spacing:.1em;margin-bottom:6px;font-weight:600">MANO DE OBRA</div>
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <tbody>
                    ${manosObra.map(m => {
                        const mdesc  = m.descripcion ?? m.Descripcion ?? '—';
                        const horas  = m.horasTrabajo ?? m.HorasTrabajo ?? 0;
                        const tarifa = m.tarifaHora ?? m.TarifaHora ?? 0;
                        const mtotal = m.total ?? m.Total ?? horas * tarifa;
                        const tec    = m.tecnicoNombre ?? m.TecnicoNombre ?? '';
                        return `<tr style="border-bottom:1px solid rgba(255,255,255,.04)">
                            <td style="padding:4px 6px">${utils.escapeHtml(mdesc)}${tec ? ` <small style="color:var(--text-muted)">(${utils.escapeHtml(tec)})</small>` : ''}</td>
                            <td style="text-align:center;padding:4px 6px">${horas}h</td>
                            <td style="text-align:right;padding:4px 6px">$${Number(tarifa).toLocaleString('es-CO')}/h</td>
                            <td style="text-align:right;padding:4px 6px;color:var(--champagne-gold)">$${Number(mtotal).toLocaleString('es-CO')}</td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table>
            </div>` : '';

        const card = document.createElement('div');
        card.className = 'servicio-card dashboard-card';
        card.dataset.id = id;
        card.innerHTML = `
            <div class="servicio-card-header">
                <div class="servicio-toggle" data-id="${id}">?</div>
                <div class="servicio-info">
                    <div class="servicio-titulo">${utils.escapeHtml(desc.length>90 ? desc.substring(0,90)+'…' : desc)}</div>
                    ${obs ? `<div class="servicio-desc">${utils.escapeHtml(obs)}</div>` : ''}
                </div>
                <div class="servicio-precio">$${total.toLocaleString('es-CO')}</div>
            </div>
            <div class="servicio-detalle-expandible" style="display:none;padding:12px 0 0">
                ${tablaRep}
                ${tablaMO}
                ${(mat>0||mano>0) ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:12px;padding-top:8px;border-top:1px solid var(--gold-border)">
                    ${mat>0 ? `<span style="color:var(--text-muted)">Total materiales</span><span style="text-align:right">$${mat.toLocaleString('es-CO')}</span>` : ''}
                    ${mano>0 ? `<span style="color:var(--text-muted)">Total mano de obra</span><span style="text-align:right">$${mano.toLocaleString('es-CO')}</span>` : ''}
                    <span style="color:var(--text-muted)">Técnico asignado</span><span>${utils.escapeHtml(mecanico)}</span>
                </div>` : ''}
                ${!detalles.length && !manosObra.length ? `<p style="color:var(--text-muted);font-size:12px;font-style:italic">El técnico indicará los materiales a utilizar.</p>` : ''}
            </div>
            <button class="btn-ver-detalle" data-id="${id}"
                style="background:none;border:none;color:var(--bronze-gold);font-size:11px;cursor:pointer;padding:6px 0;text-decoration:underline;">
                ${detalles.length ? `Ver desglose (${detalles.length} repuesto${detalles.length>1?'s':''})` : 'Ver detalle'}
            </button>
            <div class="servicio-decision">
                <button class="btn-si" data-id="${id}">✓ Sí, quiero este servicio</button>
                <button class="btn-no" data-id="${id}">✗ No, cancelar este servicio</button>
            </div>`;

        card.querySelector('.btn-si').addEventListener('click', () => setDecision(id, 'si'));
        card.querySelector('.btn-no').addEventListener('click', () => setDecision(id, 'no'));
        card.querySelector('.btn-ver-detalle').addEventListener('click', () => {
            const panel = card.querySelector('.servicio-detalle-expandible');
            const btn   = card.querySelector('.btn-ver-detalle');
            const open  = panel.style.display !== 'none';
            panel.style.display = open ? 'none' : 'block';
            btn.textContent = open
                ? (detalles.length ? `Ver desglose (${detalles.length} repuesto${detalles.length>1?'s':''})` : 'Ver detalle')
                : 'Ocultar detalle';
        });
        card.querySelector('.servicio-toggle').addEventListener('click', () => {
            const actual = serviciosState[id]?.decision;
            setDecision(id, actual === 'si' ? null : 'si');
        });
        // Si tiene detalles, expandir automáticamente para que el cliente los vea
        if (detalles.length || manosObra.length) {
            card.querySelector('.servicio-detalle-expandible').style.display = 'block';
            card.querySelector('.btn-ver-detalle').textContent = 'Ocultar detalle';
        }
        return card;
    }

    function setDecision(id, decision) {
        if (!serviciosState[id]) return;
        serviciosState[id].decision = decision;
        const card = document.querySelector(`.servicio-card[data-id="${id}"]`);
        card?.classList.toggle('seleccionado',  decision === 'si');
        card?.classList.toggle('rechazado-cli', decision === 'no');
        const toggle = card?.querySelector('.servicio-toggle');
        if (toggle) toggle.textContent = decision==='si' ? '✓' : decision==='no' ? '✗' : '?';
        card?.querySelector('.btn-si')?.classList.toggle('activo', decision === 'si');
        card?.querySelector('.btn-no')?.classList.toggle('activo', decision === 'no');
        actualizarResumen();
    }

    function actualizarResumen() {
        const todos       = Object.values(serviciosState);
        const aprobados   = todos.filter(s => s.decision === 'si');
        const rechazados  = todos.filter(s => s.decision === 'no');
        const pendientes  = todos.filter(s => s.decision === null);
        const total       = aprobados.reduce((sum,s) => sum + Number(s.data.total ?? s.data.Total ?? 0), 0);

        document.getElementById('resumen-total').textContent = `$${total.toLocaleString('es-CO')}`;
        document.getElementById('resumen-info').textContent  =
            `${aprobados.length} aprobado(s) · ${rechazados.length} rechazado(s) · ${pendientes.length} sin decidir`;
        const btn = document.getElementById('btn-confirmar-seleccion');
        const listo = pendientes.length === 0 && todos.length > 0;
        btn.disabled = !listo;
        btn.textContent = listo
            ? `Confirmar — ${aprobados.length} servicio(s) aprobado(s)`
            : `Decide todos los servicios (faltan ${pendientes.length})`;
    }

    document.getElementById('btn-confirmar-seleccion')?.addEventListener('click', () => {
        const todos      = Object.values(serviciosState);
        const aprobados  = todos.filter(s => s.decision === 'si');
        const rechazados = todos.filter(s => s.decision === 'no');
        const total      = aprobados.reduce((s,x) => s + Number(x.data.total ?? x.data.Total ?? 0), 0);
        const resHtml = `
            <div style="background:rgba(255,255,255,.03);border-radius:6px;padding:16px">
                ${aprobados.length>0 ? `<p style="font-size:12px;color:#4ade80;font-weight:600;margin-bottom:8px">✓ Servicios que SÍ quieres (${aprobados.length}):</p>
                <ul style="margin:0 0 12px 16px;font-size:13px;color:var(--text-ivory)">
                    ${aprobados.map(s => `<li>${utils.escapeHtml((s.data.descripcion??s.data.Descripcion??'').substring(0,60))} — <span style="color:var(--champagne-gold)">$${Number(s.data.total??0).toLocaleString('es-CO')}</span></li>`).join('')}
                </ul>` : ''}
                ${rechazados.length>0 ? `<p style="font-size:12px;color:#f87171;font-weight:600;margin-bottom:8px">✗ Servicios que NO quieres (${rechazados.length}):</p>
                <ul style="margin:0 0 12px 16px;font-size:13px;color:var(--text-muted)">
                    ${rechazados.map(s => `<li>${utils.escapeHtml((s.data.descripcion??s.data.Descripcion??'').substring(0,60))}</li>`).join('')}
                </ul>` : ''}
                <div style="border-top:1px solid var(--gold-border);padding-top:10px;font-size:15px;font-weight:600;color:var(--champagne-gold)">Total: $${total.toLocaleString('es-CO')}</div>
            </div>`;
        document.getElementById('confirm-cli-resumen').innerHTML = resHtml;
        document.getElementById('confirm-cli-obs').value = '';
        document.getElementById('modal-confirmar-cliente').classList.add('open');
    });

    document.getElementById('confirm-cli-close')?.addEventListener('click', () => document.getElementById('modal-confirmar-cliente').classList.remove('open'));
    document.getElementById('confirm-cli-cancel')?.addEventListener('click', () => document.getElementById('modal-confirmar-cliente').classList.remove('open'));
    document.getElementById('modal-confirmar-cliente')?.addEventListener('click', e => { if (e.target.id==='modal-confirmar-cliente') e.target.classList.remove('open'); });

    document.getElementById('confirm-cli-ok')?.addEventListener('click', async () => {
        const obs    = document.getElementById('confirm-cli-obs').value.trim();
        const todos  = Object.values(serviciosState);
        document.getElementById('modal-confirmar-cliente').classList.remove('open');
        const msgEl  = document.getElementById('page-message');
        const btn    = document.getElementById('btn-confirmar-seleccion');
        btn.disabled = true; btn.textContent = 'Procesando…';

        let ok = 0, err = 0;
        for (const s of todos) {
            try {
                if (s.decision === 'si')
                    await api.presupuestos.aprobarCliente(s.id, true, obs||null);
                else if (s.decision === 'no')
                    await api.presupuestos.aprobarCliente(s.id, false, 'Cliente no desea este servicio.' + (obs ? ' '+obs : ''));
                ok++;
            } catch { err++; }
        }
        const aprobados  = todos.filter(s => s.decision==='si').length;
        const rechazados = todos.filter(s => s.decision==='no').length;
        if (err === 0)
            utils.setPageMessage(msgEl, 'success',
                `✓ Decisión confirmada. ${aprobados} servicio(s) aprobado(s) — consolidados en una sola Orden de Servicio. ${rechazados} cancelado(s).`);
        else
            utils.setPageMessage(msgEl, 'error', `Procesados ${ok} con ${err} error(es). Recarga para ver el estado.`);
        setTimeout(() => cargarServiciosCliente(), 2000);
    });

    // ════════════════════════════════════════════════════════════════════════
    //  VISTA STAFF — tabla con acciones
    // ════════════════════════════════════════════════════════════════════════

    function iniciarVistaStaff() {
        // Mostrar botón "Nueva Propuesta" para Admin, JefeTaller y Mecánicos
        if (puedeCriar) document.getElementById('btn-nuevo').style.display = '';

        const container = document.getElementById('table-container');
        const messageEl = document.getElementById('page-message');
        const paginEl   = document.getElementById('pagination-bar');
        const filtro    = document.getElementById('filtro-estado');

        let currentPage = 1;
        const pageSize  = 20;

        const ESTADOS = {
            0:{label:'Borrador',                     cls:'est-borrador'},
            1:{label:'En Revisión Jefe',             cls:'est-revision-jefe'},
            2:{label:'Aprobado — listo para enviar',  cls:'est-revision-jefe'},
            3:{label:'Pendiente aprobación cliente', cls:'est-revision-cli'},
            4:{label:'Aprobado — OS generada',       cls:'est-aprobada-cli'},
            5:{label:'En Proceso',                   cls:'est-en-proceso'},
            6:{label:'Completado',                   cls:'est-completada'},
            7:{label:'Rechazado por Jefe',           cls:'est-rechazada'},
            8:{label:'Rechazado por Cliente',        cls:'est-rechazada'},
            9:{label:'Cancelado',                    cls:'est-cancelada'},
        };

        async function cargar() {
            utils.setLoading(container, true);
            utils.setPageMessage(messageEl, 'info', '');
            try {
                const estado = filtro.value !== '' ? Number(filtro.value) : undefined;
                const { items, total } = await api.presupuestos.list({ pagina:currentPage, tamano:pageSize, estado });
                renderTabla(items);
                renderPaginacion(total);
            } catch (err) {
                container.innerHTML = '';
                utils.setPageMessage(messageEl, 'error', err.message);
            }
        }

        function renderTabla(items) {
            if (!items?.length) {
                container.innerHTML = '<p class="table-empty">No hay presupuestos con ese filtro.</p>';
                return;
            }
            const rows = items.map(p => {
                const estado = p.estado ?? p.Estado ?? 0;
                const eInfo  = ESTADOS[estado] ?? {label:String(estado),cls:'est-borrador'};
                const id     = p.id ?? p.Id ?? '';
                const numero = p.numeroMiniOrden ?? p.NumeroMiniOrden ?? '—';
                const desc   = (p.descripcion ?? p.Descripcion ?? '').substring(0,55);
                const mec    = p.mecanicoNombre ?? p.MecanicoNombre ?? '—';
                const total  = Number(p.total ?? p.Total ?? 0);

                const btns = [];
                if (estado===0 && puedeCriar)
                    btns.push(`<button class="btn-accion btn-enviar" data-id="${id}" data-accion="enviar">Enviar al Jefe</button>`);
                if (estado===1 && puedeAprJefe) {
                    btns.push(`<button class="btn-accion btn-aprobar"  data-id="${id}" data-accion="jefe-aprobar">Enviar al cliente ✓</button>`);
                    btns.push(`<button class="btn-accion btn-rechazar" data-id="${id}" data-accion="jefe-rechazar">Rechazar</button>`);
                }
                if (estado===2 && puedeAprJefe) {
                    btns.push(`<button class="btn-accion btn-aprobar"  data-id="${id}" data-accion="jefe-aprobar">Enviar al cliente ✓</button>`);
                }
                if (estado===3 && puedeAprCli) {
                    btns.push(`<button class="btn-accion btn-aprobar"  data-id="${id}" data-accion="cli-aprobar">✓ Aprobar por cliente</button>`);
                    btns.push(`<button class="btn-accion btn-rechazar" data-id="${id}" data-accion="cli-rechazar">✗ Rechazar</button>`);
                }
                if (estado===5 && (puedeCriar || puedeAprJefe))
                    btns.push(`<button class="btn-accion btn-completar" data-id="${id}" data-accion="completar">Completar</button>`);
                btns.push(`<button class="btn-accion" style="border-color:var(--text-muted);color:var(--text-muted)" data-id="${id}" data-accion="ver">Detalle</button>`);
                if (puedeCriar || puedeAprJefe)
                    btns.push(`<button class="btn-accion" style="border-color:#6b7280;color:#6b7280;font-size:10px" data-id="${id}" data-accion="eliminar">🗑</button>`);

                return `<tr>
                    <td><span style="color:var(--bronze-gold);font-weight:500">${utils.escapeHtml(numero)}</span></td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${utils.escapeHtml(desc)}${(p.descripcion?.length??0)>55?'…':''}</td>
                    <td>${utils.escapeHtml(mec)}</td>
                    <td><span class="badge ${eInfo.cls}">${eInfo.label}</span></td>
                    <td style="text-align:right">$${total.toLocaleString('es-CO')}</td>
                    <td style="white-space:nowrap">${btns.join('')}</td>
                </tr>`;
            }).join('');

            container.innerHTML = `<table class="data-table"><thead><tr>
                <th>Número</th><th>Descripción</th><th>Técnico</th>
                <th>Estado</th><th style="text-align:right">Total</th><th>Acciones</th>
            </tr></thead><tbody>${rows}</tbody></table>`;

            container.querySelectorAll('[data-accion]').forEach(btn =>
                btn.addEventListener('click', () => manejarAccion(btn.dataset.id, btn.dataset.accion)));
        }

        function renderPaginacion(total) {
            if (!paginEl) return;
            const tp = Math.ceil(total/pageSize);
            let html = `<span>${total} presupuesto(s) · Pág ${currentPage}/${Math.max(1,tp)}</span>`;
            if (currentPage>1)  html += `<button class="btn-dashboard" style="padding:4px 12px;font-size:12px;margin-left:8px" id="pag-prev">← Anterior</button>`;
            if (currentPage<tp) html += `<button class="btn-dashboard" style="padding:4px 12px;font-size:12px;margin-left:4px" id="pag-next">Siguiente →</button>`;
            paginEl.innerHTML = html;
            document.getElementById('pag-prev')?.addEventListener('click', () => { currentPage--; cargar(); });
            document.getElementById('pag-next')?.addEventListener('click', () => { currentPage++; cargar(); });
        }

        document.getElementById('btn-reload')?.addEventListener('click', () => { currentPage=1; cargar(); });
        document.getElementById('btn-filtrar')?.addEventListener('click', () => { currentPage=1; cargar(); });
        cargar();

        // ── Acciones ───────────────────────────────────────────────────────
        async function manejarAccion(id, accion) {
            if (accion === 'ver') { await mostrarDetalle(id); return; }
            if (accion === 'eliminar') {
                if (!confirm('¿Eliminar este presupuesto? No aparecerá más en la lista.\n\nNo se puede eliminar si su orden de servicio ya fue finalizada.')) return;
                try {
                    await api.presupuestos.eliminar(id);
                    utils.setPageMessage(messageEl, 'success', '✓ Presupuesto eliminado.');
                    cargar();
                } catch (err) { utils.setPageMessage(messageEl, 'error', err.message); }
                return;
            }
            if (accion === 'enviar') {
                if (!confirm('¿Enviar al Jefe de Taller para revisión?')) return;
                await ejecutar(() => api.presupuestos.enviarRevision(id), '✓ Enviado al Jefe de Taller.');
                return;
            }
            if (accion === 'completar') {
                const obs = prompt('Observaciones finales (opcional):');
                if (obs === null) return;
                await ejecutar(() => api.presupuestos.completar(id, obs||undefined), '✓ Marcado como completado.');
                return;
            }
            const configs = {
                'jefe-aprobar':  { titulo:'Enviar al cliente para aprobación', info:'El presupuesto será visible para el cliente, quien podrá aprobarlo o rechazarlo.', aprobado:true,  obsReq:false, fn:obs=>api.presupuestos.aprobarJefe(id,true,obs) },
                'jefe-rechazar': { titulo:'Rechazar — devolver al técnico',   info:'El presupuesto se devolverá con el motivo de rechazo.',  aprobado:false, obsReq:true,  fn:obs=>api.presupuestos.aprobarJefe(id,false,obs) },
                'cli-aprobar':   { titulo:'Aprobar en nombre del cliente',   info:'Se generará la Orden de Servicio automáticamente.',      aprobado:true,  obsReq:false, fn:obs=>api.presupuestos.aprobarCliente(id,true,obs) },
                'cli-rechazar':  { titulo:'Rechazar en nombre del cliente',  info:'Este servicio no se realizará.',                         aprobado:false, obsReq:true,  fn:obs=>api.presupuestos.aprobarCliente(id,false,obs) },
            };
            const cfg = configs[accion];
            if (cfg) abrirModalAccion(cfg, messageEl, cargar);
        }

        async function ejecutar(fn, msgOk) {
            try {
                const r = await fn();
                const d = r?.data ?? r;
                let msg = msgOk;
                if (d?.numeroOrden || d?.NumeroOrden) msg += ` Orden de Servicio #${d.numeroOrden??d.NumeroOrden}.`;
                utils.setPageMessage(messageEl, 'success', msg);
                cargar();
            } catch (err) { utils.setPageMessage(messageEl, 'error', err.message); }
        }

        // Detalle
        const modalDetalle      = document.getElementById('modal-detalle');
        const modalAddRep       = document.getElementById('modal-pres-add-rep');
        const modalAddMano      = document.getElementById('modal-pres-add-mano');
        let detalleIdActivo     = null;
        let repuestosCachePres  = [];
        let mecanicosCachePres  = [];

        async function mostrarDetalle(id) {
            detalleIdActivo = id;
            modalDetalle.classList.add('open');
            document.getElementById('detalle-body').innerHTML     = '<p style="color:var(--text-muted)">Cargando...</p>';
            document.getElementById('detalle-acciones').innerHTML = '';
            try {
                const resp   = await api.presupuestos.getById(id);
                const p      = resp?.data ?? resp;
                renderDetallePres(p, id);
            } catch (err) {
                document.getElementById('detalle-body').innerHTML = `<p style="color:#f87171">Error: ${utils.escapeHtml(err.message)}</p>`;
            }
        }

        function renderDetallePres(p, id) {
            const estado  = p.estado ?? p.Estado ?? 0;
            const eInfo   = ESTADOS[estado] ?? {label:String(estado), cls:''};
            const esBorrador = estado === 0;
            const detalles   = p.detalles   ?? p.Detalles   ?? [];
            const manosObra  = p.manosObra  ?? p.ManosObra  ?? [];

            document.getElementById('detalle-titulo').innerHTML =
                `Presupuesto <strong>${utils.escapeHtml(p.numeroMiniOrden??'')}</strong> ` +
                `<span class="badge ${eInfo.cls}" style="font-size:11px">${eInfo.label}</span>` +
                `<button class="modal-close" id="detalle-close">✕</button>`;
            document.getElementById('detalle-close')?.addEventListener('click', () => modalDetalle.classList.remove('open'));

            // Info básica
            const infoLineas = [
                ['Técnico',       p.mecanicoNombre   ?? p.MecanicoNombre   ?? '—'],
                ['Descripción',   p.descripcion      ?? p.Descripcion      ?? '—'],
                ['Observaciones', p.observaciones    ?? p.Observaciones    ?? null],
                ['Motivo rechazo',p.motivoRechazo    ?? p.MotivoRechazo    ?? null],
                ['OS generada',   p.numeroOrden      ?? p.NumeroOrden      ?? null],
            ].filter(([,v]) => v && v !== '—');

            // Tabla repuestos
            const filaRep = detalles.length
                ? detalles.map(d => {
                    const nombre = d.repuestoNombre ?? d.RepuestoNombre ?? '—';
                    const cant   = d.cantidad       ?? d.Cantidad       ?? 0;
                    const precio = d.precioUnitario ?? d.PrecioUnitario ?? 0;
                    const sub    = d.subtotal       ?? d.Subtotal       ?? (cant * precio);
                    const dId    = d.id ?? d.Id ?? '';
                    const btnDel = (esBorrador && puedeCriar)
                        ? `<button class="btn-rm-pres" data-tipo="rep" data-id="${dId}" title="Quitar" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 4px">✕</button>`
                        : '';
                    return `<tr>
                        <td>${utils.escapeHtml(d.repuestoCodigo ?? d.RepuestoCodigo ?? '')} ${utils.escapeHtml(nombre)}</td>
                        <td style="text-align:center">${cant}</td>
                        <td style="text-align:right">$${Number(precio).toLocaleString('es-CO')}</td>
                        <td style="text-align:right">$${Number(sub).toLocaleString('es-CO')}</td>
                        <td>${btnDel}</td>
                    </tr>`;
                }).join('')
                : `<tr><td colspan="5" style="color:var(--text-muted);font-size:12px;font-style:italic;padding:8px 0">Sin repuestos registrados</td></tr>`;

            // Tabla mano de obra
            const filaMO = manosObra.length
                ? manosObra.map(m => {
                    const desc   = m.descripcion   ?? m.Descripcion   ?? '—';
                    const horas  = m.horasTrabajo  ?? m.HorasTrabajo  ?? 0;
                    const tarifa = m.tarifaHora    ?? m.TarifaHora    ?? 0;
                    const total  = m.total         ?? m.Total         ?? (horas * tarifa);
                    const tec    = m.tecnicoNombre ?? m.TecnicoNombre ?? '—';
                    const mId    = m.id ?? m.Id ?? '';
                    const btnDel = (esBorrador && puedeCriar)
                        ? `<button class="btn-rm-pres" data-tipo="mo" data-id="${mId}" title="Quitar" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 4px">✕</button>`
                        : '';
                    return `<tr>
                        <td>${utils.escapeHtml(desc)}</td>
                        <td>${utils.escapeHtml(tec)}</td>
                        <td style="text-align:center">${horas}h × $${Number(tarifa).toLocaleString('es-CO')}</td>
                        <td style="text-align:right">$${Number(total).toLocaleString('es-CO')}</td>
                        <td>${btnDel}</td>
                    </tr>`;
                }).join('')
                : `<tr><td colspan="5" style="color:var(--text-muted);font-size:12px;font-style:italic;padding:8px 0">Sin mano de obra registrada</td></tr>`;

            const addBtns = (esBorrador && puedeCriar) ? `
                <div style="display:flex;gap:8px;margin-top:8px">
                    <button class="btn-dashboard" id="pres-btn-add-rep" style="font-size:11px;padding:4px 12px;border-color:var(--gold-border)">+ Repuesto</button>
                    <button class="btn-dashboard" id="pres-btn-add-mo"  style="font-size:11px;padding:4px 12px;border-color:var(--gold-border)">+ Mano de obra</button>
                </div>` : '';

            document.getElementById('detalle-body').innerHTML = `
                ${infoLineas.map(([l,v])=>`
                    <span style="color:var(--text-muted)">${utils.escapeHtml(l)}</span>
                    <span style="color:var(--text-ivory)">${utils.escapeHtml(v)}</span>
                `).join('')}
                <span style="color:var(--text-muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase;grid-column:1/-1;padding-top:10px">Repuestos e Insumos</span>
                <div style="grid-column:1/-1;overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse;font-size:12px">
                        <thead><tr>
                            <th style="color:var(--text-muted);text-align:left;padding:4px 6px">Descripción</th>
                            <th style="color:var(--text-muted);text-align:center;padding:4px 6px">Cant.</th>
                            <th style="color:var(--text-muted);text-align:right;padding:4px 6px">P.Unit.</th>
                            <th style="color:var(--text-muted);text-align:right;padding:4px 6px">Subtotal</th>
                            <th></th>
                        </tr></thead>
                        <tbody>${filaRep}</tbody>
                    </table>
                </div>
                <span style="color:var(--text-muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase;grid-column:1/-1;padding-top:10px">Mano de Obra</span>
                <div style="grid-column:1/-1;overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse;font-size:12px">
                        <thead><tr>
                            <th style="color:var(--text-muted);text-align:left;padding:4px 6px">Descripción</th>
                            <th style="color:var(--text-muted);text-align:left;padding:4px 6px">Técnico</th>
                            <th style="color:var(--text-muted);text-align:center;padding:4px 6px">Horas × Tarifa</th>
                            <th style="color:var(--text-muted);text-align:right;padding:4px 6px">Total</th>
                            <th></th>
                        </tr></thead>
                        <tbody>${filaMO}</tbody>
                    </table>
                </div>
                ${addBtns}
                <span style="color:var(--text-muted)">Materiales</span><span style="color:var(--text-ivory)">$${Number(p.totalMateriales??0).toLocaleString('es-CO')}</span>
                <span style="color:var(--text-muted)">Mano de obra</span><span style="color:var(--text-ivory)">$${Number(p.totalManoObra??0).toLocaleString('es-CO')}</span>
                <span style="color:var(--text-muted);font-weight:600">TOTAL</span>
                <span style="color:var(--champagne-gold);font-weight:600;font-size:15px">$${Number(p.total??0).toLocaleString('es-CO')}</span>
            `;

            // Eventos quitar ítems
            document.querySelectorAll('#detalle-body .btn-rm-pres').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Quitar este ítem del presupuesto?')) return;
                    try {
                        if (btn.dataset.tipo === 'rep')
                            await api.presupuestos.removeDetalle(detalleIdActivo, btn.dataset.id);
                        else
                            await api.presupuestos.removeManoObra(detalleIdActivo, btn.dataset.id);
                        await recargarDetallePres();
                    } catch (err) { utils.setPageMessage(messageEl, 'error', err.message); }
                });
            });

            document.getElementById('pres-btn-add-rep')?.addEventListener('click', () => abrirAddRepPres());
            document.getElementById('pres-btn-add-mo')?.addEventListener('click',  () => abrirAddMoPres());

            // Botones de flujo
            const btns = document.getElementById('detalle-acciones');
            if (estado===0&&puedeCriar)   btns.innerHTML += `<button class="btn-dashboard btn-enviar" style="border-color:#fbbf24;color:#fbbf24" data-id="${id}" data-accion="enviar">Enviar al Jefe</button>`;
            if ((estado===1||estado===2)&&puedeAprJefe) {
                btns.innerHTML += `<button class="btn-dashboard" style="border-color:#4ade80;color:#4ade80;font-weight:600" data-id="${id}" data-accion="jefe-aprobar">Enviar al cliente ✓</button>`;
                if (estado===1) btns.innerHTML += `<button class="btn-dashboard" style="border-color:#f87171;color:#f87171" data-id="${id}" data-accion="jefe-rechazar">Rechazar</button>`;
            }
            if (estado===3&&puedeAprCli)  { btns.innerHTML += `<button class="btn-dashboard" style="border-color:#4ade80;color:#4ade80;font-weight:600" data-id="${id}" data-accion="cli-aprobar">✓ Aprobar por cliente</button>`; btns.innerHTML += `<button class="btn-dashboard" style="border-color:#f87171;color:#f87171" data-id="${id}" data-accion="cli-rechazar">✗ Rechazar</button>`; }
            if (estado===5&&(puedeCriar||puedeAprJefe)) btns.innerHTML += `<button class="btn-dashboard" style="border-color:#38bdf8;color:#38bdf8" data-id="${id}" data-accion="completar">Completar</button>`;
            btns.querySelectorAll('[data-accion]').forEach(btn=>btn.addEventListener('click',()=>{ modalDetalle.classList.remove('open'); manejarAccion(btn.dataset.id,btn.dataset.accion); }));
        }

        async function recargarDetallePres() {
            try {
                const resp = await api.presupuestos.getById(detalleIdActivo);
                renderDetallePres(resp?.data ?? resp, detalleIdActivo);
                cargar();
            } catch { /* silent */ }
        }

        // ── Modal agregar repuesto a presupuesto ─────────────────────────────
        async function abrirAddRepPres() {
            document.getElementById('pres-rep-cant').value   = '1';
            document.getElementById('pres-rep-precio').value = '';
            modalAddRep.classList.add('open');

            if (!repuestosCachePres.length) {
                const sel = document.getElementById('pres-sel-rep');
                sel.innerHTML = '<option value="">Cargando...</option>';
                try {
                    const { items } = await api.repuestos.list({ tamano: 200 });
                    repuestosCachePres = items ?? [];
                } catch (err) {
                    sel.innerHTML = `<option value="">Error: ${utils.escapeHtml(err.message)}</option>`;
                    return;
                }
            }
            const sel = document.getElementById('pres-sel-rep');
            sel.innerHTML = '<option value="">— Seleccionar —</option>' +
                repuestosCachePres.map(r => {
                    const precio = r.precioVenta ?? r.PrecioVenta ?? 0;
                    return `<option value="${r.id??r.Id}" data-precio="${precio}">${utils.escapeHtml(r.codigo??'')} — ${utils.escapeHtml(r.nombre??'')} ($${Number(precio).toLocaleString('es-CO')})</option>`;
                }).join('');
            sel.onchange = () => {
                const opt = sel.options[sel.selectedIndex];
                if (opt?.dataset?.precio) document.getElementById('pres-rep-precio').value = opt.dataset.precio;
            };
        }

        document.getElementById('pres-add-rep-close')?.addEventListener('click',  () => modalAddRep.classList.remove('open'));
        document.getElementById('pres-add-rep-cancel')?.addEventListener('click', () => modalAddRep.classList.remove('open'));
        modalAddRep?.addEventListener('click', e => { if (e.target===modalAddRep) modalAddRep.classList.remove('open'); });

        document.getElementById('pres-add-rep-ok')?.addEventListener('click', async () => {
            const repId  = document.getElementById('pres-sel-rep').value;
            const cant   = parseInt(document.getElementById('pres-rep-cant').value);
            const precio = parseFloat(document.getElementById('pres-rep-precio').value);
            if (!repId || !cant || cant < 1 || isNaN(precio) || precio < 0) { alert('Completa todos los campos.'); return; }
            try {
                await api.presupuestos.addDetalle(detalleIdActivo, { RepuestoId: repId, Cantidad: cant, PrecioUnitario: precio });
                modalAddRep.classList.remove('open');
                await recargarDetallePres();
            } catch (err) { utils.setPageMessage(messageEl, 'error', err.message); modalAddRep.classList.remove('open'); }
        });

        // ── Modal agregar mano de obra a presupuesto ─────────────────────────
        async function abrirAddMoPres() {
            document.getElementById('pres-mo-desc').value   = '';
            document.getElementById('pres-mo-tarifa').value = '';
            document.getElementById('pres-mo-horas').value  = '1';
            modalAddMano.classList.add('open');

            if (!mecanicosCachePres.length) {
                try {
                    const { items } = await api.empleados.list({ tamano: 100 });
                    mecanicosCachePres = (items ?? []).filter(e => [0,1,5,6].includes(e.tipoEmpleado ?? e.TipoEmpleado));
                } catch { mecanicosCachePres = []; }
            }
            const sel = document.getElementById('pres-sel-tec');
            sel.innerHTML = '<option value="">Sin asignar</option>' +
                mecanicosCachePres.map(m => {
                    const nombre = `${m.nombres??''} ${m.apellidos??''}`.trim();
                    return `<option value="${m.id??m.Id}">${utils.escapeHtml(nombre)}</option>`;
                }).join('');
        }

        document.getElementById('pres-add-mo-close')?.addEventListener('click',  () => modalAddMano.classList.remove('open'));
        document.getElementById('pres-add-mo-cancel')?.addEventListener('click', () => modalAddMano.classList.remove('open'));
        modalAddMano?.addEventListener('click', e => { if (e.target===modalAddMano) modalAddMano.classList.remove('open'); });

        document.getElementById('pres-add-mo-ok')?.addEventListener('click', async () => {
            const desc   = document.getElementById('pres-mo-desc').value.trim();
            const tarifa = parseFloat(document.getElementById('pres-mo-tarifa').value);
            const horas  = parseFloat(document.getElementById('pres-mo-horas').value) || 1;
            const tecId  = document.getElementById('pres-sel-tec').value || null;
            if (!desc || isNaN(tarifa) || tarifa < 0) { alert('Completa la descripción y la tarifa.'); return; }
            try {
                await api.presupuestos.addManoObra(detalleIdActivo, { Descripcion: desc, TarifaHora: tarifa, HorasTrabajo: horas, TecnicoId: tecId });
                modalAddMano.classList.remove('open');
                await recargarDetallePres();
            } catch (err) { utils.setPageMessage(messageEl, 'error', err.message); modalAddMano.classList.remove('open'); }
        });

        modalDetalle?.addEventListener('click', e => { if (e.target===modalDetalle) modalDetalle.classList.remove('open'); });
    }

    // ── Modal acción (staff) ──────────────────────────────────────────────────
    const modalAccion = document.getElementById('modal-accion');
    let cfgPend = null;
    function abrirModalAccion(cfg, msgEl, recargar) {
        document.getElementById('accion-titulo').textContent    = cfg.titulo;
        document.getElementById('accion-info').textContent      = cfg.info;
        document.getElementById('accion-obs-label').textContent = cfg.obsReq ? 'Motivo (obligatorio)' : 'Observación (opcional)';
        document.getElementById('accion-obs').value = '';
        document.getElementById('accion-obs').placeholder = cfg.obsReq ? 'Obligatorio…' : 'Opcional…';
        const cb = document.getElementById('accion-confirm');
        cb.textContent  = cfg.aprobado ? 'Confirmar aprobación' : 'Confirmar rechazo';
        cb.style.cssText = cfg.aprobado ? '' : 'border:1px solid #f87171!important;color:#f87171!important;background:transparent!important';
        cfgPend = { cfg, msgEl, recargar };
        modalAccion.classList.add('open');
    }
    document.getElementById('accion-close')?.addEventListener('click',  () => { modalAccion.classList.remove('open'); cfgPend=null; });
    document.getElementById('accion-cancel')?.addEventListener('click', () => { modalAccion.classList.remove('open'); cfgPend=null; });
    modalAccion?.addEventListener('click', e => { if (e.target===modalAccion) { modalAccion.classList.remove('open'); cfgPend=null; } });
    document.getElementById('accion-confirm')?.addEventListener('click', async () => {
        if (!cfgPend) return;
        const { cfg, msgEl, recargar } = cfgPend;
        const obs = document.getElementById('accion-obs').value.trim();
        if (cfg.obsReq && !obs) { alert('Este campo es obligatorio.'); return; }
        modalAccion.classList.remove('open'); cfgPend = null;
        try {
            const r = await cfg.fn(obs||undefined);
            const d = r?.data ?? r;
            let msg = cfg.aprobado ? '✓ Aprobado.' : '✓ Rechazado.';
            if (d?.numeroOrden||d?.NumeroOrden) msg += ` Orden de Servicio #${d.numeroOrden??d.NumeroOrden}.`;
            utils.setPageMessage(msgEl, 'success', msg);
            recargar?.();
        } catch (err) { utils.setPageMessage(cfgPend?.msgEl ?? msgEl, 'error', err.message); }
    });

    // ════════════════════════════════════════════════════════════════════════
    //  MODAL NUEVA PROPUESTA — múltiples servicios
    // ════════════════════════════════════════════════════════════════════════

    const modalNuevo   = document.getElementById('modal-nuevo');
    let clienteSel     = null;
    let vehiculoSel    = null;
    let debCli;
    let repuestosCache    = [];   // repuestos del inventario
    let tiposServicioCache = []; // tipos de servicio disponibles
    // Lista de servicios a crear: [{ tipoId, desc, obs, detalles: [{repId,nombre,codigo,cant,precio}] }]
    let listaServicios = [];

    document.getElementById('btn-nuevo')?.addEventListener('click', abrirModalNuevo);
    const cerrarNuevo = () => modalNuevo.classList.remove('open');
    document.getElementById('nuevo-close')?.addEventListener('click', cerrarNuevo);
    document.getElementById('nuevo-cancel')?.addEventListener('click', cerrarNuevo);
    modalNuevo?.addEventListener('click', e => { if (e.target===modalNuevo) cerrarNuevo(); });

    async function cargarCaches() {
        const proms = [];
        if (!repuestosCache.length)
            proms.push(
                api.repuestos.list({ tamano: 500 })
                    .then(({ items }) => { repuestosCache = items ?? []; })
                    .catch(() => {})
            );
        if (!tiposServicioCache.length)
            proms.push(
                api.catalogos.tiposServicio()
                    .then(r => { tiposServicioCache = r?.data ?? r ?? []; })
                    .catch(() => {})
            );
        if (proms.length) await Promise.all(proms);
    }

    // Devuelve las opciones de repuesto para un tipoServicioId dado.
    // Primero los del tipo, luego los sin tipo (generales), omitiendo los de otro tipo.
    function repuestosParaTipo(tipoId) {
        if (!tipoId || tipoId === '__custom__') return repuestosCache; // sin filtro
        const propios    = repuestosCache.filter(r => (r.tipoServicioId ?? r.TipoServicioId) === tipoId);
        const generales  = repuestosCache.filter(r => !(r.tipoServicioId ?? r.TipoServicioId));
        return [...propios, ...generales];
    }

    function opcionesRepuestoHtml(tipoId) {
        const lista = repuestosParaTipo(tipoId);
        if (!lista.length) return `<option value="">Sin repuestos en inventario</option>`;

        const tipoId2 = (tipoId && tipoId !== '__custom__') ? tipoId : null;
        const propios = lista.filter(r => tipoId2 && (r.tipoServicioId ?? r.TipoServicioId) === tipoId2);
        const otros   = lista.filter(r => !(r.tipoServicioId ?? r.TipoServicioId));

        const mkOption = r => {
            const precio = r.precioVenta ?? r.PrecioVenta ?? 0;
            return `<option value="${r.id??r.Id}"
                data-precio="${precio}"
                data-nombre="${utils.escapeHtml(r.nombre??r.Nombre??'')}"
                data-codigo="${utils.escapeHtml(r.codigo??r.Codigo??'')}">
                ${utils.escapeHtml(r.codigo??r.Codigo??'')} — ${utils.escapeHtml(r.nombre??r.Nombre??'')} ($${Number(precio).toLocaleString('es-CO')})
            </option>`;
        };

        if (tipoId2 && propios.length) {
            return `<option value="" disabled>— Repuestos del servicio —</option>` +
                   propios.map(mkOption).join('') +
                   (otros.length ? `<option value="" disabled>— Otros repuestos —</option>` + otros.map(mkOption).join('') : '');
        }
        return `<option value="">— Seleccionar repuesto —</option>` + lista.map(mkOption).join('');
    }

    async function abrirModalNuevo() {
        // Mostrar modal con indicador de carga mientras se obtienen los datos
        modalNuevo.classList.add('open');
        const wrap = document.getElementById('nuevo-servicios-wrap');
        if (wrap) wrap.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:10px 0">Cargando catálogos...</p>';

        await cargarCaches();

        clienteSel = vehiculoSel = null;
        listaServicios = [{ tipoId:'', desc:'', obs:'', detalles:[] }];
        const busCliente = document.getElementById('nuevo-buscar-cliente');
        if (busCliente) busCliente.value = '';
        document.getElementById('nuevo-cliente-sel').textContent = '';
        document.getElementById('nuevo-veh-sel').textContent     = '';
        document.getElementById('nuevo-lista-clientes').style.display = 'none';
        const listaVeh = document.getElementById('nuevo-lista-veh');
        if (listaVeh) listaVeh.innerHTML = '<div class="search-empty">Selecciona un cliente primero</div>';
        document.getElementById('nuevo-veh-wrap').style.display = 'none';
        renderListaServicios();
    }

    // ── Render de la lista de servicios ─────────────────────────────────────────
    function renderListaServicios() {
        const wrap = document.getElementById('nuevo-servicios-wrap');
        if (!wrap) return;
        wrap.innerHTML = listaServicios.map((s, i) => {
            const filasDet = s.detalles.map((d, di) => `
                <tr>
                    <td style="font-size:12px">${utils.escapeHtml(d.codigo ? `[${d.codigo}] ` : '')}${utils.escapeHtml(d.nombre)}</td>
                    <td style="text-align:center">
                        <input type="number" min="1" value="${d.cant}" data-svc="${i}" data-det="${di}" data-field="cant"
                            style="width:50px;background:rgba(255,255,255,.06);border:1px solid var(--gold-border);color:var(--text-ivory);padding:2px 6px;border-radius:3px;font-size:12px;text-align:center">
                    </td>
                    <td style="text-align:right">
                        <input type="number" min="0" step="100" value="${d.precio}" data-svc="${i}" data-det="${di}" data-field="precio"
                            style="width:90px;background:rgba(255,255,255,.06);border:1px solid var(--gold-border);color:var(--text-ivory);padding:2px 6px;border-radius:3px;font-size:12px;text-align:right">
                    </td>
                    <td style="text-align:right;font-size:12px;color:var(--champagne-gold)">$${Number(d.cant*d.precio).toLocaleString('es-CO')}</td>
                    <td><button class="btn-rm-det" data-svc="${i}" data-det="${di}"
                        style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 4px">✕</button></td>
                </tr>`).join('') || `<tr><td colspan="5" style="color:var(--text-muted);font-size:11px;padding:6px 0;font-style:italic">Sin repuestos aún</td></tr>`;

            const totalDet = s.detalles.reduce((acc, d) => acc + d.cant * d.precio, 0);

            const opcionesTipo = tiposServicioCache.map(t =>
                `<option value="${t.id??t.Id}" ${s.tipoId===(t.id??t.Id)?'selected':''}>
                    ${utils.escapeHtml(t.nombre??t.Nombre??'')}${(t.precioBase??t.PrecioBase) ? ` — $${Number(t.precioBase??t.PrecioBase).toLocaleString('es-CO')}` : ''}
                </option>`
            ).join('');

            const opcionesRep = opcionesRepuestoHtml(s.tipoId);

            return `
            <div style="background:rgba(255,255,255,.03);border:1px solid var(--gold-border);border-radius:5px;padding:14px;margin-bottom:12px;position:relative">
                <div style="font-size:11px;color:var(--bronze-gold);margin-bottom:10px;letter-spacing:.08em;font-weight:600">SERVICIO ${i+1}</div>
                ${listaServicios.length > 1 ? `<button class="btn-accion btn-rechazar" data-rm="${i}" style="position:absolute;top:12px;right:12px;padding:2px 8px;font-size:10px">✕ Quitar</button>` : ''}

                <div class="form-field" style="margin-bottom:8px">
                    <label style="font-size:11px">Tipo de servicio *</label>
                    <select class="svc-tipo" data-svc="${i}"
                        style="width:100%;background:#1a1b1f;border:1px solid var(--gold-border);color:#e8e4dc;padding:8px 10px;border-radius:4px;font-family:inherit;font-size:13px">
                        <option value="">— Seleccionar tipo de servicio —</option>
                        ${opcionesTipo}
                        <option value="__custom__" ${s.tipoId==='__custom__'?'selected':''}>Otro (escribir manualmente)</option>
                    </select>
                </div>

                <div class="svc-desc-wrap" style="${s.tipoId==='__custom__'?'':'display:none'}">
                    <div class="form-field" style="margin-bottom:8px">
                        <label style="font-size:11px">Descripción del servicio *</label>
                        <textarea class="modal-textarea" data-svc="${i}" data-field="desc" style="min-height:48px"
                            placeholder="Describe el trabajo a realizar...">${utils.escapeHtml(s.desc)}</textarea>
                    </div>
                </div>

                <div class="form-field" style="margin-bottom:12px">
                    <label style="font-size:11px">Observaciones para el cliente (opcional)</label>
                    <textarea class="modal-textarea" data-svc="${i}" data-field="obs" style="min-height:36px"
                        placeholder="Información adicional visible para el cliente...">${utils.escapeHtml(s.obs)}</textarea>
                </div>

                <div style="border-top:1px solid var(--gold-border);padding-top:10px">
                    <div style="font-size:11px;color:var(--text-muted);letter-spacing:.08em;margin-bottom:8px">REPUESTOS E INSUMOS</div>

                    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">
                        <thead><tr>
                            <th style="text-align:left;color:var(--text-muted);padding:3px 4px;font-weight:500">Repuesto</th>
                            <th style="text-align:center;color:var(--text-muted);padding:3px 4px;font-weight:500">Cant.</th>
                            <th style="text-align:right;color:var(--text-muted);padding:3px 4px;font-weight:500">P. Unitario</th>
                            <th style="text-align:right;color:var(--text-muted);padding:3px 4px;font-weight:500">Subtotal</th>
                            <th></th>
                        </tr></thead>
                        <tbody>${filasDet}</tbody>
                    </table>

                    ${totalDet > 0 ? `<div style="text-align:right;font-size:12px;color:var(--champagne-gold);margin-bottom:8px">Subtotal materiales: $${totalDet.toLocaleString('es-CO')}</div>` : ''}

                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                        <select class="sel-rep-nuevo" data-svc="${i}"
                            style="flex:1;min-width:180px;background:#1a1b1f;border:1px solid var(--gold-border);color:#e8e4dc;padding:6px 8px;border-radius:4px;font-family:inherit;font-size:12px">
                            <option value="">— Seleccionar repuesto —</option>
                            ${opcionesRep}
                        </select>
                        <input type="number" class="inp-cant-nuevo" data-svc="${i}" min="1" value="1"
                            style="width:60px;background:#1a1b1f;border:1px solid var(--gold-border);color:#e8e4dc;padding:6px 8px;border-radius:4px;font-family:inherit;font-size:12px">
                        <button class="btn-add-rep-svc btn-dashboard" data-svc="${i}"
                            style="padding:5px 12px;font-size:11px;white-space:nowrap">+ Agregar</button>
                    </div>
                    ${!repuestosCache.length ? `<p style="color:var(--text-muted);font-size:11px;margin-top:6px">No hay repuestos en inventario. Agrégalos desde el módulo de Repuestos.</p>` : ''}
                </div>
            </div>`;
        }).join('');

        // ── Eventos en la lista de servicios ─────────────────────────────────
        // Selector de tipo de servicio
        wrap.querySelectorAll('select.svc-tipo').forEach(sel => {
            sel.addEventListener('change', () => {
                const si  = Number(sel.dataset.svc);
                const val = sel.value;
                listaServicios[si].tipoId = val;
                // Si elige una opción predefinida, usar su nombre como desc
                if (val && val !== '__custom__') {
                    const opt = sel.options[sel.selectedIndex];
                    listaServicios[si].desc = opt.textContent.split('—')[0].trim();
                } else if (val !== '__custom__') {
                    listaServicios[si].desc = '';
                }
                // Mostrar u ocultar campo de descripción manual
                const card = sel.closest('div[style]');
                const descWrap = card?.querySelector('.svc-desc-wrap');
                if (descWrap) descWrap.style.display = val === '__custom__' ? '' : 'none';
                // Actualizar el select de repuestos con los del nuevo tipo
                const selRep = card?.querySelector('.sel-rep-nuevo');
                if (selRep) selRep.innerHTML = opcionesRepuestoHtml(val);
            });
        });
        // Texto desc / obs
        wrap.querySelectorAll('textarea[data-svc]').forEach(el => {
            el.addEventListener('input', () => {
                listaServicios[Number(el.dataset.svc)][el.dataset.field] = el.value;
            });
        });
        // Quitar servicio
        wrap.querySelectorAll('[data-rm]').forEach(btn => {
            btn.addEventListener('click', () => {
                listaServicios.splice(Number(btn.dataset.rm), 1);
                renderListaServicios();
            });
        });
        // Editar cant/precio de un detalle ya agregado
        wrap.querySelectorAll('input[data-det]').forEach(inp => {
            inp.addEventListener('input', () => {
                const si = Number(inp.dataset.svc), di = Number(inp.dataset.det);
                const val = parseFloat(inp.value) || 0;
                listaServicios[si].detalles[di][inp.dataset.field] = val;
                renderListaServicios(); // re-render para actualizar subtotal
            });
        });
        // Quitar detalle
        wrap.querySelectorAll('.btn-rm-det').forEach(btn => {
            btn.addEventListener('click', () => {
                const si = Number(btn.dataset.svc), di = Number(btn.dataset.det);
                listaServicios[si].detalles.splice(di, 1);
                renderListaServicios();
            });
        });
        // Agregar repuesto a un servicio
        wrap.querySelectorAll('.btn-add-rep-svc').forEach(btn => {
            btn.addEventListener('click', () => {
                const si  = Number(btn.dataset.svc);
                const sel = wrap.querySelector(`.sel-rep-nuevo[data-svc="${si}"]`);
                const inp = wrap.querySelector(`.inp-cant-nuevo[data-svc="${si}"]`);
                const opt = sel?.options[sel.selectedIndex];
                if (!sel?.value || !opt) { alert('Selecciona un repuesto.'); return; }
                const cant = parseInt(inp?.value) || 1;
                listaServicios[si].detalles.push({
                    repId:  sel.value,
                    nombre: opt.dataset.nombre,
                    codigo: opt.dataset.codigo,
                    cant,
                    precio: parseFloat(opt.dataset.precio) || 0,
                });
                renderListaServicios();
            });
        });
    }

    document.getElementById('nuevo-agregar-servicio')?.addEventListener('click', () => {
        listaServicios.push({ tipoId:'', desc:'', obs:'', detalles:[] });
        renderListaServicios();
        // Scroll al nuevo
        const wrap = document.getElementById('nuevo-servicios-wrap');
        wrap?.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'nearest' });
    });

    // Búsqueda cliente
    document.getElementById('nuevo-buscar-cliente')?.addEventListener('input', e => {
        clearTimeout(debCli);
        const q = e.target.value.trim();
        if (q.length<2) { document.getElementById('nuevo-lista-clientes').style.display='none'; return; }
        debCli = setTimeout(() => buscarClienteModal(q), 350);
    });
    async function buscarClienteModal(q) {
        const lista = document.getElementById('nuevo-lista-clientes');
        lista.innerHTML = '<div class="search-empty">Buscando...</div>'; lista.style.display='';
        try {
            const { items } = await api.clientes.list({ busqueda:q, tamano:8 });
            if (!items?.length) { lista.innerHTML='<div class="search-empty">Sin resultados</div>'; return; }
            lista.innerHTML = items.map(c => {
                const nombre = `${c.nombres??''} ${c.apellidos??''}`.trim();
                return `<div class="search-item" data-id="${c.id}" data-nombre="${utils.escapeHtml(nombre)}">
                    ${utils.escapeHtml(nombre)}
                    <small>${utils.escapeHtml(c.tipoDocumento??'')} ${utils.escapeHtml(c.numeroDocumento??'')}</small>
                </div>`;
            }).join('');
            lista.querySelectorAll('.search-item').forEach(el => el.addEventListener('click', () => {
                clienteSel = { id:el.dataset.id, nombre:el.dataset.nombre };
                document.getElementById('nuevo-cliente-sel').textContent = `✓ Cliente: ${el.dataset.nombre}`;
                lista.style.display = 'none';
                vehiculoSel = null;
                document.getElementById('nuevo-veh-sel').textContent = '';
                document.getElementById('nuevo-veh-wrap').style.display = '';
                cargarVehiculosClientePres();
            }));
        } catch { lista.innerHTML='<div class="search-empty" style="color:#f87171">Error al buscar</div>'; }
    }

    // Carga automática de vehículos al seleccionar cliente
    async function cargarVehiculosClientePres() {
        const lista = document.getElementById('nuevo-lista-veh');
        lista.innerHTML = '<div class="search-empty">Cargando vehículos...</div>';
        try {
            const { items } = await api.vehiculos.list({ tamano: 50, clienteId: clienteSel?.id });
            if (!items?.length) {
                lista.innerHTML = `<div class="search-empty" style="color:#f87171">
                    Este cliente no tiene vehículos registrados.<br>
                    <small style="color:var(--text-muted)">Regístrele un vehículo primero.</small>
                </div>`;
                return;
            }
            lista.innerHTML = items.map(v => {
                const pm = v.placa ?? v.Placa ?? '';
                const mm = `${v.marca ?? v.Marca ?? ''} ${v.modelo ?? v.Modelo ?? ''}`.trim();
                const anio = v.anio ?? v.Anio ?? '';
                const km   = v.kilometrajeActual ?? v.KilometrajeActual ?? 0;
                return `<div class="search-item" data-id="${v.id ?? v.Id}" data-placa="${utils.escapeHtml(pm)}"
                    style="cursor:pointer;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.04);">
                    <strong style="color:var(--champagne-gold)">${utils.escapeHtml(pm)}</strong>
                    — ${utils.escapeHtml(mm)}
                    <small style="display:block;color:var(--text-muted);margin-top:2px">
                        ${anio}${km ? ` · ${Number(km).toLocaleString('es-CO')} km` : ''}
                    </small>
                </div>`;
            }).join('');
            lista.querySelectorAll('.search-item').forEach(el => el.addEventListener('click', () => {
                lista.querySelectorAll('.search-item').forEach(e => e.style.background = '');
                el.style.background = 'rgba(197,160,89,.15)';
                vehiculoSel = { id: el.dataset.id, placa: el.dataset.placa };
                document.getElementById('nuevo-veh-sel').textContent = `✓ Vehículo seleccionado: ${el.dataset.placa}`;
            }));
        } catch (err) {
            lista.innerHTML = `<div class="search-empty" style="color:#f87171">Error: ${utils.escapeHtml(err.message)}</div>`;
        }
    }

    // Crear servicios
    document.getElementById('nuevo-crear')?.addEventListener('click', () => crearServicios(false));
    document.getElementById('nuevo-crear-y-enviar')?.addEventListener('click', () => crearServicios(true));

    async function crearServicios(enviarAlCliente) {
        if (!clienteSel)  { alert('Selecciona un cliente.'); return; }
        if (!vehiculoSel) { alert('Selecciona un vehículo.'); return; }

        // Declarar referencias a botones ANTES de usarlos
        const msgEl  = document.getElementById('page-message');
        const btnCr  = document.getElementById('nuevo-crear');
        const btnEnv = document.getElementById('nuevo-crear-y-enviar');

        // Válido: que tenga tipo seleccionado O descripción manual
        const validos = listaServicios.filter(s =>
            (s.tipoId && s.tipoId !== '__custom__') || s.desc.trim()
        );
        if (!validos.length) {
            alert('Selecciona al menos un tipo de servicio.');
            return;
        }

        [btnCr, btnEnv].forEach(b => { if(b) { b.disabled=true; b.textContent='Procesando…'; } });
        cerrarNuevo();

        let creados=0, errores=0, ultimoError='';
        const idsCreados = [];

        for (const svc of validos) {
            try {
                const detallesApi = svc.detalles
                    .filter(d => d.repId && d.cant > 0 && d.precio >= 0)
                    .map(d => ({ RepuestoId: d.repId, Cantidad: d.cant, PrecioUnitario: d.precio }));
                // Descripción: nombre del tipo de servicio o texto manual
                let descripcion = svc.desc.trim();
                if (svc.tipoId && svc.tipoId !== '__custom__') {
                    const tipo = tiposServicioCache.find(t => (t.id??t.Id) === svc.tipoId);
                    descripcion = tipo ? (tipo.nombre ?? tipo.Nombre ?? descripcion) : descripcion;
                }
                const result = await api.presupuestos.crear({
                    ClienteId:      clienteSel.id,
                    VehiculoId:     vehiculoSel.id,
                    Descripcion:    descripcion || 'Servicio',
                    Observaciones:  svc.obs.trim() || null,
                    TipoServicioId: (svc.tipoId && svc.tipoId !== '__custom__') ? svc.tipoId : null,
                    Detalles:       detallesApi.length ? detallesApi : [],
                    ManosObra:      null,
                });
                const data = result?.data ?? result;
                idsCreados.push(data?.id ?? data?.Id);
                creados++;
            } catch (err) {
                errores++;
                ultimoError = err.message || 'Error desconocido';
            }
        }

        if (creados === 0) {
            utils.setPageMessage(msgEl, 'error',
                `No se pudo crear el servicio. ${ultimoError}`);
            [btnCr, btnEnv].forEach(b => { if(b) { b.disabled=false; b.textContent = b===btnCr ? 'Guardar como borrador':'Enviar al cliente'; } });
            return;
        }

        // Si el usuario eligió "Enviar al cliente" y puede aprobar como Jefe → avanzar el estado
        if (enviarAlCliente && puedeAprJefe && idsCreados.length > 0) {
            let avanzados = 0;
            for (const id of idsCreados) {
                if (!id) continue;
                try {
                    await api.presupuestos.enviarRevision(id);
                    await api.presupuestos.aprobarJefe(id, true, 'Aprobado por Jefe de Taller');
                    avanzados++;
                } catch { /* si falla uno, continuar */ }
            }
            utils.setPageMessage(msgEl, 'success',
                `✓ ${creados} servicio(s) creado(s) y enviado(s) al cliente de ${clienteSel.nombre}. ` +
                `${avanzados} listo(s) para aprobación del cliente.` +
                (errores>0 ? ` (${errores} con error)` : ''));
        } else {
            utils.setPageMessage(msgEl, 'success',
                `✓ ${creados} servicio(s) creado(s) como borrador para ${clienteSel.nombre}. ` +
                `Cuando estén listos, envíalos al cliente.` +
                (errores>0 ? ` (${errores} con error)` : ''));
        }

        [btnCr, btnEnv].forEach(b => { if(b) { b.disabled=false; b.textContent = b===btnCr ? 'Guardar como borrador':'Enviar al cliente'; } });
        document.getElementById('btn-reload')?.click();
    }
});
