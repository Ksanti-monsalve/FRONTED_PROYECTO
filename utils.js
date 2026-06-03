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

    // Elimina tildes y pasa a minúsculas para comparaciones seguras.
    // "Mecánico" → "mecanico", "MecanicoArea" → "mecanicoarea"
    function normalizeStr(s) {
        return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function formatRoleLabel(roles) {
        const norm = (roles || []).map(normalizeStr);
        if (norm.some((r) => r === 'admin'))                 return 'Administrador';
        if (norm.some((r) => r === 'jefetaller'))            return 'Jefe de Taller';
        if (norm.some((r) => r === 'mecanicodiagnostico'))   return 'Mecánico Diagnóstico';
        if (norm.some((r) => r === 'mecanicoarea'))          return 'Mecánico de Área';
        if (norm.some((r) => r.includes('mecanic')))         return 'Mecánico';
        if (norm.some((r) => r === 'recepcionista'))         return 'Recepcionista';
        if (norm.some((r) => r === 'jefealmacen'))           return 'Jefe de Almacén';
        if (norm.some((r) => r === 'jefebodega'))            return 'Jefe de Bodega';
        if (norm.some((r) => r === 'cliente'))               return 'Cliente';
        return 'Usuario';
    }

    function getRoleColor(roles) {
        const norm = (roles || []).map(normalizeStr);
        if (norm.some((r) => r === 'admin'))               return '#e74c3c';
        if (norm.some((r) => r === 'jefetaller'))          return '#f39c12';
        if (norm.some((r) => r.includes('mecanic')))       return '#3498db';
        if (norm.some((r) => r === 'recepcionista'))       return '#27ae60';
        if (norm.some((r) => r.includes('almacen') || r.includes('bodega'))) return '#8e44ad';
        if (norm.some((r) => r === 'cliente'))             return '#16a085';
        return '#7f8c8d';
    }

    // hasRole: compara patrones contra roles normalizados (sin tildes, minúsculas).
    // Ejemplos de uso: hasRole(roles, 'admin', 'jefetaller')
    //                  hasRole(roles, 'mecan')  → captura Mecánico, MecanicoDiagnostico, MecanicoArea
    function hasRole(roles, ...patterns) {
        const normalized = (roles || []).map(normalizeStr);
        return patterns.some((pattern) =>
            normalized.some((role) => role.includes(normalizeStr(pattern)))
        );
    }

    /**
     * Desenvuelve la respuesta del backend.
     * Soporta:
     *   - ApiResponse<PagedResult<T>>: { exito, data: { items: [...], totalCount: N } }
     *   - ApiResponse<T[]>:            { exito, data: [...] }
     *   - Array plano:                 [...]
     */
    function unwrapList(body, totalFromHeader) {
        if (Array.isArray(body)) {
            return { items: body, total: totalFromHeader ?? body.length };
        }

        // Backend: { exito, data: { items: [...], totalCount: N, ... } }
        if (body?.data && !Array.isArray(body.data) && Array.isArray(body.data.items)) {
            return {
                items: body.data.items,
                total: body.data.totalCount ?? totalFromHeader ?? body.data.items.length,
            };
        }

        // Backend: { exito, data: [...] }
        if (body?.data && Array.isArray(body.data)) {
            return { items: body.data, total: totalFromHeader ?? body.data.length };
        }

        // Fallback genérico
        const items = body?.data ?? body?.Data ?? [];
        const total = totalFromHeader ?? (Array.isArray(items) ? items.length : 0);
        return { items, total };
    }

    function setPageMessage(el, type, message) {
        if (!el) return;
        if (!message) { el.hidden = true; el.textContent = ''; return; }
        el.className = `page-alert page-alert-${type}`;
        el.textContent = message;
        el.hidden = false;
    }

    // Mapa de estado de orden (EstadoOrdenEnum del backend)
    const ESTADO_ORDEN = {
        0: 'Pendiente',
        1: 'Aprobada',
        2: 'En Proceso',
        3: 'Finalizada',
        4: 'Cancelada',
    };

    /**
     * Normaliza un objeto OrdenServicioDto del backend al shape que usan los módulos.
     * Backend devuelve (camelCase): numeroOrden, clienteNombre, vehiculoPlaca,
     *   mecanicoNombre, estado (number), fechaIngreso, etc.
     */
    function mapOrden(orden) {
        if (!orden) return {};

        const estadoRaw = orden.estado ?? orden.Estado;
        const estadoStr = typeof estadoRaw === 'string'
            ? estadoRaw
            : (ESTADO_ORDEN[estadoRaw] ?? String(estadoRaw ?? '—'));

        return {
            ordenId:      orden.numeroOrden    ?? orden.NumeroOrden    ?? orden.id ?? '—',
            cliente:      orden.clienteNombre  ?? orden.ClienteNombre  ?? '—',
            vin:          orden.vehiculoPlaca  ?? orden.VehiculoPlaca  ?? '—',
            marcaModelo:  orden.vehiculoPlaca  ?? orden.VehiculoPlaca  ?? '—',
            estado:       estadoStr,
            prioridad:    orden.prioridad      ?? orden.Prioridad      ?? '—',
            mecanico:     orden.mecanicoNombre ?? orden.MecanicoNombre ?? '—',
            fechaIngreso: orden.fechaIngreso   ?? orden.FechaIngreso,
        };
    }

    function setLoading(container, isLoading, message = 'Cargando datos del backend...') {
        if (!container) return;
        if (isLoading) {
            container.innerHTML = `<p class="table-loading">${escapeHtml(message)}</p>`;
        }
    }

    window.AppUtils = {
        escapeHtml, formatDate, formatRoleLabel, getRoleColor, hasRole, normalizeStr,
        unwrapList, setPageMessage, setLoading, mapOrden,
        ESTADO_ORDEN,
    };
})();
