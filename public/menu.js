/**
 * ERP GOLDEN - Componente de Navegación Glassmorphic VIP con RBAC Estricto
 */

function renderizarMenu(paginaActiva) {
    const usuarioSesion = obtenerUsuarioSesion();
    const rol = usuarioSesion ? usuarioSesion.rol : null;

    // Identificación de tipo de usuario
    const esCliente = rol === 'CLIENTE_B2B' || rol === 'CLIENTE_B2C';
    const esAdmin = rol === 'ADMIN';
    const esAlmacenero = rol === 'ALMACENERO';
    const esRepartidor = rol === 'REPARTIDOR';

    // Logo apunta a la Tienda para clientes y al Dashboard para personal interno
    const logoHref = esCliente ? 'tienda.html' : 'dashboard.html';

    // Generar enlaces de navegación según RBAC
    let linksNavHTML = '';

    if (esCliente) {
        // CLIENTES EXTERNOS: Única y exclusivamente acceso a la Tienda / Catálogo
        linksNavHTML = `
            <li class="nav-item">
                <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 active text-warning fw-bold" 
                   style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);" 
                   href="tienda.html">
                    <i class="bi bi-shop text-warning"></i> Catálogo Oficial & Pedidos
                </a>
            </li>
        `;
    } else {
        // PERSONAL INTERNO (ADMIN, ALMACENERO, REPARTIDOR)
        if (esAdmin) {
            linksNavHTML += `
                <li class="nav-item">
                    <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 ${paginaActiva === 'dashboard' ? 'active text-warning fw-bold' : 'text-light text-opacity-75'}" 
                       style="${paginaActiva === 'dashboard' ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);' : 'transition: all 0.2s;'}" 
                       href="dashboard.html">
                        <i class="bi bi-speedometer2 text-warning"></i> Dashboard
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 ${paginaActiva === 'usuarios' ? 'active text-warning fw-bold' : 'text-light text-opacity-75'}" 
                       style="${paginaActiva === 'usuarios' ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);' : 'transition: all 0.2s;'}" 
                       href="index.html">
                        <i class="bi bi-people-fill text-warning"></i> Usuarios
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 ${paginaActiva === 'compras' ? 'active text-warning fw-bold' : 'text-light text-opacity-75'}" 
                       style="${paginaActiva === 'compras' ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);' : 'transition: all 0.2s;'}" 
                       href="compras.html">
                        <i class="bi bi-truck-flatbed text-warning"></i> Proveedores/SCM
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 ${paginaActiva === 'facturacion' ? 'active text-warning fw-bold' : 'text-light text-opacity-75'}" 
                       style="${paginaActiva === 'facturacion' ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);' : 'transition: all 0.2s;'}" 
                       href="facturacion.html">
                        <i class="bi bi-credit-card-2-front-fill text-warning"></i> Cobranza y Facturación
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 ${paginaActiva === 'creditos' ? 'active text-warning fw-bold' : 'text-light text-opacity-75'}" 
                       style="${paginaActiva === 'creditos' ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);' : 'transition: all 0.2s;'}" 
                       href="creditos.html">
                        <i class="bi bi-bank text-warning"></i> Créditos B2B
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 ${paginaActiva === 'auditoria' ? 'active text-warning fw-bold' : 'text-light text-opacity-75'}" 
                       style="${paginaActiva === 'auditoria' ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);' : 'transition: all 0.2s;'}" 
                       href="auditoria.html">
                        <i class="bi bi-shield-check text-warning"></i> Auditoría
                    </a>
                </li>
            `;
        }

        if (esAdmin || esAlmacenero) {
            linksNavHTML += `
                <li class="nav-item">
                    <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 ${paginaActiva === 'inventario' ? 'active text-warning fw-bold' : 'text-light text-opacity-75'}" 
                       style="${paginaActiva === 'inventario' ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);' : 'transition: all 0.2s;'}" 
                       href="inventario.html">
                        <i class="bi bi-box-seam-fill text-warning"></i> Inventario
                    </a>
                </li>
            `;
        }

        linksNavHTML += `
            <li class="nav-item">
                <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 ${paginaActiva === 'tienda' ? 'active text-warning fw-bold' : 'text-light text-opacity-75'}" 
                   style="${paginaActiva === 'tienda' ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);' : 'transition: all 0.2s;'}" 
                   href="tienda.html">
                    <i class="bi bi-shop text-warning"></i> Catálogo / Ventas
                </a>
            </li>
        `;

        if (esAdmin || esAlmacenero || esRepartidor) {
            linksNavHTML += `
                <li class="nav-item">
                    <a class="nav-link px-3 py-2 rounded-3 text-nowrap fw-semibold d-flex align-items-center gap-2 ${paginaActiva === 'logistica' ? 'active text-warning fw-bold' : 'text-light text-opacity-75'}" 
                       style="${paginaActiva === 'logistica' ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);' : 'transition: all 0.2s;'}" 
                       href="logistica.html">
                        <i class="bi bi-truck text-warning"></i> Logística
                    </a>
                </li>
            `;
        }
    }

    const menuHTML = `
    <nav class="navbar navbar-expand-lg" style="background: transparent; border-bottom: none;">
        <div class="container-fluid px-4 py-1">
            <!-- Brand Logo -->
            <a class="navbar-brand fw-extrabold d-flex align-items-center gap-2 text-decoration-none py-1" href="${logoHref}">
                <div class="d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.1) 100%); border: 1px solid rgba(245, 158, 11, 0.4); box-shadow: 0 0 15px rgba(245, 158, 11, 0.2);">
                    <i class="bi bi-shield-shaded text-warning fs-5"></i>
                </div>
                <div class="d-flex flex-column" style="line-height: 1.1;">
                    <span class="fw-bolder tracking-wide text-white" style="letter-spacing: 0.5px; font-size: 1.15rem;">
                        GOLDEN <span class="text-gradient-gold">ERP</span>
                    </span>
                    <span class="text-muted" style="font-size: 0.65rem; letter-spacing: 1.5px; font-weight: 700;">ENTERPRISE SUITE</span>
                </div>
            </a>

            <!-- Botón Hamburguesa Responsive -->
            <button class="navbar-toggler border-0 p-2 text-warning" type="button" data-bs-toggle="collapse" data-bs-target="#menuPrincipal" aria-controls="menuPrincipal" aria-expanded="false" aria-label="Menú">
                <i class="bi bi-list fs-2"></i>
            </button>

            <!-- Links de Navegación según Rol (RBAC) -->
            <div class="collapse navbar-collapse" id="menuPrincipal">
                <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-4 gap-1">
                    ${linksNavHTML}
                </ul>

                <!-- Área Derecha: Campanita de Notificaciones, Badge de Perfil, Carrito y Salir -->
                <div class="d-flex align-items-center flex-wrap gap-2 mt-3 mt-lg-0">
                    
                    <!-- Campanita de Notificaciones (Alertas de Stock en Vivo) -->
                    <div class="position-relative">
                        <button id="btnCampanaNotificaciones" class="btn p-0 rounded-circle text-warning d-flex align-items-center justify-content-center position-relative" style="width: 40px; height: 40px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); transition: all 0.25s ease;" onclick="mostrarModalAlertasStock()" title="Alertas de Stock en Tiempo Real">
                            <i class="bi bi-bell-fill fs-5 text-warning"></i>
                            <span id="badgeNotificacionesStock" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-dark" style="font-size: 0.68rem; display: none; padding: 0.35em 0.55em; box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);">
                                0
                            </span>
                        </button>
                    </div>

                    <!-- Badge Usuario con Indicador Pulsante -->
                    <div id="userInfoBadge" class="d-flex align-items-center gap-2 px-3 py-1 rounded-pill" style="background: rgba(20, 28, 46, 0.85); border: 1px solid rgba(255, 255, 255, 0.12);">
                        <span class="pulse-dot pulse-dot-emerald"></span>
                        <div class="d-flex flex-column" style="line-height: 1.1;">
                            <span class="fw-bold small text-white text-nowrap" id="navUserName">${usuarioSesion ? usuarioSesion.nombre : 'Usuario'}</span>
                            <span class="text-warning text-uppercase" style="font-size: 0.68rem; font-weight: 700; letter-spacing: 0.5px;" id="navUserRol">${usuarioSesion ? usuarioSesion.rol : 'INVITADO'}</span>
                        </div>
                    </div>

                    ${paginaActiva === 'tienda' ? `
                    <!-- Botón Carrito Flotante -->
                    <button class="btn btn-vip-gold d-flex align-items-center gap-2 px-3 py-2" type="button" data-bs-toggle="offcanvas" data-bs-target="#carritoLateral">
                        <i class="bi bi-bag-check-fill fs-5"></i>
                        <span>Carrito</span>
                        <span id="contadorCarrito" class="badge rounded-pill bg-danger shadow-sm ms-1" style="font-size: 0.75rem;">0</span>
                    </button>
                    ` : ''}

                    <!-- Botón Salir -->
                    <button class="btn btn-outline-danger btn-sm fw-bold px-3 py-2 rounded-3 d-flex align-items-center gap-1" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08);" onclick="cerrarSesion()" title="Cerrar Sesión Segura">
                        <i class="bi bi-power"></i>
                        <span class="d-none d-sm-inline">Salir</span>
                    </button>
                </div>
            </div>
        </div>
    </nav>`;

    const contenedor = document.getElementById('menu-contenedor');
    if (contenedor) {
        contenedor.style.position = 'sticky';
        contenedor.style.top = '0';
        contenedor.style.zIndex = '1000';
        contenedor.style.width = '100%';
        contenedor.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
        contenedor.style.backdropFilter = 'blur(10px)';
        contenedor.style.webkitBackdropFilter = 'blur(10px)';
        contenedor.style.borderBottom = '1px solid rgba(245, 158, 11, 0.2)';
        contenedor.innerHTML = menuHTML;
        setTimeout(iniciarMonitorAlertasStock, 300);
    }
}

