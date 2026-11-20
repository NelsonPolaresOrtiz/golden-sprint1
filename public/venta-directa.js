/**
 * ============================================================================
 * ERP GOLDEN - MÓDULO DE VENTA DIRECTA EN TIENDA (CAJA & MOSTRADOR PRESENCIAL)
 * Conforme a estándares de diseño automotriz y arquitectura financiera Bolivia.
 * ============================================================================
 */

const API_URL = '/api';

// Estado global de la caja y venta en curso
let catalogoProductos = [];
let carritoVenta = [];
let clientesRegistrados = [];
let modoCliente = 'CONSUMIDOR_FINAL';
let metodoPagoActual = 'EFECTIVO';
let categoriaActiva = 'TODOS';
let textoBusqueda = '';
let ultimaVentaRealizada = null;

// Helper para Toast con SweetAlert2
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
});

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Renderizar Menú Superior
    if (typeof renderizarMenu === 'function') {
        renderizarMenu('venta-directa');
    }

    // 2. Establecer nombre del cajero/vendedor activo
    const usuario = typeof obtenerUsuarioSesion === 'function' ? obtenerUsuarioSesion() : null;
    const txtVendedor = document.getElementById('txtVendedorNombre');
    if (txtVendedor && usuario) {
        txtVendedor.innerText = `${usuario.nombre} (${usuario.rol || 'Ventas'})`;
    }

    // 3. Cargar datos iniciales
    await Promise.all([
        cargarProductosTienda(),
        cargarClientesRegistrados()
    ]);

    // 4. Configurar escuchadores de eventos
    configurarEventos();
});

/**
 * Obtiene los encabezados de autenticación basados en la sesión activa
 */
function obtenerHeadersAuth() {
    let rol = '';
    let email = '';
    try {
        const raw = localStorage.getItem('usuario_golden') || localStorage.getItem('usuario');
        if (raw) {
            const u = JSON.parse(raw);
            rol = u.rol || '';
            email = u.email || u.correo || '';
        }
    } catch (e) {}

    return {
        'Content-Type': 'application/json',
        'x-usuario-rol': rol,
        'x-usuario-email': email,
        'Authorization': `Bearer ${rol}`
    };
}

/**
 * Carga el catálogo de productos con stock en tienda
 */
async function cargarProductosTienda() {
    try {
        const res = await fetch(`${API_URL}/productos?t=${Date.now()}`);
        if (!res.ok) throw new Error('No se pudo cargar el catálogo');
        catalogoProductos = await res.json();
        renderizarGridProductos();
    } catch (error) {
        console.error('Error al cargar productos:', error);
        const grid = document.getElementById('gridProductosVenta');
        if (grid) {
            grid.innerHTML = `
                <div class="col-12 text-center py-4 text-danger small">
                    <i class="bi bi-exclamation-triangle fs-3 d-block mb-1"></i>
                    No se pudo conectar con el catálogo de almacén. Verifique su conexión.
                </div>
            `;
        }
    }
}

/**
 * Carga el directorio de clientes y talleres para búsqueda rápida
 */
async function cargarClientesRegistrados() {
    try {
        const res = await fetch(`${API_URL}/usuarios?t=${Date.now()}`, {
            headers: obtenerHeadersAuth()
        });
        if (res.ok) {
            const usuarios = await res.json();
            // Filtrar solo talleres y clientes
            clientesRegistrados = usuarios.filter(u => {
                const r = String(u.rol || '').toUpperCase();
                return r === 'CLIENTE' || r === 'CLIENTE_B2B' || r === 'CLIENTE_B2C';
            });
            poblarSelectClientes();
        }
    } catch (e) {
        console.warn('No se pudo cargar la lista de talleres registrados:', e);
    }
}

/**
 * Puebla el selector de clientes registrados
 */
