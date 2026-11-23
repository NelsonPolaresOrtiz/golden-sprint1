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
                    <a class="nav-link-stitch ${paginaActiva === 'venta-directa' ? 'active' : ''}" href="venta-directa.html">
                        <i class="bi bi-cart-check-fill me-1 text-danger"></i> Venta Directa
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
            <a class="nav-drawer-link ${paginaActiva === 'venta-directa' ? 'active' : ''}" href="venta-directa.html">
                <i class="bi bi-cart-check-fill text-danger fs-5"></i>
                <div class="d-flex flex-column">
                    <span class="fw-bold">Venta Directa en Tienda</span>
                    <small class="text-muted" style="font-size: 0.72rem;">Caja presencial y mostrador de repuestos</small>
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

    // Formateo de usuario, iniciales e identidad compacta futurista
    const nombreCompleto = usuarioSesion ? (usuarioSesion.nombre || 'Usuario') : 'Usuario';
    const emailUsuario = usuarioSesion ? (usuarioSesion.email || '') : '';

    // Iniciales en mayúsculas (ej: 'Carlos Mendoza' -> 'CM')
    const partesNombre = nombreCompleto.replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean);
    let iniciales = 'U';
    if (partesNombre.length >= 2) {
        iniciales = (partesNombre[0].charAt(0) + partesNombre[1].charAt(0)).toUpperCase();
    } else if (partesNombre.length === 1 && partesNombre[0].length >= 2) {
        iniciales = partesNombre[0].substring(0, 2).toUpperCase();
    } else if (partesNombre.length === 1) {
        iniciales = partesNombre[0].charAt(0).toUpperCase();
    }

    // Nombre corto limpio para barra superior (ej: 'Carlos Mendoza')
    const nombreCorto = partesNombre.length >= 2 ? `${partesNombre[0]} ${partesNombre[1]}` : (partesNombre[0] || 'Usuario');

    // Micro-insignia tecnológica del rol
    let rolTechTag = 'INVITADO';
    let rolTechClass = 'role-cliente';
    if (rol === 'ADMIN' || rol === 'ADMINISTRADOR' || rol === 'SUPERADMIN' || rol === 'GERENTE') {
        rolTechTag = 'ADMIN';
        rolTechClass = 'role-admin';
    } else if (rol === 'EMPAQUE' || rol === 'ALMACENERO' || rol === 'ALMACEN') {
        rolTechTag = 'EMPAQUE';
        rolTechClass = 'role-empaque';
    } else if (rol === 'DESPACHO' || rol === 'REPARTIDOR') {
        rolTechTag = 'DESPACHO';
        rolTechClass = 'role-despacho';
    } else if (rol === 'CLIENTE' || rol === 'CLIENTE_B2B' || rol === 'CLIENTE_B2C') {
        rolTechTag = 'CLIENTE';
        rolTechClass = 'role-cliente';
    } else if (rol === 'TRABAJADOR') {
        rolTechTag = 'VENTAS';
        rolTechClass = 'role-empaque';
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

            <!-- Área Derecha: Campanita de Notificaciones Minimalista, Perfil Compacto y Menú Flotante -->
            <div class="d-flex align-items-center flex-nowrap gap-2 ms-auto flex-shrink-0" style="white-space: nowrap;">
                
                ${!esCliente ? `
                <!-- Campanita de Notificaciones con Popover Desplegable Moderno -->
                <div class="position-relative flex-shrink-0 notificaciones-dropdown-container" id="notificacionesContainer">
                    <button id="btnCampanaNotificaciones" class="btn-nav-notif-futuristic" onclick="togglePopoverNotificaciones(event)" title="Notificaciones del Sistema" aria-label="Notificaciones del Sistema">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-bell-svg">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        <span id="badgeNotificacionesStock" class="nav-bell-badge" style="display: none;">0</span>
                    </button>

                    <!-- Popover Desplegable de Notificaciones (#popoverNotificaciones) -->
                    <div id="popoverNotificaciones" class="popover-notificaciones-panel shadow-lg d-none" role="dialog" aria-labelledby="popoverNotifTitulo">
                        <!-- Cabecera del Panel -->
                        <div class="popover-notif-header d-flex align-items-center justify-content-between p-3 border-bottom" style="border-color: #F1F5F9 !important;">
                            <div class="d-flex align-items-center gap-2">
                                <i class="bi bi-bell-fill text-danger" style="font-size: 0.95rem;"></i>
                                <h6 class="mb-0 fw-bold text-dark" id="popoverNotifTitulo" style="font-size: 0.88rem; letter-spacing: -0.2px;">Notificaciones del Sistema</h6>
                                <span id="popoverNotifBadgeCount" class="badge bg-danger rounded-pill font-mono" style="font-size: 0.68rem; padding: 2px 7px;">0</span>
                            </div>
                            <button type="button" class="btn btn-sm btn-link text-decoration-none text-secondary p-0 fw-medium" id="btnMarcarLeidas" onclick="marcarNotificacionesLeidas(event)" style="font-size: 0.75rem;">
                                Marcar leídas
                            </button>
                        </div>

                        <!-- Lista Dinámica de Notificaciones (Scrollable) -->
                        <div class="popover-notif-list" id="popoverNotifLista" style="max-height: 380px; overflow-y: auto;">
                            <div class="text-center py-4 text-muted small">
                                <span class="spinner-border spinner-border-sm me-2 text-danger"></span> Cargando notificaciones...
                            </div>
                        </div>

                        <!-- Pie del Panel -->
                        <a href="auditoria.html" class="popover-notif-footer d-flex align-items-center justify-content-between px-3 py-2 text-decoration-none bg-light text-secondary border-top" style="border-color: #F1F5F9 !important; font-size: 0.78rem;">
                            <span class="fw-medium">Ver historial completo en Auditoría</span>
                            <i class="bi bi-arrow-right"></i>
                        </a>
                    </div>
                </div>
                ` : ''}

                <!-- Identificación de Usuario Compacta y Futurista (Estilo Linear / Vercel) -->
                <div class="dropdown position-relative flex-shrink-0 user-dropdown-container" id="userInfoBadge">
                    <div class="nav-profile-chip" role="button" aria-expanded="false" title="Perfil de ${nombreCompleto}">
                        <!-- Avatar Circular con Iniciales e Indicador Esmeralda -->
                        <div class="nav-avatar-wrap">
                            <div class="nav-avatar-img">
                                ${iniciales}
                            </div>
                            <span class="nav-avatar-status" title="Sesión activa"></span>
                        </div>

                        <!-- Identidad Limpia (Nombre Corto + Micro-insignia tecnológica de rol) -->
                        <div class="d-none d-sm-flex align-items-center gap-2">
                            <span class="nav-profile-name" id="navUserName">${nombreCorto}</span>
                            <span class="nav-role-badge-tech ${rolTechClass}" id="navUserRol">${rolTechTag}</span>
                            <i class="bi bi-chevron-down nav-profile-chevron"></i>
                        </div>
                    </div>

                    <!-- Tarjeta Flotante Oscura (Glassmorphism) -->
                    <div class="dropdown-menu dropdown-menu-end nav-profile-dropdown-menu user-dropdown profile-dropdown shadow-lg">
                        <!-- Cabecera de Usuario -->
                        <div class="d-flex align-items-center gap-3 pb-3 border-bottom border-secondary border-opacity-25">
                            <div class="nav-avatar-img" style="width: 40px; height: 40px; font-size: 15px; border-radius: 50%; flex-shrink: 0; background: #B91C1C; color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                                ${iniciales}
                            </div>
                            <div class="d-flex flex-column text-truncate" style="line-height: 1.25;">
                                <span class="fw-bold text-white text-truncate" style="font-size: 13.5px;">${nombreCompleto}</span>
                                <div class="d-flex align-items-center gap-1 mt-1">
                                    <span class="nav-role-badge-tech ${rolTechClass}" style="font-size: 10px; padding: 2px 6px;">${rolTechTag}</span>
                                    <span class="text-secondary small text-truncate" style="font-size: 11px;">${rolLegible}</span>
                                </div>
                                ${emailUsuario ? `<span class="font-mono text-muted text-truncate mt-1" style="font-size: 10.5px;">${emailUsuario}</span>` : ''}
                            </div>
                        </div>

                        <!-- Estado de Conexión Activa -->
                        <div class="d-flex align-items-center justify-content-between py-2 px-3 my-2 rounded-2" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);">
                            <span class="small text-secondary" style="font-size: 11.5px;">Estado de sesión</span>
                            <span class="d-inline-flex align-items-center gap-1 small text-success fw-bold" style="font-size: 11px;">
                                <span style="width: 7px; height: 7px; background: #10B981; border-radius: 50%; display: inline-block; box-shadow: 0 0 6px rgba(16,185,129,0.5);"></span>
                                Activo
                            </span>
                        </div>

                        <!-- Acciones según rol -->
                        <div class="d-flex flex-column gap-1 my-2">
                            ${!esCliente ? `
                                <a href="dashboard.html" class="nav-dropdown-item d-flex align-items-center gap-2 py-2 px-2 rounded-2 text-decoration-none">
                                    <i class="bi bi-speedometer2 text-danger"></i>
                                    <span>Panel de control</span>
                                </a>
                                <a href="tienda.html" class="nav-dropdown-item d-flex align-items-center gap-2 py-2 px-2 rounded-2 text-decoration-none">
                                    <i class="bi bi-shop text-danger"></i>
                                    <span>Catálogo comercial</span>
                                </a>
                            ` : `
                                <a href="tienda.html" class="nav-dropdown-item d-flex align-items-center gap-2 py-2 px-2 rounded-2 text-decoration-none">
                                    <i class="bi bi-shop text-danger"></i>
                                    <span>Catálogo de productos</span>
                                </a>
                                <button type="button" class="nav-dropdown-item d-flex align-items-center gap-2 py-2 px-2 rounded-2 text-decoration-none border-0 bg-transparent text-start w-100" onclick="navegarAMisPedidos()">
                                    <i class="bi bi-truck text-warning"></i>
                                    <span>Mis pedidos</span>
                                </button>
                            `}
                        </div>

                        <!-- Botón de Salir Integrado -->
                        <div class="pt-2 border-top border-secondary border-opacity-25 mt-2">
                            <button id="btnHeaderSalir" class="btn btn-futuristic-logout w-100 d-flex align-items-center justify-content-center gap-2" onclick="cerrarSesion()" title="Cerrar sesión">
                                <i class="bi bi-power"></i>
                                <span>Cerrar sesión</span>
                            </button>
                        </div>
                    </div>
                </div>

                ${paginaActiva === 'tienda' ? `
                <!-- Botón Pedido / Carrito -->
                <button class="btn btn-stitch-primary d-flex align-items-center gap-1 px-2 py-1 flex-shrink-0" type="button" data-bs-toggle="offcanvas" data-bs-target="#carritoLateral" style="border-radius: 8px; background-color: #C81E1E; border: 1px solid #C81E1E; color: #FFFFFF; font-size: 0.76rem; height: 36px;">
                    <i class="bi bi-cart3 fs-6"></i>
                    <span class="d-none d-md-inline">Mi pedido</span>
                    <span id="contadorCarrito" class="badge bg-white text-dark font-monospace ms-1" style="font-size: 0.68rem; border-radius: 4px;">0</span>
                </button>
                ` : ''}

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
                <div class="p-3 mb-3 rounded-3" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div class="d-flex align-items-center gap-3">
                        <div class="nav-avatar-wrap" style="width: 38px; height: 38px;">
                            <div class="nav-avatar-img" style="width: 38px; height: 38px; font-size: 14px;">
                                ${iniciales}
                            </div>
                            <span class="nav-avatar-status" style="width: 9px; height: 9px; bottom: 0; right: 0;"></span>
                        </div>
                        <div class="d-flex flex-column text-truncate" style="line-height: 1.2;">
                            <span class="text-white fw-bold text-truncate" style="font-size: 0.9rem;">${nombreCorto}</span>
                            <div class="d-flex align-items-center gap-2 mt-1">
                                <span class="nav-role-badge-tech ${rolTechClass}">${rolTechTag}</span>
                                <span class="d-inline-flex align-items-center gap-1 text-success fw-bold" style="font-size: 10.5px;">
                                    <span style="width: 6px; height: 6px; background: #10B981; border-radius: 50%; display: inline-block;"></span>
                                    Sesión activa
                                </span>
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