/**
 * Renderizador del Sidebar Maestro (6 Módulos Alineados y Ordenados)
 */
function renderizarSidebar(moduloActivo) {
    const usuario = obtenerUsuarioSesion();
    const contenedor = document.getElementById('sidebar-contenedor');
    if (!contenedor) return;

    const nombre = usuario ? usuario.nombre : 'Administrador';
    const rol = usuario ? (usuario.rol || 'ADMIN') : 'ADMIN';

    contenedor.innerHTML = `
        <aside class="sidebar-master d-flex flex-column flex-shrink-0 p-3 text-white" style="width: 280px; background-color: #0f172a; border-right: 1px solid rgba(255, 255, 255, 0.08); z-index: 1020;">
            <!-- Brand / Logo Header -->
            <a href="dashboard.html" class="d-flex align-items-center gap-3 text-white text-decoration-none pb-3 border-bottom border-secondary border-opacity-25 px-2">
                <div class="d-flex align-items-center justify-content-center rounded-3 shadow-sm flex-shrink-0" style="width: 42px; height: 42px; background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: #0f172a; font-weight: 900; font-size: 1.35rem; border: 1px solid rgba(251, 191, 36, 0.5);">
                    G
                </div>
                <div class="d-flex flex-column" style="line-height: 1.15;">
                    <span class="fs-5 fw-bold tracking-tight text-white">
                        GOLDEN <span style="color: #f59e0b;">ERP</span>
                    </span>
                    <span class="text-secondary small fw-semibold text-uppercase" style="font-size: 0.65rem; letter-spacing: 1.5px;">Enterprise Suite</span>
                </div>
            </a>

            <!-- 2. SIDEBAR ORDENADO (Los 6 Módulos en Orden Estricto) -->
            <ul class="nav flex-column gap-2 mt-4 flex-grow-1">
                <li class="nav-item">
                    <a href="dashboard.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'dashboard' ? 'active' : ''}">
                        <span class="nav-icon">📊</span>
                        <span>Analítica y Monetización</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="tienda.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'tienda' ? 'active' : ''}">
                        <span class="nav-icon">🛒</span>
                        <span>E-commerce y Ventas</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="inventario.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'inventario' ? 'active' : ''}">
                        <span class="nav-icon">📦</span>
                        <span>Gestión de Inventario</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="logistica.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'logistica' ? 'active' : ''}">
                        <span class="nav-icon">🚚</span>
                        <span>Distribución y Logística</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="facturacion.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'facturacion' ? 'active' : ''}">
                        <span class="nav-icon">💳</span>
                        <span>Cobranza y Facturación</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="auditoria.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'auditoria' ? 'active' : ''}">
                        <span class="nav-icon">🔐</span>
                        <span>Seguridad y Usuario</span>
                    </a>
                </li>
            </ul>

            <!-- Pie del Sidebar: Usuario, Alertas en Vivo y Logout -->
            <div class="pt-3 border-top border-secondary border-opacity-25 px-2">
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <div class="d-flex align-items-center gap-2 overflow-hidden">
                        <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width: 36px; height: 36px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24;">
                            <i class="bi bi-person-fill"></i>
                        </div>
                        <div class="d-flex flex-column text-truncate" style="line-height: 1.1;">
                            <span class="small fw-bold text-white text-truncate" id="sidebarUserName">${nombre}</span>
                            <span class="text-warning text-uppercase" style="font-size: 0.65rem; font-weight: 700;" id="sidebarUserRol">${rol}</span>
                        </div>
                    </div>
                    <!-- Campanita de Notificaciones de Stock -->
                    <button id="btnCampanaSidebar" class="btn p-0 text-warning d-flex align-items-center justify-content-center position-relative flex-shrink-0" style="width: 34px; height: 34px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px;" onclick="mostrarModalAlertasStock()" title="Alertas de Stock Crítico">
                        <i class="bi bi-bell-fill fs-6 text-warning"></i>
                        <span id="badgeNotificacionesStock" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-dark" style="font-size: 0.65rem; display: none; padding: 0.3em 0.5em;">0</span>
                    </button>
                </div>
                <button class="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-2 py-2 rounded-3" onclick="cerrarSesion()" title="Finalizar Sesión Segura">
                    <i class="bi bi-power"></i>
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    `;

    setTimeout(iniciarMonitorAlertasStock, 300);
}

