/**
 * Protección de rutas para páginas autenticadas.
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

    window.AppAuth = { requireAuth };
})();
