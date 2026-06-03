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
            ${(mat>0||mano>0) ? `<div class="servicio-detalle">
                <span class="dl">Materiales</span><span class="dv">$${mat.toLocaleString('es-CO')}</span>
                <span class="dl">Mano de obra</span><span class="dv">$${mano.toLocaleString('es-CO')}</span>
                <span class="dl">Técnico</span><span class="dv">${utils.escapeHtml(mecanico)}</span>
            </div>` : ''}
            <div class="servicio-decision">
                <button class="btn-si"  data-id="${id}">✓ Sí, quiero este servicio</button>
                <button class="btn-no"  data-id="${id}">✗ No, cancelar este servicio</button>
            </div>`;
        card.querySelector('.btn-si').addEventListener('click', () => setDecision(id, 'si'));
        card.querySelector('.btn-no').addEventListener('click', () => setDecision(id, 'no'));
        card.querySelector('.servicio-toggle').addEventListener('click', () => {
            const actual = serviciosState[id]?.decision;
            setDecision(id, actual === 'si' ? null : 'si');
        });
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
                `✓ Decisión enviada. ${aprobados} servicio(s) aprobado(s) — se generaron las órdenes de trabajo. ${rechazados} cancelado(s).`);
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
            2:{label:'Aprobado por Jefe',            cls:'est-revision-jefe'},
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
                    btns.push(`<button class="btn-accion btn-aprobar"  data-id="${id}" data-accion="jefe-aprobar">Aprobar</button>`);
                    btns.push(`<button class="btn-accion btn-rechazar" data-id="${id}" data-accion="jefe-rechazar">Rechazar</button>`);
                }
                if (estado===3 && puedeAprCli) {
                    btns.push(`<button class="btn-accion btn-aprobar"  data-id="${id}" data-accion="cli-aprobar">✓ Aprobar por cliente</button>`);
                    btns.push(`<button class="btn-accion btn-rechazar" data-id="${id}" data-accion="cli-rechazar">✗ Rechazar</button>`);
                }
                if (estado===5 && (puedeCriar || puedeAprJefe))
                    btns.push(`<button class="btn-accion btn-completar" data-id="${id}" data-accion="completar">Completar</button>`);
                btns.push(`<button class="btn-accion" style="border-color:var(--text-muted);color:var(--text-muted)" data-id="${id}" data-accion="ver">Detalle</button>`);

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
            if (accion === 'ver')       { await mostrarDetalle(id); return; }
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
                'jefe-aprobar':  { titulo:'Aprobar — se enviará al cliente', info:'El presupuesto pasará a esperar aprobación del cliente.', aprobado:true,  obsReq:false, fn:obs=>api.presupuestos.aprobarJefe(id,true,obs) },
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
                if (d?.numeroOrden || d?.NumeroOrden) msg += ` OS #${d.numeroOrden??d.NumeroOrden} generada.`;
                utils.setPageMessage(messageEl, 'success', msg);
                cargar();
            } catch (err) { utils.setPageMessage(messageEl, 'error', err.message); }
        }

        // Detalle
        const modalDetalle = document.getElementById('modal-detalle');
        async function mostrarDetalle(id) {
            modalDetalle.classList.add('open');
            document.getElementById('detalle-body').innerHTML   = '<p style="color:var(--text-muted)">Cargando...</p>';
            document.getElementById('detalle-acciones').innerHTML = '';
            try {
                const resp  = await api.presupuestos.getById(id);
                const p     = resp?.data ?? resp;
                const estado = p.estado ?? p.Estado ?? 0;
                const eInfo  = ESTADOS[estado] ?? {label:String(estado),cls:''};
                document.getElementById('detalle-titulo').innerHTML =
                    `Presupuesto <strong>${utils.escapeHtml(p.numeroMiniOrden??'')}</strong> ` +
                    `<span class="badge ${eInfo.cls}" style="font-size:11px">${eInfo.label}</span>` +
                    `<button class="modal-close" id="detalle-close">✕</button>`;
                document.getElementById('detalle-close')?.addEventListener('click', () => modalDetalle.classList.remove('open'));
                const lineas = [
                    ['Técnico',      p.mecanicoNombre   ??'—'],
                    ['Jefe Taller',  p.jefeTallerNombre ??'—'],
                    ['Descripción',  p.descripcion      ??'—'],
                    ['Observaciones',p.observaciones    ??'—'],
                    ['Motivo rechazo',p.motivoRechazo   ??'—'],
                    ['Materiales',   `$${Number(p.totalMateriales??0).toLocaleString('es-CO')}`],
                    ['Mano de obra', `$${Number(p.totalManoObra??0).toLocaleString('es-CO')}`],
                    ['TOTAL',        `$${Number(p.total??0).toLocaleString('es-CO')}`],
                    ['OS generada',  p.numeroOrden      ??'No aún'],
                ].filter(([,v])=>v&&v!=='—');
                document.getElementById('detalle-body').innerHTML = lineas.map(([l,v],i)=>`
                    <span style="color:var(--text-muted)">${utils.escapeHtml(l)}</span>
                    <span style="${i===lineas.length-1&&l==='TOTAL'?'color:var(--champagne-gold);font-weight:600;font-size:15px':'color:var(--text-ivory)'}">${utils.escapeHtml(v)}</span>
                `).join('');
                const btns = document.getElementById('detalle-acciones');
                if (estado===0&&puedeCriar)   btns.innerHTML += `<button class="btn-dashboard btn-enviar" style="border-color:#fbbf24;color:#fbbf24" data-id="${id}" data-accion="enviar">Enviar al Jefe</button>`;
                if (estado===1&&puedeAprJefe) { btns.innerHTML += `<button class="btn-dashboard btn-aprobar" style="border-color:#4ade80;color:#4ade80" data-id="${id}" data-accion="jefe-aprobar">Aprobar</button>`; btns.innerHTML += `<button class="btn-dashboard btn-rechazar" style="border-color:#f87171;color:#f87171" data-id="${id}" data-accion="jefe-rechazar">Rechazar</button>`; }
                if (estado===3&&puedeAprCli)  { btns.innerHTML += `<button class="btn-dashboard btn-aprobar" style="border-color:#4ade80;color:#4ade80;font-weight:600" data-id="${id}" data-accion="cli-aprobar">✓ Aprobar por cliente</button>`; btns.innerHTML += `<button class="btn-dashboard btn-rechazar" style="border-color:#f87171;color:#f87171" data-id="${id}" data-accion="cli-rechazar">✗ Rechazar</button>`; }
                if (estado===5&&(puedeCriar||puedeAprJefe)) btns.innerHTML += `<button class="btn-dashboard btn-completar" style="border-color:#38bdf8;color:#38bdf8" data-id="${id}" data-accion="completar">Completar</button>`;
                btns.querySelectorAll('[data-accion]').forEach(btn=>btn.addEventListener('click',()=>{ modalDetalle.classList.remove('open'); manejarAccion(btn.dataset.id,btn.dataset.accion); }));
            } catch (err) {
                document.getElementById('detalle-body').innerHTML = `<p style="color:#f87171">Error: ${utils.escapeHtml(err.message)}</p>`;
            }
        }
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
            if (d?.numeroOrden||d?.NumeroOrden) msg += ` OS #${d.numeroOrden??d.NumeroOrden} generada.`;
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
    let debCli, debVeh;
    // Lista de servicios a crear
    let listaServicios = [];   // [{ desc, obs }]

    document.getElementById('btn-nuevo')?.addEventListener('click', abrirModalNuevo);
    const cerrarNuevo = () => modalNuevo.classList.remove('open');
    document.getElementById('nuevo-close')?.addEventListener('click', cerrarNuevo);
    document.getElementById('nuevo-cancel')?.addEventListener('click', cerrarNuevo);
    modalNuevo?.addEventListener('click', e => { if (e.target===modalNuevo) cerrarNuevo(); });

    function abrirModalNuevo() {
        clienteSel = vehiculoSel = null;
        listaServicios = [{ desc:'', obs:'' }];
        ['nuevo-buscar-cliente','nuevo-buscar-veh'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
        document.getElementById('nuevo-cliente-sel').textContent = '';
        document.getElementById('nuevo-veh-sel').textContent     = '';
        document.getElementById('nuevo-lista-clientes').style.display = 'none';
        document.getElementById('nuevo-lista-veh').style.display      = 'none';
        document.getElementById('nuevo-veh-wrap').style.display        = 'none';
        renderListaServicios();
        modalNuevo.classList.add('open');
    }

    // Render de la lista de servicios
    function renderListaServicios() {
        const wrap = document.getElementById('nuevo-servicios-wrap');
        if (!wrap) return;
        wrap.innerHTML = listaServicios.map((s, i) => `
            <div style="background:rgba(255,255,255,.03);border:1px solid var(--gold-border);border-radius:5px;padding:14px;margin-bottom:10px;position:relative">
                <div style="font-size:11px;color:var(--bronze-gold);margin-bottom:8px;letter-spacing:.08em">SERVICIO ${i+1}</div>
                <div class="form-field" style="margin-bottom:8px">
                    <label style="font-size:11px">Descripción del servicio *</label>
                    <textarea class="modal-textarea" data-svc="${i}" data-field="desc"
                        style="min-height:60px"
                        placeholder="Ej: Cambio de filtro de aire, revisión de frenos, alineación...">${utils.escapeHtml(s.desc)}</textarea>
                </div>
                <div class="form-field">
                    <label style="font-size:11px">Observaciones (opcional)</label>
                    <textarea class="modal-textarea" data-svc="${i}" data-field="obs"
                        style="min-height:44px"
                        placeholder="Notas adicionales para este servicio...">${utils.escapeHtml(s.obs)}</textarea>
                </div>
                ${listaServicios.length > 1 ? `<button class="btn-accion btn-rechazar" data-rm="${i}" style="position:absolute;top:12px;right:12px;padding:2px 8px">✕ Quitar</button>` : ''}
            </div>`).join('');

        // Eventos textarea
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
    }

    document.getElementById('nuevo-agregar-servicio')?.addEventListener('click', () => {
        listaServicios.push({ desc:'', obs:'' });
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
                document.getElementById('nuevo-veh-wrap').style.display = '';
            }));
        } catch { lista.innerHTML='<div class="search-empty" style="color:#f87171">Error al buscar</div>'; }
    }

    // Búsqueda vehículo
    document.getElementById('nuevo-buscar-veh')?.addEventListener('input', e => {
        clearTimeout(debVeh);
        const q = e.target.value.trim();
        if (q.length<2) { document.getElementById('nuevo-lista-veh').style.display='none'; return; }
        debVeh = setTimeout(() => buscarVehiculoModal(q), 350);
    });
    async function buscarVehiculoModal(placa) {
        const lista = document.getElementById('nuevo-lista-veh');
        lista.innerHTML='<div class="search-empty">Buscando...</div>'; lista.style.display='';
        try {
            const { items } = await api.vehiculos.list({ placa, tamano:8 });
            if (!items?.length) { lista.innerHTML='<div class="search-empty">Sin resultados</div>'; return; }
            lista.innerHTML = items.map(v => {
                const pm = v.placa??v.Placa??'';
                const mm = `${v.marca??v.Marca??''} ${v.modelo??v.Modelo??''}`.trim();
                return `<div class="search-item" data-id="${v.id}" data-placa="${utils.escapeHtml(pm)}">
                    ${utils.escapeHtml(pm)} — ${utils.escapeHtml(mm)}<small>${v.anio??''}</small>
                </div>`;
            }).join('');
            lista.querySelectorAll('.search-item').forEach(el=>el.addEventListener('click',()=>{
                vehiculoSel={id:el.dataset.id,placa:el.dataset.placa};
                document.getElementById('nuevo-veh-sel').textContent=`✓ Vehículo: ${el.dataset.placa}`;
                lista.style.display='none';
            }));
        } catch { lista.innerHTML='<div class="search-empty" style="color:#f87171">Error al buscar</div>'; }
    }

    // Crear servicios
    document.getElementById('nuevo-crear')?.addEventListener('click', () => crearServicios(false));
    document.getElementById('nuevo-crear-y-enviar')?.addEventListener('click', () => crearServicios(true));

    async function crearServicios(enviarAlCliente) {
        if (!clienteSel)   { alert('Selecciona un cliente.'); return; }
        if (!vehiculoSel)  { alert('Selecciona un vehículo.'); return; }
        const validos = listaServicios.filter(s => s.desc.trim());
        if (!validos.length) { alert('Agrega al menos un servicio con descripción.'); return; }

        const msgEl  = document.getElementById('page-message');
        const btnCr  = document.getElementById('nuevo-crear');
        const btnEnv = document.getElementById('nuevo-crear-y-enviar');
        [btnCr, btnEnv].forEach(b => { if(b) { b.disabled=true; b.textContent='Procesando…'; } });

        cerrarNuevo();

        let creados=0, errores=0;
        const idsCreados = [];

        for (const svc of validos) {
            try {
                const result = await api.presupuestos.crear({
                    ClienteId: clienteSel.id, VehiculoId: vehiculoSel.id,
                    Descripcion: svc.desc.trim(), Observaciones: svc.obs.trim()||null,
                    Detalles: [], ManosObra: null,
                });
                const data = result?.data ?? result;
                idsCreados.push(data?.id ?? data?.Id);
                creados++;
            } catch { errores++; }
        }

        if (creados === 0) {
            utils.setPageMessage(msgEl, 'error', 'No se pudo crear ningún servicio. Verifica los datos.');
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