window.renderizarSidebar = renderizarSidebar;

function obtenerUsuarioSesion() {
    try {
        const raw = localStorage.getItem('usuario_golden');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

/**
 * Guardián de Rutas RBAC Estricto:
 * Valida autenticación y rol. Si un cliente intenta acceder a módulos internos,
 * lo redirige de inmediato a tienda.html.
 */
function protegerRuta(paginaActual, rolesPermitidos) {
    const usuario = obtenerUsuarioSesion();

    // 1. Si no hay sesión iniciada
    if (!usuario) {
        if (paginaActual !== 'login' && paginaActual !== 'usuarios') {
            window.location.href = 'index.html';
            return null;
        }
        return null;
    }

    const esCliente = usuario.rol === 'CLIENTE_B2B' || usuario.rol === 'CLIENTE_B2C';

    // Soporte flexible para invocación: protegerRuta("ADMIN") o protegerRuta('auditoria', ['ADMIN'])
    if (!rolesPermitidos && (typeof paginaActual === 'string' && ['ADMIN', 'ALMACENERO', 'REPARTIDOR', 'CLIENTE_B2B', 'CLIENTE_B2C'].includes(paginaActual) || Array.isArray(paginaActual))) {
        rolesPermitidos = Array.isArray(paginaActual) ? paginaActual : [paginaActual];
        paginaActual = window.location.pathname.split('/').pop().replace('.html', '') || 'modulo';
    } else if (typeof rolesPermitidos === 'string') {
        rolesPermitidos = [rolesPermitidos];
    }

    // 2. Si es cliente externo y la página solicitada NO es la tienda
    if (esCliente && paginaActual !== 'tienda') {
        window.location.href = 'tienda.html';
        return null;
    }

    // 3. Si se definieron roles específicos permitidos
    if (rolesPermitidos && Array.isArray(rolesPermitidos)) {
        if (!rolesPermitidos.includes(usuario.rol)) {
            if (esCliente) {
                window.location.href = 'tienda.html';
            } else {
                window.location.href = 'dashboard.html';
            }
            return null;
        }
    }

    return usuario;
}

// ==========================================
// CONFIGURACIÓN GLOBAL SWEETALERT2 VIP
// ==========================================
if (typeof Swal !== 'undefined') {
    window.Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: '#0d121f',
        color: '#f8fafc',
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    window.confirmarAccionModal = async function (titulo, textoHtml, confirmBtnText = 'Sí, continuar', isDanger = true) {
        return await Swal.fire({
            title: titulo,
            html: textoHtml,
            icon: isDanger ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonColor: isDanger ? '#ef4444' : '#f59e0b',
            cancelButtonColor: '#334155',
            confirmButtonText: confirmBtnText,
            cancelButtonText: 'Cancelar',
            background: '#0d121f',
            color: '#f8fafc',
            reverseButtons: true
        });
    };
}

window.cerrarSesion = async function () {
    if (typeof Swal !== 'undefined') {
        const confirmacion = await Swal.fire({
            title: '¿Cerrar Sesión?',
            text: '¿Estás seguro de que deseas salir del sistema ERP GOLDEN?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#334155',
            confirmButtonText: '<i class="bi bi-box-arrow-right me-1"></i> Cerrar Sesión',
            cancelButtonText: 'Permanecer',
            background: '#0d121f',
            color: '#f8fafc',
            reverseButtons: true
        });
        if (!confirmacion.isConfirmed) return;
    }
    localStorage.removeItem('usuario_golden');
    window.location.href = 'index.html';
};

// =========================================================================
// PAQUETE ENTERPRISE 1: ALERTA DE STOCK EN TIEMPO REAL (CAMPANITA NAVBAR)
// =========================================================================
let cacheProductosCriticos = [];

async function iniciarMonitorAlertasStock() {
    try {
        const res = await fetch('/api/productos?t=' + Date.now());
        if (!res.ok) return;
        const productos = await res.json();
        if (!Array.isArray(productos)) return;

        cacheProductosCriticos = productos.filter(p => p.stock <= p.stock_minimo);
        const badge = document.getElementById('badgeNotificacionesStock');
        const btn = document.getElementById('btnCampanaNotificaciones');

        if (badge) {
            if (cacheProductosCriticos.length > 0) {
                badge.innerText = cacheProductosCriticos.length;
                badge.style.display = 'inline-block';
            } else {
                badge.innerText = '0';
                badge.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn("Monitor de alertas de stock en espera...", e.message);
    }
}

function mostrarModalAlertasStock() {
    if (!cacheProductosCriticos || cacheProductosCriticos.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '<span class="text-emerald fw-bold"><i class="bi bi-shield-check me-2"></i>Almacén Óptimo</span>',
                html: '<p class="text-secondary small mb-0">No se detectaron repuestos en nivel crítico. Todas las referencias cuentan con stock por encima del nivel de reposición mínimo.</p>',
                icon: 'success',
                background: '#0d121f',
                color: '#f8fafc',
                confirmButtonColor: '#f59e0b',
                confirmButtonText: 'Entendido'
            });
        } else {
            alert("No hay alertas de stock crítico.");
        }
        return;
    }

    const filasHTML = cacheProductosCriticos.map(p => {
        const esAgotado = p.stock <= 0;
        const badgeEstado = esAgotado 
            ? '<span class="badge bg-danger text-white px-2 py-1 small">AGOTADO</span>'
            : `<span class="badge bg-warning text-dark px-2 py-1 small fw-bold">CRÍTICO (${p.stock})</span>`;
        return `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                <td class="text-start py-2 font-monospace text-warning small">${p.sku}</td>
                <td class="text-start py-2 text-white small">${p.nombre}</td>
                <td class="text-center py-2 font-monospace text-secondary small">${p.stock_minimo}</td>
                <td class="text-center py-2">${badgeEstado}</td>
            </tr>
        `;
    }).join('');

    const tablaHTML = `
        <div class="text-start mb-3">
            <span class="text-secondary small">Se detectaron <strong class="text-warning">${cacheProductosCriticos.length} repuestos</strong> con existencias iguales o inferiores al stock mínimo de seguridad:</span>
        </div>
        <div class="table-responsive rounded-3 mb-2" style="max-height: 260px; overflow-y: auto; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.1);">
            <table class="table table-sm align-middle mb-0" style="color: #cbd5e1;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.15); background: rgba(9, 13, 24, 0.8);">
                        <th class="py-2 text-start small text-secondary">SKU</th>
                        <th class="py-2 text-start small text-secondary">Repuesto</th>
                        <th class="py-2 text-center small text-secondary">Mín.</th>
                        <th class="py-2 text-center small text-secondary">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasHTML}
                </tbody>
            </table>
        </div>
    `;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '<div class="d-flex align-items-center justify-content-center gap-2 text-warning"><i class="bi bi-bell-fill"></i><span>Alertas de Stock en Tiempo Real</span></div>',
            html: tablaHTML,
            icon: 'warning',
            background: '#0d121f',
            color: '#f8fafc',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#334155',
            confirmButtonText: '<i class="bi bi-truck-flatbed me-1"></i> Ir a SCM / Compras',
            cancelButtonText: 'Cerrar',
            customClass: {
                popup: 'rounded-4 border border-secondary border-opacity-25 shadow-lg'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'compras.html';
            }
        });
    } else {
        alert(`Alerta de Stock: ${cacheProductosCriticos.length} repuestos críticos.`);
    }
}

