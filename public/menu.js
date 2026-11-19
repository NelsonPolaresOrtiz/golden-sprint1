/**
 * ERP GOLDEN - Sistema de Navegación Distribuidora de Lubricantes & Filtros
 * Conforme a .agent/skills/stitch-ui/SKILL.md & .antigravityrules
 */

function renderizarMenu(paginaActiva) {
    const usuarioSesion = obtenerUsuarioSesion();
    const rol = usuarioSesion && usuarioSesion.rol ? String(usuarioSesion.rol).toUpperCase().trim() : null;

    // Validación de vista comercial limpia (?vista=cliente) y roles en tienda.html
    const urlParams = new URLSearchParams(window.location.search);
    const esVistaCliente = urlParams.get('vista') === 'cliente';

    if (paginaActiva === 'tienda') {
        const esGestorAutorizado = !esVistaCliente && usuarioSesion && [
            'ADMIN', 'ADMINISTRADOR', 'SUPERADMIN', 'GERENTE', 
            'EMPAQUE', 'ALMACENERO', 'ALMACEN'
        ].includes(rol);

        const contenedor = document.getElementById('menu-contenedor');
        if (!esGestorAutorizado) {
            if (contenedor) {
                contenedor.innerHTML = '';
                contenedor.classList.add('d-none');
                contenedor.style.display = 'none';
            }
            return;
        } else {
            if (contenedor) {
                contenedor.classList.remove('d-none');
                contenedor.style.display = 'block';
            }
        }
    }

    // Identificación estricta de tipo de usuario
    const esCliente = !rol || rol === 'CLIENTE' || rol === 'CLIENTE_B2B' || rol === 'CLIENTE_B2C';
    const esAdminOTrabajador = rol === 'ADMIN' || rol === 'ADMINISTRADOR' || rol === 'TRABAJADOR' || rol === 'SUPERADMIN' || rol === 'GERENTE';
    const esEmpaque = rol === 'EMPAQUE' || rol === 'ALMACENERO';
    const esAlmacenero = esEmpaque;
    const esDespacho = rol === 'DESPACHO' || rol === 'REPARTIDOR';
    const esRepartidor = esDespacho;

    // Logo apunta al Catálogo para clientes y al Panel de control para personal interno
    const logoHref = esCliente ? 'tienda.html' : 'dashboard.html';

    // Generar enlaces de navegación según RBAC con lenguaje comercial humano
    let linksNavHTML = '';

    if (esCliente) {
        // CLIENTES EXTERNOS (Taller Comprador): Vista simplificada (Catálogo, Mis Pedidos)
        linksNavHTML = `
            <li class="nav-item">
                <a class="nav-link-stitch ${paginaActiva === 'tienda' ? 'active' : ''}" href="tienda.html">
                    <i class="bi bi-shop me-1 text-danger"></i> Catálogo
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link-stitch" href="javascript:void(0)" onclick="navegarAMisPedidos()">
                    <i class="bi bi-truck me-1 text-warning"></i> Mis Pedidos
                </a>
            </li>
        `;
    } else {
        // PERSONAL INTERNO: ADMIN y TRABAJADOR tienen acceso completo a los 9 módulos
        if (esAdminOTrabajador) {
            linksNavHTML += `
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'dashboard' ? 'active' : ''}" href="dashboard.html">
                        <i class="bi bi-speedometer2 me-1 text-danger"></i> Panel
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'usuarios' ? 'active' : ''}" href="usuarios.html">
                        <i class="bi bi-people-fill me-1 text-danger"></i> Talleres
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'compras' ? 'active' : ''}" href="compras.html">
                        <i class="bi bi-truck-flatbed me-1 text-danger"></i> Compras
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'facturacion' ? 'active' : ''}" href="facturacion.html">
                        <i class="bi bi-credit-card-2-front-fill me-1 text-danger"></i> Cobranzas
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'creditos' ? 'active' : ''}" href="creditos.html">
                        <i class="bi bi-bank me-1 text-danger"></i> Créditos
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'auditoria' ? 'active' : ''}" href="auditoria.html">
                        <i class="bi bi-shield-check me-1 text-danger"></i> Auditoría
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'inventario' ? 'active' : ''}" href="inventario.html">
                        <i class="bi bi-box-seam-fill me-1 text-danger"></i> Inventario
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'tienda' ? 'active' : ''}" href="tienda.html">
                        <i class="bi bi-shop me-1 text-danger"></i> Catálogo
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'logistica' ? 'active' : ''}" href="logistica.html">
                        <i class="bi bi-truck me-1 text-danger"></i> Logística
                    </a>
                </li>
            `;
        } else {
            // ROLES OPERATIVOS ESPECÍFICOS (EMPAQUE, DESPACHO)
            if (esAlmacenero) {
                linksNavHTML += `
                    <li class="nav-item">
                        <a class="nav-link-stitch ${paginaActiva === 'inventario' ? 'active' : ''}" href="inventario.html">
                            <i class="bi bi-box-seam-fill me-1 text-danger"></i> Inventario
                        </a>
                    </li>
                `;
            }

            linksNavHTML += `
                <li class="nav-item">
                    <a class="nav-link-stitch ${paginaActiva === 'tienda' ? 'active' : ''}" href="tienda.html">
                        <i class="bi bi-shop me-1 text-danger"></i> Catálogo
                    </a>
                </li>
            `;

            if (esAlmacenero || esRepartidor) {
                linksNavHTML += `
                    <li class="nav-item">
                        <a class="nav-link-stitch ${paginaActiva === 'logistica' ? 'active' : ''}" href="logistica.html">
                            <i class="bi bi-truck me-1 text-danger"></i> Logística
                        </a>
                    </li>
                `;
            }
        }
    }

    // Construcción de Enlaces para el Menú Lateral Deslizable (Drawer / Offcanvas)
    let linksDrawerHTML = '';
    if (esCliente) {
        linksDrawerHTML = `
            <a class="nav-drawer-link ${paginaActiva === 'tienda' ? 'active' : ''}" href="tienda.html">
                <i class="bi bi-shop text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Catálogo de Repuestos</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Aceites, filtros y compras en línea</small>
                </div>
            </a>
            <a class="nav-drawer-link" href="javascript:void(0)" onclick="navegarAMisPedidos(); bootstrap.Offcanvas.getInstance(document.getElementById('drawerNavegacionGlobal'))?.hide();">
                <i class="bi bi-truck text-warning fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Mis Pedidos &amp; Despachos</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Estado y seguimiento en tiempo real</small>
                </div>
            </a>
        `;
    } else if (esAdminOTrabajador) {
        linksDrawerHTML = `
            <a class="nav-drawer-link ${paginaActiva === 'dashboard' ? 'active' : ''}" href="dashboard.html">
                <i class="bi bi-speedometer2 text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Panel de Control</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Métricas generales y KPIs</small>
                </div>
            </a>
            <a class="nav-drawer-link ${paginaActiva === 'usuarios' ? 'active' : ''}" href="usuarios.html">
                <i class="bi bi-people-fill text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Talleres &amp; Clientes</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Directorio B2B y cuentas de usuario</small>
                </div>
            </a>
            <a class="nav-drawer-link ${paginaActiva === 'compras' ? 'active' : ''}" href="compras.html">
                <i class="bi bi-truck-flatbed text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Compras &amp; SCM</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Órdenes y proveedores de repuestos</small>
                </div>
            </a>
            <a class="nav-drawer-link ${paginaActiva === 'facturacion' ? 'active' : ''}" href="facturacion.html">
                <i class="bi bi-credit-card-2-front-fill text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Cobranzas &amp; Facturación</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Gestión de pagos y comprobantes QR</small>
                </div>
            </a>
            <a class="nav-drawer-link ${paginaActiva === 'creditos' ? 'active' : ''}" href="creditos.html">
                <i class="bi bi-bank text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Líneas de Crédito B2B</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Saldos, límites y amortizaciones</small>
                </div>
            </a>
            <a class="nav-drawer-link ${paginaActiva === 'auditoria' ? 'active' : ''}" href="auditoria.html">
                <i class="bi bi-shield-check text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Auditoría del Sistema</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Bitácora de seguridad y trazabilidad</small>
                </div>
            </a>
            <a class="nav-drawer-link ${paginaActiva === 'inventario' ? 'active' : ''}" href="inventario.html">
                <i class="bi bi-box-seam-fill text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Almacén e Inventario</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Kardex, stock y presentaciones</small>
                </div>
            </a>
            <a class="nav-drawer-link ${paginaActiva === 'tienda' ? 'active' : ''}" href="tienda.html">
                <i class="bi bi-shop text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Catálogo Comercial</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Vista pública de venta mayorista</small>
                </div>
            </a>
            <a class="nav-drawer-link ${paginaActiva === 'logistica' ? 'active' : ''}" href="logistica.html">
                <i class="bi bi-truck text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Logística &amp; Despacho</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Empaque, choferes y entregas</small>
                </div>
            </a>
        `;
    } else {
        if (esAlmacenero) {
            linksDrawerHTML += `
                <a class="nav-drawer-link ${paginaActiva === 'inventario' ? 'active' : ''}" href="inventario.html">
                    <i class="bi bi-box-seam-fill text-danger fs-5"></i>
                    <div class="d-flex flex-column">
                        <span class="fw-bold">Almacén e Inventario</span>
                        <small class="text-muted" style="font-size: 0.72rem;">Kardex y preparación</small>
                    </div>
                </a>
            `;
        }
        linksDrawerHTML += `
            <a class="nav-drawer-link ${paginaActiva === 'tienda' ? 'active' : ''}" href="tienda.html">
                <i class="bi bi-shop text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Catálogo Comercial</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Productos y stock</small>
                </div>
            </a>
        `;
        if (esAlmacenero || esRepartidor) {
            linksDrawerHTML += `
                <a class="nav-drawer-link ${paginaActiva === 'logistica' ? 'active' : ''}" href="logistica.html">
                    <i class="bi bi-truck text-danger fs-5"></i>
                    <div class="d-flex flex-column">
                        <span class="fw-bold">Logística &amp; Despacho</span>
                        <small class="text-muted" style="font-size: 0.72rem;">Órdenes y rutas de entrega</small>
                    </div>
                </a>
            `;
        }
    }

    // Etiqueta legible y humana del rol para el navbar
    let rolLegible = 'Invitado';
    if (rol === 'CLIENTE' || rol === 'CLIENTE_B2B' || rol === 'CLIENTE_B2C') {
        rolLegible = 'Cuenta Taller';
    } else if (rol === 'ADMIN') {
        rolLegible = 'Administración';
    } else if (rol === 'EMPAQUE') {
        rolLegible = 'Encargado de Almacén & Empaque';
    } else if (rol === 'DESPACHO') {
        rolLegible = 'Chofer / Encargado de Entrega';
    } else if (rol === 'TRABAJADOR') {
        rolLegible = 'Encargado de Almacén & Ventas';
    } else if (rol === 'ALMACENERO') {
        rolLegible = 'Almacén Central';
    } else if (rol === 'REPARTIDOR') {
        rolLegible = 'Logística y Despacho';
    } else if (usuarioSesion && usuarioSesion.rol) {
        rolLegible = usuarioSesion.rol;
    }

    const menuHTML = `
    <nav class="navbar navbar-expand-lg navbar-golden" style="background: transparent; border: none; padding: 12px 24px; min-height: 72px;">
        <div class="container-fluid px-0 py-0 d-flex align-items-center justify-content-between">
            
            <!-- Lado Izquierdo: Botón Hamburguesa (<1024px) + Isotipo de Marca Oficial -->
            <div class="d-flex align-items-center gap-2">
                <!-- Botón Hamburguesa Responsive para Pantallas < 1024px -->
                <button class="btn btn-hamburger-golden d-flex align-items-center justify-content-center p-1" type="button" data-bs-toggle="offcanvas" data-bs-target="#drawerNavegacionGlobal" aria-controls="drawerNavegacionGlobal" title="Abrir Menú de Módulos">
                    <i class="bi bi-list fs-2 text-white"></i>
                </button>

                <!-- Isotipo Oficial: Engranaje + Gota estilizado en SVG Inline -->
                <a class="brand-logo" href="${logoHref}" style="display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0;">
                    <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
                        <path d="M50 12c-3.1 0-5.8 2.1-6.6 5.1l-1.3 4.8c-2.3.6-4.5 1.6-6.6 2.9l-4.1-2.9c-2.5-1.8-5.9-1.3-7.8 1.1l-4.2 5.2c-1.9 2.4-1.6 5.8.7 7.7l3.8 3.1c-.5 2.3-.7 4.7-.6 7l-4.7 1.6c-2.9 1-4.9 3.7-4.9 6.8v6.7c0 3.1 2 5.8 4.9 6.8l4.7 1.6c.1 2.3.4 4.7.9 7l-3.8 3.1c-2.3 1.9-2.6 5.3-.7 7.7l4.2 5.2c1.9 2.4 5.3 2.9 7.8 1.1l4.1-2.9c2.1 1.3 4.3 2.3 6.6 2.9l1.3 4.8c.8 3 3.5 5.1 6.6 5.1h6.7c3.1 0 5.8-2.1 6.6-5.1l1.3-4.8c2.3-.6 4.5-1.6 6.6-2.9l4.1 2.9c2.5 1.8 5.9 1.3 7.8-1.1l4.2-5.2c1.9-2.4 1.6-5.8-.7-7.7l-3.8-3.1c.5-2.3.7-4.7.6-7l4.7-1.6c2.9-1 4.9-3.7 4.9-6.8v-6.7c0-3.1-2-5.8-4.9-6.8l-4.7-1.6c-.1-2.3-.4-4.7-.9-7l3.8-3.1c2.3-1.9 2.6-5.3.7-7.7l-4.2-5.2c-1.9-2.4-5.3-2.9-7.8-1.1l-4.1 2.9c-2.1-1.3-4.3-2.3-6.6-2.9l-1.3-4.8c-.8-3-3.5-5.1-6.6-5.1H50z" fill="#B91C1C"/>
                        <circle cx="50" cy="55" r="28" fill="#D97706" stroke="#18181B" stroke-width="4"/>
                        <path d="M50 33c0 0-14 14.5-14 21.5s6.3 11.5 14 11.5 14-4.5 14-11.5S50 33 50 33z" fill="#FFF" stroke="#18181B" stroke-width="4"/>
                        <path d="M47 48c0-3 3-7 3-7" stroke="#B91C1C" stroke-width="3" stroke-linecap="round"/>
                        <path d="M30 65l-12 12" stroke="#18181B" stroke-width="5" stroke-linecap="round"/>
                        <path d="M26 55l-14 5" stroke="#18181B" stroke-width="5" stroke-linecap="round"/>
                        <path d="M35 44l-10-10" stroke="#18181B" stroke-width="5" stroke-linecap="round"/>
                    </svg>
                    <!-- Texto de la Marca en Dos Líneas compactas -->
                    <div style="display: flex; flex-direction: column; line-height: 1.1;">
                        <span style="font-family: 'Inter', sans-serif; font-size: 1.3rem; font-weight: 800; color: #FAFAFA; letter-spacing: -0.01em;">GOLDEN</span>
                        <span style="font-family: 'Inter', sans-serif; font-size: 0.62rem; font-weight: 600; color: #EF4444; letter-spacing: 0.05em; white-space: nowrap;">LUBRICANTES &amp; FILTROS</span>
                    </div>
                </a>
            </div>

            <!-- Centro: Enlaces de Navegación Desktop (Visible >= 1024px) -->
            <div class="navbar-desktop-container">
                <ul class="navbar-nav mb-0 gap-1 flex-nowrap align-items-center" style="white-space: nowrap;">
                    ${linksNavHTML}
                </ul>
            </div>

            <!-- Área Derecha: Campanita de Stock, Identificación de Usuario, Carrito y Salir (1 Sola Fila Horizontal) -->
            <div class="d-flex align-items-center flex-nowrap gap-2 ms-auto flex-shrink-0" style="white-space: nowrap;">
                
                ${!esCliente ? `
                <!-- Campanita de Reposición: Solo visible para Administración y Almacén -->
                <div class="position-relative flex-shrink-0">
                    <button id="btnCampanaNotificaciones" class="btn p-0 text-white d-flex align-items-center justify-content-center position-relative flex-shrink-0" style="width: 32px; height: 32px; background: #27272A; border: 1px solid #3F3F46; border-radius: 6px;" onclick="mostrarModalAlertasStock()" title="Control de reposición y stock crítico">
                        <i class="bi bi-bell-fill" style="color: #F59E0B; font-size: 0.85rem;"></i>
                        <span id="badgeNotificacionesStock" class="position-absolute top-0 start-100 translate-middle badge bg-danger border border-dark" style="font-size: 0.6rem; display: none; padding: 0.2em 0.35em; border-radius: 4px;">
                            0
                        </span>
                    </button>
                </div>
                ` : ''}

                <!-- Identificación de Usuario Compacta y Humana -->
                <div id="userInfoBadge" class="nav-user-badge-stitch flex-shrink-0 d-none d-sm-flex" style="padding: 4px 8px;">
                    <span class="pulse-dot pulse-dot-emerald"></span>
                    <div class="d-flex flex-column" style="line-height: 1.15;">
                        <span class="fw-bold text-white text-nowrap" style="font-size: 0.76rem;" id="navUserName">${usuarioSesion ? usuarioSesion.nombre : 'Usuario'}</span>
                        <span class="text-nowrap" style="font-family: 'Inter', sans-serif; font-size: 0.62rem; font-weight: 600; color: #D97706; letter-spacing: 0.2px;" id="navUserRol">${rolLegible}</span>
                    </div>
                </div>

                ${paginaActiva === 'tienda' ? `
                <!-- Botón Pedido / Carrito -->
                <button class="btn btn-stitch-primary d-flex align-items-center gap-1 px-2 py-1 flex-shrink-0" type="button" data-bs-toggle="offcanvas" data-bs-target="#carritoLateral" style="border-radius: 6px; background-color: #C81E1E; border: 1px solid #C81E1E; color: #FFFFFF; font-size: 0.76rem;">
                    <i class="bi bi-cart3 fs-6"></i>
                    <span class="d-none d-md-inline">Mi pedido</span>
                    <span id="contadorCarrito" class="badge bg-white text-dark font-monospace ms-1" style="font-size: 0.68rem; border-radius: 4px;">0</span>
                </button>
                ` : ''}

                <!-- Botón Salir Compacto Integrado al Header Oscuro -->
                <button id="btnHeaderSalir" class="btn btn-sm d-flex align-items-center gap-1 flex-shrink-0 btn-header-logout" onclick="cerrarSesion()" title="Cerrar sesión">
                    <i class="bi bi-power"></i>
                    <span class="d-none d-sm-inline">Salir</span>
                </button>
            </div>
        </div>
    </nav>

    <!-- DRAWER OFFCANVAS ADAPTABLE (< 1024px) -->
    <div class="offcanvas offcanvas-start text-white border-0" tabindex="-1" id="drawerNavegacionGlobal" aria-labelledby="drawerNavegacionGlobalLabel" style="width: 310px; background-color: #141619; border-right: 3px solid #B91C1C !important; z-index: 10050;">
        <div class="offcanvas-header pb-3" style="border-bottom: 1px solid #292524; background-color: #1C1917;">
            <div class="d-flex align-items-center gap-2">
                <svg width="30" height="30" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 12c-3.1 0-5.8 2.1-6.6 5.1l-1.3 4.8c-2.3.6-4.5 1.6-6.6 2.9l-4.1-2.9c-2.5-1.8-5.9-1.3-7.8 1.1l-4.2 5.2c-1.9 2.4-1.6 5.8.7 7.7l3.8 3.1c-.5 2.3-.7 4.7-.6 7l-4.7 1.6c-2.9 1-4.9 3.7-4.9 6.8v6.7c0 3.1 2 5.8 4.9 6.8l4.7 1.6c.1 2.3.4 4.7.9 7l-3.8 3.1c-2.3 1.9-2.6 5.3-.7 7.7l4.2 5.2c1.9 2.4 5.3 2.9 7.8 1.1l4.1-2.9c2.1 1.3 4.3 2.3 6.6 2.9l1.3 4.8c.8 3 3.5 5.1 6.6 5.1h6.7c3.1 0 5.8-2.1 6.6-5.1l1.3-4.8c2.3-.6 4.5-1.6 6.6-2.9l4.1 2.9c2.5 1.8 5.9 1.3 7.8-1.1l4.2-5.2c1.9-2.4 1.6-5.8-.7-7.7l-3.8-3.1c.5-2.3.7-4.7.6-7l4.7-1.6c2.9-1 4.9-3.7 4.9-6.8v-6.7c0-3.1-2-5.8-4.9-6.8l-4.7-1.6c-.1-2.3-.4-4.7-.9-7l3.8-3.1c2.3-1.9 2.6-5.3.7-7.7l-4.2-5.2c-1.9-2.4-5.3-2.9-7.8-1.1l-4.1 2.9c-2.1-1.3-4.3-2.3-6.6-2.9l-1.3-4.8c-.8-3-3.5-5.1-6.6-5.1H50z" fill="#B91C1C"/>
                    <circle cx="50" cy="55" r="28" fill="#D97706" stroke="#18181B" stroke-width="4"/>
                    <path d="M50 33c0 0-14 14.5-14 21.5s6.3 11.5 14 11.5 14-4.5 14-11.5S50 33 50 33z" fill="#FFF" stroke="#18181B" stroke-width="4"/>
                </svg>
                <div class="d-flex flex-column" style="line-height: 1.1;">
                    <span style="font-family: 'Inter', sans-serif; font-size: 1.15rem; font-weight: 900; color: #FAFAFA;">GOLDEN</span>
                    <span style="font-family: 'Inter', sans-serif; font-size: 0.52rem; font-weight: 700; color: #B91C1C; letter-spacing: 0.08em;">LUBRICANTES &amp; FILTROS</span>
                </div>
            </div>
            <button type="button" class="btn-close btn-close-white text-reset" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
        </div>

        <div class="offcanvas-body d-flex flex-column justify-content-between p-3" style="overflow-y: auto;">
            <div>
                <!-- Tarjeta de Usuario Activo en el Drawer -->
                <div class="p-3 mb-3 rounded-3" style="background: #1C1917; border: 1px solid #3F3F46;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0" style="width: 40px; height: 40px; background: #B91C1C; font-size: 1rem;">
                            ${(usuarioSesion ? usuarioSesion.nombre : 'U').charAt(0).toUpperCase()}
                        </div>
                        <div class="d-flex flex-column text-truncate" style="line-height: 1.2;">
                            <span class="text-white fw-bold text-truncate" style="font-size: 0.88rem;">${usuarioSesion ? usuarioSesion.nombre : 'Usuario'}</span>
                            <div class="d-flex align-items-center gap-1 mt-1">
                                <span class="badge bg-danger text-uppercase px-2 py-0" style="font-size: 0.65rem;">${rolLegible}</span>
                                <span class="badge bg-dark border text-muted" style="font-size: 0.65rem;">ACTIVO</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Lista de Enlaces de Módulos (9 Módulos Completos) -->
                <div class="d-flex flex-column gap-1">
                    ${linksDrawerHTML}
                </div>
            </div>

            <!-- Pie del Drawer: Botón Salir -->
            <div class="pt-3 border-top border-secondary border-opacity-25 mt-4">
                <button class="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 py-2" onclick="cerrarSesion()">
                    <i class="bi bi-power fs-5"></i>
                    <span class="fw-bold">Cerrar Sesión Segura</span>
                </button>
            </div>
        </div>
    </div>`;

    const contenedor = document.getElementById('menu-contenedor') || document.getElementById('menu-container') || document.querySelector('.navbar-golden') || document.querySelector('header.topbar-golden');
    if (contenedor) {
        contenedor.style.position = 'fixed';
        contenedor.style.top = '0';
        contenedor.style.left = '0';
        contenedor.style.right = '0';
        contenedor.style.width = '100%';
        contenedor.style.minHeight = '72px';
        contenedor.style.zIndex = '9999';
        contenedor.style.backgroundColor = '#1C1917';
        contenedor.style.borderBottom = '3px solid #C81E1E';
        contenedor.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.32)';
        contenedor.innerHTML = menuHTML;
        document.body.classList.add('has-navbar-fixed');
        if (!esCliente) {
            setTimeout(iniciarMonitorAlertasStock, 300);
        }
    }
}
window.renderizarMenu = renderizarMenu;

