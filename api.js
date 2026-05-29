/**
 * Cliente HTTP completo para AutoTallerManager API (ASP.NET Core 8).
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
        if (!body || typeof body !== 'object') {
            return `Error del servidor (${status})`;
        }
        if (body.mensaje) return body.mensaje;
        if (Array.isArray(body.errores) && body.errores.length > 0) {
            return body.errores.join('. ');
        }
        if (body.title) return body.title;
        return `Error del servidor (${status})`;
    }

    function saveSession(tokens, persistent) {
        const storage = persistent ? localStorage : sessionStorage;
        storage.setItem(TOKEN_KEYS.access, tokens.accessToken);
        storage.setItem(TOKEN_KEYS.refresh, tokens.refreshToken);
        storage.setItem(TOKEN_KEYS.user, JSON.stringify({
            nombreUsuario: tokens.nombreUsuario,
            roles: tokens.roles || [],
            expiracion: tokens.expiracion,
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
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function isSessionExpired(user) {
        if (!user?.expiracion) return false;
        const expiresAt = new Date(user.expiracion).getTime();
        return Number.isFinite(expiresAt) && expiresAt <= Date.now();
    }

    function isAuthenticated() {
        if (!getAccessToken()) return false;
        const user = getStoredUser();
        if (isSessionExpired(user)) {
            clearSession();
            return false;
        }
        return true;
    }

    function getRoute(name) {
        const path = window.APP_CONFIG?.routes?.[name] ?? `/${name}.html`;
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        return path.startsWith('/') ? path : `/${path}`;
    }

    function goTo(routeName) {
        window.location.href = getRoute(routeName);
    }

    function replaceTo(routeName) {
        window.location.replace(getRoute(routeName));
    }

    async function rawFetch(path, options = {}) {
        const url = `${getBaseUrl()}${path}`;
        const headers = {
            Accept: 'application/json',
            ...(options.headers || {}),
        };

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
            const isFileProtocol = window.location.protocol === 'file:';
            const hint = isFileProtocol
                ? ' Usa npm run dev (no abras el HTML con doble clic).'
                : ' Verifica que el backend esté en ejecución y CORS configurado.';
            throw new Error(`No se pudo conectar con el backend.${hint}`);
        }
    }

    async function tryRefreshToken() {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return false;

        if (!refreshPromise) {
            refreshPromise = (async () => {
                const response = await rawFetch('/api/Auth/refresh', {
                    method: 'POST',
                    auth: false,
                    body: JSON.stringify({ refreshToken }),
                });
                const body = await parseJsonSafe(response);
                if (!response.ok) return false;

                const persistent = localStorage.getItem(TOKEN_KEYS.persistent) === '1';
                saveSession(body, persistent);
                return true;
            })().finally(() => {
                refreshPromise = null;
            });
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

        if (!response.ok) {
            throw new Error(extractErrorMessage(response.status, body));
        }

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

        if (!response.ok) {
            throw new Error(extractErrorMessage(response.status, body));
        }

        const totalHeader = response.headers.get('X-Total-Count');
        const totalFromHeader = totalHeader ? parseInt(totalHeader, 10) : null;

        return window.AppUtils.unwrapList(body, totalFromHeader);
    }

    async function login(correo, password, options = {}) {
        const tokens = await request('/api/Auth/login', {
            method: 'POST',
            auth: false,
            body: JSON.stringify({ correo, password }),
            skipAuthRedirect: true,
        });
        saveSession(tokens, Boolean(options.remember));
        return tokens;
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
        } catch {
            /* cerrar sesión local aunque falle el servidor */
        }
        clearSession();
    }

    async function healthCheck() {
        const pageSize = window.APP_CONFIG?.pagination?.defaultPageSize ?? 1;
        await requestList(`/api/Clientes${buildQuery({ pagina: 1, tamano: pageSize })}`, {
            skipAuthRedirect: true,
        });
        return true;
    }

    const clientes = {
        list: (params = {}) => requestList(
            `/api/Clientes${buildQuery({
                pagina: params.pagina ?? 1,
                tamano: params.tamano ?? window.APP_CONFIG?.pagination?.defaultPageSize ?? 20,
                ordenarPor: params.ordenarPor,
                descendente: params.descendente,
            })}`
        ),
        getById: (id) => request(`/api/Clientes/${id}`),
        create: (payload) => request('/api/Clientes', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    };

    const ordenes = {
        list: (params = {}) => requestList(
            `/api/OrdenesServicio${buildQuery({
                pagina: params.pagina ?? 1,
                tamano: params.tamano ?? window.APP_CONFIG?.pagination?.defaultPageSize ?? 20,
                ultimoId: params.ultimoId ?? 0,
            })}`
        ),
        porMecanico: (mecanicoId) => request(`/api/OrdenesServicio/mecanico/${mecanicoId}`),
        porVehiculo: (vehiculoId) => request(`/api/OrdenesServicio/vehiculo/${vehiculoId}`),
        create: (payload) => request('/api/OrdenesServicio', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
        cambiarEstado: (id, payload) => request(`/api/OrdenesServicio/${id}/estado`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    };

    const repuestos = {
        list: (params = {}) => requestList(
            `/api/Repuestos${buildQuery({
                pagina: params.pagina ?? 1,
                tamano: params.tamano ?? window.APP_CONFIG?.pagination?.defaultPageSize ?? 20,
            })}`
        ),
        stockCritico: () => request('/api/Repuestos/stock-critico'),
        movimiento: (payload) => request('/api/Repuestos/movimiento', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    };

    const configuracion = {
        list: () => request('/api/Configuracion'),
        update: (clave, valor) => request(`/api/Configuracion/${encodeURIComponent(clave)}`, {
            method: 'PUT',
            body: JSON.stringify({ valor }),
        }),
        rateLimits: () => request('/api/Configuracion/rate-limits'),
    };

    window.AutoTallerApi = {
        login,
        logout,
        request,
        requestList,
        healthCheck,
        clearSession,
        getAccessToken,
        getRefreshToken,
        getStoredUser,
        isAuthenticated,
        getBaseUrl,
        getRoute,
        goTo,
        replaceTo,
        buildQuery,
        clientes,
        ordenes,
        repuestos,
        configuracion,
        TOKEN_KEYS,
    };
})();