// =========================================================================
// PAQUETE ENTERPRISE 2: EXPORTACIÓN GERENCIAL A CSV / EXCEL
// =========================================================================
function exportarTablaCSV(tablaId, nombreArchivo = 'Reporte_GOLDEN') {
    let tabla = document.getElementById(tablaId);
    if (!tabla) {
        const el = document.getElementById(tablaId);
        if (el && el.tagName === 'TBODY') {
            tabla = el.closest('table');
        }
    }

    if (!tabla) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'warning', title: 'Tabla no encontrada', text: 'No se pudo ubicar el elemento de datos para exportar.', background: '#0d121f', color: '#f8fafc' });
        } else {
            alert('Tabla no encontrada.');
        }
        return;
    }

    const filas = Array.from(tabla.querySelectorAll('tr'));
    if (filas.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Sin registros', text: 'La tabla está vacía en este momento.', background: '#0d121f', color: '#f8fafc' });
        }
        return;
    }

    const lineasCSV = [];

    filas.forEach(fila => {
        // Omitir filas de carga o mensaje "No se encontraron datos"
        const colspanTd = fila.querySelector('td[colspan]');
        if (colspanTd && parseInt(colspanTd.getAttribute('colspan')) >= 3) {
            return;
        }

        const celdas = Array.from(fila.querySelectorAll('th, td'));
        const datosFila = [];

        celdas.forEach(celda => {
            const textoCabecera = celda.innerText.trim().toLowerCase();
            // Omitir columna de acciones o botones
            if (textoCabecera === 'acciones' || celda.classList.contains('col-acciones')) {
                return;
            }
            if (celda.querySelector('button') && !celda.innerText.trim()) {
                return;
            }

            let valor = celda.innerText
                .replace(/(\r\n|\n|\r)/gm, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            valor = valor.replace(/"/g, '""');
            datosFila.push(`"${valor}"`);
        });

        if (datosFila.length > 0) {
            lineasCSV.push(datosFila.join(';')); // Punto y coma para compatibilidad estándar con Excel
        }
    });

    if (lineasCSV.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Sin datos exportables', text: 'No se encontraron filas válidas para exportar.', background: '#0d121f', color: '#f8fafc' });
        }
        return;
    }

    // UTF-8 BOM (\uFEFF) para que Excel reconozca tildes, ñ y moneda sin problemas
    const contenidoCSV = '\uFEFF' + lineasCSV.join('\r\n');
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });

    const fechaStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${nombreArchivo}_${fechaStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof Toast !== 'undefined') {
        Toast.fire({ icon: 'success', title: `Datos exportados: ${nombreArchivo}.csv` });
    }
}

