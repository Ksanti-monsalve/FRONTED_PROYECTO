document.addEventListener('DOMContentLoaded', () => {
    // AdminOnly: redirige al dashboard si no es admin
    if (!window.AppAuth?.requireRole('admin')) return;

    const ctx = window.AppLayout?.initAppLayout({ activeModule: 'configuracion' });
    if (!ctx) return;

    const { api, utils, user } = ctx;
    const container = document.getElementById('table-container');
    const messageEl = document.getElementById('page-message');
    const reloadBtn = document.getElementById('btn-reload');

    async function load() {
        utils.setLoading(container, true);
        utils.setPageMessage(messageEl, 'info', '');

        try {
            const configs = await api.configuracion.list();
            renderConfigTable(container, configs, utils, api, messageEl);
        } catch (err) {
            container.innerHTML = '';
            utils.setPageMessage(messageEl, 'error', err.message);
        }
    }

    reloadBtn?.addEventListener('click', load);
    load();
});

function renderConfigTable(container, items, utils, api, messageEl) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
        container.innerHTML = '<p class="table-empty">No hay configuraciones.</p>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Clave</th>
                    <th>Valor</th>
                    <th>Grupo</th>
                    <th>Editable</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${list.map((cfg) => `
                    <tr data-clave="${utils.escapeHtml(cfg.clave)}">
                        <td>${utils.escapeHtml(cfg.clave)}</td>
                        <td>
                            <input
                                class="config-input"
                                type="text"
                                value="${utils.escapeHtml(cfg.valor)}"
                                ${cfg.esEditable ? '' : 'disabled'}
                            />
                        </td>
                        <td>${utils.escapeHtml(cfg.grupoConfig || '—')}</td>
                        <td>${cfg.esEditable ? 'Sí' : 'No'}</td>
                        <td>
                            ${cfg.esEditable
                                ? `<button type="button" class="btn-dashboard btn-save-config">Guardar</button>`
                                : '—'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.querySelectorAll('.btn-save-config').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('tr');
            const clave = row?.getAttribute('data-clave');
            const input = row?.querySelector('.config-input');
            if (!clave || !input) return;

            btn.disabled = true;
            try {
                await api.configuracion.update(clave, input.value);
                utils.setPageMessage(messageEl, 'success', `Configuración "${clave}" actualizada.`);
            } catch (err) {
                utils.setPageMessage(messageEl, 'error', err.message);
            } finally {
                btn.disabled = false;
            }
        });
    });
}
