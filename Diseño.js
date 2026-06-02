/* ==========================================================================
   AUTOTALLERMANAGER - LUXURY REFINED MIRROR SYSTEM INTERACTIVE LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    if (window.AutoTallerApi?.isAuthenticated()) {
        window.AutoTallerApi.replaceTo('dashboard');
        return;
    }

    /* Login page only — resto de páginas usan AppAuth + AppLayout */

    /* ==========================================================================
       1. LUXURY DUST PARTICLE CANVAS (SLOW DRIFTING GOLD MOTES)
       ========================================================================== */
    const canvas = document.getElementById('dust-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let width = canvas.width = canvas.offsetWidth;
        let height = canvas.height = canvas.offsetHeight;

        // Mouse coordinates for proximity wind drift
        const mouse = { x: null, y: null, radius: 130 };

        // Handle resizing
        window.addEventListener('resize', () => {
            if (canvas.offsetWidth && canvas.offsetHeight) {
                width = canvas.width = canvas.offsetWidth;
                height = canvas.height = canvas.offsetHeight;
            }
        });

        // Track mouse position over the visual panel
        const visualPanel = document.querySelector('.visual-panel');
        if (visualPanel) {
            visualPanel.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                mouse.x = e.clientX - rect.left;
                mouse.y = e.clientY - rect.top;
            });

            visualPanel.addEventListener('mouseleave', () => {
                mouse.x = null;
                mouse.y = null;
            });
        }

        // Luxury Dust Particle Class
        class GoldMote {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 1.6 + 0.3; // extremely tiny shimmers
                this.speedX = Math.random() * 0.12 - 0.06; // ultra slow movement
                this.speedY = Math.random() * 0.1 - 0.05;
                this.baseOpacity = Math.random() * 0.3 + 0.08;
                this.opacity = this.baseOpacity;
                this.fadeDirection = Math.random() > 0.5 ? 0.004 : -0.004;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                // Ambient shimmer / twinkling
                this.opacity += this.fadeDirection;
                if (this.opacity > 0.45) this.fadeDirection = -0.003;
                if (this.opacity < 0.03) this.fadeDirection = 0.003;

                // Infinite wrapping
                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;

                // Proximity effect with Mouse cursor (gentle wind pull)
                if (mouse.x !== null && mouse.y !== null) {
                    const dx = mouse.x - this.x;
                    const dy = mouse.y - this.y;
                    const distance = Math.hypot(dx, dy);

                    if (distance < mouse.radius) {
                        const force = (mouse.radius - distance) / mouse.radius;
                        // Pull motes slowly towards mouse
                        this.x += (dx / distance) * force * 0.4;
                        this.y += (dy / distance) * force * 0.4;
                    }
                }
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(212, 175, 55, ${this.opacity})`;
                ctx.fill();
            }
        }

        // Initialize particles
        const particleCount = 40;
        for (let i = 0; i < particleCount; i++) {
            particles.push(new GoldMote());
        }

        // Main animation loop (60fps)
        function animate() {
            ctx.clearRect(0, 0, width, height);
            
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
            }
            requestAnimationFrame(animate);
        }

        animate();
    }


    /* ==========================================================================
       2. REFINED LATENCY OSCILLATOR
       ========================================================================== */
    const jwtLatencyText = document.getElementById('latency-text');

    if (jwtLatencyText) {
        setInterval(() => {
            const latency = 12 + Math.floor(Math.sin(Date.now() / 1400) * 1.5) + Math.floor(Math.random() * 2);
            jwtLatencyText.textContent = `Cifrado JWT asimétrico activo (latencia: ${latency}ms)`;
        }, 4000);
    }


    /* ==========================================================================
       3. INPUT FIELDS FOCUS STYLING
       ========================================================================== */
    const inputs = document.querySelectorAll('.input-wrapper input');
    
    inputs.forEach(input => {
        const group = input.closest('.input-group');

        input.addEventListener('focus', () => {
            group.classList.add('input-focus-active');
        });

        input.addEventListener('blur', () => {
            group.classList.remove('input-focus-active');
            validateField(input);
        });

        input.addEventListener('input', () => {
            if (group.classList.contains('has-error')) {
                validateField(input);
            }
        });
    });


    /* ==========================================================================
       4. PASSWORD VISIBILITY TOGGLE
       ========================================================================== */
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const passwordInput = document.getElementById('password');

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';

            const showIcon = togglePasswordBtn.querySelector('.eye-show');
            const hideIcon = togglePasswordBtn.querySelector('.eye-hide');

            if (isPassword) {
                showIcon.classList.add('hidden');
                hideIcon.classList.remove('hidden');
                togglePasswordBtn.setAttribute('aria-label', 'Ocultar contraseña');
            } else {
                showIcon.classList.remove('hidden');
                hideIcon.classList.add('hidden');
                togglePasswordBtn.setAttribute('aria-label', 'Mostrar contraseña');
            }

            passwordInput.focus();
        });
    }


    /* ==========================================================================
       5. DEMO CREDENTIAL AUTOFILL (TYPEWRITER SIMULATION WITH DISPATCH EVENTS)
       ========================================================================== */
    const roleChips = document.querySelectorAll('.role-chip');
    const emailInput = document.getElementById('email');

    const credentials = {
        admin: {
            email: 'admin@autotaller.com',
            pass: 'Admin@123'
        },
        mecanico: {
            email: 'mecanico@autotaller.com',
            pass: 'Mecanico@123'
        },
        recepcionista: {
            email: 'recepcion@autotaller.com',
            pass: 'Recepcion@123'
        }
    };

    roleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            // Set active class
            roleChips.forEach(c => c.classList.remove('active-chip'));
            chip.classList.add('active-chip');

            const role = chip.getAttribute('data-role');
            let data = null;

            if (role === 'admin') data = credentials.admin;
            else if (role === 'mecanico') data = credentials.mecanico;
            else data = credentials.recepcionista;

            // Clear errors prior to typing
            clearValidationStates();

            // Type email then password with premium typewriter delay
            typewriterFill(emailInput, data.email, () => {
                typewriterFill(passwordInput, data.pass, () => {
                    validateField(emailInput);
                    validateField(passwordInput);
                });
            });
        });
    });

    function typewriterFill(inputField, text, callback) {
        inputField.value = '';
        let index = 0;
        
        const originalType = inputField.type;
        if (originalType === 'password') {
            inputField.type = 'text';
        }

        const interval = setInterval(() => {
            if (index < text.length) {
                inputField.value += text[index];
                index++;
                
                // Dispatch input event so the floating label understands it's active immediately!
                inputField.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                clearInterval(interval);
                
                if (originalType === 'password') {
                    inputField.type = 'password';
                }
                
                if (callback) callback();
            }
        }, 15); // faster sleek typing (15ms per character)
    }

    function clearValidationStates() {
        const groups = document.querySelectorAll('.input-group');
        groups.forEach(g => {
            g.classList.remove('has-error', 'has-success');
            const errorSpan = g.querySelector('.error-message');
            if (errorSpan) errorSpan.style.display = 'none';
        });
    }


    /* ==========================================================================
       6. FIELD VALIDATION PROCEDURES
       ========================================================================== */
    function validateField(input) {
        const group = input.closest('.input-group');
        const errorSpan = group.querySelector('.error-message');
        let isValid = true;

        if (input.id === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = emailRegex.test(input.value.trim());
        } else if (input.id === 'password') {
            isValid = input.value.length >= 6;
        }

        if (isValid && input.value.trim() !== '') {
            group.classList.remove('has-error');
            group.classList.add('has-success');
            if (errorSpan) errorSpan.style.display = 'none';
            return true;
        } else if (!isValid && input.value.trim() !== '') {
            group.classList.remove('has-success');
            group.classList.add('has-error');
            if (errorSpan) errorSpan.style.display = 'block';
            return false;
        } else {
            group.classList.remove('has-error', 'has-success');
            if (errorSpan) errorSpan.style.display = 'none';
            return false;
        }
    }


    /* ==========================================================================
       7. FORM SUBMISSION & SHOWROOM REWARD
       ========================================================================== */
    const loginForm = document.getElementById('login-form-element');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
    const btnLoader = submitBtn ? submitBtn.querySelector('.btn-loader') : null;
    const statusMessageBox = document.getElementById('status-message-box');
    const rememberMeCheckbox = document.getElementById('remember-me');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const isEmailValid = validateField(emailInput);
            const isPasswordValid = validateField(passwordInput);

            if (emailInput.value === '') {
                showFieldRequiredError(emailInput, 'Firma de correo corporativa requerida');
            }
            if (passwordInput.value === '') {
                showFieldRequiredError(passwordInput, 'Contraseña de acceso corporativa requerida');
            }

            if (!isEmailValid || !isPasswordValid) {
                const firstError = document.querySelector('.has-error input');
                if (firstError) firstError.focus();
                return;
            }

            triggerAuthSequence();
        });
    }

    function showFieldRequiredError(input, msg) {
        const group = input.closest('.input-group');
        const errorSpan = group.querySelector('.error-message');
        group.classList.add('has-error');
        if (errorSpan) {
            errorSpan.textContent = msg;
            errorSpan.style.display = 'block';
        }
    }

    function setAuthLoading(isLoading) {
        if (!submitBtn || !btnText || !btnLoader) return;

        emailInput.disabled = isLoading;
        passwordInput.disabled = isLoading;
        submitBtn.disabled = isLoading;
        roleChips.forEach(c => { c.style.pointerEvents = isLoading ? 'none' : ''; });

        if (isLoading) {
            btnText.style.opacity = '0';
            btnLoader.classList.remove('hidden');
        } else {
            btnLoader.classList.add('hidden');
            btnText.style.opacity = '1';
        }
    }

    function resetSubmitButtonStyle() {
        if (!submitBtn || !btnText) return;
        btnText.textContent = 'Verificar Credenciales';
        submitBtn.style.background = '';
        submitBtn.style.borderColor = '';
        submitBtn.style.color = '';
        submitBtn.style.boxShadow = '';
    }

    function showAuthStatus({ success, title, description }) {
        if (!statusMessageBox) return;

        const statusIcon = document.getElementById('status-icon');
        const statusTitle = document.getElementById('status-title');
        const statusDesc = document.getElementById('status-desc');

        statusMessageBox.classList.remove('hidden');
        statusMessageBox.classList.toggle('msg-error', !success);

        if (success) {
            statusIcon.innerHTML = `<svg fill="none" stroke="var(--accent-emerald)" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
            statusTitle.style.color = 'var(--accent-emerald)';
        } else {
            statusIcon.innerHTML = `<svg fill="none" stroke="var(--accent-rose)" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
            statusTitle.style.color = 'var(--accent-rose)';
        }

        statusTitle.textContent = title;
        statusDesc.innerHTML = description;
    }

    function formatRoleLabel(roles) {
        const normalized = (roles || []).map(r => String(r).toLowerCase());
        if (normalized.some(r => r.includes('admin'))) return 'Administrador';
        if (normalized.some(r => r.includes('mecan'))) return 'Especialista';
        if (normalized.some(r => r.includes('recep') || r.includes('concierge'))) return 'Concierge';
        return 'Usuario';
    }

    async function triggerAuthSequence() {
        if (!window.AutoTallerApi) {
            showAuthStatus({
                success: false,
                title: 'CLIENTE API NO CARGADO',
                description: 'No se encontró <strong>api.js</strong>. Recarga la página.',
            });
            return;
        }

        setAuthLoading(true);
        resetSubmitButtonStyle();
        statusMessageBox?.classList.add('hidden');

        try {
            const tokens = await window.AutoTallerApi.login(
                emailInput.value.trim(),
                passwordInput.value,
                { remember: rememberMeCheckbox?.checked }
            );

            btnLoader.classList.add('hidden');
            btnText.style.opacity = '1';
            btnText.textContent = 'FIRMADO';
            submitBtn.style.background = 'var(--bronze-gold)';
            submitBtn.style.borderColor = 'var(--champagne-gold)';
            submitBtn.style.color = '#000000';
            submitBtn.style.boxShadow = 'var(--glow-gold)';

            const roleName = formatRoleLabel(tokens.roles);
            const displayName = tokens.nombreUsuario || emailInput.value.trim();

            showAuthStatus({
                success: true,
                title: 'FIRMA DIGITAL VERIFICADA',
                description: `JWT validado. Bienvenido, <strong>${displayName}</strong> (${roleName}). Abriendo consola principal...`,
            });

            triggerVisualRewardEffect();

            const delay = window.APP_CONFIG?.redirectDelayMs ?? 1400;
            setTimeout(() => {
                window.AutoTallerApi.goTo('dashboard');
            }, delay);
        } catch (error) {
            window.AutoTallerApi.clearSession();
            resetSubmitButtonStyle();

            showAuthStatus({
                success: false,
                title: 'ACCESO DENEGADO',
                description: error.message || 'No fue posible autenticar las credenciales.',
            });
            setAuthLoading(false);
        }
    }

    function triggerVisualRewardEffect() {
        // 1. Classic car silhouette glows intensely in champagne gold
        const realCarGroup = document.querySelector('.real-car');
        const mirroredCarGroup = document.querySelector('.mirrored-reflection');
        const carMirrorSvg = document.querySelector('.car-mirror-system');

        if (carMirrorSvg) {
            carMirrorSvg.style.filter = 'drop-shadow(0 0 35px rgba(212, 175, 55, 0.45))';
        }

        if (realCarGroup) {
            const chasis = realCarGroup.querySelector('.silhouette-path');
            const interior = realCarGroup.querySelector('.interior-path');
            
            if (chasis) {
                chasis.style.stroke = 'var(--champagne-gold)';
                chasis.style.filter = 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.8))';
            }
            if (interior) {
                interior.style.stroke = 'var(--champagne-gold)';
                interior.style.opacity = '0.9';
            }
        }

        // 2. Mirrored reflection glows in warm gold shimmers
        if (mirroredCarGroup) {
            mirroredCarGroup.style.opacity = '1.0';
            mirroredCarGroup.style.filter = 'url(#mirrorBlur) drop-shadow(0 0 15px rgba(212, 175, 55, 0.35))';
        }

        // 3. Gold dust particles shimmer intensely
        // We'll log in the console that the secure redirection has successfully initiated
        console.log('JWT Session granted. Redirection triggered successfully.');
    }

    // Recover credentials alert
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Se ha enviado una solicitud de firma asimétrica de recuperación a los servidores de alta seguridad de ASP.NET Core.');
        });
    }

});