function poblarSelectClientes() {
    const select = document.getElementById('selectClienteRegistrado');
    if (!select) return;

    select.innerHTML = '<option value="">-- Buscar taller o mecánico registrado --</option>';
    clientesRegistrados.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.nombre} (NIT: ${c.nit || 'S/N'})`;
        select.appendChild(opt);
    });
}

/**
 * Filtra los productos por texto y categoría activa
 */
function obtenerProductosFiltrados() {
    const q = (textoBusqueda || '').toLowerCase().trim();
    return catalogoProductos.filter(p => {
        const matchCat = (categoriaActiva === 'TODOS') || 
            (p.categoria && p.categoria.toUpperCase().trim() === categoriaActiva.toUpperCase().trim());

        if (!matchCat) return false;
        if (!q) return true;

        const nombre = (p.nombre || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const categoria = (p.categoria || '').toLowerCase();
        const espec = (typeof p.especificaciones === 'string' ? p.especificaciones : JSON.stringify(p.especificaciones || '')).toLowerCase();

        return nombre.includes(q) || sku.includes(q) || categoria.includes(q) || espec.includes(q);
    });
}

/**
 * Renderiza el grid de tarjetas de productos en la columna izquierda
 */
function renderizarGridProductos() {
    const grid = document.getElementById('gridProductosVenta');
    const txtContador = document.getElementById('txtContadorResultados');
    if (!grid) return;

    const productos = obtenerProductosFiltrados();

    if (txtContador) {
        txtContador.innerText = `${productos.length} repuesto(s) disponible(s) en almacén`;
    }

    if (productos.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center py-5 text-muted small">
                <i class="bi bi-search fs-3 d-block mb-2 text-secondary opacity-50"></i>
                No se encontraron repuestos con los criterios de búsqueda.
            </div>
        `;
        return;
    }

    grid.innerHTML = productos.map(p => {
        const stock = parseInt(p.stock, 10) || 0;
        const precio = parseFloat(p.precio) || 0;
        const imgUrl = p.imagen_url || './img/Aceite_Sintetico.jpg';
        const estaAgotado = stock <= 0;

        // Badge de stock estilizado
        let badgeStockHTML = '';
        if (stock > 5) {
            badgeStockHTML = `<span class="badge" style="background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0; font-size: 0.68rem;">Stock: ${stock} unids.</span>`;
        } else if (stock > 0) {
            badgeStockHTML = `<span class="badge" style="background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; font-size: 0.68rem;">Bajo stock: ${stock}</span>`;
        } else {
            badgeStockHTML = `<span class="badge" style="background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; font-size: 0.68rem;">Agotado (0)</span>`;
        }

        // Cantidad actual en carrito de este repuesto
        const itemEnCarrito = carritoVenta.find(it => it.id === p.id);
        const cantEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;
        const stockDisponible = stock - cantEnCarrito;

        return `
            <div class="col">
                <div class="pos-card-product p-2 h-100 d-flex flex-column justify-content-between position-relative ${estaAgotado ? 'opacity-75' : ''}" onclick="agregarProductoAVenta(${p.id})">
                    
                    <div>
                        <!-- Imagen con dimensiones fijas y fallback -->
                        <div class="d-flex justify-content-center align-items-center mb-2 bg-light rounded" style="height: 105px; overflow: hidden;">
                            <img src="${imgUrl}" alt="${p.nombre}" class="img-fluid" style="max-height: 95px; object-fit: contain;" onerror="this.src='./img/Aceite_Sintetico.jpg'">
                        </div>

                        <!-- Categoría y SKU -->
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="text-secondary small font-mono" style="font-size: 0.68rem;">${p.sku || 'SKU'}</span>
                            ${badgeStockHTML}
                        </div>

                        <!-- Nombre del producto -->
                        <h6 class="fw-bold text-dark mb-1 text-truncate-2" style="font-size: 0.82rem; min-height: 38px; line-height: 1.25;" title="${p.nombre}">
                            ${p.nombre}
                        </h6>
                    </div>

                    <!-- Precio y Botón Agregar -->
                    <div class="pt-2 border-top mt-2 d-flex justify-content-between align-items-center">
                        <div>
                            <span class="text-secondary small d-block" style="font-size: 0.65rem;">Precio unitario:</span>
                            <span class="fs-6 fw-bold text-danger font-mono" style="font-feature-settings: 'tnum';">
                                Bs. ${precio.toFixed(2)}
                            </span>
                        </div>

                        <button type="button" class="btn btn-sm ${estaAgotado ? 'btn-secondary disabled' : (cantEnCarrito > 0 ? 'btn-danger' : 'btn-outline-danger')} d-flex align-items-center gap-1 py-1 px-2 fw-semibold" style="border-radius: 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); agregarProductoAVenta(${p.id});">
                            <i class="bi ${cantEnCarrito > 0 ? 'bi-check2' : 'bi-plus-lg'}"></i>
                            <span>${cantEnCarrito > 0 ? `${cantEnCarrito} en caja` : 'Agregar'}</span>
                        </button>
                    </div>

                </div>
            </div>
        `;
    }).join('');
}