// Auto-inicialización de contingencia del Menú ERP si el contenedor está vacío
document.addEventListener('DOMContentLoaded', () => {
    const contenedor = document.getElementById('menu-contenedor') || document.getElementById('menu-container');
    if (contenedor && !contenedor.classList.contains('d-none') && (!contenedor.innerHTML || !contenedor.innerHTML.trim())) {
        const pag = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
        if (pag !== 'index' && pag !== 'login') {
            renderizarMenu(pag);
        }
    }
});

/**
 * Renderizador del Sidebar Maestro para vistas auxiliares
 */
function renderizarSidebar(moduloActivo) {
    const usuario = obtenerUsuarioSesion();
    const contenedor = document.getElementById('sidebar-contenedor');
    if (!contenedor) return;

    const nombre = usuario ? usuario.nombre : 'Administrador';
    const rol = usuario ? (usuario.rol || 'ADMIN') : 'ADMIN';
    const esCliente = rol === 'CLIENTE_B2B' || rol === 'CLIENTE_B2C';

    contenedor.innerHTML = `
        <aside class="sidebar-master d-flex flex-column flex-shrink-0 p-3 text-white" style="width: 280px; background-color: #1C1917; border-right: 1px solid #292524; z-index: 1020;">
            <!-- Cabecera de Marca Oficial -->
            <a href="dashboard.html" class="brand-logo pb-3 border-bottom border-secondary border-opacity-25 px-2" style="display: flex; align-items: center; gap: 10px; text-decoration: none;">
                <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
                    <path d="M50 12c-3.1 0-5.8 2.1-6.6 5.1l-1.3 4.8c-2.3.6-4.5 1.6-6.6 2.9l-4.1-2.9c-2.5-1.8-5.9-1.3-7.8 1.1l-4.2 5.2c-1.9 2.4-1.6 5.8.7 7.7l3.8 3.1c-.5 2.3-.7 4.7-.6 7l-4.7 1.6c-2.9 1-4.9 3.7-4.9 6.8v6.7c0 3.1 2 5.8 4.9 6.8l4.7 1.6c.1 2.3.4 4.7.9 7l-3.8 3.1c-2.3 1.9-2.6 5.3-.7 7.7l4.2 5.2c1.9 2.4 5.3 2.9 7.8 1.1l4.1-2.9c2.1 1.3 4.3 2.3 6.6 2.9l1.3 4.8c.8 3 3.5 5.1 6.6 5.1h6.7c3.1 0 5.8-2.1 6.6-5.1l1.3-4.8c2.3-.6 4.5-1.6 6.6-2.9l4.1 2.9c2.5 1.8 5.9 1.3 7.8-1.1l4.2-5.2c1.9-2.4 1.6-5.8-.7-7.7l-3.8-3.1c.5-2.3.7-4.7.6-7l4.7-1.6c2.9-1 4.9-3.7 4.9-6.8v-6.7c0-3.1-2-5.8-4.9-6.8l-4.7-1.6c-.1-2.3-.4-4.7-.9-7l3.8-3.1c2.3-1.9 2.6-5.3.7-7.7l-4.2-5.2c-1.9-2.4-5.3-2.9-7.8-1.1l-4.1 2.9c-2.1-1.3-4.3-2.3-6.6-2.9l-1.3-4.8c-.8-3-3.5-5.1-6.6-5.1H50z" fill="#B91C1C"/>
                    <circle cx="50" cy="55" r="28" fill="#D97706" stroke="#18181B" stroke-width="4"/>
                    <path d="M50 33c0 0-14 14.5-14 21.5s6.3 11.5 14 11.5 14-4.5 14-11.5S50 33 50 33z" fill="#FFF" stroke="#18181B" stroke-width="4"/>
                    <path d="M47 48c0-3 3-7 3-7" stroke="#B91C1C" stroke-width="3" stroke-linecap="round"/>
                    <path d="M30 65l-12 12" stroke="#18181B" stroke-width="5" stroke-linecap="round"/>
                    <path d="M26 55l-14 5" stroke="#18181B" stroke-width="5" stroke-linecap="round"/>
                    <path d="M35 44l-10-10" stroke="#18181B" stroke-width="5" stroke-linecap="round"/>
                </svg>
                <div style="display: flex; flex-direction: column; line-height: 1.1;">
                    <span style="font-family: 'Inter', sans-serif; font-size: 1.3rem; font-weight: 800; color: #FAFAFA; letter-spacing: -0.01em;">GOLDEN</span>
                    <span style="font-family: 'Inter', sans-serif; font-size: 0.62rem; font-weight: 600; color: #EF4444; letter-spacing: 0.05em; white-space: nowrap;">LUBRICANTES &amp; FILTROS</span>
                </div>
            </a>

            <!-- Módulos en Orden Comercial -->
            <ul class="nav flex-column gap-2 mt-4 flex-grow-1">
                <li class="nav-item">
                    <a href="dashboard.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'dashboard' ? 'active' : ''}">
                        <span class="nav-icon"><i class="bi bi-speedometer2 text-danger"></i></span>
                        <span>Panel de control</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="tienda.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'tienda' ? 'active' : ''}">
                        <span class="nav-icon"><i class="bi bi-shop text-danger"></i></span>
                        <span>Catálogo y ventas</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="inventario.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'inventario' ? 'active' : ''}">
                        <span class="nav-icon"><i class="bi bi-box-seam-fill text-danger"></i></span>
                        <span>Almacén e inventario</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="logistica.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'logistica' ? 'active' : ''}">
                        <span class="nav-icon"><i class="bi bi-truck text-danger"></i></span>
                        <span>Despacho y logística</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="facturacion.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'facturacion' ? 'active' : ''}">
                        <span class="nav-icon"><i class="bi bi-credit-card-2-front-fill text-danger"></i></span>
                        <span>Cobranzas y facturación</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="auditoria.html" class="nav-sidebar-link d-flex align-items-center ${moduloActivo === 'auditoria' ? 'active' : ''}">
                        <span class="nav-icon"><i class="bi bi-shield-check text-danger"></i></span>
                        <span>Auditoría del sistema</span>
                    </a>
                </li>
            </ul>

            <!-- Pie del Sidebar: Usuario, Alertas y Salir -->
            <div class="pt-3 border-top border-secondary border-opacity-25 px-2">
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <div class="d-flex align-items-center gap-2 overflow-hidden">
                        <div class="d-flex align-items-center justify-content-center flex-shrink-0" style="width: 34px; height: 34px; background: #292524; border: 1px solid #44403C; color: #D97706; border-radius: 6px;">
                            <i class="bi bi-person-fill"></i>
                        </div>
                        <div class="d-flex flex-column text-truncate" style="line-height: 1.1;">
                            <span class="small fw-bold text-white text-truncate" id="sidebarUserName">${nombre}</span>
                            <span class="font-monospace text-uppercase" style="font-size: 0.65rem; font-weight: 700; color: #D97706;" id="sidebarUserRol">${rol}</span>
                        </div>
                    </div>
                    ${!esCliente ? `
                    <button id="btnCampanaSidebar" class="btn p-0 text-warning d-flex align-items-center justify-content-center position-relative flex-shrink-0" style="width: 34px; height: 34px; background: #292524; border: 1px solid #44403C; border-radius: 6px;" onclick="mostrarModalAlertasStock()" title="Control de reposición">
                        <i class="bi bi-bell-fill fs-6" style="color: #F59E0B;"></i>
                        <span id="badgeNotificacionesStock" class="position-absolute top-0 start-100 translate-middle badge bg-danger border border-dark" style="font-size: 0.65rem; display: none; padding: 0.25em 0.45em; border-radius: 4px;">0</span>
                    </button>
                    ` : ''}
                </div>
                <button class="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-2 py-2" style="border-radius: 6px;" onclick="cerrarSesion()" title="Finalizar sesión">
                    <i class="bi bi-power"></i>
                    <span>Cerrar sesión</span>
                </button>
            </div>
        </aside>
    `;

    if (!esCliente) {
        setTimeout(iniciarMonitorAlertasStock, 300);
    }
}

