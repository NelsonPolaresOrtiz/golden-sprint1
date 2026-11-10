/**
 * ERP GOLDEN - Módulo de Tienda VIP B2B/B2C, Factura Flotante, QR y WhatsApp
 */
const API_URL = '/api';
const FALLBACK_IMG_OFFLINE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23f8fafc'/><rect x='10' y='10' width='380' height='280' fill='none' stroke='%23cbd5e1' stroke-dasharray='6 6' rx='8'/><text x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='16' font-weight='bold'>REPUESTO AUTOMOTRIZ</text><text x='50%25' y='58%25' dominant-baseline='middle' text-anchor='middle' fill='%23d97706' font-family='sans-serif' font-size='13' font-weight='600'>GOLDEN ERP</text></svg>";
let productosTienda = [];
let carrito = [];
let categoriaActual = 'Todos';

// Helper Toast con SweetAlert2 para notificaciones flotantes modernas
const Toast = window.Toast || (typeof Swal !== 'undefined' ? Swal.mixin({
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
}) : {
    fire: ({ title }) => alert(title)
});

document.addEventListener('DOMContentLoaded', () => {
    const usuario = protegerRuta('tienda');
    if (!usuario) return;

    renderizarMenu('tienda');
    cargarCatalogo();
});

// ==========================================
// 1. CARGA Y RENDERIZADO DEL CATÁLOGO VIP
// ==========================================
async function cargarCatalogo() {
    const contenedor = document.getElementById('catalogoProductos');
    contenedor.innerHTML = '<div class="col-12 text-center py-5"><span class="spinner-border spinner-border-sm text-warning me-2"></span><span class="text-secondary">Cargando catálogo oficial...</span></div>';

    try {
        const res = await fetch(`${API_URL}/productos?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar productos');
        productosTienda = await res.json();
        renderizarCatalogo();
    } catch (error) {
        console.error("Error al cargar catálogo:", error);
        contenedor.innerHTML = '<div class="col-12 text-center py-5 text-danger"><i class="bi bi-exclamation-triangle me-1"></i>Error al conectar con el servidor de inventario.</div>';
        Toast.fire({ icon: 'error', title: 'Error al cargar catálogo de productos' });
    }
}

let productoFichaActual = null;

function renderizarCatalogo() {
    // 1. Definición de Arrays de Imágenes Locales (100% Offline)
    const imgsAceite = ['Aceite_Sintetico.jpg', 'Aceite_Sintetico1.jpg', 'Aceite_Sintetico2.jpg', 'Aceite_Sintetico3.jpg', 'Aceite_Sintetico4.jpg', 'Aceite_Sintetico5.jpg', 'Aceite_Sintetico6.jpg', 'Aceite_Sintetico7.jpg'];
    const imgsFiltroAceite = ['Filtro_de_Aceite.jpg', 'Filtro_de_Aceite1.jpg', 'Filtro_de_Aceite2.jpg', 'Filtro_de_Aceite3.jpg', 'Filtro_de_Aceite4.jpg', 'Filtro_de_Aceite5.jpg', 'Filtro_de_Aceite6.jpg'];
    const imgsFiltroAire = ['Filtro_de_Aire3.jpg', 'Filtro_de_Aire4.jpg', 'Filtro_de_Aire5.jpg', 'Filtro_de_Aire6.jpg', 'Filtros_de_Aire.jpg', 'Filtros_de_Aire1.jpg', 'Filtros_de_Aire2.jpg'];
    const imgsGrasa = ['Grasa_Minerales.jpg', 'Grasa_Minerales1.jpg', 'Grasa_Minerales2.jpg', 'Grasa_Minerales3.jpg', 'Grasa_Minerales4.jpg', 'Grasa_Minerales5.jpg', 'Grasa_Minerales6.jpg'];

    const contenedor = document.getElementById('catalogoProductos');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    let productosFiltrados = productosTienda;
    if (categoriaActual !== 'Todos') {
        productosFiltrados = productosTienda.filter(p => p.categoria === categoriaActual);
    }

    if (productosFiltrados.length === 0) {
        contenedor.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-box-seam display-1 text-muted d-block mb-3 opacity-50"></i>
                <h4 class="text-white fw-bold">No se encontraron repuestos en esta categoría</h4>
                <p class="text-secondary small">Selecciona otra categoría o registra productos en el módulo de Inventario.</p>
            </div>`;
        return;
    }

    let html = '';
    productosFiltrados.forEach((producto, index) => {
        // 2. Lógica de asignación dinámica evaluando estrictamente el nombre del producto
        const nombreProd = (producto.nombre || '').toLowerCase();
        let rutaImg = '';

        if (nombreProd.includes('filtro de aceite')) {
            rutaImg = './img/' + imgsFiltroAceite[index % imgsFiltroAceite.length];
        } else if (nombreProd.includes('aire') || nombreProd.includes('cabina')) {
            rutaImg = './img/' + imgsFiltroAire[index % imgsFiltroAire.length];
        } else if ((nombreProd.includes('aceite') || nombreProd.includes('mineral') || nombreProd.includes('sintético') || nombreProd.includes('sintetico')) && !nombreProd.includes('freno')) {
            rutaImg = './img/' + imgsAceite[index % imgsAceite.length];
        } else {
            // Para cualquier otro producto (grasa, refrigerante, frenos, aditivo)
            rutaImg = './img/' + imgsGrasa[index % imgsGrasa.length];
        }

        producto.rutaImg = rutaImg;
        const p = producto;

        const sinStock = p.stock <= 0;
        const botonHTML = sinStock
            ? `<button class="btn btn-secondary w-100 fw-bold rounded-3 opacity-50 btn-sm py-2" disabled><i class="bi bi-x-circle me-1"></i> Agotado</button>`
            : `<button class="btn btn-vip-gold w-100 fw-bold shadow-sm text-dark btn-sm py-2" onclick="event.stopPropagation(); agregarAlCarrito(${p.id})"><i class="bi bi-bag-plus-fill me-1"></i> Añadir a la Orden</button>`;

        const badgeStock = sinStock
            ? '<span class="badge-pill-vip badge-pill-ruby">Agotado</span>'
            : (p.stock <= p.stock_minimo
                ? `<span class="badge-pill-vip badge-pill-gold"><span class="pulse-dot pulse-dot-gold me-1"></span>¡Últimas ${p.stock}!</span>`
                : `<span class="badge-pill-vip badge-pill-emerald"><span class="pulse-dot pulse-dot-emerald me-1"></span>Stock: ${p.stock}</span>`);

        let sublinea = p.categoria;
        try {
            if (p.especificaciones) {
                const sp = typeof p.especificaciones === 'string' ? JSON.parse(p.especificaciones) : p.especificaciones;
                if (sp.tipo) sublinea = sp.tipo;
            }
        } catch (e) {}

        const nombreEscapado = escaparHTML(p.nombre);

        html += `
            <div class="col-sm-6 col-md-4 col-lg-3">
                <div class="card-producto-wix h-100 d-flex flex-column" onclick="abrirFichaTecnica(${p.id})" title="Clic para abrir Ficha Técnica Completa (WIX Style)">
                    
                    <!-- Imagen del Repuesto Centrada con Fondo Blanco de Alto Contraste -->
                    <div class="wix-img-wrapper" style="background-color: #ffffff; border-radius: 8px 8px 0 0; overflow: hidden; position: relative;">
                        <img src="${rutaImg}" alt="${nombreEscapado}" onerror="this.onerror=null; this.src=FALLBACK_IMG_OFFLINE;" style="object-fit: contain; height: 160px; width: 100%; padding: 10px; background-color: #ffffff; border-radius: 8px 8px 0 0;">
                        <div class="position-absolute top-0 start-0 m-2">
                            <span class="badge bg-dark bg-opacity-75 text-warning font-monospace px-2 py-1 border border-secondary border-opacity-25 small" style="font-size: 0.68rem;">
                                ${p.sku}
                            </span>
                        </div>
                        <div class="position-absolute top-0 end-0 m-2">
                            ${badgeStock}
                        </div>
                    </div>

                    <!-- Cuerpo de la Tarjeta con Flexbox Vertical -->
                    <div class="p-3 d-flex flex-column flex-grow-1">
                        <span class="badge-pill-vip badge-pill-slate small align-self-start mb-2" style="font-size: 0.68rem;">
                            ${p.categoria}
                        </span>

                        <h5 class="fw-bold text-white mb-1" style="font-size: 0.95rem; line-height: 1.35; min-height: 2.6rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${escaparHTML(p.nombre)}">
                            ${escaparHTML(p.nombre)}
                        </h5>

                        <p class="text-secondary small mb-3 text-truncate" style="font-size: 0.78rem;">
                            ${escaparHTML(sublinea)}
                        </p>

                        <!-- Bloque de Precio y Botón de Compra -->
                        <div class="mt-auto border-top border-secondary border-opacity-25 pt-2 mb-2">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div>
                                    <span class="text-secondary d-block" style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase;">Mayorista B2B</span>
                                    <h4 class="text-gradient-emerald fw-extrabold mb-0" style="font-size: 1.25rem;">Bs. ${parseFloat(p.precio).toFixed(2)}</h4>
                                </div>
                                <span class="badge bg-dark text-secondary border border-secondary border-opacity-25 small" style="font-size: 0.68rem;">IVA Inc.</span>
                            </div>
                            ${botonHTML}
                        </div>
                    </div>

                    <!-- Bloque Inferior del SKU Interactivo con Hover Puro -->
                    <div class="wix-sku-bar">
                        <span class="wix-sku-label">
                            <i class="bi bi-upc-scan me-1"></i>${p.sku}
                        </span>
                        <span class="wix-sku-action">
                            Ficha Técnica <i class="bi bi-arrow-right-short fs-5"></i>
                        </span>
                    </div>

                </div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}

function filtrarCategoria(categoria, botonElemento) {
    categoriaActual = categoria;
    document.querySelectorAll('.btn-filter-vip').forEach(btn => btn.classList.remove('active'));
    botonElemento.classList.add('active');
    renderizarCatalogo();
}

/**
 * =========================================================================
 * 2. MODAL DE FICHA TÉCNICA (EFECTO WOW ESTILO WIX FILTERS)
 * =========================================================================
 */
function abrirFichaTecnica(idProducto) {
    const producto = productosTienda.find(p => p.id === idProducto);
    if (!producto) return;
    productoFichaActual = producto;

    let specs = null;
    try {
        specs = typeof producto.especificaciones === 'string' ? JSON.parse(producto.especificaciones) : producto.especificaciones;
    } catch (e) {
        specs = null;
    }

    if (!specs) {
        specs = generarEspecificacionesPorDefecto(producto);
    }

    // 1. Datos básicos de cabecera
    const elSku = document.getElementById('fichaModalSku');
    const elCat = document.getElementById('fichaModalCategoria');
    const elTit = document.getElementById('fichaModalTitulo');
    const elPre = document.getElementById('fichaModalPrecio');
    const elImg = document.getElementById('fichaModalImagen');

    if (elSku) elSku.innerText = producto.sku;
    if (elCat) elCat.innerText = producto.categoria;
    if (elTit) elTit.innerText = producto.nombre;
    if (elPre) elPre.innerText = `Bs. ${parseFloat(producto.precio).toFixed(2)}`;
    if (elImg) {
        const urlModal = producto.rutaImg || obtenerImagenRespaldo(producto.nombre, producto.categoria, producto.imagen_url);
        elImg.src = urlModal;
        elImg.alt = producto.nombre;
        elImg.onerror = function() {
            this.onerror = null;
            this.src = FALLBACK_IMG_OFFLINE;
        };
        elImg.style = "object-fit: contain; height: 230px; width: 100%; padding: 10px; background-color: #ffffff; border-radius: 8px;";
    }

    // 2. Stock y Disponibilidad
    const sinStock = producto.stock <= 0;
    const badgeStock = sinStock
        ? '<span class="badge-pill-vip badge-pill-ruby">Agotado</span>'
        : (producto.stock <= producto.stock_minimo
            ? `<span class="badge-pill-vip badge-pill-gold"><span class="pulse-dot pulse-dot-gold me-1"></span>¡Últimas ${producto.stock}!</span>`
            : `<span class="badge-pill-vip badge-pill-emerald"><span class="pulse-dot pulse-dot-emerald me-1"></span>Stock: ${producto.stock} unid.</span>`);
    
    const elBadgeStock = document.getElementById('fichaModalBadgeStock');
    const elStockMax = document.getElementById('fichaModalStockMax');
    if (elBadgeStock) elBadgeStock.innerHTML = badgeStock;
    if (elStockMax) elStockMax.innerText = `(${producto.stock} disponibles)`;

    // 3. Selector de cantidad
    const inputCant = document.getElementById('fichaInputCantidad');
    if (inputCant) {
        inputCant.value = 1;
        inputCant.max = producto.stock;
        inputCant.disabled = sinStock;
    }

    // 4. Botón Agregar a la Orden dentro del Modal
    const btnAgregar = document.getElementById('btnFichaAgregarCarrito');
    if (btnAgregar) {
        if (sinStock) {
            btnAgregar.disabled = true;
            btnAgregar.className = 'btn btn-secondary w-100 py-3 fw-bold fs-5 rounded-3 opacity-50';
            btnAgregar.innerHTML = '<i class="bi bi-x-circle me-1"></i> Sin Stock Disponible';
        } else {
            btnAgregar.disabled = false;
            btnAgregar.className = 'btn btn-vip-gold w-100 py-3 fw-extrabold fs-5 shadow-lg rounded-3 d-flex align-items-center justify-content-center gap-2 text-dark';
            btnAgregar.innerHTML = '<i class="bi bi-bag-plus-fill fs-4"></i><span>Añadir a la Orden</span>';
            btnAgregar.onclick = () => {
                const cant = parseInt(inputCant ? inputCant.value : 1) || 1;
                agregarAlCarrito(producto.id, cant);
                const modalEl = document.getElementById('modalFichaTecnica');
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
            };
        }
    }

    // 5. Tabla de Especificaciones
    const tbodySpecs = document.getElementById('fichaModalEspecificaciones');
    if (tbodySpecs) {
        let specsHTML = '';
        if (specs.tipo) specsHTML += `<tr><td class="spec-key"><i class="bi bi-tag text-warning me-2"></i>Tipo de Repuesto</td><td class="spec-val">${escaparHTML(specs.tipo)}</td></tr>`;
        if (specs.filtracion) specsHTML += `<tr><td class="spec-key"><i class="bi bi-funnel text-warning me-2"></i>Filtración / Grado</td><td class="spec-val">${escaparHTML(specs.filtracion)}</td></tr>`;
        if (specs.empaque) specsHTML += `<tr><td class="spec-key"><i class="bi bi-box-seam text-warning me-2"></i>Empaque Master</td><td class="spec-val">${escaparHTML(specs.empaque)}</td></tr>`;

        if (specs.dimensiones && typeof specs.dimensiones === 'object') {
            for (const [key, val] of Object.entries(specs.dimensiones)) {
                const keyFormateada = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                specsHTML += `<tr><td class="spec-key"><i class="bi bi-arrows-angle-expand text-warning me-2"></i>${keyFormateada}</td><td class="spec-val font-monospace">${escaparHTML(String(val))}</td></tr>`;
            }
        }
        tbodySpecs.innerHTML = specsHTML;
    }

    // 6. Código de Barras
    const barcodeCode = specs.codigo_barras || ('775' + String(producto.id).padStart(9, '0') + '1');
    const elBarcodeVis = document.getElementById('fichaModalBarcodeVisual');
    const elBarcodeTxt = document.getElementById('fichaModalBarcodeTexto');
    if (elBarcodeVis) elBarcodeVis.innerText = `*${barcodeCode}*`;
    if (elBarcodeTxt) elBarcodeTxt.innerText = barcodeCode;

    // 7. Aplicaciones Vehiculares
    const tbodyApp = document.getElementById('fichaModalAplicaciones');
    if (tbodyApp) {
        const aplicaciones = Array.isArray(specs.aplicaciones) ? specs.aplicaciones : [];
        if (aplicaciones.length === 0) {
            tbodyApp.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-secondary small">Aplicación universal para motores de combustión interna según norma de viscosidad.</td></tr>`;
        } else {
            tbodyApp.innerHTML = aplicaciones.map(a => `
                <tr>
                    <td class="ps-3 fw-bold text-white"><i class="bi bi-car-front text-warning me-2"></i>${escaparHTML(a.marca)}</td>
                    <td class="text-light">${escaparHTML(a.modelo)}</td>
                    <td class="font-monospace text-secondary">${escaparHTML(a.motor)}</td>
                    <td class="text-end pe-3 font-monospace text-warning">${escaparHTML(a.anios)}</td>
                </tr>
            `).join('');
        }
    }

    // 8. Equivalencias / Intercambios OEM
    const tbodyEquiv = document.getElementById('fichaModalEquivalencias');
    if (tbodyEquiv) {
        const equivalencias = Array.isArray(specs.equivalencias) ? specs.equivalencias : [];
        if (equivalencias.length === 0) {
            tbodyEquiv.innerHTML = `<tr><td colspan="3" class="text-center py-3 text-secondary small">Reemplazo directo para números de parte estándar de equipo original.</td></tr>`;
        } else {
            tbodyEquiv.innerHTML = equivalencias.map(eq => `
                <tr>
                    <td class="ps-3 fw-bold text-white"><i class="bi bi-patch-check text-success me-2"></i>${escaparHTML(eq.marca)}</td>
                    <td class="font-monospace text-warning fw-bold fs-6">${escaparHTML(eq.codigo)}</td>
                    <td class="text-end pe-3 small text-secondary">Intercambio Directo Homologado</td>
                </tr>
            `).join('');
        }
    }

    // 9. Mostrar Modal
    const modalEl = document.getElementById('modalFichaTecnica');
    if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

function ajustarCantidadFicha(delta) {
    const input = document.getElementById('fichaInputCantidad');
    if (!input || !productoFichaActual) return;
    let actual = parseInt(input.value) || 1;
    let nuevo = actual + delta;
    if (nuevo < 1) nuevo = 1;
    if (nuevo > productoFichaActual.stock) nuevo = productoFichaActual.stock;
    input.value = nuevo;
}

function generarEspecificacionesPorDefecto(p) {
    const cat = (p.categoria || '').toLowerCase();
    const esFiltro = cat.includes('filtro');
    const esAceite = cat.includes('aceite');

    return {
        tipo: esFiltro ? 'Filtro Blindado de Alta Eficiencia (Spin-on)' : (esAceite ? 'Lubricante Multigrado de Alto Rendimiento' : 'Repuesto Automotriz Homologado'),
        filtracion: esFiltro ? '21 Micrones (Eficiencia Beta 99%)' : 'Viscosidad Cinemática Optimizada para Alta Presión',
        empaque: '12 Unidades / Caja Master',
        dimensiones: {
            alto: '82 mm',
            diametro_exterior: '68 mm',
            rosca: '3/4-16 UNF / M20'
        },
        codigo_barras: '775' + String(p.id).padStart(9, '0') + '1',
        aplicaciones: [
            { marca: 'Toyota', modelo: 'Hilux / Corolla / RAV4', motor: '1GD / 2ZR', anios: '2015 - 2024' },
            { marca: 'Nissan', modelo: 'Frontier / Sentra / Versa', motor: 'YD25 / HR16', anios: '2014 - 2023' }
        ],
        equivalencias: [
            { marca: 'WIX Filters', codigo: 'WIX-' + p.sku.replace(/\D/g, '').padEnd(5, '0') },
            { marca: 'MANN-FILTER', codigo: 'W ' + p.id + '/80' },
            { marca: 'OEM SPEC', codigo: 'OEM-' + p.sku }
        ]
    };
}

/**
 * Mapeo de Imágenes de Respaldo Dinámicas Seguras para Localhost:
 * Si el producto no tiene una imagen válida o proviene de servidores con bloqueo CORS (como Amazon),
 * le asigna automáticamente un servicio compatible con localhost ('placehold.co' / 'loremflickr.com').
 */
function obtenerImagenRespaldo(nombre = '', categoria = '', imagenUrl = null) {
    // Si la imagen viene de Amazon o placeholder, descartarla para priorizar fotos locales
    if (imagenUrl && typeof imagenUrl === 'string' && imagenUrl.trim().length > 10) {
        const urlLimpia = imagenUrl.trim();
        if (!urlLimpia.includes('media-amazon.com') && !urlLimpia.includes('amazon.') && !urlLimpia.includes('placehold.co')) {
            return urlLimpia;
        }
    }

    const nombreProd = (nombre || '').toLowerCase();

    // 1. Filtros de Aceite
    if (nombreProd.includes('filtro de aceite')) {
        return './img/Filtro_de_Aceite.jpg';
    }
    // 2. Filtros de Aire / Cabina
    if (nombreProd.includes('aire') || nombreProd.includes('cabina')) {
        return './img/Filtros_de_Aire.jpg';
    }
    // 3. Aceite Sintético o Mineral
    if ((nombreProd.includes('aceite') || nombreProd.includes('mineral') || nombreProd.includes('sintético') || nombreProd.includes('sintetico')) && !nombreProd.includes('freno')) {
        return './img/Aceite_Sintetico.jpg';
    }

    // 4. Para cualquier otro producto (grasa, refrigerante, frenos, aditivo)
    return './img/Grasa_Minerales.jpg';
}

function handleImageError(img) {
    if (!img) return;
    img.onerror = null; // Evitar ciclos infinitos
    img.src = 'https://placehold.co/400x300/ffffff/1e293b?text=Imagen+No+Disponible';
}

// ==========================================
// 3. GESTIÓN DEL CARRITO (FACTURA FLOTANTE)
// ==========================================
function agregarAlCarrito(idProducto, cantidadDeseada = 1) {
    const producto = productosTienda.find(p => p.id === idProducto);
    if (!producto || producto.stock <= 0) {
        Toast.fire({ icon: 'warning', title: 'Este repuesto no tiene existencias disponibles' });
        return;
    }

    const itemExistente = carrito.find(item => item.id === idProducto);
    const cantAgregar = Math.max(1, parseInt(cantidadDeseada) || 1);

    if (itemExistente) {
        if (itemExistente.cantidad + cantAgregar > producto.stock) {
            Toast.fire({ icon: 'warning', title: `Límite alcanzado: máximo ${producto.stock} unid. disponibles` });
            return;
        }
        itemExistente.cantidad += cantAgregar;
        Toast.fire({ icon: 'success', title: `+${cantAgregar} unidades añadidas (${itemExistente.cantidad} en orden)` });
    } else {
        if (cantAgregar > producto.stock) {
            Toast.fire({ icon: 'warning', title: `Solo hay ${producto.stock} unidades en stock` });
            return;
        }
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            sku: producto.sku,
            precio: parseFloat(producto.precio),
            stockMaximo: producto.stock,
            cantidad: cantAgregar
        });
        Toast.fire({ icon: 'success', title: `${cantAgregar > 1 ? cantAgregar + ' unidades añadidas' : 'Repuesto añadido'} a la orden` });
    }

    actualizarCarrito();

    const panel = document.getElementById('carritoLateral');
    if (panel) {
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(panel) || new bootstrap.Offcanvas(panel);
        bsOffcanvas.show();
    }
}

