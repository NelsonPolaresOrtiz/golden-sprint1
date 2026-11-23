/**
 * ERP GOLDEN - Gestión de Autenticación y CRUD de Usuarios (Stitch Enterprise UI)
 * Conforme a .agent/skills/stitch-ui/SKILL.md & .antigravityrules
 */
const API_URL = '/api';
let listaUsuariosGlobal = [];

// Helper Toast con SweetAlert2 (Stitch UI Sobrio y Compacto)
const Toast = window.Toast || (typeof Swal !== 'undefined' ? Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: false,
    background: '#FFFFFF',
    color: '#0F172A',
    customClass: {
        popup: 'stitch-toast'
    },
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
}) : {
    fire: ({ title }) => alert(title)
});

// ==========================================
// CAPA SUPERPUESTA TEMPORAL: INTRO ANIMADA (SPLASH SCREEN OVERLAY)
// ==========================================

let splashTimeoutExit = null;
let splashTimeoutDone = null;

function iniciarSecuenciaSplash() {
    const splash = document.getElementById('splashOverlay');
    if (!splash) return;

    // Verificar si ya se reprodujo en esta sesión de navegación
    const yaVisto = sessionStorage.getItem('golden_splash_visto');
    if (yaVisto === '1') {
        splash.classList.add('is-hidden');
        splash.style.setProperty('display', 'none', 'important');
        splash.style.setProperty('pointer-events', 'none', 'important');
        return;
    }

    if (splashTimeoutExit) clearTimeout(splashTimeoutExit);
    if (splashTimeoutDone) clearTimeout(splashTimeoutDone);

    // 2.3s - 3.0s: Efecto de expansión (transform: scale(5); opacity: 0;)
    splashTimeoutExit = setTimeout(() => {
        splash.classList.add('splash-zoom-exit');
    }, 2300);

    // A los 3.0s: Desvanecer por completo y marcar como visto en sessionStorage
    splashTimeoutDone = setTimeout(() => {
        saltarSplashIntro();
    }, 3000);
}

function saltarSplashIntro() {
    const splash = document.getElementById('splashOverlay');
    if (!splash) return;
    if (splashTimeoutExit) clearTimeout(splashTimeoutExit);
    if (splashTimeoutDone) clearTimeout(splashTimeoutDone);
    sessionStorage.setItem('golden_splash_visto', '1');
    splash.classList.add('is-hidden');
    splash.classList.remove('splash-zoom-exit');
    splash.style.setProperty('display', 'none', 'important');
    splash.style.setProperty('pointer-events', 'none', 'important');
}

window.saltarSplashIntro = saltarSplashIntro;

// ==========================================
// CONTROL DE CARRUSEL AUTOMOTRIZ (4.5s)
// ==========================================
var timerCarruselAutomotriz = null;
var indiceSlideAutomotriz = 0;

