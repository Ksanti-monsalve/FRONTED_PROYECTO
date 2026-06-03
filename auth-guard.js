/**
 * Protección de rutas para páginas autenticadas.
 *
 * requireAuth()         — solo verifica que haya sesión activa.
 * requireRole(...pats)  — verifica sesión + al menos uno de los patrones de rol.
 *                         Si el usuario está autenticado pero no tiene el rol,
 *                         lo redirige al dashboard (no al login).
 *
 * Patrones de rol (coincidencia parcial, sin tildes):
 *   'admin'      → Admin
 *   'jefetaller' → JefeTaller
 *   'mecan'      → Mecánico, MecanicoDiagnostico, MecanicoArea
 *   'recep'      → Recepcionista
 *   'almacen'    → JefeAlmacen
 *   'bodega'     → JefeBodega
 *   'cliente'    → Cliente
 */
(function () {
    function requireAuth() {
        const api = window.AutoTallerApi;
        if (!api?.isAuthenticated()) {
            api?.replaceTo('login');
            return false;
        }
        return true;
    }

    // Devuelve true si el usuario tiene sesión Y al menos uno de los patrones.
    // Redirige al dashboard si la sesión es válida pero el rol no coincide.
    function requireRole(...patterns) {
        if (!requireAuth()) return false;
        const user = window.AutoTallerApi.getStoredUser();
        const ok = window.AppUtils.hasRole(user?.roles, ...patterns);
        if (!ok) {
            window.AutoTallerApi.replaceTo('dashboard');
            return false;
        }
        return true;
    }

    window.AppAuth = { requireAuth, requireRole };
})();