/**
 * Agrega un producto a la nota de venta actual o incrementa su cantidad
 */
function agregarProductoAVenta(productoId) {
    const prod = catalogoProductos.find(p => p.id === productoId);
    if (!prod) return;

    const maxStock = parseInt(prod.stock, 10) || 0;
    if (maxStock <= 0) {
        Toast.fire({ icon: 'warning', title: `Repuesto agotado en tienda: "${prod.nombre}"` });
        return;
    }

    const itemExistente = carritoVenta.find(it => it.id === productoId);
    if (itemExistente) {
        if (itemExistente.cantidad >= maxStock) {
            Toast.fire({ icon: 'warning', title: `Límite alcanzado: solo quedan ${maxStock} unidades en tienda física.` });
            return;
        }
        itemExistente.cantidad += 1;
    } else {
        carritoVenta.push({
            id: prod.id,
            sku: prod.sku,
            nombre: prod.nombre,
            precio: parseFloat(prod.precio) || 0,
            cantidad: 1,
            maxStock: maxStock
        });
    }

    renderizarCarritoVenta();
    renderizarGridProductos(); // Para actualizar los contadores en las tarjetas
    Toast.fire({ icon: 'success', title: `Agregado: ${prod.nombre}` });
}

/**
 * Modifica la cantidad de un repuesto en la nota de venta
 */
function modificarCantidad(productoId, delta) {
    const item = carritoVenta.find(it => it.id === productoId);
    if (!item) return;

    const nuevaCant = item.cantidad + delta;
    if (nuevaCant <= 0) {
        eliminarItemVenta(productoId);
        return;
    }

    if (nuevaCant > item.maxStock) {
        Toast.fire({ icon: 'warning', title: `No hay más stock en tienda: máximo ${item.maxStock} unids.` });
        return;
    }

    item.cantidad = nuevaCant;
    renderizarCarritoVenta();
    renderizarGridProductos();
}

/**
 * Cambia directamente la cantidad escribiendo en el input
 */
function cambiarCantidadDirecta(productoId, valor) {
    const item = carritoVenta.find(it => it.id === productoId);
    if (!item) return;

    let cant = parseInt(valor, 10);
    if (isNaN(cant) || cant <= 0) cant = 1;
    if (cant > item.maxStock) {
        cant = item.maxStock;
        Toast.fire({ icon: 'warning', title: `Ajustado a existencias máximas: ${item.maxStock} unids.` });
    }

    item.cantidad = cant;
    renderizarCarritoVenta();
    renderizarGridProductos();
}

/**
 * Elimina un ítem de la nota de venta
 */
function eliminarItemVenta(productoId) {
    carritoVenta = carritoVenta.filter(it => it.id !== productoId);
    renderizarCarritoVenta();
    renderizarGridProductos();
}

/**
 * Limpia la venta actual
 */
function limpiarVentaDirecta(preguntar = false) {
    if (preguntar && carritoVenta.length > 0) {
        Swal.fire({
            title: '¿Iniciar nueva venta?',
            text: 'Se limpiará el detalle de la venta actual.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#B91C1C',
            cancelButtonColor: '#64748B',
            confirmButtonText: 'Sí, limpiar',
            cancelButtonText: 'Continuar actual'
        }).then((result) => {
            if (result.isConfirmed) {
                resetearFormularioVenta();
            }
        });
        return;
    }
    resetearFormularioVenta();
}

function resetearFormularioVenta() {
    carritoVenta = [];
    document.getElementById('inputClienteNombre').value = 'Consumidor Final';
    document.getElementById('inputClienteNit').value = '0';
    document.getElementById('inputClienteEmail').value = '';
    document.getElementById('inputMontoRecibido').value = '';
    document.getElementById('txtCambioDevolverBs').innerText = 'Bs. 0.00';
    document.getElementById('radioConsumidorFinal').checked = true;
    cambiarModoCliente('CONSUMIDOR_FINAL');
    seleccionarMetodoPago('EFECTIVO');
    renderizarCarritoVenta();
    renderizarGridProductos();
}

