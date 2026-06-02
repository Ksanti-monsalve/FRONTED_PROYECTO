document.addEventListener('DOMContentLoaded', async () => {
    const api = window.AutoTallerApi;
    const utils = window.AppUtils;

    if (api.isAuthenticated()) { api.replaceTo('dashboard'); return; }

    const form = document.getElementById('register-form');
    const msgEl = document.getElementById('page-message');
    const marcaSelect = document.getElementById('marca');
    const modeloSelect = document.getElementById('modelo');
    const colorSelect = document.getElementById('color');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');

    let marcasData = [];
    let modelosData = [];

    // Load catalogs (public endpoints)
    try {
        const [marcas, colores] = await Promise.all([
            api.catalogos.marcas(),
            api.catalogos.colores(),
        ]);

        marcasData = marcas?.data ?? marcas ?? [];
        marcaSelect.innerHTML = '<option value="">Seleccionar marca...</option>' +
            marcasData.map(m => `<option value="${m.id}">${utils.escapeHtml(m.nombre)}</option>`).join('');

        const coloresArr = colores?.data ?? colores ?? [];
        colorSelect.innerHTML = '<option value="">No especificar</option>' +
            coloresArr.map(c => `<option value="${c.id}">${utils.escapeHtml(c.nombre)}</option>`).join('');
    } catch (e) {
        showMsg('error', 'No se pudo cargar el catálogo de marcas. Verifica que el servidor esté activo.');
    }

    marcaSelect.addEventListener('change', async () => {
        const marcaId = marcaSelect.value;
        modeloSelect.innerHTML = '<option value="">Cargando...</option>';
        modeloSelect.disabled = true;
        if (!marcaId) { modeloSelect.innerHTML = '<option value="">Selecciona una marca primero</option>'; return; }
        try {
            const resp = await api.catalogos.modelos(marcaId);
            modelosData = resp?.data ?? resp ?? [];
            modeloSelect.innerHTML = '<option value="">Seleccionar modelo...</option>' +
                modelosData.map(m => `<option value="${m.id}">${utils.escapeHtml(m.nombre)}</option>`).join('');
            modeloSelect.disabled = false;
        } catch {
            modeloSelect.innerHTML = '<option value="">Error al cargar modelos</option>';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('confirm-password').value;

        if (password !== confirm) { showMsg('error', 'Las contraseñas no coinciden.'); return; }
        if (password.length < 6) { showMsg('error', 'La contraseña debe tener al menos 6 caracteres.'); return; }

        const modeloVehiculoId = document.getElementById('modelo').value;
        const anio = parseInt(document.getElementById('anio').value, 10);
        const placa = document.getElementById('placa').value.toUpperCase().trim();

        if (!modeloVehiculoId) { showMsg('error', 'Selecciona el modelo del vehículo.'); return; }
        if (!placa) { showMsg('error', 'Ingresa la placa del vehículo.'); return; }

        const colorId = document.getElementById('color').value || null;

        setLoading(true);
        try {
            const result = await api.auth.registerCliente({
                email:           document.getElementById('reg-email').value.trim(),
                password,
                nombres:         document.getElementById('nombres').value.trim(),
                apellidos:       document.getElementById('apellidos').value.trim(),
                tipoDocumento:   document.getElementById('tipo-doc').value,
                numeroDocumento: document.getElementById('num-doc').value.trim(),
                telefono:        document.getElementById('telefono').value.trim() || null,
                placa,
                modeloVehiculoId,
                anio,
                colorId,
                vin:             document.getElementById('vin').value.trim() || null,
            });

            const data = result?.data ?? result;
            const normalized = {
                accessToken:  data.token,
                refreshToken: data.refreshToken,
                nombreUsuario: [data.nombres, data.apellidos].filter(Boolean).join(' ') || data.email,
                roles: data.roles || [],
                expiracion: data.expiration,
            };

            // Save session and redirect to dashboard
            const st = sessionStorage;
            st.setItem('atm_access_token', normalized.accessToken);
            st.setItem('atm_refresh_token', normalized.refreshToken);
            st.setItem('atm_user', JSON.stringify(normalized));
            api.setToken && api.setToken(normalized.accessToken);

            showMsg('success', '¡Registro exitoso! Redirigiendo...');
            setTimeout(() => api.replaceTo('dashboard'), 1500);
        } catch (err) {
            showMsg('error', err.message || 'Error al registrar. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    });

    function showMsg(type, msg) {
        msgEl.className = `page-alert page-alert-${type}`;
        msgEl.textContent = msg;
        msgEl.classList.remove('hidden');
        msgEl.hidden = false;
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function setLoading(on) {
        submitBtn.disabled = on;
        btnText.textContent = on ? 'Registrando...' : 'Registrarme';
    }
});
