function renderizarMenu(paginaActiva) {
    const menuHTML = `
    <nav class="navbar navbar-expand-lg navbar-dark shadow-sm sticky-top" style="background: linear-gradient(135deg, #0f172a, #1e293b);">
        <div class="container">
            <a class="navbar-brand fw-bold text-warning" href="#"><i class="bi bi-gear-wide-connected me-2"></i>ERP GOLDEN</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menuPrincipal"><span class="navbar-toggler-icon"></span></button>
            <div class="collapse navbar-collapse" id="menuPrincipal">
                <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-4">
                    <!-- NUEVO BOTÓN DASHBOARD -->
                    <li class="nav-item"><a class="nav-link ${paginaActiva === 'dashboard' ? 'active fw-bold border-bottom border-warning' : ''}" href="dashboard.html"><i class="bi bi-bar-chart-fill me-1"></i> Dashboard</a></li>
                    
                    <li class="nav-item"><a class="nav-link ${paginaActiva === 'usuarios' ? 'active fw-bold border-bottom border-warning' : ''}" href="index.html"><i class="bi bi-people me-1"></i> Usuarios</a></li>
                    <li class="nav-item"><a class="nav-link ${paginaActiva === 'inventario' ? 'active fw-bold border-bottom border-warning' : ''}" href="inventario.html"><i class="bi bi-box-seam me-1"></i> Inventario</a></li>
                    <li class="nav-item"><a class="nav-link ${paginaActiva === 'tienda' ? 'active fw-bold border-bottom border-warning' : ''}" href="tienda.html"><i class="bi bi-shop me-1"></i> Ventas</a></li>
                    <li class="nav-item"><a class="nav-link ${paginaActiva === 'logistica' ? 'active fw-bold border-bottom border-warning' : ''}" href="logistica.html"><i class="bi bi-truck me-1"></i> Logística</a></li>
                </ul>
                <div class="d-flex align-items-center gap-3">
                    <span id="userInfoBadge" class="text-light small"></span>
                    ${paginaActiva === 'tienda' ? `<button class="btn btn-warning fw-bold" type="button" data-bs-toggle="offcanvas" data-bs-target="#carritoLateral"><i class="bi bi-cart3"></i> Carrito <span id="contadorCarrito" class="badge bg-danger ms-1">0</span></button>` : ''}
                    <button class="btn btn-outline-danger btn-sm fw-bold" onclick="cerrarSesion()"><i class="bi bi-power"></i> Salir</button>
                </div>
            </div>
        </div>
    </nav>`;
    document.getElementById('menu-contenedor').innerHTML = menuHTML;
}
window.cerrarSesion = function() { localStorage.removeItem('usuario_golden'); window.location.href = 'index.html'; }