/**
 * Cliente HTTP para AutoTallerManager API (ASP.NET Core 9).
 * Adaptado al contrato real del backend.
 */
(function () {
    const TOKEN_KEYS = {
        access: 'atm_access_token',
        refresh: 'atm_refresh_token',
        user: 'atm_user',
        persistent: 'atm_remember',
    };

    let refreshPromise = null;

    function getBaseUrl() {
        const base = window.APP_CONFIG?.apiBaseUrl ?? 'http://localhost:5000';
        return base.replace(/\/$/, '');
    }

    function getActiveStorage() {
        const persistent = localStorage.getItem(TOKEN_KEYS.persistent) === '1';
        return persistent ? localStorage : sessionStorage;
    }

    function getAccessToken() {
        return sessionStorage.getItem(TOKEN_KEYS.access)
            || localStorage.getItem(TOKEN_KEYS.access);
    }

    function getRefreshToken() {
        return sessionStorage.getItem(TOKEN_KEYS.refresh)
            || localStorage.getItem(TOKEN_KEYS.refresh);
    }

    function buildQuery(params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.set(key, String(value));
            }
        });
        const qs = query.toString();
        return qs ? `?${qs}` : '';
    }

    function parseJsonSafe(response) {
        if (response.status === 204) return null;
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return null;
        return response.json();
    }

    function extractErrorMessage(status, body) {
        if (!body || typeof body !== 'object') return `Error del servidor (${status})`;
        if (body.mensaje) return body.mensaje;
        if (Array.isArray(body.errores) && body.errores.length > 0) return body.errores.join('. ');
        if (body.title) return body.title;
        return `Error del servidor (${status})`;
    }

    /**
     * Normaliza la respuesta del backend { exito, data: { token, refreshToken, ... } }
     * al formato que espera saveSession.
     */
    function normalizeAuthData(raw) {
        const d = raw?.data ?? raw ?? {};
        return {
            accessToken:   d.token,
            refreshToken:  d.refreshToken,
            nombreUsuario: [d.nombres, d.apellidos].filter(Boolean).join(' ').trim() || d.email || 'Usuario',
            roles:         d.roles || [],
            expiracion:    d.expiration ?? d.expiracion,
        };
    }

    function saveSession(tokens, persistent) {
        const storage = persistent ? localStorage : sessionStorage;
        storage.setItem(TOKEN_KEYS.access,   tokens.accessToken);
        storage.setItem(TOKEN_KEYS.refresh,  tokens.refreshToken);
        storage.setItem(TOKEN_KEYS.user, JSON.stringify({
            nombreUsuario: tokens.nombreUsuario,
            roles:         tokens.roles || [],
            expiracion:    tokens.expiracion,
        }));
        localStorage.setItem(TOKEN_KEYS.persistent, persistent ? '1' : '0');

        const other = persistent ? sessionStorage : localStorage;
        Object.values(TOKEN_KEYS).forEach((key) => {
            if (key !== TOKEN_KEYS.persistent) other.removeItem(key);
        });
    }

    function clearSession() {
        [localStorage, sessionStorage].forEach((storage) => {
            Object.values(TOKEN_KEYS).forEach((key) => storage.removeItem(key));
        });
    }

    function getStoredUser() {
        const raw = sessionStorage.getItem(TOKEN_KEYS.user)
            || localStorage.getItem(TOKEN_KEYS.user);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }

    function isSessionExpired(user) {
        if (!user?.expiracion) return false;
        const expiresAt = new Date(user.expiracion).getTime();
        return Number.isFinite(expiresAt) && expiresAt <= Date.now();
    }

    function isAuthenticated() {
        if (!getAccessToken()) return false;
        const user = getStoredUser();
        if (isSessionExpired(user)) { clearSession(); return false; }
        return true;
    }

    function getRoute(name) {
        const path = window.APP_CONFIG?.routes?.[name] ?? `/${name}.html`;
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        return path.startsWith('/') ? path : `/${path}`;
    }

    function goTo(routeName)    { window.location.href    = getRoute(routeName); }
    function replaceTo(routeName) { window.location.replace(getRoute(routeName)); }

    async function rawFetch(path, options = {}) {
        const url = `${getBaseUrl()}${path}`;
        const headers = { Accept: 'application/json', ...(options.headers || {}) };

        if (options.body !== undefined && options.body !== null && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        if (options.auth !== false) {
            const token = getAccessToken();
            if (token) headers.Authorization = `Bearer ${token}`;
        }

        try {
            return await fetch(url, { ...options, headers });
        } catch {
            const hint = window.location.protocol === 'file:'
                ? ' Usa npm run dev (no abras el HTML con doble clic).'
                : ' Verifica que el backend esté en ejecución y CORS configurado.';
            throw new Error(`No se pudo conectar con el backend.${hint}`);
        }
    }

    async function tryRefreshToken() {
        const rt = getRefreshToken();
        if (!rt) return false;

        if (!refreshPromise) {
            refreshPromise = (async () => {
                const response = await rawFetch('/api/Auth/refresh-token', {
                    method: 'POST',
                    auth: false,
                    body: JSON.stringify({ token: getAccessToken() ?? '', refreshToken: rt }),
                });
                const body = await parseJsonSafe(response);
                if (!response.ok) return false;

                const persistent = localStorage.getItem(TOKEN_KEYS.persistent) === '1';
                saveSession(normalizeAuthData(body), persistent);
                return true;
            })().finally(() => { refreshPromise = null; });
        }

        return refreshPromise;
    }

    async function request(path, options = {}, retried = false) {
        const response = await rawFetch(path, options);
        let body = await parseJsonSafe(response);

        if (response.status === 401 && options.auth !== false && !retried) {
            const refreshed = await tryRefreshToken();
            if (refreshed) return request(path, options, true);
            clearSession();
            if (!options.skipAuthRedirect) replaceTo('login');
            throw new Error('Sesión expirada. Inicia sesión nuevamente.');
        }

        if (!response.ok) throw new Error(extractErrorMessage(response.status, body));
        return body;
    }

    async function requestList(path, options = {}) {
        const response = await rawFetch(path, options);
        let body = await parseJsonSafe(response);

        if (response.status === 401 && options.auth !== false) {
            const refreshed = await tryRefreshToken();
            if (refreshed) return requestList(path, options);
            clearSession();
            if (!options.skipAuthRedirect) replaceTo('login');
            throw new Error('Sesión expirada. Inicia sesión nuevamente.');
        }

        if (!response.ok) throw new Error(extractErrorMessage(response.status, body));

        const totalHeader = response.headers.get('X-Total-Count');
        const totalFromHeader = totalHeader ? parseInt(totalHeader, 10) : null;

        return window.AppUtils.unwrapList(body, totalFromHeader);
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    async function login(correo, password, options = {}) {
        // Backend espera { email, password }
        const body = await request('/api/Auth/login', {
            method: 'POST',
            auth: false,
            body: JSON.stringify({ email: correo, password }),
            skipAuthRedirect: true,
        });
        const normalized = normalizeAuthData(body);
        saveSession(normalized, Boolean(options.remember));
        // Devuelve los datos normalizados para que Diseño.js pueda usarlos
        return normalized;
    }

    async function logout() {
        const refreshToken = getRefreshToken();
        try {
            if (refreshToken && getAccessToken()) {
                await request('/api/Auth/logout', {
                    method: 'POST',
                    body: JSON.stringify({ refreshToken }),
                    skipAuthRedirect: true,
                });
            }
        } catch { /* cerrar sesión local aunque falle el servidor */ }
        clearSession();
    }

    async function healthCheck() {
        await requestList(`/api/Clientes${buildQuery({ PageNumber: 1, PageSize: 1 })}`, {
            skipAuthRedirect: true,
        });
        return true;
    }

    // ── Clientes ──────────────────────────────────────────────────────────────

    const clientes = {
        list: (params = {}) => requestList(
            `/api/Clientes${buildQuery({
                PageNumber: params.pagina ?? 1,
                PageSize:   params.tamano ?? window.APP_CONFIG?.pagination?.defaultPageSize ?? 20,
                busqueda:   params.busqueda,
            })}`
        ),
        getById: (id) => request(`/api/Clientes/${id}`),
        create:  (payload) => request('/api/Clientes', { method: 'POST', body: JSON.stringify(payload) }),
    };

    // ── Órdenes de Servicio ───────────────────────────────────────────────────

    const ordenes = {
        list: (params = {}) => requestList(
            `/api/Ordenes${buildQuery({
                PageNumber: params.pagina  ?? 1,
                PageSize:   params.tamano  ?? window.APP_CONFIG?.pagination?.defaultPageSize ?? 20,
                ClienteId:  params.clienteId,
                Estado:     params.estado,
            })}`
        ),
        getById: (id) => request(`/api/Ordenes/${id}`),
        // POST /api/Ordenes  — body: { ClienteId, VehiculoId, Descripcion?, TipoServicioId? }
        crear: (payload) => request('/api/Ordenes', { method: 'POST', body: JSON.stringify(payload) }),
        // POST /api/Ordenes/{id}/aprobar  — body: Guid clienteId (JSON)
        aprobar: (id, clienteId) => request(`/api/Ordenes/${id}/aprobar`, {
            method: 'POST', body: JSON.stringify(clienteId),
        }),
        // POST /api/Ordenes/{id}/asignar-mecanico  — body: Guid empleadoId (JSON)
        asignarMecanico: (id, empleadoId) => request(`/api/Ordenes/${id}/asignar-mecanico`, {
            method: 'POST', body: JSON.stringify(empleadoId),
        }),
        // POST /api/Ordenes/{id}/finalizar  — sin body
        finalizar: (id) => request(`/api/Ordenes/${id}/finalizar`, { method: 'POST', body: '{}' }),
        // POST /api/Ordenes/{id}/cancelar  — body: string motivo (JSON)
        cancelar: (id, motivo) => request(`/api/Ordenes/${id}/cancelar`, {
            method: 'POST', body: JSON.stringify(motivo),
        }),
        // POST /api/Ordenes/{id}/detalles — agrega repuesto/insumo
        addDetalle: (id, payload) => request(`/api/Ordenes/${id}/detalles`, {
            method: 'POST', body: JSON.stringify(payload),
        }),
        // DELETE /api/Ordenes/{id}/detalles/{detalleId}
        removeDetalle: (id, detalleId) => request(`/api/Ordenes/${id}/detalles/${detalleId}`, {
            method: 'DELETE',
        }),
        // POST /api/Ordenes/{id}/manos-obra — agrega mano de obra
        addManoObra: (id, payload) => request(`/api/Ordenes/${id}/manos-obra`, {
            method: 'POST', body: JSON.stringify(payload),
        }),
        // DELETE /api/Ordenes/{id}/manos-obra/{manoObraId}
        removeManoObra: (id, manoObraId) => request(`/api/Ordenes/${id}/manos-obra/${manoObraId}`, {
            method: 'DELETE',
        }),
    };

    // ── Repuestos ─────────────────────────────────────────────────────────────

    const repuestos = {
        list: (params = {}) => requestList(
            `/api/Repuestos${buildQuery({
                PageNumber: params.pagina ?? 1,
                PageSize:   params.tamano ?? window.APP_CONFIG?.pagination?.defaultPageSize ?? 20,
                Busqueda:   params.busqueda,
            })}`
        ),
        getById: (id) => request(`/api/Repuestos/${id}`),
        // Solo Admin y Recepcionista
        create: (payload) => request('/api/Repuestos', { method: 'POST', body: JSON.stringify(payload) }),
        update: (id, payload) => request(`/api/Repuestos/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
        // Stock crítico viene del dashboard endpoint
        stockCritico: () =>
            requestList(`/api/Dashboard/repuestos-criticos${buildQuery({ pageNumber: 1, pageSize: 50 })}`)
                .then((r) => r.items ?? []),
        // Movimientos de inventario — rutas correctas del backend
        entrada: (payload) => request('/api/Inventario/entrada', {
            method: 'POST', body: JSON.stringify(payload),
        }),
        salida: (payload) => request('/api/Inventario/salida', {
            method: 'POST', body: JSON.stringify(payload),
        }),
        ajuste: (payload) => request('/api/Inventario/ajuste', {
            method: 'POST', body: JSON.stringify(payload),
        }),
        movimientos: (params = {}) => requestList(
            `/api/Inventario/movimientos${buildQuery({
                PageNumber: params.pagina ?? 1,
                PageSize:   params.tamano ?? 20,
                repuestoId: params.repuestoId,
            })}`
        ),
    };

    // ── Configuración ─────────────────────────────────────────────────────────

    const configuracion = {
        list:       () => request('/api/Configuracion'),
        update:     (clave, valor) => request(`/api/Configuracion/${encodeURIComponent(clave)}`, {
            method: 'PUT',
            body: JSON.stringify({ valor }),
        }),
        rateLimits: () => request('/api/Configuracion/rate-limits'),
    };

    // ── Vehículos ─────────────────────────────────────────────────────────────

    const vehiculos = {
        list: (params = {}) => requestList(
            `/api/Vehiculos${buildQuery({
                PageNumber: params.pagina ?? 1,
                PageSize:   params.tamano ?? 20,
                Placa:      params.placa,
                Activo:     params.activo,
            })}`
        ),
        getById: (id) => request(`/api/Vehiculos/${id}`),
        create:  (payload) => request('/api/Vehiculos', { method: 'POST', body: JSON.stringify(payload) }),
    };

    // ── Empleados ─────────────────────────────────────────────────────────────

    const empleados = {
        list: (params = {}) => requestList(
            `/api/Empleados${buildQuery({ PageNumber: params.pagina ?? 1, PageSize: params.tamano ?? 50, tipo: params.tipo })}`
        ),
    };

    // ── Presupuestos (Mini Órdenes — Flujo M→J→C) ────────────────────────────
    // Estados: 0=Borrador 1=EnRevisionJefe 2=AprobadaJefe 3=EnRevisionCliente
    //          4=AprobadaCliente(OS!) 5=EnProceso 6=Completada 7=RechazadaJefe
    //          8=RechazadaCliente 9=Cancelada

    const presupuestos = {
        list: (params = {}) => requestList(
            `/api/MiniOrdenes${buildQuery({
                PageNumber:  params.pagina    ?? 1,
                PageSize:    params.tamano    ?? 20,
                Estado:      params.estado,
                ClienteId:   params.clienteId,
                MecanicoId:  params.mecanicoId,
            })}`
        ),
        getById: (id) => request(`/api/MiniOrdenes/${id}`),
        // Crear presupuesto — solo Mecánicos (MecanicoOnly)
        // body: { ClienteId, VehiculoId, Descripcion, Observaciones?, Detalles[], ManosObra? }
        crear: (payload) => request('/api/MiniOrdenes', { method: 'POST', body: JSON.stringify(payload) }),
        // Mecánico envía a revisión del Jefe
        enviarRevision: (id) => request(`/api/MiniOrdenes/${id}/enviar-revision`, { method: 'POST', body: '{}' }),
        // Jefe aprueba o rechaza — body: { Aprobado: bool, Observacion?: string }
        aprobarJefe: (id, aprobado, observacion) => request(`/api/MiniOrdenes/${id}/aprobacion-jefe`, {
            method: 'POST',
            body: JSON.stringify({ Aprobado: aprobado, Observacion: observacion ?? null }),
        }),
        // Cliente/Admin/Recepcionista aprueba o rechaza — genera OS si aprueba
        aprobarCliente: (id, aprobado, observacion) => request(`/api/MiniOrdenes/${id}/aprobacion-cliente`, {
            method: 'POST',
            body: JSON.stringify({ Aprobado: aprobado, Observacion: observacion ?? null }),
        }),
        // Mecánico o Jefe marca como completado
        completar: (id, observacion) => request(
            `/api/MiniOrdenes/${id}/completar${observacion ? `?observacion=${encodeURIComponent(observacion)}` : ''}`,
            { method: 'POST', body: '{}' }
        ),
        // Gestión de repuestos en el presupuesto
        addDetalle: (id, payload) => request(`/api/MiniOrdenes/${id}/detalles`, {
            method: 'POST', body: JSON.stringify(payload),
        }),
        removeDetalle: (id, detalleId) => request(`/api/MiniOrdenes/${id}/detalles/${detalleId}`, {
            method: 'DELETE',
        }),
        // Gestión de mano de obra en el presupuesto
        addManoObra: (id, payload) => request(`/api/MiniOrdenes/${id}/manos-obra`, {
            method: 'POST', body: JSON.stringify(payload),
        }),
        removeManoObra: (id, manoObraId) => request(`/api/MiniOrdenes/${id}/manos-obra/${manoObraId}`, {
            method: 'DELETE',
        }),
    };

    // ── Proveedores ───────────────────────────────────────────────────────────

    const proveedores = {
        list: (params = {}) => requestList(
            `/api/Proveedores${buildQuery({ PageNumber: params.pagina ?? 1, PageSize: params.tamano ?? 20 })}`
        ),
        create: (payload) => request('/api/Proveedores', { method: 'POST', body: JSON.stringify(payload) }),
    };

    // ── Facturas ──────────────────────────────────────────────────────────────

    const facturas = {
        list: (params = {}) => requestList(
            `/api/Facturas${buildQuery({ PageNumber: params.pagina ?? 1, PageSize: params.tamano ?? 20 })}`
        ),
        getById: (id) => request(`/api/Facturas/${id}`),
    };

    // ── Dashboard API ─────────────────────────────────────────────────────────

    const dashboardApi = {
        resumen: () => request('/api/Dashboard/resumen'),
        ordenesPorEstado: () => request('/api/Dashboard/ordenes-por-estado'),
        facturacionMensual: () => request('/api/Dashboard/facturacion-mensual'),
    };

    // ── Catálogos (endpoints públicos) ────────────────────────────────────────

    const catalogos = {
        marcas: () => request('/api/Catalogos/marcas', { auth: false }),
        modelos: (marcaId) => request(`/api/Catalogos/modelos${marcaId ? `?marcaId=${marcaId}` : ''}`, { auth: false }),
        colores: () => request('/api/Catalogos/colores', { auth: false }),
        tiposDocumento: () => request('/api/Catalogos/tipos-documento', { auth: false }),
        tiposServicio: () => request('/api/Catalogos/tipos-servicio'),
        categoriasRepuesto: () => request('/api/Catalogos/categorias-repuesto'),
    };

    // ── Auth extendido (registro de cliente) ──────────────────────────────────

    const auth = {
        registerCliente: (payload) => rawFetch('/api/Auth/register-cliente', {
            method: 'POST',
            auth: false,
            body: JSON.stringify(payload),
        }).then(async (resp) => {
            const body = await resp.json();
            if (!resp.ok) throw new Error(body?.mensaje || body?.errores?.[0] || 'Error al registrar');
            return body;
        }),
    };

    window.AutoTallerApi = {
        login, logout, request, requestList,
        healthCheck, clearSession,
        getAccessToken, getRefreshToken, getStoredUser,
        isAuthenticated, getBaseUrl, getRoute, goTo, replaceTo, buildQuery,
        clientes, ordenes, repuestos, configuracion,
        vehiculos, empleados, presupuestos, proveedores, facturas,
        dashboardApi, catalogos, auth,
        TOKEN_KEYS,
    };
})();