// Manejador global del Menú Desplegable de Perfil Futurista (soporte nativo y sin dependencias)
document.addEventListener('click', (e) => {
    const chip = e.target.closest('.nav-profile-chip');
    const allDropdowns = document.querySelectorAll('.nav-profile-dropdown-menu, .user-dropdown');

    if (chip) {
        const wrap = chip.closest('#userInfoBadge, #tiendaProfileWrap, .user-dropdown-container') || chip.parentElement;
        const menu = wrap ? wrap.querySelector('.nav-profile-dropdown-menu, .user-dropdown') : null;
        if (menu) {
            e.stopPropagation();
            const isShown = menu.classList.contains('show');
            allDropdowns.forEach(d => {
                d.classList.remove('show');
                const p = d.closest('#userInfoBadge, #tiendaProfileWrap, .user-dropdown-container') || d.parentElement;
                const c = p ? p.querySelector('.nav-profile-chip') : null;
                if (c) c.setAttribute('aria-expanded', 'false');
            });
            if (!isShown) {
                menu.classList.add('show');
                chip.setAttribute('aria-expanded', 'true');
            }
        }
    } else if (!e.target.closest('.nav-profile-dropdown-menu, .user-dropdown')) {
        allDropdowns.forEach(d => {
            d.classList.remove('show');
            const p = d.closest('#userInfoBadge, #tiendaProfileWrap, .user-dropdown-container') || d.parentElement;
            const c = p ? p.querySelector('.nav-profile-chip') : null;
            if (c) c.setAttribute('aria-expanded', 'false');
        });
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

window.cerrarSesion = function () {
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
};
window.logout = window.cerrarSesion;

// =========================================================================
// CENTRO DE NOTIFICACIONES MODERNO EN TIEMPO REAL (#popoverNotificaciones)
// =========================================================================
let cacheNotificaciones = {
    productosCriticos: [],
    pedidosPendientes: [],
    leidas: false,
    timestamp: 0
};

// Variable para retrocompatibilidad
let cacheProductosCriticos = [];

async function iniciarMonitorAlertasStock() {
    try {
        const usuario = obtenerUsuarioSesion();
        if (usuario && (usuario.rol === 'CLIENTE_B2B' || usuario.rol === 'CLIENTE_B2C')) {
            return; // No ejecutar para clientes
        }
        await cargarNotificacionesSistema(false);
    } catch (e) {
        console.warn("Monitor de notificaciones en espera...", e.message);
    }
}

async function cargarNotificacionesSistema(forzar = false) {
    const ahora = Date.now();
    // Cache de 12 segundos para evitar sobrecarga de peticiones
    if (!forzar && ahora - cacheNotificaciones.timestamp < 12000 && cacheNotificaciones.timestamp > 0) {
        renderizarListaNotificaciones();
        actualizarBadgesCampana();
        return;
    }

    try {
        const [resProds, resPedidos] = await Promise.all([
            fetch('/api/productos?t=' + ahora).catch(() => null),
            fetch('/api/pedidos?t=' + ahora).catch(() => null)
        ]);

        let productosCriticos = [];
        if (resProds && resProds.ok) {
            const prods = await resProds.json();
            if (Array.isArray(prods)) {
                productosCriticos = prods.filter(p => p.stock <= p.stock_minimo)
                    .sort((a, b) => a.stock - b.stock);
            }
        }

        let pedidosPendientes = [];
        if (resPedidos && resPedidos.ok) {
            const pedidos = await resPedidos.json();
            if (Array.isArray(pedidos)) {
                pedidosPendientes = pedidos.filter(p => {
                    const estPago = String(p.estado_pago || '').toUpperCase();
                    const est = String(p.estado || '').toUpperCase();
                    const estLog = String(p.estado_logistica || '').toUpperCase();
                    return estPago === 'PENDIENTE' || est === 'PENDIENTE' || est === 'EMPAQUE' || estLog.includes('ORDEN RECIBIDA');
                }).slice(0, 10);
            }
        }

        cacheNotificaciones.productosCriticos = productosCriticos;
        cacheNotificaciones.pedidosPendientes = pedidosPendientes;
        cacheNotificaciones.timestamp = ahora;
        cacheProductosCriticos = productosCriticos; // Retrocompatibilidad

        actualizarBadgesCampana();
        renderizarListaNotificaciones();

    } catch (err) {
        console.warn('Error al sincronizar notificaciones del sistema:', err);
        const listaEl = document.getElementById('popoverNotifLista');
        if (listaEl) {
            listaEl.innerHTML = `
                <div class="text-center py-4 px-3 text-muted small">
                    <i class="bi bi-wifi-off text-warning fs-4 d-block mb-1"></i>
                    <span>Sincronizando con el servidor ERP...</span>
                </div>
            `;
        }
    }
}

function actualizarBadgesCampana() {
    const total = cacheNotificaciones.productosCriticos.length + cacheNotificaciones.pedidosPendientes.length;
    const badges = [
        document.getElementById('badgeNotificacionesStock'),
        document.getElementById('badgeNotificacionesSidebar'),
        document.getElementById('badgeNotificacionesStockTienda')
    ];

    badges.forEach(b => {
        if (!b) return;
        if (total > 0 && !cacheNotificaciones.leidas) {
            b.innerText = total > 99 ? '99+' : String(total);
            b.style.display = 'inline-flex';
        } else {
            b.innerText = '0';
            b.style.display = 'none';
        }
    });

    const badgeHeader = document.getElementById('popoverNotifBadgeCount');
    if (badgeHeader) {
        badgeHeader.innerText = (total > 0 && !cacheNotificaciones.leidas) ? String(total) : '0';
        badgeHeader.className = (total > 0 && !cacheNotificaciones.leidas) 
            ? 'badge bg-danger rounded-pill font-mono' 
            : 'badge bg-secondary rounded-pill font-mono';
    }
}

function renderizarListaNotificaciones() {
    const listaEl = document.getElementById('popoverNotifLista');
    if (!listaEl) return;

    const prods = cacheNotificaciones.productosCriticos;
    const pedidos = cacheNotificaciones.pedidosPendientes;
    const total = prods.length + pedidos.length;

    if (total === 0 || cacheNotificaciones.leidas) {
        listaEl.innerHTML = `
            <div class="text-center py-5 px-3">
                <div class="mb-2 d-inline-flex align-items-center justify-content-center rounded-circle" style="width: 48px; height: 48px; background: #F0FDF4; color: #16A34A; font-size: 24px;">
                    <i class="bi bi-check2-circle"></i>
                </div>
                <div class="fw-bold text-dark small mb-1">Todo al día</div>
                <div class="text-muted" style="font-size: 0.78rem;">No tienes alertas pendientes.</div>
            </div>
        `;
        return;
    }

    let itemsHTML = '';

    // 1. Productos con Stock Crítico o Agotados (enlace directo a inventario.html)
    prods.slice(0, 15).forEach(p => {
        const esAgotado = (p.stock <= 0);
        const iconClass = esAgotado ? 'popover-notif-icon-danger' : 'popover-notif-icon-warning';
        const iconSvg = esAgotado ? '<i class="bi bi-x-octagon-fill"></i>' : '<i class="bi bi-exclamation-triangle-fill"></i>';
        const badgeTag = esAgotado
            ? '<span class="badge bg-danger text-white rounded-pill px-2 py-0" style="font-size: 0.65rem;">AGOTADO</span>'
            : `<span class="badge bg-warning text-dark rounded-pill px-2 py-0 fw-bold" style="font-size: 0.65rem;">CRÍTICO (${p.stock})</span>`;

        itemsHTML += `
            <a href="inventario.html" class="popover-notif-item" title="Ver en Inventario">
                <div class="popover-notif-icon-wrap ${iconClass}">
                    ${iconSvg}
                </div>
                <div class="popover-notif-content">
                    <div class="d-flex align-items-center justify-content-between gap-1 mb-1">
                        <span class="popover-notif-title text-truncate">${p.nombre}</span>
                        ${badgeTag}
                    </div>
                    <div class="popover-notif-desc">
                        SKU <span class="font-mono text-dark fw-semibold">${p.sku}</span> · Stock: <strong class="${esAgotado ? 'text-danger' : 'text-warning'}">${p.stock}</strong> vs Mínimo: ${p.stock_minimo}
                    </div>
                    <div class="popover-notif-meta">
                        <i class="bi bi-box-seam me-1"></i>Almacén e Inventario · Reponer stock
                    </div>
                </div>
            </a>
        `;
    });

    // 2. Pedidos pendientes de verificación o empaque (enlace a cobranzas.html o logistica.html)
    pedidos.slice(0, 10).forEach(ped => {
        const esPagoPendiente = String(ped.estado_pago || '').toUpperCase() === 'PENDIENTE';
        const iconClass = esPagoPendiente ? 'popover-notif-icon-warning' : 'popover-notif-icon-primary';
        const iconSvg = esPagoPendiente ? '<i class="bi bi-cash-coin"></i>' : '<i class="bi bi-truck"></i>';
        const destino = esPagoPendiente ? 'cobranzas.html' : 'logistica.html';
        const badgeTag = esPagoPendiente
            ? '<span class="badge bg-warning text-dark rounded-pill px-2 py-0 fw-bold" style="font-size: 0.65rem;">PAGO PENDIENTE</span>'
            : '<span class="badge bg-primary text-white rounded-pill px-2 py-0" style="font-size: 0.65rem;">DESPACHO</span>';

        itemsHTML += `
            <a href="${destino}" class="popover-notif-item" title="Gestionar orden">
                <div class="popover-notif-icon-wrap ${iconClass}">
                    ${iconSvg}
                </div>
                <div class="popover-notif-content">
                    <div class="d-flex align-items-center justify-content-between gap-1 mb-1">
                        <span class="popover-notif-title text-truncate">Pedido #${ped.id} · ${ped.cliente || 'Cliente'}</span>
                        ${badgeTag}
                    </div>
                    <div class="popover-notif-desc">
                        Total: <strong class="text-danger font-mono">Bs. ${parseFloat(ped.total || 0).toFixed(2)}</strong> · ${ped.metodo_pago || 'QR Simple'}
                    </div>
                    <div class="popover-notif-meta">
                        <i class="bi bi-arrow-up-right-circle me-1"></i>${destino === 'cobranzas.html' ? 'Cobranzas' : 'Logística & Despacho'}
                    </div>
                </div>
            </a>
        `;
    });

    listaEl.innerHTML = itemsHTML;
}

function marcarNotificacionesLeidas(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    cacheNotificaciones.leidas = true;
    actualizarBadgesCampana();
    renderizarListaNotificaciones();
}

function garantizarPopoverNotificaciones(containerDestino) {
    let popover = document.getElementById('popoverNotificaciones');
    if (!popover) {
        popover = document.createElement('div');
        popover.id = 'popoverNotificaciones';
        popover.className = 'popover-notificaciones-panel shadow-lg d-none';
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-labelledby', 'popoverNotifTitulo');
        popover.innerHTML = `
            <div class="popover-notif-header d-flex align-items-center justify-content-between p-3 border-bottom" style="border-color: #F1F5F9 !important;">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-bell-fill text-danger" style="font-size: 0.95rem;"></i>
                    <h6 class="mb-0 fw-bold text-dark" id="popoverNotifTitulo" style="font-size: 0.88rem; letter-spacing: -0.2px;">Notificaciones del Sistema</h6>
                    <span id="popoverNotifBadgeCount" class="badge bg-danger rounded-pill font-mono" style="font-size: 0.68rem; padding: 2px 7px;">0</span>
                </div>
                <button type="button" class="btn btn-sm btn-link text-decoration-none text-secondary p-0 fw-medium" id="btnMarcarLeidas" onclick="marcarNotificacionesLeidas(event)" style="font-size: 0.75rem;">
                    Marcar leídas
                </button>
            </div>
            <div class="popover-notif-list" id="popoverNotifLista" style="max-height: 380px; overflow-y: auto;">
                <div class="text-center py-4 text-muted small">
                    <span class="spinner-border spinner-border-sm me-2 text-danger"></span> Cargando notificaciones...
                </div>
            </div>
            <a href="auditoria.html" class="popover-notif-footer d-flex align-items-center justify-content-between px-3 py-2 text-decoration-none bg-light text-secondary border-top" style="border-color: #F1F5F9 !important; font-size: 0.78rem;">
                <span class="fw-medium">Ver historial completo en Auditoría →</span>
                <i class="bi bi-arrow-right"></i>
            </a>
        `;
        const contenedor = containerDestino || document.querySelector('.notificaciones-dropdown-container') || document.body;
        contenedor.appendChild(popover);
    }
    return popover;
}

function togglePopoverNotificaciones(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const triggerBtn = (event && event.currentTarget) || document.getElementById('btnCampanaNotificaciones');
    const container = triggerBtn ? triggerBtn.closest('.notificaciones-dropdown-container') : null;
    const popover = garantizarPopoverNotificaciones(container);

    if (container && popover.parentElement !== container) {
        container.appendChild(popover);
    }

    const estaOculto = popover.classList.contains('d-none');
    if (estaOculto) {
        // Cerrar cualquier otro dropdown abierto (ej. perfil de usuario)
        document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
        popover.classList.remove('d-none');
        cargarNotificacionesSistema(true);
    } else {
        popover.classList.add('d-none');
    }
}

// Escuchador global: cerrar popover al hacer clic fuera o presionar Escape
document.addEventListener('click', function(e) {
    const popover = document.getElementById('popoverNotificaciones');
    if (!popover || popover.classList.contains('d-none')) return;

    const btnCampana = document.getElementById('btnCampanaNotificaciones');
    const btnSidebar = document.getElementById('btnCampanaSidebar');
    const btnTienda = document.getElementById('btnCampanaNotificacionesTienda');

    if (popover.contains(e.target)) return;
    if (btnCampana && btnCampana.contains(e.target)) return;
    if (btnSidebar && btnSidebar.contains(e.target)) return;
    if (btnTienda && btnTienda.contains(e.target)) return;

    popover.classList.add('d-none');
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const popover = document.getElementById('popoverNotificaciones');
        if (popover && !popover.classList.contains('d-none')) {
            popover.classList.add('d-none');
        }
    }
});

// Función de compatibilidad
function mostrarModalAlertasStock(event) {
    togglePopoverNotificaciones(event);
}

window.togglePopoverNotificaciones = togglePopoverNotificaciones;
window.marcarNotificacionesLeidas = marcarNotificacionesLeidas;
window.cargarNotificacionesSistema = cargarNotificacionesSistema;
window.mostrarModalAlertasStock = mostrarModalAlertasStock;

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
            console.warn('Tabla no encontrada para exportar.');
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
            console.warn('No se encontró el contenedor #plantilla-factura en la vista.');
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
