const API_URL = '/api';
let productosTienda = [];
let carrito = [];
let categoriaActual = 'Todos';

document.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem('usuario_golden');
    if (!usuarioGuardado) { window.location.href = 'index.html'; return; }
    
    renderizarMenu('tienda');

    const usuario = JSON.parse(usuarioGuardado);
    document.getElementById('userInfoBadge').innerHTML = `
        <i class="bi bi-person-circle me-1"></i> ${usuario.nombre} 
        <span class="badge bg-warning text-dark ms-1">${usuario.rol}</span>
    `;

    cargarCatalogo(); 
});

// ==========================================
// 1. CARGAR Y DIBUJAR CATÁLOGO VIP
// ==========================================
async function cargarCatalogo() {
    try {
        const res = await fetch(`${API_URL}/productos?t=${new Date().getTime()}`);
        productosTienda = await res.json();
        renderizarCatalogo();
    } catch (error) {
        console.error("Error cargando catálogo", error);
    }
}

function renderizarCatalogo() {
    const contenedor = document.getElementById('catalogoProductos');
    contenedor.innerHTML = '';

    // Lógica de Filtrado
    let productosFiltrados = productosTienda;
    if (categoriaActual !== 'Todos') {
        productosFiltrados = productosTienda.filter(p => p.categoria === categoriaActual);
    }

    // Mensaje bonito si no hay productos (tu pantalla blanca)
    if (productosFiltrados.length === 0) {
        contenedor.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-box-seam display-1 text-muted d-block mb-3"></i>
                <h3 class="text-muted fw-bold">No hay repuestos disponibles</h3>
                <p class="text-secondary">Ve a la pestaña de "Inventario" para registrar nuevos productos.</p>
            </div>`;
        return;
    }

    // Dibujar Tarjetas
    productosFiltrados.forEach(p => {
        const sinStock = p.stock <= 0;
        const botonHTML = sinStock 
            ? `<button class="btn btn-secondary w-100 fw-bold shadow-sm" disabled><i class="bi bi-x-circle me-1"></i> Agotado</button>`
            : `<button class="btn btn-warning w-100 fw-bold shadow-sm text-dark" onclick="agregarAlCarrito(${p.id})"><i class="bi bi-cart-plus me-1"></i> Añadir al Carrito</button>`;

        // Magia visual: Cambiar ícono y color según la categoría
        let icono = 'bi-box';
        let bgClass = 'default-bg';
        if (p.categoria.includes('Aceite') && !p.categoria.includes('Filtro')) {
            icono = 'bi-droplet-half';
            bgClass = 'aceite-bg';
        } else if (p.categoria.includes('Filtro')) {
            icono = 'bi-funnel';
            bgClass = 'filtro-bg';
        }

        contenedor.innerHTML += `
            <div class="col-sm-6 col-md-4 col-lg-3">
                <div class="card card-producto h-100 shadow-sm">
                    <div class="img-placeholder ${bgClass}">
                        <i class="bi ${icono}"></i>
                    </div>
                    <div class="card-body d-flex flex-column p-4">
                        <span class="badge bg-dark mb-3 align-self-start">${p.categoria}</span>
                        <h5 class="card-title fw-bolder text-dark mb-1">${p.nombre}</h5>
                        <p class="text-muted small mb-3">SKU: ${p.sku}</p>
                        
                        <div class="mt-auto border-top pt-3">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h4 class="text-success fw-bold mb-0">Bs. ${p.precio}</h4>
                                <span class="badge ${sinStock ? 'bg-danger' : 'bg-success-subtle text-success border border-success-subtle'} p-2">
                                    Stock: ${p.stock}
                                </span>
                            </div>
                            ${botonHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

function filtrarCategoria(categoria, botonElemento) {
    categoriaActual = categoria;
    
    // Cambiar el color visual del botón presionado
    document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active', 'text-warning'));
    botonElemento.classList.add('active', 'text-warning');
    
    renderizarCatalogo();
}

// ==========================================
// 2. LÓGICA DEL CARRITO Y COMPRA
// ==========================================
function agregarAlCarrito(idProducto) {
    const producto = productosTienda.find(p => p.id === idProducto);
    const itemExistente = carrito.find(item => item.id === idProducto);
    
    if (itemExistente) {
        if (itemExistente.cantidad >= producto.stock) {
            alert('Límite de stock alcanzado.');
            return;
        }
        itemExistente.cantidad++;
    } else {
        carrito.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1 });
    }
    actualizarCarrito();
    
    // Abrir panel lateral automáticamente al agregar
    const panel = document.getElementById('carritoLateral');
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(panel) || new bootstrap.Offcanvas(panel);
    bsOffcanvas.show();
}

function eliminarDelCarrito(idProducto) {
    carrito = carrito.filter(item => item.id !== idProducto);
    actualizarCarrito();
}

function actualizarCarrito() {
    const listaCarrito = document.getElementById('listaCarrito');
    const contadorCarrito = document.getElementById('contadorCarrito');
    const totalCarrito = document.getElementById('totalCarrito');
    
    listaCarrito.innerHTML = '';
    let total = 0;
    let cantidadTotal = 0;

    if (carrito.length === 0) {
        listaCarrito.innerHTML = '<p class="text-muted text-center mt-5"><i class="bi bi-cart-x display-4 d-block mb-3"></i>Tu carrito está vacío.</p>';
        contadorCarrito.innerText = '0';
        totalCarrito.innerText = 'Bs. 0.00';
        return;
    }

    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        cantidadTotal += item.cantidad;

        listaCarrito.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-3 border bg-light p-2 rounded">
                <div>
                    <h6 class="mb-0 fw-bold text-dark">${item.nombre}</h6>
                    <small class="text-secondary">${item.cantidad} x Bs. ${item.precio}</small>
                </div>
                <div class="text-end">
                    <span class="fw-bold d-block text-success">Bs. ${subtotal.toFixed(2)}</span>
                    <button class="btn btn-sm text-danger p-0 fw-bold" onclick="eliminarDelCarrito(${item.id})"><i class="bi bi-trash"></i> Quitar</button>
                </div>
            </div>
        `;
    });

    contadorCarrito.innerText = cantidadTotal;
    totalCarrito.innerText = `Bs. ${total.toFixed(2)}`;
}

async function procesarCompra() {
    if (carrito.length === 0) { alert("Agrega repuestos a tu carrito primero."); return; }

    let totalVenta = 0;
    carrito.forEach(item => totalVenta += (item.precio * item.cantidad));
    const usuario = JSON.parse(localStorage.getItem('usuario_golden'));

    try {
        const res = await fetch(`${API_URL}/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_id: usuario.id, total: totalVenta, carrito: carrito })
        });
        const data = await res.json();
        
        if (!res.ok) { alert('❌ Error en la compra: ' + data.error); return; }

        alert('✅ ¡COMPRA EXITOSA!\n\nSe ha descontado el stock de tu inventario automáticamente.');
        
        carrito = [];
        actualizarCarrito();
        cargarCatalogo(); // Recargar la página con el nuevo stock
        
        const panel = document.getElementById('carritoLateral');
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(panel);
        if (bsOffcanvas) bsOffcanvas.hide();

    } catch (error) {
        alert("Error de conexión al procesar la compra.");
    }
}