function irASlideAutomotriz(nuevoIndice) {
    const slides = document.querySelectorAll('.ken-burns-slide');
    const pills = document.querySelectorAll('.showcase-indicator-pill');
    const elTagText = document.getElementById('showcaseTagText');
    const elTitle = document.getElementById('showcaseActiveTitle');
    const elSub = document.getElementById('showcaseActiveSub');

    if (!slides || slides.length === 0) return;
    const total = slides.length;
    indiceSlideAutomotriz = ((nuevoIndice % total) + total) % total;

    slides.forEach((slide, idx) => {
        if (idx === indiceSlideAutomotriz) {
            slide.classList.add('active');
            const img = slide.querySelector('img');
            if (img) {
                img.style.animation = 'none';
                void img.offsetHeight;
                img.style.animation = '';
            }
            const tag = slide.getAttribute('data-tag') || '';
            const title = slide.getAttribute('data-title') || '';
            const sub = slide.getAttribute('data-sub') || '';

            if (elTagText) elTagText.textContent = tag;
            if (elTitle) elTitle.textContent = title;
            if (elSub) elSub.textContent = sub;
        } else {
            slide.classList.remove('active');
        }
    });

    pills.forEach((pill, idx) => {
        if (idx === indiceSlideAutomotriz) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    if (timerCarruselAutomotriz) clearInterval(timerCarruselAutomotriz);
    timerCarruselAutomotriz = setInterval(() => {
        irASlideAutomotriz(indiceSlideAutomotriz + 1);
    }, 4500);
}

window.irASlideAutomotriz = irASlideAutomotriz;
window.iniciarCarruselAutomotriz = function() {
    irASlideAutomotriz(0);
};

// Control de visibilidad de contraseña
function toggleMostrarPassword() {
    const input = document.getElementById('loginPassword');
    const icono = document.getElementById('iconoPassword');
    if (!input || !icono) return;
    if (input.type === 'password') {
        input.type = 'text';
        icono.className = 'bi bi-eye-slash-fill text-warning';
    } else {
        input.type = 'password';
        icono.className = 'bi bi-eye-fill';
    }
}
window.toggleMostrarPassword = toggleMostrarPassword;

// ==========================================
// INICIALIZACIÓN GENERAL DE LA VISTA
// ==========================================

// Helper de redirección contextual para Clientes (Conserva el carrito y flujo de checkout)
function redirigirSegunContextoCliente() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    const hayCarritoPendiente = !!localStorage.getItem('carrito_pendiente');

    if (redirect === 'checkout' || redirect === 'cotizar' || hayCarritoPendiente) {
        window.location.href = 'tienda.html?checkout=1';
    } else {
        window.location.href = 'tienda.html';
    }
}
window.redirigirSegunContextoCliente = redirigirSegunContextoCliente;

document.addEventListener('DOMContentLoaded', () => {
    // Iniciar capa superpuesta de intro animada sobre el login
    iniciarSecuenciaSplash();

    // Iniciar escaparate automotriz en movimiento (Carrusel Ken Burns 4.5s)
    if (document.getElementById('automotiveSlidesContainer')) {
        irASlideAutomotriz(0);
    }

    // Detección automática de ?modo=cliente en la URL para abrir el portal comercial luminoso
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modo') === 'cliente' || urlParams.get('cliente') === '1') {
        if (typeof window.activarModoComercialCliente === 'function') {
            window.activarModoComercialCliente();
        }
    }

    // Comprobar si hay sesión activa previa
    const usuarioGuardado = localStorage.getItem('usuario_golden');
    if (usuarioGuardado) {
        try {
            const usuario = JSON.parse(usuarioGuardado);
            // Si es cliente externo, redirigir de inmediato al catálogo de la tienda
            if (usuario.rol === 'CLIENTE' || usuario.rol === 'CLIENTE_B2B' || usuario.rol === 'CLIENTE_B2C') {
                redirigirSegunContextoCliente();
                return;
            }
            if (usuario.rol === 'TRABAJADOR') {
                redirigirSegunContextoCliente();
                return;
            }
            if (usuario.rol === 'EMPAQUE' || usuario.rol === 'DESPACHO' || usuario.rol === 'REPARTIDOR' || usuario.rol === 'ALMACENERO') {
                window.location.href = 'logistica.html';
                return;
            }
            // Si es ADMIN y está en index.html, habilitar panel CRUD si no se solicitó forzar login
            if (usuario.rol === 'ADMIN' && window.location.pathname.includes('index.html') && !window.location.search.includes('forzarLogin')) {
                mostrarPanelCRUD(usuario);
            }
        } catch (e) {
            localStorage.removeItem('usuario_golden');
        }
    }

    // Configurar buscador en tiempo real con evento 'input'
    const inputBuscador = document.getElementById('buscadorUsuarios');
    if (inputBuscador) {
        inputBuscador.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase().trim();
            const filtrados = listaUsuariosGlobal.filter(u =>
                (u.nombre && u.nombre.toLowerCase().includes(texto)) ||
                (u.email && u.email.toLowerCase().includes(texto)) ||
                (u.rol && u.rol.toLowerCase().includes(texto)) ||
                (u.telefono && u.telefono.toLowerCase().includes(texto)) ||
                (u.nit && u.nit.toLowerCase().includes(texto)) ||
                (u.id && String(u.id).includes(texto))
            );
            renderizarUsuarios(filtrados, texto);
        });
    }

    // Configurar formulario de Login original (Personal Interno)
    const formLogin = document.getElementById('loginForm') || document.getElementById('formLogin');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const elEmail = document.getElementById('loginEmail') || document.getElementById('email');
            const elPass = document.getElementById('loginPassword') || document.getElementById('password');
            const email = elEmail ? elEmail.value.trim() : '';
            const password = elPass ? elPass.value : '';
            const alertBox = document.getElementById('loginAlert');
            const btnLogin = document.getElementById('btnLogin');

            if (alertBox) alertBox.classList.add('d-none');

            // Feedback visual y protección contra doble clic
            const contenidoOriginalBtn = btnLogin ? btnLogin.innerHTML : '';
            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Validando acceso...`;
            }

            try {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, tipo_portal: 'INTERNO' })
                });
                const data = await res.json();

                if (!res.ok) {
                    if (alertBox) {
                        alertBox.textContent = data.error || 'Error al iniciar sesión.';
                        alertBox.classList.remove('d-none');
                    }
                    Toast.fire({ icon: 'error', title: data.error || 'Credenciales no autorizadas' });
                    return;
                }

                // Guardar sesión en localStorage
                localStorage.setItem('usuario_golden', JSON.stringify(data.usuario));

                Toast.fire({ icon: 'success', title: `Bienvenido, ${data.usuario.nombre}` });

                // Redirección automática según rol oficial
                const rol = (data.usuario.rol || '').toUpperCase().trim();
                if (rol === 'CLIENTE' || rol === 'CLIENTE_B2B' || rol === 'CLIENTE_B2C') {
                    redirigirSegunContextoCliente();
                    return;
                }

                if (rol === 'ADMIN') {
                    window.location.href = 'dashboard.html';
                    return;
                }

                if (rol === 'EMPAQUE' || rol === 'DESPACHO' || rol === 'REPARTIDOR' || rol === 'ALMACENERO') {
                    window.location.href = 'logistica.html';
                    return;
                }

                window.location.href = 'dashboard.html';
            } catch (error) {
                if (alertBox) {
                    alertBox.textContent = 'Error de conexión con el servidor ERP.';
                    alertBox.classList.remove('d-none');
                }
                Toast.fire({ icon: 'error', title: 'Error de conexión con el servidor ERP' });
            } finally {
                if (btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.innerHTML = contenidoOriginalBtn;
                }
            }
        });
    }

    // Configurar formulario de Login de Clientes / Talleres (Portal y legacy)
    const formPortalLogin = document.getElementById('portalLoginForm') || document.getElementById('formLogin') || document.getElementById('clienteLoginForm');
    if (formPortalLogin) {
        formPortalLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const elEmail = document.getElementById('portalClienteEmail') || document.getElementById('clienteEmail');
            const elPass = document.getElementById('portalClientePassword') || document.getElementById('clientePassword');
            const alertBox = document.getElementById('portalClienteAlert') || document.getElementById('clienteAlert');
            const btnLogin = document.getElementById('btnPortalClienteLogin') || document.getElementById('btnClienteLogin');

            const email = elEmail ? elEmail.value.trim() : '';
            const password = elPass ? elPass.value : '';

            if (alertBox) alertBox.classList.add('d-none');
            const contenidoOriginalBtn = btnLogin ? btnLogin.innerHTML : '';
            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> Validando acceso...`;
            }

            try {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, tipo_portal: 'CLIENTE' })
                });
                const data = await res.json();

                if (!res.ok) {
                    if (alertBox) {
                        alertBox.textContent = data.error || 'Credenciales no autorizadas.';
                        alertBox.classList.remove('d-none');
                    }
                    Toast.fire({ icon: 'error', title: data.error || 'Acceso no autorizado' });
                    return;
                }

                localStorage.setItem('usuario_golden', JSON.stringify(data.usuario));
                Toast.fire({ icon: 'success', title: `Bienvenido, ${data.usuario.nombre}` });

                // Redirección contextual según rol
                const rol = (data.usuario.rol || '').toUpperCase().trim();
                setTimeout(() => {
                    if (rol === 'CLIENTE' || rol === 'CLIENTE_B2B' || rol === 'CLIENTE_B2C') {
                        redirigirSegunContextoCliente();
                        return;
                    }
                    if (rol === 'ADMIN') {
                        window.location.href = 'dashboard.html';
                        return;
                    }
                    if (rol === 'EMPAQUE' || rol === 'DESPACHO' || rol === 'REPARTIDOR' || rol === 'ALMACENERO') {
                        window.location.href = 'logistica.html';
                        return;
                    }
                    redirigirSegunContextoCliente();
                }, 350);

            } catch (error) {
                if (alertBox) {
                    alertBox.textContent = 'Error de conexión con el servidor.';
                    alertBox.classList.remove('d-none');
                }
                Toast.fire({ icon: 'error', title: 'Error de conexión con el servidor' });
            } finally {
                if (btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.innerHTML = contenidoOriginalBtn;
                }
            }
        });
    }

    // Configurar formulario de Registro de Nuevo Taller (Portal y legacy)
    const formPortalReg = document.getElementById('portalRegistroForm') || document.getElementById('formRegistro') || document.getElementById('clienteRegistroForm');
    if (formPortalReg) {
        formPortalReg.addEventListener('submit', async (e) => {
            e.preventDefault();
            const elNombre = document.getElementById('regPortalNombre') || document.getElementById('regTallerNombre');
            const elNit = document.getElementById('regPortalNit') || document.getElementById('regTallerNit');
            const elTel = document.getElementById('regPortalTelefono') || document.getElementById('regTallerTelefono');
            const elDir = document.getElementById('regPortalDireccion');
            const elEmail = document.getElementById('regPortalEmail') || document.getElementById('regTallerEmail');
            const elPass = document.getElementById('regPortalPassword') || document.getElementById('regTallerPassword');
            const alertBox = document.getElementById('portalClienteAlert') || document.getElementById('clienteAlert');
            const btnReg = document.getElementById('btnPortalClienteRegistro') || document.getElementById('btnClienteRegistro');

            const nombre = elNombre ? elNombre.value.trim() : '';
            const nit = elNit ? elNit.value.trim() : '';
            const telefono = elTel ? elTel.value.trim() : '';
            const direccion = elDir ? elDir.value.trim() : '';
            const email = elEmail ? elEmail.value.trim() : '';
            const password = elPass ? elPass.value : '';

            if (!password || password.length < 6) {
                if (alertBox) {
                    alertBox.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                    alertBox.classList.remove('d-none');
                }
                Toast.fire({ icon: 'warning', title: 'La contraseña debe tener al menos 6 caracteres' });
                return;
            }

            if (alertBox) alertBox.classList.add('d-none');
            const contenidoOriginalBtn = btnReg ? btnReg.innerHTML : '';
            if (btnReg) {
                btnReg.disabled = true;
                btnReg.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> Creando cuenta de taller...`;
            }

            try {
                const res = await fetch(`${API_URL}/clientes/registro`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, nit, telefono, direccion, email, correo: email, password, metodo_auth: 'local' })
                });
                const data = await res.json();

                if (!res.ok) {
                    if (alertBox) {
                        alertBox.textContent = data.error || 'Error al registrar el taller.';
                        alertBox.classList.remove('d-none');
                    }
                    Toast.fire({ icon: 'error', title: data.error || 'Error en registro' });
                    return;
                }

                localStorage.setItem('usuario_golden', JSON.stringify(data.usuario));

                if (typeof Swal !== 'undefined') {
                    await Swal.fire({
                        icon: 'success',
                        title: '¡Taller Registrado con Éxito!',
                        html: `Bienvenido a la red comercial de GOLDEN, <b>${data.usuario.nombre}</b>.<br><small class="text-muted">NIT/CI: ${data.usuario.nit || nit} • Sucre, Bolivia</small>`,
                        confirmButtonText: 'Ir al Catálogo Mayorista',
                        confirmButtonColor: '#B91C1C'
                    });
                } else {
                    Toast.fire({ icon: 'success', title: `Bienvenido, ${data.usuario.nombre}` });
                }

                redirigirSegunContextoCliente();

            } catch (error) {
                if (alertBox) {
                    alertBox.textContent = 'Error de conexión con el servidor.';
                    alertBox.classList.remove('d-none');
                }
                Toast.fire({ icon: 'error', title: 'Error de conexión con el servidor' });
            } finally {
                if (btnReg) {
                    btnReg.disabled = false;
                    btnReg.innerHTML = contenidoOriginalBtn;
                }
            }
        });
    }
});

// ==========================================
// MODO COMERCIAL DE CLIENTES Y OAUTH SOCIAL
// ==========================================

let currentOAuthProvider = 'Google';

window.activarModoComercialCliente = function() {
    const loginView = document.getElementById('loginView');
    const portalClientesView = document.getElementById('portalClientesView');
    const crudView = document.getElementById('crudView');
    const splitWrapper = document.getElementById('splitScreenWrapper');
    const btnSwitch = document.getElementById('btnSwitchModePersonal');

    if (crudView) crudView.classList.add('d-none');
    if (splitWrapper) splitWrapper.classList.remove('d-none');
    if (loginView) loginView.classList.add('d-none');
    if (portalClientesView) {
        portalClientesView.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (btnSwitch) {
        btnSwitch.innerHTML = '<span>Acceso Personal GOLDEN</span> <i class="bi bi-arrow-right"></i>';
        btnSwitch.onclick = window.activarModoPersonalInterno;
    }
};

window.activarModoPersonalInterno = function() {
    const loginView = document.getElementById('loginView');
    const portalClientesView = document.getElementById('portalClientesView');
    const splitWrapper = document.getElementById('splitScreenWrapper');
    const btnSwitch = document.getElementById('btnSwitchModePersonal');

    if (splitWrapper) splitWrapper.classList.remove('d-none');
    if (portalClientesView) portalClientesView.classList.add('d-none');
    if (loginView) {
        loginView.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (btnSwitch) {
        btnSwitch.innerHTML = '<i class="bi bi-arrow-left"></i> <span>Portal Clientes &amp; Talleres</span>';
        btnSwitch.onclick = window.activarModoComercialCliente;
    }
};

window.alternarPillComercial = function(modo) {
    const tabIngresar = document.getElementById('tabPillIngresar');
    const tabRegistrar = document.getElementById('tabPillRegistrar');
    const secIngresar = document.getElementById('seccionPillIngresar');
    const secRegistrar = document.getElementById('seccionPillRegistrar');
    const alertBox = document.getElementById('portalClienteAlert');

    if (alertBox) alertBox.classList.add('d-none');

    if (modo === 'ingresar') {
        if (tabIngresar) tabIngresar.classList.add('active');
        if (tabRegistrar) tabRegistrar.classList.remove('active');
        if (secIngresar) secIngresar.classList.remove('d-none');
        if (secRegistrar) secRegistrar.classList.add('d-none');
    } else {
        if (tabRegistrar) tabRegistrar.classList.add('active');
        if (tabIngresar) tabIngresar.classList.remove('active');
        if (secRegistrar) secRegistrar.classList.remove('d-none');
        if (secIngresar) secIngresar.classList.add('d-none');
    }
};

window.llenarPortalCliente = function(email, pass) {
    const elEmail = document.getElementById('portalClienteEmail') || document.getElementById('clienteEmail');
    const elPass = document.getElementById('portalClientePassword') || document.getElementById('clientePassword');
    const alertBox = document.getElementById('portalClienteAlert') || document.getElementById('clienteAlert');
    if (alertBox) alertBox.classList.add('d-none');

    if (elEmail) elEmail.value = email;
    if (elPass) elPass.value = pass;
    if (elEmail) elEmail.focus();

    Toast.fire({ icon: 'info', title: `Credenciales de taller cargadas: ${email}` });
};

window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn.querySelector ? btn.querySelector('i') : null;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.className = 'bi bi-eye-slash-fill text-warning';
    } else {
        input.type = 'password';
        if (icon) icon.className = 'bi bi-eye-fill';
    }
};

window.alternarTabComercial = function(tab) {
    const btnLogin = document.getElementById('tabClienteLogin');
    const btnReg = document.getElementById('tabClienteRegistro');
    const subLogin = document.getElementById('subPanelClienteLogin');
    const subReg = document.getElementById('subPanelClienteRegistro');
    const alertBox = document.getElementById('clienteAlert');
    if (alertBox) alertBox.classList.add('d-none');

    if (tab === 'login') {
        if (btnLogin) btnLogin.classList.add('active');
        if (btnReg) btnReg.classList.remove('active');
        if (subLogin) subLogin.classList.remove('d-none');
        if (subReg) subReg.classList.add('d-none');
    } else {
        if (btnReg) btnReg.classList.add('active');
        if (btnLogin) btnLogin.classList.remove('active');
        if (subReg) subReg.classList.remove('d-none');
        if (subLogin) subLogin.classList.add('d-none');
    }
};

window.llenarLoginCliente = function(email, pass) {
    const elEmail = document.getElementById('clienteEmail');
    const elPass = document.getElementById('clientePassword');
    const alertBox = document.getElementById('clienteAlert');
    if (alertBox) alertBox.classList.add('d-none');

    if (elEmail) elEmail.value = email;
    if (elPass) elPass.value = pass;
    if (elEmail) elEmail.focus();

    Toast.fire({ icon: 'info', title: `Credenciales de taller cargadas: ${email}` });
};

let GOOGLE_CLIENT_ID = '';

async function obtenerGoogleClientId() {
    if (GOOGLE_CLIENT_ID) return GOOGLE_CLIENT_ID;
    try {
        const res = await fetch(`${API_URL}/auth/config`);
        if (res.ok) {
            const data = await res.json();
            GOOGLE_CLIENT_ID = data.googleClientId || '';
        }
    } catch (e) {
        GOOGLE_CLIENT_ID = '';
    }
    return GOOGLE_CLIENT_ID;
}

window.abrirModalOAuthSocial = async function(provider) {
    const provLimpio = provider ? provider.toLowerCase() : 'google';

    // Si es Google y hay Google Client ID configurado (válido):
    if (provLimpio === 'google') {
        const clientId = await obtenerGoogleClientId();
        if (clientId && clientId.trim().length > 10 && typeof google !== 'undefined' && google.accounts?.id) {
            try {
                google.accounts.id.initialize({
                    client_id: clientId,
                    callback: manejarRespuestaGoogleCredential,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });
                google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMomentum()) {
                        mostrarModalOAuthVisual('Google');
                    }
                });
                return;
            } catch (err) {
                console.warn('Error en Google Identity Services, abriendo selector modal:', err);
            }
        }
    }

    // Modo selector visual auténtico (Google / Facebook / Microsoft)
    mostrarModalOAuthVisual(provider);
};

function manejarRespuestaGoogleCredential(response) {
    if (!response || !response.credential) return;
    const payload = decodificarJwtGoogle(response.credential);
    if (!payload || !payload.email) return;

    Toast.fire({ icon: 'info', title: `Autenticando Google: ${payload.email}` });
    window.ejecutarOAuthLogin(payload.email, payload.name || payload.email.split('@')[0], payload.picture);
}

function decodificarJwtGoogle(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

function mostrarModalOAuthVisual(provider) {
    currentOAuthProvider = provider ? (provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase()) : 'Google';
    const titleEl = document.getElementById('oauthModalTitle');
    const iconWrapper = document.getElementById('oauthModalIconWrapper');
    const customForm = document.getElementById('oauthCustomForm');
    const spinner = document.getElementById('oauthLoadingSpinner');
    const triggerBtn = document.getElementById('btnCustomOAuthTrigger');
    const customEmailInput = document.getElementById('oauthCustomEmail');
    const customSubmitBtn = document.getElementById('btnCustomOAuthSubmit');
    const customEmailLabel = document.getElementById('lblCustomOAuthEmail');

    if (customForm) customForm.classList.add('d-none');
    if (spinner) spinner.classList.add('d-none');

    let iconSvg = '';
    if (currentOAuthProvider.toLowerCase() === 'google') {
        if (titleEl) titleEl.textContent = 'Iniciar sesión con Google';
        if (triggerBtn) triggerBtn.innerHTML = '<i class="bi bi-person-plus me-1"></i> Usar mi propio correo Gmail...';
        if (customEmailLabel) customEmailLabel.textContent = 'Correo Electrónico Gmail';
        if (customEmailInput) customEmailInput.placeholder = 'tu.correo@gmail.com';
        if (customSubmitBtn) customSubmitBtn.textContent = 'Entrar con esta cuenta de Google';

        iconSvg = `<svg width="22" height="22" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>`;
    } else if (currentOAuthProvider.toLowerCase() === 'facebook') {
        if (titleEl) titleEl.textContent = 'Iniciar sesión con Facebook';
        if (triggerBtn) triggerBtn.innerHTML = '<i class="bi bi-person-plus me-1"></i> Usar otra cuenta de Facebook / Correo...';
        if (customEmailLabel) customEmailLabel.textContent = 'Correo Electrónico o Teléfono';
        if (customEmailInput) customEmailInput.placeholder = 'taller@facebook.com';
        if (customSubmitBtn) customSubmitBtn.textContent = 'Entrar con esta cuenta de Facebook';

        iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>`;
    } else {
        if (titleEl) titleEl.textContent = 'Iniciar sesión con Microsoft';
        if (triggerBtn) triggerBtn.innerHTML = '<i class="bi bi-person-plus me-1"></i> Usar otra cuenta Microsoft...';
        if (customEmailLabel) customEmailLabel.textContent = 'Correo Outlook / Hotmail';
        if (customEmailInput) customEmailInput.placeholder = 'taller@outlook.com';
        if (customSubmitBtn) customSubmitBtn.textContent = 'Entrar con esta cuenta Microsoft';

        iconSvg = `<svg width="20" height="20" viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
        </svg>`;
    }

    if (iconWrapper) iconWrapper.innerHTML = iconSvg;

    const modalEl = document.getElementById('modalOAuthSocial');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl, {
            backdrop: true,
            keyboard: true
        });
        modal.show();
    }
}

