/**
 * Layout compartido: navegación, usuario y cierre de sesión.
 */
(function () {
    function initAppLayout(options = {}) {
        const api = window.AutoTallerApi;
        const utils = window.AppUtils;
        if (!window.AppAuth?.requireAuth()) return null;

        const user = api.getStoredUser();
        const active = options.activeModule || '';

        const userNameEl = document.getElementById('layout-user-name');
        const userRoleEl = document.getElementById('layout-user-role');
        const apiStatusEl = document.getElementById('layout-api-status');
        const navEl = document.getElementById('layout-nav');
        const logoutBtn = document.getElementById('btn-logout');

        if (userNameEl) userNameEl.textContent = user?.nombreUsuario || 'Usuario';
        if (userRoleEl) {
            userRoleEl.textContent = utils.formatRoleLabel(user?.roles);
            userRoleEl.style.color = utils.getRoleColor(user?.roles);
        }

        if (navEl) {
            navEl.innerHTML = buildNavItems(user?.roles, active, api);

            // ── Hamburger menu para móvil ───────────────────────────────────
            const header = navEl.closest('.app-layout-header');
            if (header && !header.querySelector('.nav-hamburger')) {
                const ham = document.createElement('button');
                ham.className = 'nav-hamburger';
                ham.setAttribute('aria-label', 'Menú');
                ham.innerHTML = `<span></span><span></span><span></span>`;
                ham.style.cssText = `
                    display:none; background:none; border:1px solid var(--gold-border);
                    border-radius:3px; padding:6px 8px; cursor:pointer; flex-direction:column;
                    gap:4px; align-items:center; justify-content:center;`;
                ham.addEventListener('click', () => {
                    navEl.classList.toggle('nav-open');
                    ham.classList.toggle('open');
                });
                // Insertar antes del nav
                header.insertBefore(ham, navEl);

                // Mostrar hamburger solo en móvil
                const mq = window.matchMedia('(max-width: 768px)');
                const toggleHam = (e) => {
                    ham.style.display = e.matches ? 'flex' : 'none';
                    if (!e.matches) navEl.classList.remove('nav-open');
                };
                mq.addEventListener('change', toggleHam);
                toggleHam(mq);
            }
        }

        logoutBtn?.addEventListener('click', async () => {
            logoutBtn.disabled = true;
            await api.logout();
            api.replaceTo('login');
        });

        // Health check desactivado — no mostrar URL del backend en producción
        if (apiStatusEl) apiStatusEl.style.display = 'none';

        return { user, api, utils };
    }

    // Tabla de acceso alineada con las políticas del backend:
    //   RecepcionOnly  → admin, recep, jefetaller
    //   StaffOnly      → admin, recep, jefetaller, mecan  (Mecánico, MecanicoDiagnostico, MecanicoArea)
    //   AlmacenOTaller → admin, jefetaller, almacen, bodega, mecan
    //   AlmacenOnly    → admin, almacen, bodega
    //   Reportes       → admin, jefetaller, almacen, bodega
    //   ClienteOrAdmin → admin, recep, cliente
    //   AdminOnly      → admin
    function buildNavItems(roles, active, api) {
        const links = [
            { key: 'dashboard',     label: 'Inicio',        route: 'dashboard',    roles: null },
            { key: 'clientes',      label: 'Clientes',       route: 'clientes',     roles: ['admin', 'recep', 'jefetaller'] },
            { key: 'vehiculos',     label: 'Vehículos',      route: 'vehiculos',    roles: ['admin', 'recep', 'jefetaller', 'mecan'] },
            { key: 'ordenes',       label: 'Órdenes',        route: 'ordenes',      roles: ['admin', 'recep', 'mecan', 'jefetaller'] },
            { key: 'presupuestos',  label: 'Presupuestos',   route: 'presupuestos', roles: ['admin', 'recep', 'mecan', 'jefetaller', 'cliente'] },
            { key: 'empleados',     label: 'Mecánicos',      route: 'empleados',    roles: ['admin', 'jefetaller'] },
            { key: 'repuestos',     label: 'Inventario',     route: 'repuestos',    roles: ['admin', 'mecan', 'almacen', 'bodega', 'jefetaller'] },
            { key: 'proveedores',   label: 'Proveedores',    route: 'proveedores',  roles: ['admin', 'recep'] },
            // Facturas: RecepcionOnly + Reportes → admin, recep, jefetaller, almacen, bodega
            { key: 'facturas',      label: 'Facturas',       route: 'facturas',     roles: ['admin', 'recep', 'jefetaller', 'almacen', 'bodega'] },
            // Mis Facturas: solo el cliente (y admin/recep para pruebas)
            { key: 'mis-facturas',  label: 'Mis Facturas',   route: 'mis-facturas', roles: ['cliente'] },
            { key: 'configuracion', label: 'Config',         route: 'configuracion',roles: ['admin'] },
        ];

        return links
            .filter((link) => {
                if (!link.roles) return true;
                return window.AppUtils.hasRole(roles, ...link.roles);
            })
            .map((link) => {
                const href = api.getRoute(link.route);
                const isActive = active === link.key ? ' is-active' : '';
                return `<a class="layout-nav-link${isActive}" href="${href}">${link.label}</a>`;
            })
            .join('');
    }

    async function checkApiHealth(api, el) {
        el.textContent = 'Comprobando backend...';
        el.className = 'api-status api-status-pending';

        try {
            await api.healthCheck();
            el.textContent = `Backend conectado (${api.getBaseUrl()})`;
            el.className = 'api-status api-status-ok';
        } catch (err) {
            el.textContent = err.message || 'Backend no disponible';
            el.className = 'api-status api-status-error';
        }
    }

    window.AppLayout = { initAppLayout };
})();