/**
 * Renderiza los ítems agregados y actualiza los cálculos de totales
 */
function renderizarCarritoVenta() {
    const contenedor = document.getElementById('contenedorItemsVenta');
    const badgeCount = document.getElementById('badgeTotalItemsCount');
    const elSubtotal = document.getElementById('vdSubtotalBs');
    const elTotalCobrar = document.getElementById('vdTotalCobrarBs');
    const elQRMontoExacto = document.getElementById('txtQRMontoExacto');

    if (!contenedor) return;

    if (carritoVenta.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-4 text-muted small" id="estadoVentaVacia">
                <i class="bi bi-cart-x fs-3 d-block mb-1 text-secondary opacity-50"></i>
                Aún no has agregado repuestos a esta venta.<br>
                Selecciona del catálogo de la izquierda para comenzar.
            </div>
        `;
        if (badgeCount) badgeCount.innerText = '0 repuestos';
        if (elSubtotal) elSubtotal.innerText = 'Bs. 0.00';
        if (elTotalCobrar) elTotalCobrar.innerText = 'Bs. 0.00';
        if (elQRMontoExacto) elQRMontoExacto.innerText = 'Bs. 0.00';
        calcularCambioEfectivo();
        return;
    }

    let totalVenta = 0;
    let unidadesTotales = 0;

    const filasHTML = carritoVenta.map(it => {
        const subtotal = it.cantidad * it.precio;
        totalVenta += subtotal;
        unidadesTotales += it.cantidad;

        return `
            <div class="pos-item-row p-2 d-flex align-items-center justify-content-between gap-2">
                <div class="flex-grow-1" style="min-width: 0;">
                    <div class="fw-bold text-dark text-truncate" style="font-size: 0.82rem;" title="${it.nombre}">
                        ${it.nombre}
                    </div>
                    <div class="d-flex align-items-center gap-2 text-secondary font-mono" style="font-size: 0.7rem;">
                        <span>${it.sku}</span>
                        <span>•</span>
                        <span>Bs. ${it.precio.toFixed(2)} c/u</span>
                    </div>
                </div>

                <!-- Controles de Cantidad -->
                <div class="d-flex align-items-center gap-1">
                    <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 fw-bold" onclick="modificarCantidad(${it.id}, -1)">-</button>
                    <input type="number" min="1" max="${it.maxStock}" class="form-control form-control-sm text-center font-mono fw-bold py-0 px-1" style="width: 44px; height: 26px; font-size: 0.82rem;" value="${it.cantidad}" onchange="cambiarCantidadDirecta(${it.id}, this.value)">
                    <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 fw-bold" onclick="modificarCantidad(${it.id}, 1)">+</button>
                </div>

                <!-- Subtotal y Eliminar -->
                <div class="text-end" style="min-width: 80px;">
                    <span class="d-block font-mono fw-bold text-danger" style="font-size: 0.85rem;">
                        Bs. ${subtotal.toFixed(2)}
                    </span>
                    <button type="button" class="btn btn-sm py-0 px-1 text-secondary" style="font-size: 0.72rem;" onclick="eliminarItemVenta(${it.id})" title="Quitar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    contenedor.innerHTML = filasHTML;
    if (badgeCount) badgeCount.innerText = `${unidadesTotales} repuesto(s)`;
    if (elSubtotal) elSubtotal.innerText = `Bs. ${totalVenta.toFixed(2)}`;
    if (elTotalCobrar) elTotalCobrar.innerText = `Bs. ${totalVenta.toFixed(2)}`;
    if (elQRMontoExacto) elQRMontoExacto.innerText = `Bs. ${totalVenta.toFixed(2)}`;

    calcularCambioEfectivo();
}

/**
 * Conmuta entre modo Consumidor Final y Taller Registrado
 */
function cambiarModoCliente(modo) {
    modoCliente = modo;
    const secCF = document.getElementById('seccionConsumidorFinal');
    const secTaller = document.getElementById('seccionTallerRegistrado');

    if (modo === 'CONSUMIDOR_FINAL') {
        if (secCF) secCF.classList.remove('d-none');
        if (secTaller) secTaller.classList.add('d-none');
    } else {
        if (secCF) secCF.classList.add('d-none');
        if (secTaller) secTaller.classList.remove('d-none');
    }
}

/**
 * Selecciona un taller registrado desde el select
 */
function seleccionarClienteRegistrado(clienteId) {
    const infoNit = document.getElementById('infoClienteNit');
    const infoEmail = document.getElementById('infoClienteEmail');

    if (!clienteId) {
        if (infoNit) infoNit.innerText = 'NIT: -';
        if (infoEmail) infoEmail.innerText = 'Email: -';
        return;
    }

    const c = clientesRegistrados.find(u => String(u.id) === String(clienteId));
    if (c) {
        if (infoNit) infoNit.innerText = `NIT: ${c.nit || 'S/N'}`;
        if (infoEmail) infoEmail.innerText = `Email: ${c.email || '-'}`;
    }
}

/**
 * Selecciona la forma de pago en tienda
 */
function seleccionarMetodoPago(metodo) {
    metodoPagoActual = metodo;

    ['tabMetodoEfectivo', 'tabMetodoQR', 'tabMetodoTransferencia'].forEach(id => {
        document.getElementById(id)?.classList.remove('active');
    });
    ['panelPagoEfectivo', 'panelPagoQR', 'panelPagoTransferencia'].forEach(id => {
        document.getElementById(id)?.classList.add('d-none');
    });

    if (metodo === 'EFECTIVO') {
        document.getElementById('tabMetodoEfectivo')?.classList.add('active');
        document.getElementById('panelPagoEfectivo')?.classList.remove('d-none');
    } else if (metodo === 'QR_TIENDA') {
        document.getElementById('tabMetodoQR')?.classList.add('active');
        document.getElementById('panelPagoQR')?.classList.remove('d-none');
    } else if (metodo === 'TRANSFERENCIA') {
        document.getElementById('tabMetodoTransferencia')?.classList.add('active');
        document.getElementById('panelPagoTransferencia')?.classList.remove('d-none');
    }
}

/**
 * Calcula el cambio a devolver cuando el pago es en efectivo
 */
function calcularCambioEfectivo() {
    const inputRecibido = document.getElementById('inputMontoRecibido');
    const txtCambio = document.getElementById('txtCambioDevolverBs');
    if (!txtCambio) return;

    let total = 0;
    carritoVenta.forEach(it => total += (it.precio * it.cantidad));

    const recibidoVal = inputRecibido ? parseFloat(inputRecibido.value) : 0;

    if (isNaN(recibidoVal) || recibidoVal <= 0) {
        txtCambio.innerText = 'Bs. 0.00';
        txtCambio.className = 'fs-5 fw-bold font-mono text-secondary';
        return;
    }

    const cambio = recibidoVal - total;
    if (cambio < 0) {
        txtCambio.innerText = `- Bs. ${Math.abs(cambio).toFixed(2)}`;
        txtCambio.className = 'fs-5 fw-bold font-mono text-danger';
    } else {
        txtCambio.innerText = `Bs. ${cambio.toFixed(2)}`;
        txtCambio.className = 'fs-5 fw-bold font-mono text-success';
    }
}

/**
 * Atajos de teclado/botones de billetes bolivianos
 */
function fijarMontoRecibido(monto) {
    const input = document.getElementById('inputMontoRecibido');
    if (!input) return;

    if (monto === 'EXACTO') {
        let total = 0;
        carritoVenta.forEach(it => total += (it.precio * it.cantidad));
        input.value = total.toFixed(2);
    } else {
        input.value = parseFloat(monto).toFixed(2);
    }
    calcularCambioEfectivo();
}

/**
 * Filtra por categoría
 */
function filtrarPorCategoria(categoria, boton) {
    categoriaActiva = categoria;
    const contenedor = document.getElementById('contenedorFiltrosCategoria');
    if (contenedor) {
        contenedor.querySelectorAll('.filter-pill-btn').forEach(b => {
            b.classList.remove('active', 'btn-danger');
            b.classList.add('btn-outline-secondary');
        });
    }
    if (boton) {
        boton.classList.add('active');
        boton.classList.remove('btn-outline-secondary');
    }
    renderizarGridProductos();
}

/**
 * Limpia la búsqueda
 */
function limpiarBusqueda() {
    const input = document.getElementById('inputBuscarRepuesto');
    if (input) {
        input.value = '';
        textoBusqueda = '';
        document.getElementById('btnLimpiarBusqueda')?.classList.add('d-none');
        renderizarGridProductos();
    }
}

/**
 * Configura los eventos de inputs y atajos de teclado
 */
function configurarEventos() {
    const inputBusqueda = document.getElementById('inputBuscarRepuesto');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', (e) => {
            textoBusqueda = e.target.value;
            const btnLimpiar = document.getElementById('btnLimpiarBusqueda');
            if (btnLimpiar) {
                if (textoBusqueda.length > 0) btnLimpiar.classList.remove('d-none');
                else btnLimpiar.classList.add('d-none');
            }
            renderizarGridProductos();
        });
    }

    // Atajos de teclado: F9 para Registrar Venta, Esc para limpiar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            e.preventDefault();
            ejecutarVentaDirecta();
        } else if (e.key === 'Escape') {
            // Si el modal está abierto no limpiar
            const modal = document.getElementById('modalVentaDirectaExitosa');
            if (!modal || !modal.classList.contains('show')) {
                limpiarVentaDirecta(true);
            }
        }
    });
}