window.ejecutarOAuthLogin = async function(email, nombre, picture) {
    const spinner = document.getElementById('oauthLoadingSpinner');
    if (spinner) spinner.classList.remove('d-none');

    try {
        const res = await fetch(`${API_URL}/auth/social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: currentOAuthProvider || 'Google',
                email: email,
                nombre: nombre || 'Taller Mecánico',
                picture: picture || ''
            })
        });

        const data = await res.json();
        if (!res.ok) {
            if (spinner) spinner.classList.add('d-none');
            Toast.fire({ icon: 'error', title: data.error || 'Error en autenticación social' });
            return;
        }

        // Guardar usuario en localStorage
        localStorage.setItem('usuario_golden', JSON.stringify(data.usuario));

        // Cerrar modal
        const modalEl = document.getElementById('modalOAuthSocial');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        Toast.fire({ icon: 'success', title: `Bienvenido a GOLDEN, ${data.usuario.nombre}` });

        setTimeout(() => {
            redirigirSegunContextoCliente();
        }, 500);

    } catch (err) {
        if (spinner) spinner.classList.add('d-none');
        Toast.fire({ icon: 'error', title: 'Error al autenticar con la cuenta seleccionada' });
    }
};

window.toggleCustomOAuthForm = function() {
    const form = document.getElementById('oauthCustomForm');
    if (form) form.classList.toggle('d-none');
};

window.ejecutarOAuthPersonalizado = function() {
    const nombre = document.getElementById('oauthCustomNombre')?.value.trim();
    const email = document.getElementById('oauthCustomEmail')?.value.trim();
    if (!email || !email.includes('@')) {
        Toast.fire({ icon: 'warning', title: 'Por favor introduce un correo válido' });
        return;
    }
    window.ejecutarOAuthLogin(email, nombre || 'Taller Mecánico');
};

// Listener global para cerrar modal al presionar Escape o hacer clic fuera
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modalEl = document.getElementById('modalOAuthSocial');
        if (modalEl && modalEl.classList.contains('show') && typeof bootstrap !== 'undefined') {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
    }
});

// Función de ayuda para la defensa universitaria: autocompletar credenciales (1 clic)
window.llenarLogin = function (email, pass) {
    const elEmail = document.getElementById('loginEmail');
    const elPass = document.getElementById('loginPassword');
    const alertBox = document.getElementById('loginAlert');
    if (alertBox) alertBox.classList.add('d-none');

    if (elEmail) elEmail.value = email;
    if (elPass) elPass.value = pass;
    if (elEmail) elEmail.focus();

    Toast.fire({ icon: 'info', title: `Credenciales cargadas: ${email}` });
};

// ==========================================
// VISTA CRUD: CONTROL DE GESTIÓN DE USUARIOS
// ==========================================

function mostrarPanelCRUD(usuario) {
    // Si no es ADMIN, no tiene acceso a la gestión de usuarios
    if (usuario.rol !== 'ADMIN') {
        window.location.href = 'tienda.html';
        return;
    }

    const loginView = document.getElementById('loginView');
    const crudView = document.getElementById('crudView');
    const menuContenedor = document.getElementById('menu-contenedor');
    const splitWrapper = document.getElementById('splitScreenWrapper');

    if (loginView) loginView.classList.add('d-none');
    if (splitWrapper) splitWrapper.classList.add('d-none');
    if (crudView) crudView.classList.remove('d-none');
    if (menuContenedor) {
        menuContenedor.classList.remove('d-none');
        renderizarMenu('usuarios');
    }

    cargarUsuarios();
}

// ==========================================
// LÓGICA CRUD DE USUARIOS Y TALLERES (ESTILO EDITORIAL AUTOMOTRIZ)
// ==========================================
async function cargarUsuarios() {
    const tbody = document.getElementById('tablaUsuarios');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm text-danger me-2"></span>Cargando directorio...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/usuarios?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar usuarios');
        listaUsuariosGlobal = await res.json();
        renderizarUsuarios(listaUsuariosGlobal);
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5"><i class="bi bi-exclamation-triangle me-1"></i>Error al cargar lista de usuarios.</td></tr>';
        Toast.fire({ icon: 'error', title: 'Error al cargar directorio de usuarios' });
    }
}

function renderizarUsuarios(usuarios, filtroBusqueda = '') {
    const tbody = document.getElementById('tablaUsuarios');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!usuarios || usuarios.length === 0) {
        if (filtroBusqueda) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-secondary"><i class="bi bi-search fs-3 d-block mb-2 text-muted opacity-50"></i>No se encontraron registros que coincidan con la búsqueda.</td></tr>`;
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary">No existen usuarios registrados.</td></tr>';
        }
        return;
    }

    usuarios.forEach(u => {
        const pillEstado = u.estado === 'ACTIVO'
            ? `<span class="badge-pill-stitch badge-pill-emerald"><span class="pulse-dot pulse-dot-emerald me-1"></span>ACTIVO</span>`
            : `<span class="badge-pill-stitch badge-pill-ruby"><span class="pulse-dot pulse-dot-ruby me-1"></span>INACTIVO</span>`;

        let pillRol = `<span class="badge-pill-stitch badge-pill-slate">${u.rol}</span>`;
        if (u.rol === 'ADMIN') {
            pillRol = `<span class="badge-pill-stitch badge-pill-gold"><i class="bi bi-shield-lock-fill me-1"></i>ADMIN</span>`;
        } else if (u.rol === 'CLIENTE_B2B') {
            pillRol = `<span class="badge-pill-stitch badge-pill-slate"><i class="bi bi-building me-1"></i>CLIENTE B2B</span>`;
        } else if (u.rol === 'REPARTIDOR') {
            pillRol = `<span class="badge-pill-stitch badge-pill-gold"><i class="bi bi-truck me-1"></i>REPARTIDOR</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold font-monospace" style="color: #cbd5e1;">#${u.id}</td>
                <td>
                    <span class="fw-bold text-white d-block">${u.nombre}</span>
                </td>
                <td class="small font-monospace" style="color: #cbd5e1;">${u.email}</td>
                <td>${pillRol}</td>
                <td>${pillEstado}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-warning rounded-2 me-1" onclick="prepararEdicion(${u.id})" title="Editar Usuario">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger rounded-2" onclick="eliminarUsuario(${u.id}, '${u.nombre.replace(/'/g, "\\'")}')" title="Eliminar Usuario">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// GUARDAR / ACTUALIZAR USUARIO CON PROTECCIÓN CONTRA DOBLE CLIC
document.getElementById('userForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rol = document.getElementById('rol').value;
    const estado = document.getElementById('estado').value;

    const btnGuardar = document.getElementById('btnGuardar');
    const esEdicion = id !== '';
    const url = esEdicion ? `${API_URL}/usuarios/${id}` : `${API_URL}/usuarios`;
    const metodo = esEdicion ? 'PUT' : 'POST';

    if (!esEdicion && (!password || password.length < 6)) {
        Toast.fire({ icon: 'warning', title: 'La contraseña debe tener al menos 6 caracteres' });
        mostrarAlerta('La contraseña debe tener al menos 6 caracteres para un nuevo usuario.', 'danger');
        return;
    }

    const payload = { nombre, email, rol, estado };
    if (password && password.trim().length > 0) {
        payload.password = password.trim();
    }

    // Feedback visual y bloqueo del botón mientras se ejecuta la petición
    const textoOriginalBtn = btnGuardar ? btnGuardar.innerHTML : '';
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Guardando Usuario...`;
    }

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
            Toast.fire({ icon: 'error', title: data.error || 'Error al procesar usuario' });
            mostrarAlerta(data.error || 'Ocurrió un error al procesar el usuario.', 'danger');
            return;
        }

        const mensajeExito = esEdicion ? 'Usuario actualizado con éxito' : 'Usuario registrado con éxito';
        Toast.fire({ icon: 'success', title: data.mensaje || mensajeExito });
        mostrarAlerta(data.mensaje || 'Operación completada exitosamente.', 'success');
        resetFormulario();
        cargarUsuarios();
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Error de comunicación con el servidor' });
        mostrarAlerta('Error de comunicación con el servidor ERP.', 'danger');
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = textoOriginalBtn;
        }
    }
});

