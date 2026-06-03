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
    // El backend devuelve { data: [...] } o el array directo
    const raw  = items?.data ?? items;
    const list = Array.isArray(raw) ? raw : [];

    if (!list.length) {
        container.innerHTML = '<p class="table-empty">No hay configuraciones registradas.</p>';
        return;
    }

    // Agrupar por grupo
    const grupos = {};
    list.forEach(cfg => {
        const g = cfg.grupo ?? cfg.Grupo ?? 'General';
        if (!grupos[g]) grupos[g] = [];
        grupos[g].push(cfg);
    });

    let html = '';
    for (const [grupo, cfgs] of Object.entries(grupos)) {
        html += `<div style="margin-bottom:20px">
            <h4 style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--bronze-gold);
                margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--gold-border);">${utils.escapeHtml(grupo)}</h4>
            <table class="data-table">
                <thead><tr>
                    <th>Clave</th><th>Descripción</th><th>Valor</th><th></th>
                </tr></thead>
                <tbody>
                ${cfgs.map(cfg => {
                    const clave = cfg.clave ?? cfg.Clave ?? '';
                    const valor = cfg.valor ?? cfg.Valor ?? '';
                    const desc  = cfg.descripcion ?? cfg.Descripcion ?? '—';
                    const editable = cfg.esEditable ?? cfg.EsEditable ?? true;
                    return `<tr data-clave="${utils.escapeHtml(clave)}">
                        <td style="font-family:monospace;font-size:12px;color:var(--champagne-gold)">${utils.escapeHtml(clave)}</td>
                        <td style="color:var(--text-muted);font-size:12px">${utils.escapeHtml(desc)}</td>
                        <td><input class="config-input" type="text"
                            value="${utils.escapeHtml(valor)}"
                            ${editable ? '' : 'disabled'}
                            style="background:rgba(255,255,255,.04);border:1px solid var(--gold-border);
                                   color:var(--text-ivory);padding:5px 10px;border-radius:4px;
                                   font-family:inherit;font-size:13px;width:100%;max-width:280px;" />
                        </td>
                        <td>${editable
                            ? `<button type="button" class="btn-dashboard btn-save-config"
                                style="padding:4px 12px;font-size:11px;">Guardar</button>`
                            : '<span style="color:var(--text-muted);font-size:11px">Solo lectura</span>'}
                        </td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table>
        </div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.btn-save-config').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const row   = btn.closest('tr');
            const clave = row?.getAttribute('data-clave');
            const input = row?.querySelector('.config-input');
            if (!clave || !input) return;

            btn.disabled    = true;
            btn.textContent = 'Guardando...';
            try {
                await api.configuracion.update(clave, input.value);
                utils.setPageMessage(messageEl, 'success', `Configuración "${clave}" actualizada.`);
            } catch (err) {
                utils.setPageMessage(messageEl, 'error', err.message);
            } finally {
                btn.disabled    = false;
                btn.textContent = 'Guardar';
            }
        });
    });
}