/**
 * Ejecuta el registro de la venta directa enviando los datos al backend
 */
async function ejecutarVentaDirecta() {
    if (carritoVenta.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Venta Vacía',
            text: 'Agrega al menos un repuesto a la nota de venta antes de registrar el cobro.',
            confirmButtonColor: '#B91C1C'
        });
        return;
    }

    let totalVenta = 0;
    carritoVenta.forEach(it => totalVenta += (it.precio * it.cantidad));

    // Determinar datos del cliente
    let clienteNombre = 'Consumidor Final';
    let clienteNit = '0';
    let clienteEmail = '';
    let clienteId = null;

    if (modoCliente === 'CONSUMIDOR_FINAL') {
        clienteNombre = (document.getElementById('inputClienteNombre')?.value || '').trim() || 'Consumidor Final';
        clienteNit = (document.getElementById('inputClienteNit')?.value || '').trim() || '0';
        clienteEmail = (document.getElementById('inputClienteEmail')?.value || '').trim();
    } else {
        const select = document.getElementById('selectClienteRegistrado');
        clienteId = select ? select.value : null;
        if (!clienteId) {
            Swal.fire({
                icon: 'warning',
                title: 'Seleccione un Taller',
                text: 'Por favor seleccione el taller o mecánico registrado en la base de datos.',
                confirmButtonColor: '#B91C1C'
            });
            return;
        }
        const c = clientesRegistrados.find(u => String(u.id) === String(clienteId));
        if (c) {
            clienteNombre = c.nombre;
            clienteNit = c.nit || 'S/N';
            clienteEmail = c.email || '';
        }
    }

    // Validar pago en efectivo
    let montoRecibido = totalVenta;
    let cambio = 0;

    if (metodoPagoActual === 'EFECTIVO') {
        const inputRecibido = document.getElementById('inputMontoRecibido');
        const valRecibido = inputRecibido ? parseFloat(inputRecibido.value) : totalVenta;
        if (isNaN(valRecibido) || valRecibido < totalVenta) {
            Swal.fire({
                icon: 'warning',
                title: 'Monto Recibido Insuficiente',
                text: `El total a cobrar es de Bs. ${totalVenta.toFixed(2)}. Ingrese el monto entregado por el cliente.`,
                confirmButtonColor: '#B91C1C'
            });
            return;
        }
        montoRecibido = valRecibido;
        cambio = parseFloat((montoRecibido - totalVenta).toFixed(2));
    }

    const payload = {
        cliente_nombre: clienteNombre,
        nit_ci: clienteNit,
        cliente_email: clienteEmail,
        cliente_id: clienteId,
        items: carritoVenta.map(it => ({
            producto_id: it.id,
            cantidad: it.cantidad,
            precio: it.precio
        })),
        metodo_pago: metodoPagoActual,
        monto_recibido: montoRecibido,
        cambio: cambio,
        observaciones: (document.getElementById('inputRefTransferencia')?.value || '').trim() || 'Venta presencial mostrador'
    };

    const btn = document.getElementById('btnRegistrarVentaDirecta');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Registrando venta...`;
    }

    try {
        const res = await fetch(`${API_URL}/ventas/directa`, {
            method: 'POST',
            headers: obtenerHeadersAuth(),
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Ocurrió un error al registrar la venta');
        }

        // Guardar referencia para PDF y comprobantes
        ultimaVentaRealizada = {
            ...data,
            items: [...carritoVenta]
        };

        // Mostrar Modal de Éxito
        mostrarModalExito(ultimaVentaRealizada);

        // Recargar inventario para actualizar stocks de inmediato
        cargarProductosTienda();

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'No se pudo registrar la venta',
            text: err.message,
            confirmButtonColor: '#B91C1C'
        });
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="bi bi-check2-circle fs-5"></i><span>Registrar Venta Directa</span>`;
        }
    }
}