window.renderizarSidebar = renderizarSidebar;

function obtenerUsuarioSesion() {
    try {
        const raw = localStorage.getItem('usuario_golden') || localStorage.getItem('usuario');
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

    if (!usuario) {
        if (paginaActual === 'tienda') {
            return null; // Catálogo abierto para visitantes sin forzar login
        }
        if (paginaActual !== 'login') {
            window.location.href = 'index.html';
            return null;
        }
        return null;
    }

    const rol = (usuario && usuario.rol ? String(usuario.rol).toUpperCase().trim() : '');
    const esCliente = !rol || rol === 'CLIENTE' || rol === 'CLIENTE_B2B' || rol === 'CLIENTE_B2C';

    if (!rolesPermitidos && (typeof paginaActual === 'string' && ['ADMIN', 'TRABAJADOR', 'ALMACENERO', 'REPARTIDOR', 'CLIENTE', 'CLIENTE_B2B', 'CLIENTE_B2C'].includes(paginaActual) || Array.isArray(paginaActual))) {
        rolesPermitidos = Array.isArray(paginaActual) ? paginaActual : [paginaActual];
        paginaActual = window.location.pathname.split('/').pop().replace('.html', '') || 'modulo';
    } else if (typeof rolesPermitidos === 'string') {
        rolesPermitidos = [rolesPermitidos];
    }

    if (esCliente && paginaActual !== 'tienda') {
        window.location.href = 'tienda.html';
        return null;
    }

    if (rolesPermitidos && Array.isArray(rolesPermitidos)) {
        // Mapear compatibilidad de roles equivalentes
        let rolesNormalizados = [...rolesPermitidos];
        if (rolesNormalizados.includes('ALMACENERO') || rolesNormalizados.includes('TRABAJADOR')) {
            rolesNormalizados.push('ALMACENERO', 'TRABAJADOR', 'EMPAQUE');
        }
        if (rolesNormalizados.includes('REPARTIDOR')) {
            rolesNormalizados.push('DESPACHO');
        }
        if (rolesNormalizados.includes('DESPACHO')) {
            rolesNormalizados.push('REPARTIDOR');
        }
        if (rolesNormalizados.includes('EMPAQUE')) {
            rolesNormalizados.push('ALMACENERO', 'TRABAJADOR');
        }
        if (rolesNormalizados.includes('CLIENTE') && !rolesNormalizados.includes('CLIENTE_B2B')) {
            rolesNormalizados.push('CLIENTE_B2B', 'CLIENTE_B2C');
        }
        const rolesMayus = rolesNormalizados.map(r => String(r).toUpperCase().trim());
        if (!rolesMayus.includes(rol)) {
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
window.obtenerUsuarioSesion = obtenerUsuarioSesion;
window.protegerRuta = protegerRuta;

// ==========================================
// CONFIGURACIÓN GLOBAL SWEETALERT2 STITCH UI
// ==========================================
if (typeof Swal !== 'undefined') {
    window.Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: false,
        background: '#FFFFFF',
        color: '#1C1917',
        customClass: {
            popup: 'stitch-toast'
        },
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
            confirmButtonColor: isDanger ? '#DC2626' : '#D97706',
            cancelButtonColor: '#64748B',
            confirmButtonText: confirmBtnText,
            cancelButtonText: 'Cancelar',
            background: '#FFFFFF',
            color: '#1C1917',
            reverseButtons: true,
            customClass: {
                popup: 'border border-secondary shadow'
            }
        });
    };
}

window.cerrarSesion = async function () {
    if (typeof Swal !== 'undefined') {
        const confirmacion = await Swal.fire({
            title: '¿Cerrar sesión?',
            text: '¿Deseas salir del sistema GOLDEN ERP?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#C81E1E',
            cancelButtonColor: '#64748B',
            confirmButtonText: '<i class="bi bi-box-arrow-right me-1"></i> Cerrar sesión',
            cancelButtonText: 'Permanecer',
            background: '#FFFFFF',
            color: '#1C1917',
            reverseButtons: true
        });
        if (!confirmacion.isConfirmed) return;
    }
    localStorage.removeItem('usuario_golden');
    window.location.href = 'index.html';
};

// =========================================================================
// MONITOREO DE STOCK EN TIEMPO REAL (SOLO PARA PERSONAL INTERNO)
// =========================================================================
let cacheProductosCriticos = [];

async function iniciarMonitorAlertasStock() {
    try {
        const usuario = obtenerUsuarioSesion();
        if (usuario && (usuario.rol === 'CLIENTE_B2B' || usuario.rol === 'CLIENTE_B2C')) {
            return; // No ejecutar para clientes
        }

        const res = await fetch('/api/productos?t=' + Date.now());
        if (!res.ok) return;
        const productos = await res.json();
        if (!Array.isArray(productos)) return;

        cacheProductosCriticos = productos.filter(p => p.stock <= p.stock_minimo);
        const badge = document.getElementById('badgeNotificacionesStock');

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
                title: '<span class="text-success fw-bold"><i class="bi bi-shield-check me-2"></i>Almacén en orden</span>',
                html: '<p class="text-muted small mb-0">No se registran repuestos en nivel crítico. Todas las referencias cuentan con stock por encima del nivel de reposición mínimo.</p>',
                icon: 'success',
                background: '#FFFFFF',
                color: '#1C1917',
                confirmButtonColor: '#C81E1E',
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
            ? '<span class="badge bg-danger text-white px-2 py-1 small">Agotado</span>'
            : `<span class="badge bg-warning text-dark px-2 py-1 small fw-bold">Crítico (${p.stock})</span>`;
        return `
            <tr>
                <td class="text-start py-2 font-monospace text-dark small">${p.sku}</td>
                <td class="text-start py-2 text-dark small">${p.nombre}</td>
                <td class="text-center py-2 font-monospace text-muted small">${p.stock_minimo}</td>
                <td class="text-center py-2">${badgeEstado}</td>
            </tr>
        `;
    }).join('');

    const tablaHTML = `
        <div class="text-start mb-3">
            <span class="text-muted small">Se registran <strong class="text-dark">${cacheProductosCriticos.length} repuestos</strong> con existencias iguales o inferiores al stock mínimo de reposición:</span>
        </div>
        <div class="table-responsive rounded-1 mb-2 border" style="max-height: 260px; overflow-y: auto; background: #FFFFFF;">
            <table class="table table-sm align-middle mb-0" style="color: #1C1917;">
                <thead>
                    <tr style="background: #1C1917; color: #FFFFFF;">
                        <th class="py-2 text-start small">SKU</th>
                        <th class="py-2 text-start small">Repuesto</th>
                        <th class="py-2 text-center small">Mínimo</th>
                        <th class="py-2 text-center small">Estado</th>
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
            title: '<div class="d-flex align-items-center justify-content-center gap-2" style="color: #C81E1E;"><i class="bi bi-bell-fill"></i><span>Control de reposición y stock</span></div>',
            html: tablaHTML,
            icon: 'warning',
            background: '#FFFFFF',
            color: '#1C1917',
            showCancelButton: true,
            confirmButtonColor: '#C81E1E',
            cancelButtonColor: '#64748B',
            confirmButtonText: '<i class="bi bi-truck-flatbed me-1"></i> Ir a reposición / compras',
            cancelButtonText: 'Cerrar',
            customClass: {
                popup: 'rounded-2 border shadow'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'compras.html';
            }
        });
    } else {
        alert(`Alerta de stock: ${cacheProductosCriticos.length} repuestos críticos.`);
    }
}

// =========================================================================
// EXPORTACIÓN A CSV / EXCEL
// =========================================================================
function exportarTablaCSV(tablaId, nombreArchivo = 'Reporte_GOLDEN', tituloReporte = 'Reporte Oficial de Operaciones') {
    if (typeof window.exportarReporteExcel === 'function' && window.EMPRESA_GOLDEN) {
        let tabla = document.getElementById(tablaId);
        if (!tabla) {
            const el = document.getElementById(tablaId);
            if (el && el.tagName === 'TBODY') tabla = el.closest('table');
        }
        if (tabla) {
            const encabezados = [];
            const anchos = [];
            const ths = tabla.querySelectorAll('thead th');
            ths.forEach(th => {
                const txt = th.innerText.trim();
                if (txt.toLowerCase() === 'acciones' || th.classList.contains('col-acciones')) return;
                encabezados.push(txt.toUpperCase());
                anchos.push(Math.max(16, txt.length + 6));
            });

            const filas = [];
            const trs = tabla.querySelectorAll('tbody tr');
            trs.forEach(tr => {
                if (tr.querySelector('td[colspan]')) return;
                const celdas = [];
                const tds = tr.querySelectorAll('td');
                tds.forEach((td, i) => {
                    if (ths[i] && (ths[i].innerText.trim().toLowerCase() === 'acciones' || ths[i].classList.contains('col-acciones'))) return;
                    let val = td.innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/g, ' ').trim();
                    celdas.push(val);
                });
                if (celdas.length > 0) filas.push(celdas);
            });

            window.exportarReporteExcel({
                titulo: tituloReporte,
                columnas: encabezados,
                filas: filas,
                anchos: anchos,
                nombreArchivo: nombreArchivo
            });
            return;
        }
    }

    let tabla = document.getElementById(tablaId);
    if (!tabla) {
        const el = document.getElementById(tablaId);
        if (el && el.tagName === 'TBODY') {
            tabla = el.closest('table');
        }
    }

    if (!tabla) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'warning', title: 'Tabla no encontrada', text: 'No se pudo ubicar el elemento de datos para exportar.', background: '#FFFFFF', color: '#1C1917' });
        } else {
            alert('Tabla no encontrada.');
        }
        return;
    }

    const filas = Array.from(tabla.querySelectorAll('tr'));
    if (filas.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Sin registros', text: 'La tabla está vacía en este momento.', background: '#FFFFFF', color: '#1C1917' });
        }
        return;
    }

    const lineasCSV = [];

    filas.forEach(fila => {
        const colspanTd = fila.querySelector('td[colspan]');
        if (colspanTd && parseInt(colspanTd.getAttribute('colspan')) >= 3) {
            return;
        }

        const celdas = Array.from(fila.querySelectorAll('th, td'));
        const datosFila = [];

        celdas.forEach(celda => {
            const textoCabecera = celda.innerText.trim().toLowerCase();
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
            lineasCSV.push(datosFila.join(';'));
        }
    });

    if (lineasCSV.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Sin datos exportables', text: 'No se encontraron filas válidas para exportar.', background: '#FFFFFF', color: '#1C1917' });
        }
        return;
    }

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
// MOTOR DE FACTURACIÓN PDF (html2pdf.js) - CARTA / A4
// =========================================================================
async function generarRecibo(pedidoId, modo = 'descargar') {
    // Si el motor centralizado oficial está cargado, usarlo directamente
    if (typeof window.generarFacturaNotaEntregaHTML === 'function') {
        try {
            if (typeof Toast !== 'undefined') {
                Toast.fire({ icon: 'info', title: 'Generando comprobante oficial...' });
            }
            const res = await fetch(`/api/pedidos/${pedidoId}`);
            if (!res.ok) throw new Error('Pedido no encontrado en el servidor');
            const pedido = await res.json();
            const htmlFactura = window.generarFacturaNotaEntregaHTML(pedido);
            const nombreArchivo = `Factura_GOLDEN_#00${String(pedido.id).padStart(4, '0')}.pdf`;

            if (modo === 'imprimir') {
                window.imprimirDocumento(htmlFactura, nombreArchivo);
            } else {
                await window.descargarDocumentoPDF(htmlFactura, nombreArchivo);
            }
            return;
        } catch (err) {
            console.error('Error al generar recibo con motor central:', err);
            if (typeof Toast !== 'undefined') {
                Toast.fire({ icon: 'error', title: 'No se pudo generar la factura del pedido' });
            }
            return;
        }
    }

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

    if (typeof html2pdf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => generarRecibo(pedidoId);
        document.head.appendChild(script);
        return;
    }

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
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center; color: #1C1917;">${d.cantidad}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; color: #1C1917;">${d.producto_nombre || 'Repuesto Automotriz'}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; color: #1C1917; font-family: 'Inter', sans-serif;">Bs. ${parseFloat(d.precio_unitario || 0).toFixed(2)}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #1C1917; font-family: 'Inter', sans-serif;">Bs. ${parseFloat(d.subtotal || 0).toFixed(2)}</td>
                        </tr>
                    `).join('');
                }
            }
        } catch (e) {
            console.warn('No se pudo cargar la orden para la factura, usando datos por defecto:', e);
        }
    }

    elemento.style.display = 'block';

    const opt = {
        margin:       0.5,
        filename:     pedidoId ? `Factura_GOLDEN_#00${pedidoId}.pdf` : 'Factura_GOLDEN.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

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

window.generarRecibo = generarRecibo;
window.generarFacturaPDF = generarRecibo;

function navegarAMisPedidos() {
    if (typeof abrirModalSeguimiento === 'function') {
        abrirModalSeguimiento();
    } else {
        window.location.href = 'tienda.html?verPedidos=1';
    }
}
window.navegarAMisPedidos = navegarAMisPedidos;
