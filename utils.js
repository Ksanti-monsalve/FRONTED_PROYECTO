/**
 * Utilidades compartidas del frontend.
 */
(function () {
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-CO');
    }

    function formatRoleLabel(roles) {
        const normalized = (roles || []).map((r) => String(r).toLowerCase());
        if (normalized.some((r) => r.includes('admin'))) return 'Administrador';
        if (normalized.some((r) => r.includes('mecan'))) return 'Especialista';
        if (normalized.some((r) => r.includes('recep'))) return 'Concierge';
        return 'Usuario';
    }

    function hasRole(roles, ...patterns) {
        const normalized = (roles || []).map((r) => String(r).toLowerCase());
        return patterns.some((pattern) =>
            normalized.some((role) => role.includes(String(pattern).toLowerCase()))
        );
    }

    function unwrapList(body, totalFromHeader) {
        if (Array.isArray(body)) {
            return {
                items: body,
                total: totalFromHeader ?? body.length,
            };
        }

        const items = body?.data ?? body?.Data ?? [];
        const total = body?.totalRegistros
            ?? body?.TotalRegistros
            ?? totalFromHeader
            ?? items.length;

        return { items, total };
    }

    function setPageMessage(el, type, message) {
        if (!el) return;
        if (!message) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.className = `page-alert page-alert-${type}`;
        el.textContent = message;
        el.hidden = false;
    }

    function mapOrden(orden) {
        if (!orden) return {};
        const vehiculo = orden.vehiculo || orden.Vehiculo;
        const mecanico = orden.mecanico || orden.Mecanico;
        const estado = orden.estado || orden.Estado;
        const prioridad = orden.prioridad || orden.Prioridad;

        return {
            ordenId: orden.ordenId ?? orden.OrdenId,
            cliente: orden.cliente
                ?? vehiculo?.cliente?.nombreCompleto
                ?? vehiculo?.Cliente?.NombreCompleto
                ?? '—',
            vin: orden.vin ?? vehiculo?.vin ?? vehiculo?.Vin ?? '—',
            marcaModelo: orden.marcaModelo
                ?? [vehiculo?.marca, vehiculo?.modelo].filter(Boolean).join(' ')
                ?? '—',
            estado: typeof orden.estado === 'string'
                ? orden.estado
                : estado?.nombre ?? estado?.Nombre ?? String(orden.estadoId ?? '—'),
            prioridad: typeof orden.prioridad === 'string'
                ? orden.prioridad
                : prioridad?.nombre ?? prioridad?.Nombre ?? '—',
            mecanico: typeof orden.mecanico === 'string'
                ? orden.mecanico
                : mecanico?.nombreUsuario ?? mecanico?.NombreUsuario ?? '—',
            fechaIngreso: orden.fechaIngreso ?? orden.FechaIngreso,
        };
    }

    function setLoading(container, isLoading, message = 'Cargando datos del backend...') {
        if (!container) return;
        if (isLoading) {
            container.innerHTML = `<p class="table-loading">${escapeHtml(message)}</p>`;
        }
    }

    window.AppUtils = {
        escapeHtml,
        formatDate,
        formatRoleLabel,
        hasRole,
        unwrapList,
        setPageMessage,
        setLoading,
        mapOrden,
    };
})();