function prepararEdicion(id) {
    const u = listaUsuariosGlobal.find(item => item.id === id);
    if (!u) return;

    const elId = document.getElementById('userId');
    const elNombre = document.getElementById('nombre');
    const elEmail = document.getElementById('email');
    const elPass = document.getElementById('password');
    const elRol = document.getElementById('rol');
    const elEstado = document.getElementById('estado');
    const elTitle = document.getElementById('formTitle');
    const elHint = document.getElementById('passHint');
    const elBtn = document.getElementById('btnGuardar');
    const elCancel = document.getElementById('btnCancelar');

    if (elId) elId.value = u.id;
    if (elNombre) elNombre.value = u.nombre;
    if (elEmail) elEmail.value = u.email;
    if (elPass) elPass.value = '';
    if (elRol) elRol.value = u.rol;
    if (elEstado) elEstado.value = u.estado;

    if (elTitle) elTitle.innerHTML = `<i class="bi bi-pencil-square me-2 fs-5"></i> Editar Usuario #${u.id}`;
    if (elHint) elHint.textContent = '(Opcional: en blanco para conservar)';
    if (elBtn) elBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i> Guardar Cambios`;
    if (elCancel) elCancel.classList.remove('d-none');
}

// ELIMINACIÓN CON DIÁLOGO MODAL SWEETALERT2
async function eliminarUsuario(id, nombre) {
    const confirmacion = typeof Swal !== 'undefined'
        ? await Swal.fire({
            title: '¿Eliminar Usuario?',
            html: `¿Estás seguro de revocar el acceso y eliminar al usuario <strong class="text-warning">"${nombre}"</strong>? Esta acción no se puede revertir.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: '<i class="bi bi-trash3 me-1"></i> Sí, eliminar',
            cancelButtonText: 'Cancelar',
            background: '#0d121f',
            color: '#f8fafc',
            reverseButtons: true
        })
        : { isConfirmed: confirm(`¿Está seguro de eliminar al usuario "${nombre}"?`) };

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok) {
            Toast.fire({ icon: 'success', title: data.mensaje || 'Usuario eliminado con éxito' });
            mostrarAlerta(data.mensaje, 'warning');
            cargarUsuarios();
        } else {
            Toast.fire({ icon: 'error', title: data.error || 'Error al eliminar usuario' });
            mostrarAlerta(data.error, 'danger');
        }
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Error al contactar con el servidor' });
        mostrarAlerta('Error al eliminar usuario.', 'danger');
    }
}