window.exportarTablaCSV = exportarTablaCSV;
window.iniciarMonitorAlertasStock = iniciarMonitorAlertasStock;
window.mostrarModalAlertasStock = mostrarModalAlertasStock;

// =========================================================================
// PAQUETE ENTERPRISE 3: MOTOR DE FACTURACIÓN PDF (html2pdf.js) - CARTA / A4
// =========================================================================
async function generarRecibo(pedidoId) {
    const elemento = document.getElementById('plantilla-factura');
    if (!elemento) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Plantilla no encontrada',
                text: 'No se encontró el contenedor #plantilla-factura en la vista.'
            });
        } else {
            alert('No se encontró el contenedor #plantilla-factura.');
        }
        return;
    }

    // Cargar dinámicamente html2pdf si aún no estuviera en memoria
    if (typeof html2pdf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => generarRecibo(pedidoId);
        document.head.appendChild(script);
        return;
    }

    // 0. Si viene pedidoId, poblar la plantilla antes de capturar
    if (pedidoId) {
        try {
            const res = await fetch(`/api/pedidos/${pedidoId}`);
            if (res.ok) {
                const pedido = await res.json();
                const elNum = document.getElementById('factura-numero');
                if (elNum) elNum.innerText = `Factura Comercial N° 00${pedido.id || pedidoId}`;

                const elCli = document.getElementById('factura-cliente');
                if (elCli) elCli.innerText = pedido.cliente || 'Consumidor Final';

                const elEmail = document.getElementById('factura-email');
                if (elEmail) elEmail.innerText = pedido.cliente_email || 'ventas@goldenerp.com';

                const elFecha = document.getElementById('factura-fecha');
                if (elFecha) {
                    elFecha.innerText = pedido.fecha_compra 
                        ? new Date(pedido.fecha_compra).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
                        : new Date().toLocaleString('es-BO');
                }

                const elEstado = document.getElementById('factura-estado');
                if (elEstado) elEstado.innerText = (pedido.estado || 'PAGADO').toUpperCase();

                const totalNum = parseFloat(pedido.total || 0);
                const subtotalNeto = totalNum / 1.13;
                const iva = totalNum - subtotalNeto;

                const elSub = document.getElementById('factura-subtotal');
                if (elSub) elSub.innerText = `Bs. ${subtotalNeto.toFixed(2)}`;

                const elIva = document.getElementById('factura-iva');
                if (elIva) elIva.innerText = `Bs. ${iva.toFixed(2)}`;

                const elTot = document.getElementById('factura-total');
                if (elTot) elTot.innerText = `Bs. ${totalNum.toFixed(2)}`;

                const qrImg = document.getElementById('factura-qr-img');
                if (qrImg) {
                    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=GOLDEN-ERP-FACTURA-00${pedido.id || pedidoId}-TOTAL-${totalNum}`;
                }

                const itemsTbody = document.getElementById('factura-items');
                if (itemsTbody && Array.isArray(pedido.detalles) && pedido.detalles.length > 0) {
                    itemsTbody.innerHTML = pedido.detalles.map((d, idx) => `
                        <tr style="border-bottom: 1px solid #cbd5e1; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center; color: #000000;">${d.cantidad}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; color: #000000;">${d.producto_nombre || 'Repuesto Automotriz'}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; color: #000000;">Bs. ${parseFloat(d.precio_unitario || 0).toFixed(2)}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #000000;">Bs. ${parseFloat(d.subtotal || 0).toFixed(2)}</td>
                        </tr>
                    `).join('');
                }
            }
        } catch (e) {
            console.warn('No se pudo cargar la orden para la factura, usando datos por defecto:', e);
        }
    }

    // 1. Mostrar temporalmente para que html2pdf lo capture correctamente
    elemento.style.display = 'block';

    // 2. Configuración estricta de html2pdf
    const opt = {
        margin:       0.5,
        filename:     pedidoId ? `Factura_GOLDEN_#00${pedidoId}.pdf` : 'Factura_GOLDEN.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // 3. Generación y ocultamiento seguro tras completar la descarga
    html2pdf().set(opt).from(elemento).save().then(() => {
        elemento.style.display = 'none';
        if (typeof Toast !== 'undefined') {
            Toast.fire({ icon: 'success', title: 'Factura PDF descargada exitosamente' });
        }
    }).catch(err => {
        console.error('Error al exportar factura PDF:', err);
        elemento.style.display = 'none';
        if (typeof Toast !== 'undefined') {
            Toast.fire({ icon: 'error', title: 'Error al generar el recibo PDF' });
        }
    });
}

// Compatibilidad
window.generarRecibo = generarRecibo;
window.generarFacturaPDF = generarRecibo;