/**
 * Muestra el modal de confirmación con los datos de la venta completada
 */
function mostrarModalExito(venta) {
    document.getElementById('modalVentaCodigo').innerText = venta.codigo_pedido || `PED-${venta.pedido_id}`;
    document.getElementById('modalVentaCliente').innerText = venta.cliente_nombre || 'Consumidor Final';
    document.getElementById('modalVentaNit').innerText = venta.nit_ci || '0';
    document.getElementById('modalVentaMetodo').innerText = venta.metodo_pago || 'EFECTIVO';
    document.getElementById('modalVentaTotal').innerText = `Bs. ${parseFloat(venta.total).toFixed(2)}`;

    const filaCambio = document.getElementById('filaModalCambio');
    const elCambio = document.getElementById('modalVentaCambio');
    if (venta.metodo_pago === 'EFECTIVO') {
        if (filaCambio) filaCambio.classList.remove('d-none');
        if (elCambio) elCambio.innerText = `Bs. ${parseFloat(venta.cambio || 0).toFixed(2)}`;
    } else {
        if (filaCambio) filaCambio.classList.add('d-none');
    }

    const modalEl = document.getElementById('modalVentaDirectaExitosa');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

/**
 * Cierra el modal y deja la caja lista para la siguiente venta
 */
function cerrarModalYNuevaVenta() {
    const modalEl = document.getElementById('modalVentaDirectaExitosa');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    resetearFormularioVenta();
}

/**
 * Imprime o descarga la Nota de Venta oficial en PDF
 */
function imprimirNotaVentaActual() {
    if (!ultimaVentaRealizada) return;

    const pedido = {
        id: ultimaVentaRealizada.pedido_id,
        total: ultimaVentaRealizada.total,
        fecha_compra: ultimaVentaRealizada.fecha || new Date().toISOString(),
        metodo_pago: ultimaVentaRealizada.metodo_pago,
        comprobante_ref: `VD-${ultimaVentaRealizada.pedido_id}`,
        numero_operacion: `VD-${ultimaVentaRealizada.pedido_id}`,
        detalles: (ultimaVentaRealizada.items || []).map(it => ({
            sku: it.sku,
            producto_nombre: it.nombre,
            cantidad: it.cantidad,
            precio_unitario: it.precio,
            subtotal: it.cantidad * it.precio
        }))
    };

    const cliente = {
        id: 999,
        nombre: ultimaVentaRealizada.cliente_nombre || 'Consumidor Final',
        nit: ultimaVentaRealizada.nit_ci || '0',
        direccion: 'Tienda Física Sucre',
        telefono: 'Venta Mostrador',
        email: ultimaVentaRealizada.cliente_email || '-'
    };

    if (typeof window.generarFacturaNotaEntregaHTML === 'function') {
        const html = window.generarFacturaNotaEntregaHTML(pedido, cliente, 'NOTA DE VENTA');
        const cont = document.getElementById('contenedorRenderFactura');
        if (cont) {
            cont.innerHTML = html;
        }

        if (typeof window.imprimirDocumento === 'function') {
            window.imprimirDocumento(html, `Nota_Venta_GOLDEN_PED-${pedido.id}`);
        } else {
            window.print();
        }
    } else {
        window.print();
    }
}
