document.addEventListener('DOMContentLoaded', () => {
    // StaffOnly: Admin, Recepcionista, JefeTaller, Mecánico (y subtipos)
    if (!window.AppAuth?.requireRole('admin', 'recep', 'jefetaller', 'mecan')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'ordenes' });
    if (!ctx) return;

    const { api, utils, user } = ctx;
    const roles = user?.roles ?? [];

    // Permisos por rol
    const puedeCrear     = utils.hasRole(roles, 'admin', 'recep', 'jefetaller');
    const puedeAprobar   = utils.hasRole(roles, 'admin', 'jefetaller');
    const puedeAsignar   = utils.hasRole(roles, 'admin', 'recep', 'jefetaller');
    const puedeFinalizar = utils.hasRole(roles, 'admin', 'jefetaller', 'mecan');
    const puedeCancelar  = utils.hasRole(roles, 'admin', 'recep', 'jefetaller');

    // Elementos UI
    const container   = document.getElementById('table-container');
    const messageEl   = document.getElementById('page-message');
    const paginEl     = document.getElementById('pagination-bar');
    const reloadBtn   = document.getElementById('btn-reload');
    const btnNueva    = document.getElementById('btn-nueva-orden');
    const filtroEstado = document.getElementById('filtro-estado');
    const btnFiltrar  = document.getElementById('btn-aplicar-filtro');

    if (puedeCrear) btnNueva.style.display = '';

    let currentPage = 1;
    const pageSize  = window.APP_CONFIG?.pagination?.defaultPageSize ?? 20;

    // ── Carga de tabla ───────────────────────────────────────────────────────

    async function cargarOrdenes() {
        utils.setLoading(container, true);
        utils.setPageMessage(messageEl, 'info', '');
        try {
            const estado = filtroEstado.value !== '' ? Number(filtroEstado.value) : undefined;
            const { items, total } = await api.ordenes.list({
                pagina: currentPage, tamano: pageSize, estado,
            });
            renderTabla(items);
            renderPaginacion(total);
        } catch (err) {
            container.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    function renderTabla(items) {
        if (!items?.length) {
            container.innerHTML = '<p class="table-empty">No hay órdenes con ese filtro.</p>';
            return;
        }

        const estadoInfo = {
            'Pendiente':  { cls: 'badge-pendiente',  label: 'Pendiente' },
            'Aprobada':   { cls: 'badge-aprobada',   label: 'Aprobada' },
            'En Proceso': { cls: 'badge-en-proceso',  label: 'En Proceso' },
            'Finalizada': { cls: 'badge-finalizada',  label: 'Finalizada' },
            'Cancelada':  { cls: 'badge-cancelada',   label: 'Cancelada' },
        };

        const rows = items.map(raw => {
            const o     = utils.mapOrden(raw);
            const eInfo = estadoInfo[o.estado] ?? { cls: 'badge', label: o.estado };
            const id    = raw.id ?? raw.Id ?? '';

            // Botones de acción según estado y rol
            let acciones = '';
            if (o.estado === 'Pendiente'  && puedeAprobar)   acciones += `<button class="btn-accion btn-aprobar"   data-id="${id}" data-cliente="${raw.clienteId ?? raw.ClienteId ?? ''}">Aprobar</button>`;
            if (o.estado === 'Aprobada'   && puedeAsignar)   acciones += `<button class="btn-accion btn-asignar"   data-id="${id}">Asignar Mec.</button>`;
            if (o.estado === 'En Proceso' && puedeFinalizar) acciones += `<button class="btn-accion btn-finalizar" data-id="${id}">Finalizar</button>`;
            if (['Pendiente','Aprobada','En Proceso'].includes(o.estado) && puedeCancelar)
                                                              acciones += `<button class="btn-accion btn-cancelar"  data-id="${id}">Cancelar</button>`;

            return `
            <tr>
                <td><span style="color:var(--bronze-gold);font-weight:500">#${utils.escapeHtml(o.ordenId)}</span></td>
                <td>${utils.escapeHtml(o.cliente)}</td>
                <td>${utils.escapeHtml(o.vin)}</td>
                <td><span class="badge ${eInfo.cls}">${eInfo.label}</span></td>
                <td>${utils.escapeHtml(o.mecanico === '—' ? 'Sin asignar' : o.mecanico)}</td>
                <td>${utils.formatDate(o.fechaIngreso)}</td>
                <td style="white-space:nowrap">${acciones || '<span style="color:var(--text-muted);font-size:11px">—</span>'}</td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Número</th>
                        <th>Cliente</th>
                        <th>Placa</th>
                        <th>Estado</th>
                        <th>Mecánico</th>
                        <th>Ingreso</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;

        // Eventos en los botones de acción
        container.querySelectorAll('.btn-aprobar').forEach(btn =>
            btn.addEventListener('click', () => aprobarOrden(btn.dataset.id, btn.dataset.cliente)));
        container.querySelectorAll('.btn-asignar').forEach(btn =>
            btn.addEventListener('click', () => abrirModalAsignar(btn.dataset.id)));
        container.querySelectorAll('.btn-finalizar').forEach(btn =>
            btn.addEventListener('click', () => finalizarOrden(btn.dataset.id)));
        container.querySelectorAll('.btn-cancelar').forEach(btn =>
            btn.addEventListener('click', () => abrirModalCancelar(btn.dataset.id)));
    }

    function renderPaginacion(total) {
        if (!paginEl) return;
        const totalPags = Math.ceil(total / pageSize);
        let html = `<span>${total} orden(es) · Página ${currentPage} de ${totalPags}</span>`;
        if (currentPage > 1)
            html += `<button class="btn-dashboard" style="padding:4px 12px;font-size:12px;margin-left:8px" id="pag-prev">← Anterior</button>`;
        if (currentPage < totalPags)
            html += `<button class="btn-dashboard" style="padding:4px 12px;font-size:12px;margin-left:4px" id="pag-next">Siguiente →</button>`;
        paginEl.innerHTML = html;
        document.getElementById('pag-prev')?.addEventListener('click', () => { currentPage--; cargarOrdenes(); });
        document.getElementById('pag-next')?.addEventListener('click', () => { currentPage++; cargarOrdenes(); });
    }

    reloadBtn?.addEventListener('click', () => { currentPage = 1; cargarOrdenes(); });
    btnFiltrar?.addEventListener('click', () => { currentPage = 1; cargarOrdenes(); });

    // ══ MODAL NUEVA ORDEN ════════════════════════════════════════════════════

    const modal        = document.getElementById('modal-nueva-orden');
    let stepActual     = 1;
    let clienteSel     = null;   // { id, nombreCompleto, numeroDocumento }
    let vehiculoSel    = null;   // { id, placa, marcaModelo }
    let timerBusCliente = null;
    let timerBusVeh     = null;

    function abrirModal() {
        stepActual  = 1;
        clienteSel  = null;
        vehiculoSel = null;
        document.getElementById('buscar-cliente').value   = '';
        document.getElementById('buscar-vehiculo').value  = '';
        document.getElementById('descripcion-orden').value = '';
        document.getElementById('lista-clientes').innerHTML  = '<p class="sel-empty">Escribe para buscar clientes</p>';
        document.getElementById('lista-vehiculos').innerHTML = '<p class="sel-empty">Escribe la placa para buscar</p>';
        document.getElementById('step1-next').disabled = true;
        document.getElementById('step2-next').disabled = true;
        irAStep(1);
        modal.classList.add('open');
        cargarTiposServicio();
    }

    function cerrarModal() { modal.classList.remove('open'); }
    function irAStep(n) {
        stepActual = n;
        document.getElementById('step-num').textContent = n;
        document.querySelectorAll('.form-step').forEach((el, i) =>
            el.classList.toggle('active', i + 1 === n));
    }

    btnNueva?.addEventListener('click', abrirModal);
    document.getElementById('modal-close-btn')?.addEventListener('click', cerrarModal);
    document.getElementById('modal-close-btn2')?.addEventListener('click', cerrarModal);
    modal?.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });

    // ── Paso 1: Buscar cliente ───────────────────────────────────────────────

    document.getElementById('buscar-cliente')?.addEventListener('input', e => {
        clearTimeout(timerBusCliente);
        const q = e.target.value.trim();
        if (q.length < 2) {
            document.getElementById('lista-clientes').innerHTML = '<p class="sel-empty">Escribe al menos 2 caracteres</p>';
            return;
        }
        timerBusCliente = setTimeout(() => buscarClientes(q), 350);
    });

    async function buscarClientes(q) {
        document.getElementById('lista-clientes').innerHTML = '<p class="sel-empty">Buscando...</p>';
        try {
            const { items } = await api.clientes.list({ busqueda: q, tamano: 8 });
            if (!items?.length) {
                document.getElementById('lista-clientes').innerHTML = '<p class="sel-empty">Sin resultados</p>';
                return;
            }
            document.getElementById('lista-clientes').innerHTML = items.map(c => `
                <div class="sel-item" data-id="${c.id ?? c.Id}" data-nombre="${utils.escapeHtml((c.nombres ?? c.Nombres ?? '') + ' ' + (c.apellidos ?? c.Apellidos ?? ''))}" data-doc="${utils.escapeHtml(c.numeroDocumento ?? c.NumeroDocumento ?? '')}">
                    ${utils.escapeHtml((c.nombres ?? c.Nombres ?? '') + ' ' + (c.apellidos ?? c.Apellidos ?? ''))}
                    <small>${utils.escapeHtml(c.tipoDocumento ?? c.TipoDocumento ?? '')} ${utils.escapeHtml(c.numeroDocumento ?? c.NumeroDocumento ?? '')} · ${utils.escapeHtml(c.email ?? c.Email ?? '')}</small>
                </div>`).join('');

            document.querySelectorAll('#lista-clientes .sel-item').forEach(el =>
                el.addEventListener('click', () => seleccionarCliente(el)));
        } catch (err) {
            document.getElementById('lista-clientes').innerHTML = `<p class="sel-empty">Error: ${utils.escapeHtml(err.message)}</p>`;
        }
    }

    function seleccionarCliente(el) {
        document.querySelectorAll('#lista-clientes .sel-item').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        clienteSel = { id: el.dataset.id, nombreCompleto: el.dataset.nombre, doc: el.dataset.doc };
        document.getElementById('step1-next').disabled = false;
    }

    document.getElementById('step1-next')?.addEventListener('click', () => {
        if (!clienteSel) return;
        document.getElementById('cliente-seleccionado-label').textContent = clienteSel.nombreCompleto;
        document.getElementById('resumen-cliente').textContent = clienteSel.nombreCompleto;
        irAStep(2);
    });

    // ── Paso 2: Buscar vehículo ──────────────────────────────────────────────

    document.getElementById('buscar-vehiculo')?.addEventListener('input', e => {
        clearTimeout(timerBusVeh);
        const q = e.target.value.trim();
        if (q.length < 2) {
            document.getElementById('lista-vehiculos').innerHTML = '<p class="sel-empty">Escribe la placa del vehículo</p>';
            return;
        }
        timerBusVeh = setTimeout(() => buscarVehiculos(q), 350);
    });

    async function buscarVehiculos(placa) {
        document.getElementById('lista-vehiculos').innerHTML = '<p class="sel-empty">Buscando...</p>';
        try {
            const { items } = await api.vehiculos.list({ tamano: 10, placa });
            if (!items?.length) {
                document.getElementById('lista-vehiculos').innerHTML = '<p class="sel-empty">Sin resultados para esa placa</p>';
                return;
            }
            document.getElementById('lista-vehiculos').innerHTML = items.map(v => {
                const pm = `${v.placa ?? v.Placa ?? ''}`;
                const marca = `${v.marca ?? v.Marca ?? ''} ${v.modelo ?? v.Modelo ?? ''}`.trim();
                const anio  = v.anio ?? v.Anio ?? '';
                return `<div class="sel-item" data-id="${v.id ?? v.Id}" data-placa="${utils.escapeHtml(pm)}" data-mm="${utils.escapeHtml(marca)}">
                    ${utils.escapeHtml(pm)} — ${utils.escapeHtml(marca)}
                    <small>${utils.escapeHtml(String(anio))}</small>
                </div>`;
            }).join('');

            document.querySelectorAll('#lista-vehiculos .sel-item').forEach(el =>
                el.addEventListener('click', () => seleccionarVehiculo(el)));
        } catch (err) {
            document.getElementById('lista-vehiculos').innerHTML = `<p class="sel-empty">Error: ${utils.escapeHtml(err.message)}</p>`;
        }
    }

    function seleccionarVehiculo(el) {
        document.querySelectorAll('#lista-vehiculos .sel-item').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        vehiculoSel = { id: el.dataset.id, placa: el.dataset.placa, marcaModelo: el.dataset.mm };
        document.getElementById('step2-next').disabled = false;
    }

    document.getElementById('step2-back')?.addEventListener('click', () => irAStep(1));
    document.getElementById('step2-next')?.addEventListener('click', () => {
        if (!vehiculoSel) return;
        document.getElementById('resumen-vehiculo').textContent = `${vehiculoSel.placa} — ${vehiculoSel.marcaModelo}`;
        irAStep(3);
    });

    // ── Paso 3: Tipos de servicio y descripción ──────────────────────────────

    async function cargarTiposServicio() {
        try {
            const resp = await api.catalogos.tiposServicio();
            const tipos = resp?.data ?? resp ?? [];
            const sel   = document.getElementById('tipo-servicio');
            if (Array.isArray(tipos) && tipos.length) {
                sel.innerHTML = '<option value="">Sin especificar</option>' +
                    tipos.map(t => `<option value="${t.id ?? t.Id}">${utils.escapeHtml(t.nombre ?? t.Nombre ?? '')}</option>`).join('');
            }
        } catch { /* opcional — no bloquea */ }
    }

    document.getElementById('step3-back')?.addEventListener('click', () => irAStep(2));

    document.getElementById('btn-crear-orden')?.addEventListener('click', async () => {
        const desc = document.getElementById('descripcion-orden').value.trim();
        if (!desc) { utils.setPageMessage(messageEl, 'error', 'La descripción del trabajo es obligatoria.'); cerrarModal(); return; }
        if (!clienteSel || !vehiculoSel) return;

        const btnText = document.getElementById('btn-crear-text');
        btnText.textContent = 'Creando...';
        document.getElementById('btn-crear-orden').disabled = true;

        const tipoId = document.getElementById('tipo-servicio').value || null;
        try {
            const result = await api.ordenes.crear({
                ClienteId:      clienteSel.id,
                VehiculoId:     vehiculoSel.id,
                Descripcion:    desc,
                TipoServicioId: tipoId,
                Detalles:       null,
                ManosObra:      null,
            });
            cerrarModal();
            const data = result?.data ?? result;
            const num  = data?.numeroOrden ?? data?.NumeroOrden ?? 'nueva';
            utils.setPageMessage(messageEl, 'success', `✓ Orden #${num} creada para ${clienteSel.nombreCompleto}. El cliente puede revisarla en su portal.`);
            currentPage = 1;
            cargarOrdenes();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
            cerrarModal();
        } finally {
            btnText.textContent = 'Crear Orden';
            document.getElementById('btn-crear-orden').disabled = false;
        }
    });

    // ══ ACCIÓN: APROBAR ══════════════════════════════════════════════════════

    async function aprobarOrden(ordenId, clienteId) {
        if (!confirm('¿Aprobar esta orden e iniciar el proceso de trabajo?')) return;
        try {
            await api.ordenes.aprobar(ordenId, clienteId);
            utils.setPageMessage(messageEl, 'success', '✓ Orden aprobada. Ya puede asignarse un mecánico.');
            cargarOrdenes();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    // ══ ACCIÓN: ASIGNAR MECÁNICO ════════════════════════════════════════════

    const modalAsignar = document.getElementById('modal-asignar');
    let ordenIdAsignar = null;
    let mecanicoSel    = null;

    async function abrirModalAsignar(ordenId) {
        ordenIdAsignar = ordenId;
        mecanicoSel    = null;
        document.getElementById('btn-confirmar-asignar').disabled = true;
        document.getElementById('lista-mecanicos').innerHTML = '<p class="sel-empty">Cargando...</p>';
        modalAsignar.classList.add('open');
        try {
            const { items } = await api.empleados.list({ tamano: 100 });
            const mecanicos = (items ?? []).filter(e => [0,1,5,6].includes(e.tipoEmpleado ?? e.TipoEmpleado));
            if (!mecanicos.length) { document.getElementById('lista-mecanicos').innerHTML = '<p class="sel-empty">No hay mecánicos registrados</p>'; return; }

            const tipo = { 0:'Mecánico', 1:'Eléctrico', 5:'Diagnóstico', 6:'Área' };
            document.getElementById('lista-mecanicos').innerHTML = mecanicos.map(m => {
                const nombre = `${m.nombres ?? m.Nombres ?? ''} ${m.apellidos ?? m.Apellidos ?? ''}`.trim();
                const t      = tipo[m.tipoEmpleado ?? m.TipoEmpleado] ?? 'Técnico';
                const esp    = m.especialidad ?? m.Especialidad ?? 'Sin especialidad';
                return `<div class="sel-item" data-id="${m.id ?? m.Id}">
                    ${utils.escapeHtml(nombre)}
                    <small>${t} · ${utils.escapeHtml(esp)}</small>
                </div>`;
            }).join('');

            document.querySelectorAll('#lista-mecanicos .sel-item').forEach(el =>
                el.addEventListener('click', () => {
                    document.querySelectorAll('#lista-mecanicos .sel-item').forEach(e => e.classList.remove('selected'));
                    el.classList.add('selected');
                    mecanicoSel = el.dataset.id;
                    document.getElementById('btn-confirmar-asignar').disabled = false;
                }));
        } catch (err) {
            document.getElementById('lista-mecanicos').innerHTML = `<p class="sel-empty">Error: ${utils.escapeHtml(err.message)}</p>`;
        }
    }

    document.getElementById('asignar-close')?.addEventListener('click',  () => modalAsignar.classList.remove('open'));
    document.getElementById('asignar-close2')?.addEventListener('click', () => modalAsignar.classList.remove('open'));
    modalAsignar?.addEventListener('click', e => { if (e.target === modalAsignar) modalAsignar.classList.remove('open'); });

    document.getElementById('btn-confirmar-asignar')?.addEventListener('click', async () => {
        if (!mecanicoSel) return;
        try {
            await api.ordenes.asignarMecanico(ordenIdAsignar, mecanicoSel);
            modalAsignar.classList.remove('open');
            utils.setPageMessage(messageEl, 'success', '✓ Mecánico asignado correctamente.');
            cargarOrdenes();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
            modalAsignar.classList.remove('open');
        }
    });

    // ══ ACCIÓN: FINALIZAR ════════════════════════════════════════════════════

    async function finalizarOrden(ordenId) {
        if (!confirm('¿Marcar esta orden como FINALIZADA?')) return;
        try {
            await api.ordenes.finalizar(ordenId);
            utils.setPageMessage(messageEl, 'success', '✓ Orden finalizada. Ya puede generarse la factura.');
            cargarOrdenes();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    // ══ ACCIÓN: CANCELAR ════════════════════════════════════════════════════

    const modalCancelar = document.getElementById('modal-cancelar');
    let ordenIdCancelar = null;

    function abrirModalCancelar(ordenId) {
        ordenIdCancelar = ordenId;
        document.getElementById('motivo-cancelacion').value = '';
        modalCancelar.classList.add('open');
    }

    document.getElementById('cancelar-close')?.addEventListener('click',  () => modalCancelar.classList.remove('open'));
    document.getElementById('cancelar-close2')?.addEventListener('click', () => modalCancelar.classList.remove('open'));
    modalCancelar?.addEventListener('click', e => { if (e.target === modalCancelar) modalCancelar.classList.remove('open'); });

    document.getElementById('btn-confirmar-cancelar')?.addEventListener('click', async () => {
        const motivo = document.getElementById('motivo-cancelacion').value.trim();
        if (!motivo) { alert('Debes escribir un motivo de cancelación.'); return; }
        try {
            await api.ordenes.cancelar(ordenIdCancelar, motivo);
            modalCancelar.classList.remove('open');
            utils.setPageMessage(messageEl, 'success', '✓ Orden cancelada.');
            cargarOrdenes();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
            modalCancelar.classList.remove('open');
        }
    });

    // ── Arranque ─────────────────────────────────────────────────────────────
    cargarOrdenes();
});
