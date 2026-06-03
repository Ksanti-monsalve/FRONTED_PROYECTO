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
    const puedeEliminar  = utils.hasRole(roles, 'admin', 'jefetaller');

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
            const tipoSvcId = raw.tipoServicioId ?? raw.TipoServicioId ?? '';
            let acciones = `<button class="btn-accion btn-detalle" data-id="${id}">Ver</button>`;
            if (o.estado === 'Pendiente'  && puedeAprobar)   acciones += `<button class="btn-accion btn-aprobar"   data-id="${id}" data-cliente="${raw.clienteId ?? raw.ClienteId ?? ''}">Aprobar</button>`;
            if (o.estado === 'Aprobada'   && puedeAsignar)   acciones += `<button class="btn-accion btn-asignar"   data-id="${id}" data-tipo-svc="${tipoSvcId}">Asignar Mec.</button>`;
            if (o.estado === 'En Proceso' && puedeFinalizar) acciones += `<button class="btn-accion btn-finalizar" data-id="${id}">Finalizar</button>`;
            if (['Pendiente','Aprobada','En Proceso'].includes(o.estado) && puedeCancelar)
                                                              acciones += `<button class="btn-accion btn-cancelar"  data-id="${id}">Cancelar</button>`;
            if (puedeEliminar)
                acciones += `<button class="btn-accion btn-eliminar" data-id="${id}"
                    style="border-color:#6b7280;color:#6b7280;font-size:10px">🗑</button>`;

            return `
            <tr>
                <td><span style="color:var(--bronze-gold);font-weight:500">#${utils.escapeHtml(o.ordenId)}</span></td>
                <td>${utils.escapeHtml(o.cliente)}</td>
                <td>${utils.escapeHtml(o.vin)}</td>
                <td><span class="badge ${eInfo.cls}">${eInfo.label}</span></td>
                <td>${utils.escapeHtml(o.mecanico === '—' ? 'Sin asignar' : o.mecanico)}</td>
                <td>${utils.formatDate(o.fechaIngreso)}</td>
                <td style="white-space:nowrap">${acciones}</td>
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
        container.querySelectorAll('.btn-detalle').forEach(btn =>
            btn.addEventListener('click', () => abrirDetalleOrden(btn.dataset.id)));
        container.querySelectorAll('.btn-aprobar').forEach(btn =>
            btn.addEventListener('click', () => aprobarOrden(btn.dataset.id, btn.dataset.cliente)));
        container.querySelectorAll('.btn-asignar').forEach(btn =>
            btn.addEventListener('click', () => abrirModalAsignar(btn.dataset.id, btn.dataset.tipoSvc)));
        container.querySelectorAll('.btn-finalizar').forEach(btn =>
            btn.addEventListener('click', () => finalizarOrden(btn.dataset.id)));
        container.querySelectorAll('.btn-cancelar').forEach(btn =>
            btn.addEventListener('click', () => abrirModalCancelar(btn.dataset.id)));
        container.querySelectorAll('.btn-eliminar').forEach(btn =>
            btn.addEventListener('click', () => eliminarOrden(btn.dataset.id)));
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

    function abrirModal() {
        stepActual  = 1;
        clienteSel  = null;
        vehiculoSel = null;
        document.getElementById('buscar-cliente').value    = '';
        document.getElementById('descripcion-orden').value = '';
        document.getElementById('lista-clientes').innerHTML  = '<p class="sel-empty">Escribe para buscar clientes</p>';
        document.getElementById('lista-vehiculos').innerHTML = '<p class="sel-empty">Selecciona un cliente primero</p>';
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
        vehiculoSel = null;
        document.getElementById('step2-next').disabled = true;
        irAStep(2);
        cargarVehiculosCliente();
    });

    // ── Paso 2: Vehículos del cliente (carga automática) ─────────────────────

    async function cargarVehiculosCliente() {
        const lista = document.getElementById('lista-vehiculos');
        lista.innerHTML = '<p class="sel-empty">Cargando vehículos...</p>';
        try {
            const { items } = await api.vehiculos.list({ tamano: 50, clienteId: clienteSel?.id });
            if (!items?.length) {
                lista.innerHTML = `<p class="sel-empty" style="color:#f87171">
                    Este cliente no tiene vehículos registrados a su nombre.<br>
                    <small style="color:var(--text-muted)">Regístrele un vehículo primero.</small>
                </p>`;
                return;
            }
            renderListaVehiculos(lista, items);
        } catch (err) {
            lista.innerHTML = `<p class="sel-empty">Error al cargar: ${utils.escapeHtml(err.message)}</p>`;
        }
    }

    function renderListaVehiculos(lista, items) {
        lista.innerHTML = items.map(v => {
            const pm    = v.placa  ?? v.Placa  ?? '';
            const marca = `${v.marca ?? v.Marca ?? ''} ${v.modelo ?? v.Modelo ?? ''}`.trim();
            const anio  = v.anio   ?? v.Anio   ?? '';
            const km    = v.kilometrajeActual ?? v.KilometrajeActual ?? 0;
            return `<div class="sel-item" data-id="${v.id ?? v.Id}"
                        data-placa="${utils.escapeHtml(pm)}" data-mm="${utils.escapeHtml(marca)}">
                <strong style="color:var(--champagne-gold)">${utils.escapeHtml(pm)}</strong>
                — ${utils.escapeHtml(marca)}
                <small>${anio}${km ? ` · ${Number(km).toLocaleString('es-CO')} km` : ''}</small>
            </div>`;
        }).join('');
        lista.querySelectorAll('.sel-item').forEach(el =>
            el.addEventListener('click', () => seleccionarVehiculo(el)));
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

    async function abrirModalAsignar(ordenId, tipoServicioId) {
        ordenIdAsignar = ordenId;
        mecanicoSel    = null;
        document.getElementById('btn-confirmar-asignar').disabled = true;
        document.getElementById('lista-mecanicos').innerHTML = '<p class="sel-empty">Cargando...</p>';
        modalAsignar.classList.add('open');
        try {
            // Si la orden tiene tipo de servicio, filtrar mecánicos especializados + generales
            const params = { tamano: 100 };
            if (tipoServicioId) params.tipoServicioId = tipoServicioId;

            const { items } = await api.empleados.list(params);
            const mecanicos = (items ?? []).filter(e => [0,1,5,6].includes(e.tipoEmpleado ?? e.TipoEmpleado));

            if (!mecanicos.length) {
                document.getElementById('lista-mecanicos').innerHTML =
                    '<p class="sel-empty">No hay mecánicos disponibles para este tipo de servicio.</p>';
                return;
            }

            const tipoLabel = { 0:'Mecánico', 1:'Eléctrico', 5:'Diagnóstico', 6:'Área' };

            // Separar: especializados (tienen TipoServicioId = el de la orden) vs generales
            const especializados = tipoServicioId
                ? mecanicos.filter(m => (m.tipoServicioId ?? m.TipoServicioId) === tipoServicioId)
                : [];
            const generales = mecanicos.filter(m => !(m.tipoServicioId ?? m.TipoServicioId) ||
                (m.tipoServicioId ?? m.TipoServicioId) !== tipoServicioId);

            const renderMec = (m, destacado) => {
                const nombre = `${m.nombres ?? m.Nombres ?? ''} ${m.apellidos ?? m.Apellidos ?? ''}`.trim();
                const t      = tipoLabel[m.tipoEmpleado ?? m.TipoEmpleado] ?? 'Técnico';
                const esp    = m.especialidad ?? m.Especialidad ?? 'Sin especialidad';
                return `<div class="sel-item" data-id="${m.id ?? m.Id}"
                    style="${destacado ? 'border-left:3px solid var(--bronze-gold);' : ''}">
                    ${destacado ? '<span style="font-size:10px;color:var(--bronze-gold);margin-right:6px">★</span>' : ''}
                    ${utils.escapeHtml(nombre)}
                    <small>${t} · ${utils.escapeHtml(esp)}</small>
                </div>`;
            };

            let html = '';
            if (especializados.length) {
                html += `<p style="font-size:10px;color:var(--bronze-gold);padding:6px 14px;margin:0;letter-spacing:.08em">ESPECIALIZADOS EN ESTE SERVICIO</p>`;
                html += especializados.map(m => renderMec(m, true)).join('');
            }
            if (generales.length) {
                if (especializados.length)
                    html += `<p style="font-size:10px;color:var(--text-muted);padding:6px 14px;margin:0;letter-spacing:.08em">OTROS TÉCNICOS</p>`;
                html += generales.map(m => renderMec(m, false)).join('');
            }

            document.getElementById('lista-mecanicos').innerHTML = html;

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

    // ══ MODAL DETALLE ORDEN ══════════════════════════════════════════════════

    const modalDetalle    = document.getElementById('modal-detalle-orden');
    const modalAddRepuesto = document.getElementById('modal-add-repuesto');
    const modalAddMano    = document.getElementById('modal-add-mano');

    let ordenDetalleId    = null;
    let ordenDetalleEstado = null;
    let repuestosCache    = [];
    let mecanicosCache    = [];

    const puedeEditarDetalle = utils.hasRole(roles, 'admin', 'jefetaller', 'mecan');

    async function abrirDetalleOrden(ordenId) {
        ordenDetalleId = ordenId;
        document.getElementById('detalle-numero-orden').textContent = '';
        document.getElementById('detalle-info-basica').innerHTML = '<span style="color:var(--text-muted);font-size:12px">Cargando...</span>';
        document.getElementById('detalle-tabla-repuestos').innerHTML = '';
        document.getElementById('detalle-tabla-manos-obra').innerHTML = '';
        document.getElementById('detalle-total').textContent = '$0';
        modalDetalle.classList.add('open');

        try {
            const raw = await api.ordenes.getById(ordenId);
            const data = raw?.data ?? raw;
            renderDetalleOrden(data);
        } catch (err) {
            document.getElementById('detalle-info-basica').innerHTML =
                `<span style="color:#f87171;font-size:12px">Error: ${utils.escapeHtml(err.message)}</span>`;
        }
    }

    function renderDetalleOrden(data) {
        const num     = data?.numeroOrden ?? data?.NumeroOrden ?? '—';
        const estado  = data?.estado ?? data?.Estado ?? '—';
        const cliente = data?.clienteNombre ?? data?.ClienteNombre ?? '—';
        const vehiculo = data?.vehiculoPlaca ?? data?.VehiculoPlaca ?? '—';
        const mecanico = data?.mecanicoNombre ?? data?.MecanicoNombre ?? 'Sin asignar';
        const tipo    = data?.tipoServicioNombre ?? data?.TipoServicioNombre ?? '—';
        const desc    = data?.descripcion ?? data?.Descripcion ?? '—';
        const total   = data?.total ?? data?.Total ?? 0;
        const detalles = data?.detalles ?? data?.Detalles ?? [];
        const manosObra = data?.manosObra ?? data?.ManosObra ?? [];

        ordenDetalleEstado = typeof estado === 'string' ? estado : String(estado);

        document.getElementById('detalle-numero-orden').textContent = `#${num}`;

        document.getElementById('detalle-info-basica').innerHTML = `
            <div><span style="color:var(--text-muted)">Cliente:</span> ${utils.escapeHtml(cliente)}</div>
            <div><span style="color:var(--text-muted)">Vehículo:</span> ${utils.escapeHtml(vehiculo)}</div>
            <div><span style="color:var(--text-muted)">Mecánico:</span> ${utils.escapeHtml(mecanico)}</div>
            <div><span style="color:var(--text-muted)">Tipo de servicio:</span> ${utils.escapeHtml(tipo)}</div>
            <div style="grid-column:1/-1"><span style="color:var(--text-muted)">Descripción:</span> ${utils.escapeHtml(desc)}</div>
        `;

        // Repuestos
        const tbodyRep = document.getElementById('detalle-tabla-repuestos');
        if (!detalles.length) {
            tbodyRep.innerHTML = `<tr><td colspan="5" class="detalle-empty">Sin repuestos registrados</td></tr>`;
        } else {
            tbodyRep.innerHTML = detalles.map(d => {
                const nombre  = d.repuestoNombre ?? d.RepuestoNombre ?? '—';
                const cant    = d.cantidad ?? d.Cantidad ?? 0;
                const precio  = d.precioUnitario ?? d.PrecioUnitario ?? 0;
                const sub     = d.subtotal ?? d.Subtotal ?? (cant * precio);
                const dId     = d.id ?? d.Id ?? '';
                const btnDel  = puedeEditarDetalle
                    ? `<td><button class="btn-remove-item" data-detalle-id="${dId}" title="Eliminar">✕</button></td>`
                    : '<td></td>';
                return `<tr>
                    <td>${utils.escapeHtml(nombre)}</td>
                    <td style="text-align:center">${cant}</td>
                    <td style="text-align:right">$${Number(precio).toLocaleString('es-CO')}</td>
                    <td style="text-align:right">$${Number(sub).toLocaleString('es-CO')}</td>
                    ${btnDel}
                </tr>`;
            }).join('');

            tbodyRep.querySelectorAll('.btn-remove-item[data-detalle-id]').forEach(btn =>
                btn.addEventListener('click', () => eliminarDetalle(btn.dataset.detalleId)));
        }

        // Mano de obra
        const tbodyMano = document.getElementById('detalle-tabla-manos-obra');
        if (!manosObra.length) {
            tbodyMano.innerHTML = `<tr><td colspan="5" class="detalle-empty">Sin mano de obra registrada</td></tr>`;
        } else {
            tbodyMano.innerHTML = manosObra.map(m => {
                const desc2   = m.descripcion ?? m.Descripcion ?? '—';
                const mec     = m.empleadoNombre ?? m.EmpleadoNombre ?? '—';
                const horas   = m.horasTrabajadas ?? m.HorasTrabajadas ?? 0;
                const costo   = m.costo ?? m.Costo ?? 0;
                const mId     = m.id ?? m.Id ?? '';
                const btnDel  = puedeEditarDetalle
                    ? `<td><button class="btn-remove-item" data-mano-id="${mId}" title="Eliminar">✕</button></td>`
                    : '<td></td>';
                return `<tr>
                    <td>${utils.escapeHtml(desc2)}</td>
                    <td>${utils.escapeHtml(mec)}</td>
                    <td style="text-align:center">${horas}</td>
                    <td style="text-align:right">$${Number(costo).toLocaleString('es-CO')}</td>
                    ${btnDel}
                </tr>`;
            }).join('');

            tbodyMano.querySelectorAll('.btn-remove-item[data-mano-id]').forEach(btn =>
                btn.addEventListener('click', () => eliminarManoObra(btn.dataset.manoId)));
        }

        document.getElementById('detalle-total').textContent =
            `$${Number(total ?? 0).toLocaleString('es-CO')}`;

        // Mostrar botones agregar solo si puede editar y la orden está activa
        const estadosEditables = ['Pendiente', 'Aprobada', 'En Proceso', '0', '1', '2'];
        const puedeAgregar = puedeEditarDetalle && estadosEditables.includes(ordenDetalleEstado);
        document.getElementById('btn-abrir-add-repuesto').style.display = puedeAgregar ? '' : 'none';
        document.getElementById('btn-abrir-add-mano').style.display = puedeAgregar ? '' : 'none';
    }

    document.getElementById('detalle-close')?.addEventListener('click', () => modalDetalle.classList.remove('open'));
    document.getElementById('detalle-close2')?.addEventListener('click', () => modalDetalle.classList.remove('open'));
    modalDetalle?.addEventListener('click', e => { if (e.target === modalDetalle) modalDetalle.classList.remove('open'); });

    // ── Eliminar repuesto del detalle ────────────────────────────────────────

    async function eliminarDetalle(detalleId) {
        if (!confirm('¿Eliminar este repuesto de la orden?')) return;
        try {
            await api.ordenes.removeDetalle(ordenDetalleId, detalleId);
            await recargarDetalle();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    async function eliminarManoObra(manoId) {
        if (!confirm('¿Eliminar esta mano de obra de la orden?')) return;
        try {
            await api.ordenes.removeManoObra(ordenDetalleId, manoId);
            await recargarDetalle();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    async function recargarDetalle() {
        try {
            const raw = await api.ordenes.getById(ordenDetalleId);
            renderDetalleOrden(raw?.data ?? raw);
            cargarOrdenes();
        } catch { /* silent */ }
    }

    // ── Modal: Agregar Repuesto ──────────────────────────────────────────────

    document.getElementById('btn-abrir-add-repuesto')?.addEventListener('click', abrirModalAddRepuesto);

    async function abrirModalAddRepuesto() {
        document.getElementById('add-cantidad').value    = '1';
        document.getElementById('add-precio-unitario').value = '';
        modalAddRepuesto.classList.add('open');

        const sel = document.getElementById('sel-repuesto');
        sel.innerHTML = '<option value="">Cargando...</option>';

        if (!repuestosCache.length) {
            try {
                const { items } = await api.repuestos.list({ tamano: 200 });
                repuestosCache = items ?? [];
            } catch (err) {
                sel.innerHTML = `<option value="">Error al cargar: ${utils.escapeHtml(err.message)}</option>`;
                return;
            }
        }

        if (repuestosCache.length) {
            sel.innerHTML = '<option value="">— Seleccionar —</option>' +
                repuestosCache.map(r => {
                    const precio = r.precioVenta ?? r.PrecioVenta ?? 0;
                    return `<option value="${r.id ?? r.Id}" data-precio="${precio}">
                        ${utils.escapeHtml(r.codigo ?? r.Codigo ?? '')} — ${utils.escapeHtml(r.nombre ?? r.Nombre ?? '')}
                        ($${Number(precio).toLocaleString('es-CO')})
                    </option>`;
                }).join('');
        } else {
            sel.innerHTML = '<option value="">Sin repuestos en inventario</option>';
        }

        // Autocompletar precio al seleccionar
        sel.onchange = () => {
            const opt = sel.options[sel.selectedIndex];
            const precio = opt?.dataset?.precio;
            if (precio) document.getElementById('add-precio-unitario').value = precio;
        };
    }

    document.getElementById('add-repuesto-close')?.addEventListener('click', () => modalAddRepuesto.classList.remove('open'));
    document.getElementById('add-repuesto-close2')?.addEventListener('click', () => modalAddRepuesto.classList.remove('open'));
    modalAddRepuesto?.addEventListener('click', e => { if (e.target === modalAddRepuesto) modalAddRepuesto.classList.remove('open'); });

    document.getElementById('btn-confirmar-add-repuesto')?.addEventListener('click', async () => {
        const repuestoId = document.getElementById('sel-repuesto').value;
        const cantidad   = parseInt(document.getElementById('add-cantidad').value);
        const precio     = parseFloat(document.getElementById('add-precio-unitario').value);

        if (!repuestoId || !cantidad || cantidad < 1 || isNaN(precio) || precio < 0) {
            alert('Completa todos los campos correctamente.');
            return;
        }

        try {
            await api.ordenes.addDetalle(ordenDetalleId, {
                RepuestoId: repuestoId,
                Cantidad: cantidad,
                PrecioUnitario: precio,
            });
            modalAddRepuesto.classList.remove('open');
            await recargarDetalle();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
            modalAddRepuesto.classList.remove('open');
        }
    });

    // ── Modal: Agregar Mano de Obra ──────────────────────────────────────────

    document.getElementById('btn-abrir-add-mano')?.addEventListener('click', abrirModalAddMano);

    async function abrirModalAddMano() {
        document.getElementById('add-mano-descripcion').value = '';
        document.getElementById('add-mano-costo').value       = '';
        document.getElementById('add-mano-horas').value       = '1';
        modalAddMano.classList.add('open');

        if (!mecanicosCache.length) {
            try {
                const { items } = await api.empleados.list({ tamano: 100 });
                mecanicosCache = (items ?? []).filter(e => [0,1,5,6].includes(e.tipoEmpleado ?? e.TipoEmpleado));
            } catch { mecanicosCache = []; }
        }

        const sel = document.getElementById('sel-mecanico-mano');
        sel.innerHTML = '<option value="">Sin asignar</option>' +
            mecanicosCache.map(m => {
                const nombre = `${m.nombres ?? m.Nombres ?? ''} ${m.apellidos ?? m.Apellidos ?? ''}`.trim();
                return `<option value="${m.id ?? m.Id}">${utils.escapeHtml(nombre)}</option>`;
            }).join('');
    }

    document.getElementById('add-mano-close')?.addEventListener('click', () => modalAddMano.classList.remove('open'));
    document.getElementById('add-mano-close2')?.addEventListener('click', () => modalAddMano.classList.remove('open'));
    modalAddMano?.addEventListener('click', e => { if (e.target === modalAddMano) modalAddMano.classList.remove('open'); });

    document.getElementById('btn-confirmar-add-mano')?.addEventListener('click', async () => {
        const descripcion = document.getElementById('add-mano-descripcion').value.trim();
        const costo       = parseFloat(document.getElementById('add-mano-costo').value);
        const horas       = parseFloat(document.getElementById('add-mano-horas').value) || 0;
        const mecanicoId  = document.getElementById('sel-mecanico-mano').value || null;

        if (!descripcion || isNaN(costo) || costo < 0) {
            alert('Completa la descripción y el costo.');
            return;
        }

        try {
            await api.ordenes.addManoObra(ordenDetalleId, {
                Descripcion: descripcion,
                Costo: costo,
                HorasTrabajadas: horas,
                EmpleadoId: mecanicoId,
            });
            modalAddMano.classList.remove('open');
            await recargarDetalle();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
            modalAddMano.classList.remove('open');
        }
    });

    // ── Eliminar orden ────────────────────────────────────────────────────────
    async function eliminarOrden(ordenId) {
        if (!confirm('¿Eliminar esta orden permanentemente? Esta acción no se puede deshacer.\n\nNota: no se puede eliminar si ya tiene una factura generada.')) return;
        try {
            await api.ordenes.eliminar(ordenId);
            utils.setPageMessage(messageEl, 'success', '✓ Orden eliminada correctamente.');
            cargarOrdenes();
        } catch (err) {
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    // ── Arranque ─────────────────────────────────────────────────────────────
    cargarOrdenes();
});