function modificarCantidad(idProducto, delta) {
    const item = carrito.find(i => i.id === idProducto);
    if (!item) return;

    const nuevaCantidad = item.cantidad + delta;
    if (nuevaCantidad <= 0) {
        eliminarDelCarrito(idProducto);
        return;
    }

    if (nuevaCantidad > item.stockMaximo) {
        Toast.fire({ icon: 'warning', title: `Límite alcanzado (${item.stockMaximo} unid. en stock)` });
        return;
    }

    item.cantidad = nuevaCantidad;
    actualizarCarrito();
}

function eliminarDelCarrito(idProducto) {
    const item = carrito.find(i => i.id === idProducto);
    carrito = carrito.filter(item => item.id !== idProducto);
    actualizarCarrito();
    if (item) {
        Toast.fire({ icon: 'info', title: `"${item.nombre}" removido de la orden` });
    }
}

function actualizarCarrito() {
    const lista = document.getElementById('listaCarrito');
    const contador = document.getElementById('contadorCarrito');
    const subtotalElemento = document.getElementById('subtotalCarrito');
    const totalElemento = document.getElementById('totalCarrito');

    lista.innerHTML = '';
    let total = 0;
    let cantidadTotal = 0;

    if (carrito.length === 0) {
        lista.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-cart-x display-3 d-block mb-3 opacity-30 text-secondary"></i>
                <h6 class="fw-bold text-white">Tu orden está vacía</h6>
                <p class="small text-secondary">Selecciona repuestos desde el catálogo para generar un despacho comercial.</p>
            </div>`;
        if (contador) contador.innerText = '0';
        if (subtotalElemento) subtotalElemento.innerText = 'Bs. 0.00';
        totalElemento.innerText = 'Bs. 0.00';
        return;
    }

    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        cantidadTotal += item.cantidad;

        lista.innerHTML += `
            <div class="receipt-item-card">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h6 class="mb-0 fw-bold text-white" style="font-size: 0.95rem;">${item.nombre}</h6>
                        <small class="text-warning font-monospace" style="font-size: 0.72rem;">${item.sku} • Bs. ${item.precio.toFixed(2)} c/u</small>
                    </div>
                    <button class="btn btn-sm text-danger p-0 border-0" onclick="eliminarDelCarrito(${item.id})" title="Quitar">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-vip-outline px-2 py-0" onclick="modificarCantidad(${item.id}, -1)">-</button>
                        <span class="btn btn-dark text-white fw-bold px-3 py-0 disabled border border-secondary border-opacity-25">${item.cantidad}</span>
                        <button type="button" class="btn btn-vip-outline px-2 py-0" onclick="modificarCantidad(${item.id}, 1)">+</button>
                    </div>
                    <span class="fw-bold text-success fs-6">Bs. ${subtotal.toFixed(2)}</span>
                </div>
            </div>
        `;
    });

    if (contador) contador.innerText = cantidadTotal;
    if (subtotalElemento) subtotalElemento.innerText = `Bs. ${total.toFixed(2)}`;
    totalElemento.innerText = `Bs. ${total.toFixed(2)}`;
}

// ==========================================
// 3. PROCESAR VENTA ATÓMICA CON FEEDBACK Y LOADING STATE
// ==========================================
async function procesarCompra() {
    if (carrito.length === 0) {
        Toast.fire({ icon: 'warning', title: 'La orden está vacía. Añade productos antes de confirmar.' });
        return;
    }

    let totalVenta = 0;
    carrito.forEach(item => {
        totalVenta += (item.precio * item.cantidad);
    });
    totalVenta = parseFloat(totalVenta.toFixed(2));

    const usuario = obtenerUsuarioSesion();
    if (!usuario) {
        Toast.fire({ icon: 'error', title: 'Sesión no válida. Inicia sesión nuevamente.' });
        window.location.href = 'index.html';
        return;
    }

    const payload = {
        cliente_id: usuario.id,
        total: totalVenta,
        carrito: carrito.map(item => ({
            id: item.id,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad
        }))
    };

    const btnConfirmar = document.getElementById('btnConfirmarCompra');
    const contenidoOriginalBtn = btnConfirmar ? btnConfirmar.innerHTML : '';

    // Protección contra doble clic y spinner de carga
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Procesando Compra...`;
    }

    try {
        const res = await fetch(`${API_URL}/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
            Toast.fire({ icon: 'error', title: data.error || 'No se pudo completar la compra' });
            return;
        }

        Toast.fire({ icon: 'success', title: '¡Compra confirmada y registrada en SQLite!' });

        const panel = document.getElementById('carritoLateral');
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(panel);
        if (bsOffcanvas) bsOffcanvas.hide();

        abrirModalConfirmacion(data.pedidoId, usuario, carrito, totalVenta);

        carrito = [];
        actualizarCarrito();
        cargarCatalogo();

    } catch (error) {
        console.error("Error al procesar compra:", error);
        Toast.fire({ icon: 'error', title: 'Error de conexión con el servidor ERP' });
    } finally {
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = contenidoOriginalBtn;
        }
    }
}

// =========================================================
// 4. GENERACIÓN DE QR Y ENLACE COMERCIAL DE WHATSAPP
// =========================================================
let ultimoPedidoId = null;

function abrirModalConfirmacion(pedidoId, usuario, itemsComprados, totalVenta) {
    ultimoPedidoId = pedidoId;
    document.getElementById('modalSubtituloOrden').innerText = `Orden Oficial #00${pedidoId} | Cliente: ${usuario.nombre}`;
    document.getElementById('modalTotalPagar').innerText = `Bs. ${totalVenta.toFixed(2)}`;

    const tbody = document.getElementById('modalListaItems');
    tbody.innerHTML = '';
    let detalleTextoWhatsApp = '';

    itemsComprados.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        tbody.innerHTML += `
            <tr>
                <td class="fw-semibold text-white">${item.nombre}</td>
                <td class="text-center"><span class="badge-pill-vip badge-pill-slate">${item.cantidad}</span></td>
                <td class="text-end text-secondary small">Bs. ${item.precio.toFixed(2)}</td>
                <td class="text-end fw-bold text-success">Bs. ${subtotal.toFixed(2)}</td>
            </tr>
        `;
        detalleTextoWhatsApp += `  • ${item.cantidad}x ${item.nombre} (Bs. ${item.precio.toFixed(2)} c/u) = Bs. ${subtotal.toFixed(2)}\n`;
    });

    generarQRPago(pedidoId, totalVenta);

    const mensajeWA = 
`🚗 *PEDIDO CONFIRMADO - ERP GOLDEN*
📋 *Orden N°:* #00${pedidoId}
👤 *Cliente:* ${usuario.nombre} (${usuario.email})
📅 *Fecha:* ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
📦 *DETALLE DE REPUESTOS:*
${detalleTextoWhatsApp}━━━━━━━━━━━━━━━━━━━━
💰 *TOTAL A CANCELAR:* Bs. ${totalVenta.toFixed(2)}
💳 *MÉTODO:* Pago QR / Transferencia BCP
📍 *ESTADO:* PENDIENTE DE DESPACHO

¡Muchas gracias por confiar en Distribuidora GOLDEN!`;

    const urlWA = `https://wa.me/?text=${encodeURIComponent(mensajeWA)}`;
    const btnWA = document.getElementById('btnWhatsAppPedido');
    btnWA.setAttribute('href', urlWA);

    const modalEl = document.getElementById('modalVentaExitosa');
    const modalInstance = new bootstrap.Modal(modalEl);
    modalInstance.show();
}