function resetFormulario() {
    const form = document.getElementById('userForm');
    if (form) form.reset();
    const userId = document.getElementById('userId');
    if (userId) userId.value = '';
    const formTitle = document.getElementById('formTitle');
    if (formTitle) formTitle.innerHTML = `<i class="bi bi-person-plus-fill me-2 fs-5"></i> Registrar Nuevo Usuario`;
    const passHint = document.getElementById('passHint');
    if (passHint) passHint.textContent = '';
    const btnGuardar = document.getElementById('btnGuardar');
    if (btnGuardar) btnGuardar.innerHTML = `<i class="bi bi-save me-1"></i> Guardar Usuario`;
    const btnCancelar = document.getElementById('btnCancelar');
    if (btnCancelar) btnCancelar.classList.add('d-none');
}

function mostrarAlerta(mensaje, tipo) {
    const alertBox = document.getElementById('crudAlert');
    if (!alertBox) return;
    alertBox.className = `alert alert-${tipo} py-2 px-3 small rounded-3 fw-semibold`;
    alertBox.textContent = mensaje;
    alertBox.classList.remove('d-none');
    setTimeout(() => alertBox.classList.add('d-none'), 4000);
}

// Cierre de sesión global unificado
function cerrarSesion() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        localStorage.removeItem('usuario_golden');
        localStorage.removeItem('usuario_rol');
        localStorage.removeItem('carrito');
        localStorage.clear();
        sessionStorage.clear();
    } catch (e) {
        console.warn('Error al limpiar almacenamiento de sesión:', e);
    }
    window.location.href = 'index.html';
}
window.cerrarSesion = cerrarSesion;
window.logout = cerrarSesion;