function descargarReciboUltimoPedidoPDF() {
    if (!ultimoPedidoId) {
        Toast.fire({ icon: 'warning', title: 'No se encontró la última orden procesada' });
        return;
    }
    if (typeof generarRecibo === 'function') {
        generarRecibo(ultimoPedidoId);
    } else if (typeof generarFacturaPDF === 'function') {
        generarFacturaPDF(ultimoPedidoId);
    } else {
        Toast.fire({ icon: 'info', title: 'Generando comprobante oficial...' });
    }
}

function generarQRPago(pedidoId, totalVenta) {
    const contenedor = document.getElementById('contenedorQR');
    contenedor.innerHTML = '<canvas id="qrCodeCanvas" width="160" height="160"></canvas>';
    const canvas = document.getElementById('qrCodeCanvas');
    const ctx = canvas.getContext('2d');

    const qrData = `GOLDEN-PAY|ORDEN-00${pedidoId}|BS-${totalVenta.toFixed(2)}|BANCO-BCP-SOL`;

    if (window.QRCode && typeof window.QRCode === 'function') {
        contenedor.innerHTML = '';
        new QRCode(contenedor, {
            text: qrData,
            width: 160,
            height: 160,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        dibujarQRFallback(ctx, pedidoId, totalVenta);
    }
}

function dibujarQRFallback(ctx, pedidoId, total) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 160, 160);

    ctx.fillStyle = '#0f172a';
    function drawFinder(x, y) {
        ctx.fillRect(x, y, 42, 42);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 6, y + 6, 30, 30);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 12, y + 12, 18, 18);
    }
    drawFinder(8, 8);
    drawFinder(110, 8);
    drawFinder(8, 110);

    const seed = (pedidoId * 9301 + 49297) % 233280;
    for (let i = 0; i < 14; i++) {
        for (let j = 0; j < 14; j++) {
            if ((i < 5 && j < 5) || (i > 8 && j < 5) || (i < 5 && j > 8)) continue;
            if (((i * j * 7 + seed + i + j) % 3) === 0) {
                ctx.fillRect(18 + i * 9, 18 + j * 9, 7, 7);
            }
        }
    }

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(80, 80, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BCP', 80, 80);
}

function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}
