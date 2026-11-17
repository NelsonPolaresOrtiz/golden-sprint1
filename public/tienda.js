/**
 * ERP GOLDEN - Módulo Oficial de Tienda B2B / B2C (Estilo Tecfil Automotriz 2026)
 * Sistema de Gestión de Catálogo en Vivo basado en Roles:
 * - ADMIN & TRABAJADOR: Barra de herramientas flotante ("Modo Gestor"), interruptor Vista Cliente / Edición,
 *   botones rápidos en cada tarjeta (Editar / Oferta On/Off), modal de edición completa en tiempo real
 *   y editor de campaña del Hero Banner.
 * - CLIENTE: Visualización pública limpia estilo Tecfil, sin controles administrativos.
 * - Persistencia ACID en SQLite3 (/api/productos, /api/config-catalogo).
 */

const API_URL = '/api';
const FALLBACK_IMG_OFFLINE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23f8fafc'/><rect x='10' y='10' width='380' height='280' fill='none' stroke='%23cbd5e1' stroke-dasharray='6 6' rx='4'/><text x='50%25' y='46%25' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='15' font-weight='bold'>REPUESTO AUTOMOTRIZ</text><text x='50%25' y='58%25' dominant-baseline='middle' text-anchor='middle' fill='%23d97706' font-family='sans-serif' font-size='12' font-weight='600'>GOLDEN ERP</text></svg>";

let productosTienda = [];
let carrito = [];
let categoriaActual = 'Todos';
let terminoBusqueda = '';
let vehiculoSeleccionado = '';
let viscosidadActual = '';

// Estado de Roles y Modo Gestor de Catálogo en Vivo
let usuarioActual = null;
let esAdminOTrabajador = false;
let modoEdicionActivo = true; // Por defecto activo para administradores y trabajadores

// Estado de la presentación seleccionada para cada producto: { [prodId]: presId }
const presentacionesSeleccionadas = {};

// Control del Carrusel de Fichas Técnicas Tecfil
let lineaOfertasActiva = 'liviana';
let slideOfertasIndex = 0;
let carruselTecfilTimer = null;

// Producto cargado actualmente en el Modal de Ficha Técnica
let productoFichaActual = null;
let ultimoPedidoId = null;

// Imágenes Locales Homologadas (100% Offline)
const imgsAceite = ['Aceite_Sintetico.jpg', 'Aceite_Sintetico1.jpg', 'Aceite_Sintetico2.jpg', 'Aceite_Sintetico3.jpg', 'Aceite_Sintetico4.jpg', 'Aceite_Sintetico5.jpg', 'Aceite_Sintetico6.jpg', 'Aceite_Sintetico7.jpg'];
const imgsFiltroAceite = ['Filtro_de_Aceite.jpg', 'Filtro_de_Aceite1.jpg', 'Filtro_de_Aceite2.jpg', 'Filtro_de_Aceite3.jpg', 'Filtro_de_Aceite4.jpg', 'Filtro_de_Aceite5.jpg', 'Filtro_de_Aceite6.jpg'];
const imgsFiltroAire = ['Filtro_de_Aire3.jpg', 'Filtro_de_Aire4.jpg', 'Filtro_de_Aire5.jpg', 'Filtro_de_Aire6.jpg', 'Filtros_de_Aire.jpg', 'Filtros_de_Aire1.jpg', 'Filtros_de_Aire2.jpg'];
const imgsGrasa = ['Grasa_Minerales.jpg', 'Grasa_Minerales1.jpg', 'Grasa_Minerales2.jpg', 'Grasa_Minerales3.jpg', 'Grasa_Minerales4.jpg', 'Grasa_Minerales5.jpg', 'Grasa_Minerales6.jpg'];

// Datos Técnicos para el Showcase "Conozca nuestros productos"
const showcaseTecnicoData = {
    aceites: {
        badge: "LÍNEA AUTOMOTRIZ & PESADA",
        titulo: "Aceites de Motor Sintéticos y Minerales",
        subtitulo: "Película lubricante hidrodinámica de extrema presión y control de fricción",
        descripcion: "Formulados con bases del Grupo III altamente refinadas y paquetes de aditivos antifricción ZDDP (Dialquilditiofosfato de Zinc). Mantienen viscosidad estable frente al cizallamiento térmico severo en alturas superiores a 3,500 msnm en el altiplano y valles de Bolivia.",
        beneficios: [
            "Índice de viscosidad superior (VI > 165) para menor consumo de combustible en tramos de montaña.",
            "Detergentes de calcio y magnesio que evitan la formación de lodos y barnices en el cárter.",
            "Protección certificada API SP / ILSAC GF-6A para motores con inyección directa y turbo."
        ],
        categoriaFiltro: "Aceites Sintéticos",
        imgPrincipal: "./img/Aceite_Sintetico.jpg",
        imgSecundaria: "./img/Aceite_Sintetico1.jpg",
        codigoDestacado: "SYN-5W30 • 100% Sintético Larga Vida"
    },
    filtrosAceite: {
        badge: "INGENIERÍA DE FILTRACIÓN",
        titulo: "Filtros de Aceite Blindados Spin-On",
        subtitulo: "Retención micrométrica de partículas y válvula de seguridad anti-drenaje",
        descripcion: "Diseñados con media filtrante de celulosa reforzada con microfibras sintéticas plisadas uniformemente. Retienen el 99.2% de partículas abrasivas mayores a 20 micras, protegiendo cojinetes de biela y bancada contra el desgaste prematuro.",
        beneficios: [
            "Válvula anti-retorno de silicona que garantiza lubricación inmediata en el arranque en frío.",
            "Válvula de alivio (by-pass) calibrada para evitar cavitación en condiciones de alta presión.",
            "Carcasa de acero estampado resistente a pulsaciones de hasta 20 bar (290 PSI)."
        ],
        categoriaFiltro: "Filtros de Aceite",
        imgPrincipal: "./img/Filtro_de_Aceite.jpg",
        imgSecundaria: "./img/Filtro_de_Aceite1.jpg",
        codigoDestacado: "PSL-560 • Spin-On Heavy Duty Flotas"
    },
    filtrosAire: {
        badge: "SISTEMAS DE ASPIRACIÓN",
        titulo: "Filtros de Aire de Flujo Radial y Panel",
        subtitulo: "Máxima eficiencia en retención de polvo sílice en caminos de ripio y tierra",
        descripcion: "Especialmente construidos para las condiciones polvorientas de los caminos interdepartamentales y obras de Bolivia. El sellado perimetral de poliuretano vulcanizado previene fugas de aire sucio que destruyen los anillos del pistón.",
        beneficios: [
            "Estructura de plisado profundo que maximiza el área de filtración sin estrangular la admisión.",
            "Tratamiento hidrófugo que evita el colapso del filtro en épocas de lluvia o alta humedad.",
            "Reducción del consumo de combustible al mantener un flujo de aire constante y limpio."
        ],
        categoriaFiltro: "Filtros de Aire",
        imgPrincipal: "./img/Filtros_de_Aire.jpg",
        imgSecundaria: "./img/Filtro_de_Aire3.jpg",
        codigoDestacado: "ARL-8832 • Filtro Radial Flota Pesada"
    },
    fluidos: {
        badge: "FLUIDOS DE SEGURIDAD Y REFRIGERACIÓN",
        titulo: "Refrigerantes OAT y Líquidos de Frenos DOT-4",
        subtitulo: "Tecnología de ácidos orgánicos y alto punto de ebullición seco",
        descripcion: "Fluidos formulados para resistir las exigencias térmicas extremas: refrigerantes OAT de larga duración que evitan la cavitación en camisas de cilindro y bombas de agua, y líquido de frenos DOT-4 con punto de ebullición superior a 260°C para descensos de montaña prolongados.",
        beneficios: [
            "Refrigerante OAT anticorrosión para radiadores de aluminio, cobre y aleaciones modernas.",
            "Líquido de frenos DOT-4 de baja viscosidad a bajas temperaturas para respuesta rápida en ABS/ESP.",
            "Protección contra la congelación en invierno y sobrecalentamiento en climas cálidos."
        ],
        categoriaFiltro: "Refrigerantes y Líquidos",
        imgPrincipal: "./img/Refrigerante_Galon_Rojo.svg",
        imgSecundaria: "./img/Liquido_Frenos_DOT4.svg",
        codigoDestacado: "OAT-RED • Refrigerante Larga Vida 40.000 km"
    }
};

/**
 * Normaliza las categorías al estándar comercial exacto
 */
function normalizarCategoriaProducto(producto) {
    if (!producto) return 'LUBRICANTES';
    const nom = (producto.nombre || '').toLowerCase();
    const cat = (producto.categoria || '').toLowerCase();

    if (nom.includes('freno') || nom.includes('dot-4') || nom.includes('dot 4') || cat.includes('fluido') || cat.includes('líquido') || cat.includes('liquido')) {
        return 'LÍQUIDOS Y FLUIDOS';
    }
    if (nom.includes('refrigerante') || cat.includes('refrigerante')) {
        return 'REFRIGERANTES';
    }
    if (nom.includes('grasa') || cat.includes('grasa')) {
        return 'GRASAS LUBRICANTES';
    }
    if (nom.includes('filtro de aceite') || (cat.includes('filtro') && nom.includes('aceite'))) {
        return 'FILTROS DE ACEITE';
    }
    if (nom.includes('filtro de aire') || nom.includes('filtro de cabina') || nom.includes('filtro de combustible') || nom.includes('aditivo') || cat.includes('aire')) {
        return 'FILTROS DE AIRE';
    }
    if (nom.includes('sintético') || nom.includes('sintetico') || nom.includes('5w-30') || nom.includes('0w-20') || nom.includes('10w-40') || nom.includes('10w-60') || cat.includes('sint')) {
        return 'ACEITES SINTÉTICOS';
    }
    if (nom.includes('mineral') || nom.includes('20w-50') || nom.includes('15w-40') || nom.includes('25w-60') || nom.includes('40w') || cat.includes('miner')) {
        return 'ACEITES MINERALES';
    }
    return producto.categoria ? producto.categoria.toUpperCase() : 'LUBRICANTES';
}

function obtenerRutaImagenLocal(producto, index = 0) {
    if (!producto) return './img/' + imgsGrasa[0];
    if (producto.imagen_url && producto.imagen_url.startsWith('./img/') && !producto.imagen_url.includes('placehold.co')) {
        return producto.imagen_url;
    }
    const nombreProd = (producto.nombre || '').toLowerCase();
    const catProd = (producto.categoria || '').toLowerCase();

    if (nombreProd.includes('freno') || nombreProd.includes('dot-4') || nombreProd.includes('dot 4')) {
        return './img/Liquido_Frenos_DOT4.svg';
    }
    if (nombreProd.includes('refrigerante') || catProd.includes('refrigerante')) {
        if (nombreProd.includes('rojo') || nombreProd.includes('orgánico') || nombreProd.includes('organico') || nombreProd.includes('oat')) {
            return './img/Refrigerante_Galon_Rojo.svg';
        }
        return './img/Refrigerante_Galon_Verde.svg';
    }
    if (nombreProd.includes('grasa') || catProd.includes('grasa')) {
        return './img/' + imgsGrasa[0];
    }
    if (nombreProd.includes('filtro de aceite') || (catProd.includes('filtro') && nombreProd.includes('aceite'))) {
        return './img/' + imgsFiltroAceite[index % imgsFiltroAceite.length];
    }
    if (nombreProd.includes('aire') || nombreProd.includes('cabina') || nombreProd.includes('combustible')) {
        return './img/' + imgsFiltroAire[index % imgsFiltroAire.length];
    }
    if (nombreProd.includes('aceite') || nombreProd.includes('mineral') || nombreProd.includes('sintético') || nombreProd.includes('sintetico')) {
        return './img/' + imgsAceite[index % imgsAceite.length];
    }
    return './img/' + imgsGrasa[0];
}

// Toast comercial sobrio
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

// =========================================================================
// INICIALIZACIÓN PRINCIPAL
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    localStorage.removeItem('cupon_ruleta_golden');

    usuarioActual = protegerRuta('tienda');
    if (!usuarioActual) return;

    // Renderizar barra de navegación oficial del ERP o Vista Cliente
    if (typeof renderizarMenu === 'function') {
        renderizarMenu('tienda');
    }

    if (window.location.search.includes('verPedidos=1')) {
        setTimeout(() => {
            abrirModalSeguimiento();
        }, 350);
    }

    esAdminOTrabajador = Boolean(usuarioActual && (
        usuarioActual.rol === 'ADMIN' || 
        usuarioActual.rol === 'TRABAJADOR' || 
        usuarioActual.rol === 'ALMACENERO'
    ));

    // Si es cliente, el modo de edición está 100% inactivo
    if (!esAdminOTrabajador) {
        modoEdicionActivo = false;
    }

    inicializarBarraGestor();
    cargarConfigBanner();

    // Sincronizar datos del usuario en la Top Bar Tecfil
    const topBarUser = document.getElementById('topBarUserName');
    const topBarRol = document.getElementById('topBarUserRol');
    if (topBarUser) {
        topBarUser.innerText = usuarioActual.nombre || 'Taller Los Primos';
    }
    if (topBarRol) {
        let labelRol = 'Cuenta Taller';
        if (usuarioActual.rol === 'ADMIN') labelRol = 'Administración';
        else if (usuarioActual.rol === 'TRABAJADOR') labelRol = 'Almacén & Ventas';
        else if (usuarioActual.rol === 'ALMACENERO') labelRol = 'Almacén Central';
        topBarRol.innerText = labelRol;
    }

    // Cerrar menú desplegable de búsqueda al hacer clic fuera
    document.addEventListener('click', (e) => {
        const searchBox = document.querySelector('.tecfil-search-box');
        const dropdown = document.getElementById('navbarSearchDropdown');
        if (searchBox && dropdown && !searchBox.contains(e.target)) {
            dropdown.classList.add('d-none');
        }
    });

    inicializarBuscadorCatalogo();
    cargarCatalogo();
    actualizarCarrito();
    iniciarAutoPlayTecfil();
});

// =========================================================================
// MODO GESTOR DE CATÁLOGO EN VIVO (ADMIN & TRABAJADOR)
// =========================================================================

function inicializarBarraGestor() {
    const toolbar = document.getElementById('adminCatalogToolbar');
    const statusText = document.getElementById('adminCatalogStatus');
    const btnHeroEdit = document.getElementById('btnEditarBannerHero');

    if (esAdminOTrabajador) {
        if (toolbar) toolbar.classList.remove('d-none');
        if (statusText) {
            const badgeColor = usuarioActual.rol === 'ADMIN' ? 'bg-danger' : 'bg-warning text-dark';
            statusText.innerHTML = `<span class="badge ${badgeColor} me-1">[${usuarioActual.rol}]</span> ${usuarioActual.nombre} • Gestor de Catálogo Activo`;
        }
        if (btnHeroEdit) {
            if (modoEdicionActivo) btnHeroEdit.classList.remove('d-none');
            else btnHeroEdit.classList.add('d-none');
        }
    } else {
        if (toolbar) toolbar.classList.add('d-none');
        if (btnHeroEdit) btnHeroEdit.classList.add('d-none');
    }
}

function establecerModoEdicion(activar) {
    if (!esAdminOTrabajador) return;
    modoEdicionActivo = activar;

    const btnModoEdicion = document.getElementById('btnModoEdicion');
    const btnModoVistaCliente = document.getElementById('btnModoVistaCliente');
    const btnHeroEdit = document.getElementById('btnEditarBannerHero');

    if (btnModoEdicion && btnModoVistaCliente) {
        if (activar) {
            btnModoEdicion.className = 'btn btn-outline-warning active';
            btnModoVistaCliente.className = 'btn btn-outline-light';
            if (btnHeroEdit) btnHeroEdit.classList.remove('d-none');
            Toast.fire({ icon: 'info', title: 'Modo Edición en vivo activado' });
        } else {
            btnModoEdicion.className = 'btn btn-outline-warning';
            btnModoVistaCliente.className = 'btn btn-outline-light active';
            if (btnHeroEdit) btnHeroEdit.classList.add('d-none');
            Toast.fire({ icon: 'info', title: 'Vista previa de Cliente activada' });
        }
    }

    renderizarCarruselTecfil();
    renderizarCatalogo();
}

// =========================================================================
// GESTOR DINÁMICO DEL HERO BANNER (SQLITE config_catalogo)
// =========================================================================

async function cargarConfigBanner() {
    try {
        const res = await fetch(`${API_URL}/config-catalogo?t=${Date.now()}`);
        if (!res.ok) return;
        const config = await res.json();

        const badgeEl = document.getElementById('heroBadgeText');
        const titleEl = document.getElementById('heroTitleText');
        const descEl = document.getElementById('heroParagraphText');
        const stampEl = document.getElementById('heroDestacadoText');

        if (badgeEl && config.hero_badge) {
            badgeEl.innerHTML = `<i class="bi bi-shield-fill-check text-warning me-1"></i> ${escaparHTML(config.hero_badge)}`;
        }
        if (titleEl && config.hero_titulo) {
            const lineas = config.hero_titulo.split('\n');
            if (lineas.length > 1) {
                titleEl.innerHTML = `${escaparHTML(lineas[0])}<br><span class="highlight-gold">${escaparHTML(lineas[1])}</span><br>${lineas.slice(2).map(l => escaparHTML(l)).join('<br>')}`;
            } else {
                titleEl.innerText = config.hero_titulo;
            }
        }
        if (descEl && config.hero_subtitulo) {
            descEl.innerText = config.hero_subtitulo;
        }
        if (stampEl && config.hero_destacado) {
            stampEl.innerText = config.hero_destacado;
        }
    } catch (e) {
        console.warn('No se pudo cargar config_catalogo:', e);
    }
}

function abrirModalEditarBanner() {
    if (!esAdminOTrabajador) return;
    const badgeEl = document.getElementById('heroBadgeText');
    const titleEl = document.getElementById('heroTitleText');
    const descEl = document.getElementById('heroParagraphText');
    const stampEl = document.getElementById('heroDestacadoText');

    const inpBadge = document.getElementById('bannerBadgeInput');
    const inpTit = document.getElementById('bannerTituloInput');
    const inpSub = document.getElementById('bannerSubtituloInput');
    const inpDest = document.getElementById('bannerDestacadoInput');

    if (inpBadge && badgeEl) inpBadge.value = badgeEl.innerText.trim();
    if (inpTit && titleEl) inpTit.value = titleEl.innerText.trim();
    if (inpSub && descEl) inpSub.value = descEl.innerText.trim();
    if (inpDest && stampEl) inpDest.value = stampEl.innerText.trim();

    const modalEl = document.getElementById('modalEditarBanner');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

async function guardarBannerDesdeModal() {
    const hero_badge = document.getElementById('bannerBadgeInput').value.trim();
    const hero_titulo = document.getElementById('bannerTituloInput').value.trim();
    const hero_subtitulo = document.getElementById('bannerSubtituloInput').value.trim();
    const hero_destacado = document.getElementById('bannerDestacadoInput').value.trim();

    try {
        const res = await fetch(`${API_URL}/config-catalogo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hero_badge, hero_titulo, hero_subtitulo, hero_destacado })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar banner');

        Toast.fire({ icon: 'success', title: '¡Hero Banner actualizado exitosamente en SQLite!' });
        const modalEl = document.getElementById('modalEditarBanner');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }
        await cargarConfigBanner();
    } catch (err) {
        console.error('Error al guardar banner:', err);
        Toast.fire({ icon: 'error', title: err.message || 'Error al guardar banner' });
    }
}

// =========================================================================
// GESTOR DE PRODUCTOS EN VIVO (CREAR / EDITAR / ELIMINAR EN SQLITE)
// =========================================================================

function abrirModalNuevoProducto() {
    if (!esAdminOTrabajador) return;
    const form = document.getElementById('formEditarProducto');
    if (form) form.reset();

    document.getElementById('editProdId').value = '';
    document.getElementById('modalEditarProdLabel').innerText = 'Registrar Nuevo Repuesto / Producto';
    document.getElementById('modalEditarProdSubtitulo').innerText = 'NUEVO INGRESO AL CATÁLOGO OFICIAL';
    document.getElementById('editProdEnOferta').checked = false;
    document.getElementById('editProdDescuento').value = 15;
    document.getElementById('editProdStockMinimo').value = 5;

    const btnEliminar = document.getElementById('btnEliminarProducto');
    if (btnEliminar) btnEliminar.classList.add('d-none');

    const modalEl = document.getElementById('modalEditarProducto');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

function abrirModalEditarProducto(prodId) {
    if (!esAdminOTrabajador) return;
    const prod = productosTienda.find(p => p.id === prodId);
    if (!prod) return;

    document.getElementById('editProdId').value = prod.id;
    document.getElementById('modalEditarProdLabel').innerText = `Editar Repuesto: ${prod.sku}`;
    document.getElementById('modalEditarProdSubtitulo').innerText = `MODIFICACIÓN EN VIVO • ID #${prod.id}`;
    document.getElementById('editProdNombre').value = prod.nombre || '';
    document.getElementById('editProdSku').value = prod.sku || '';
    document.getElementById('editProdCategoria').value = prod.categoria || 'Aceites Sintéticos';
    document.getElementById('editProdLinea').value = prod.linea || 'liviana';
    document.getElementById('editProdPrecio').value = prod.precio || 0;
    document.getElementById('editProdStock').value = prod.stock || 0;
    document.getElementById('editProdStockMinimo').value = prod.stock_minimo || 5;
    document.getElementById('editProdImagen').value = prod.imagen_url || prod.rutaImg || '';
    document.getElementById('editProdCompatibilidad').value = prod.compatibilidad || obtenerCompatibilidadVehicular(prod).resumenModelos || '';
    document.getElementById('editProdSpecs').value = prod.especificaciones || '';
    document.getElementById('editProdEnOferta').checked = Boolean(prod.en_oferta);
    document.getElementById('editProdDescuento').value = prod.descuento_porcentaje || 15;

    const btnEliminar = document.getElementById('btnEliminarProducto');
    if (btnEliminar) btnEliminar.classList.remove('d-none');

    const modalEl = document.getElementById('modalEditarProducto');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

function setImagenPreset(ruta) {
    const input = document.getElementById('editProdImagen');
    if (input) input.value = ruta;
}

async function guardarProductoDesdeModal() {
    const prodId = document.getElementById('editProdId').value;
    const nombre = document.getElementById('editProdNombre').value.trim();
    const sku = document.getElementById('editProdSku').value.trim().toUpperCase();
    const categoria = document.getElementById('editProdCategoria').value;
    const linea = document.getElementById('editProdLinea').value;
    const precio = parseFloat(document.getElementById('editProdPrecio').value);
    const stock = parseInt(document.getElementById('editProdStock').value, 10);
    const stock_minimo = parseInt(document.getElementById('editProdStockMinimo').value, 10) || 5;
    const imagen_url = document.getElementById('editProdImagen').value.trim();
    const compatibilidad = document.getElementById('editProdCompatibilidad').value.trim();
    const especificaciones = document.getElementById('editProdSpecs').value.trim();
    const en_oferta = document.getElementById('editProdEnOferta').checked ? 1 : 0;
    const descuento_porcentaje = parseInt(document.getElementById('editProdDescuento').value, 10) || 15;

    if (!nombre || !sku || isNaN(precio) || isNaN(stock)) {
        Toast.fire({ icon: 'warning', title: 'Complete los campos obligatorios del repuesto' });
        return;
    }

    const payload = {
        nombre,
        sku,
        categoria,
        linea,
        precio,
        stock,
        stock_minimo,
        imagen_url,
        compatibilidad,
        especificaciones,
        en_oferta,
        descuento_porcentaje
    };

    const btnGuardar = document.getElementById('btnGuardarProdModal');
    const originalText = btnGuardar ? btnGuardar.innerHTML : '';
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando en base de datos...';
    }

    try {
        const url = prodId ? `${API_URL}/productos/${prodId}` : `${API_URL}/productos`;
        const method = prodId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar producto');

        Toast.fire({ 
            icon: 'success', 
            title: prodId ? '¡Repuesto actualizado exitosamente en SQLite!' : '¡Nuevo repuesto registrado en el catálogo!' 
        });

        const modalEl = document.getElementById('modalEditarProducto');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }

        await cargarCatalogo();
    } catch (err) {
        console.error('Error al guardar producto:', err);
        Toast.fire({ icon: 'error', title: err.message || 'Error al guardar repuesto' });
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = originalText;
        }
    }
}

async function alternarOfertaRapida(prodId) {
    if (!esAdminOTrabajador) return;
    const prod = productosTienda.find(p => p.id === prodId);
    if (!prod) return;

    const nuevoEstado = prod.en_oferta ? 0 : 1;

    try {
        const res = await fetch(`${API_URL}/productos/${prodId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ en_oferta: nuevoEstado })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la oferta');

        prod.en_oferta = nuevoEstado;
        Toast.fire({
            icon: 'success',
            title: nuevoEstado ? `Oferta activada para ${prod.sku} (-15%)` : `Oferta desactivada para ${prod.sku}`
        });

        renderizarCarruselTecfil();
        renderizarCatalogo();
    } catch (err) {
        console.error('Error al alternar oferta:', err);
        Toast.fire({ icon: 'error', title: 'Error al cambiar estado de oferta' });
    }
}

async function darDeBajaProducto() {
    const prodId = document.getElementById('editProdId').value;
    if (!prodId) return;

    const confirmacion = await Swal.fire({
        title: '¿Dar de baja este producto?',
        text: 'Se eliminará del catálogo activo de la tienda.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#B91C1C',
        cancelButtonColor: '#64748B',
        confirmButtonText: '<i class="bi bi-trash3-fill me-1"></i> Sí, dar de baja',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/productos/${prodId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) {
            if (res.status === 409) {
                const pausar = await Swal.fire({
                    title: 'Producto con historial de ventas',
                    text: `${data.error} ¿Deseas pausarlo poniendo su stock disponible en 0?`,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, poner stock en 0',
                    cancelButtonText: 'Cancelar'
                });
                if (pausar.isConfirmed) {
                    await fetch(`${API_URL}/productos/${prodId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ stock: 0 })
                    });
                    Toast.fire({ icon: 'success', title: 'Repuesto pausado (Stock en 0)' });
                    const modalEl = document.getElementById('modalEditarProducto');
                    if (modalEl) {
                        const bsModal = bootstrap.Modal.getInstance(modalEl);
                        if (bsModal) bsModal.hide();
                    }
                    await cargarCatalogo();
                }
                return;
            }
            throw new Error(data.error || 'Error al eliminar producto');
        }

        Toast.fire({ icon: 'success', title: 'Repuesto eliminado del catálogo' });
        const modalEl = document.getElementById('modalEditarProducto');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }
        await cargarCatalogo();
    } catch (err) {
        console.error('Error al dar de baja:', err);
        Toast.fire({ icon: 'error', title: err.message || 'Error al eliminar producto' });
    }
}

// =========================================================================
// PRESENTACIONES POR VOLUMEN Y LITRAJE (1L, 4L, 20L / UNIDAD / CAJA)
// =========================================================================

function obtenerPresentaciones(producto) {
    const nom = (producto.nombre || '').toLowerCase();
    const cat = (producto.categoria || '').toLowerCase();

    const esAceiteORef = nom.includes('aceite') || nom.includes('mineral') || 
                         nom.includes('sintetico') || nom.includes('sintético') || 
                         nom.includes('refrigerante') || cat.includes('aceite');

    const esFrenoOGrasa = nom.includes('freno') || nom.includes('dot') || 
                          nom.includes('grasa') || cat.includes('grasa');

    if (esAceiteORef && !esFrenoOGrasa) {
        return [
            { id: '1L', label: '1L', nombreCompleto: '1 Litro', sufijo: '1L', factor: 1.0, multDesc: 1.0 },
            { id: '4L', label: '4L', nombreCompleto: '4 Litros (Galón)', sufijo: '4L', factor: 4.0, multDesc: 3.75 },
            { id: '20L', label: '20L', nombreCompleto: '20 Litros (Balde)', sufijo: '20L', factor: 20.0, multDesc: 17.5 }
        ];
    }

    if (esFrenoOGrasa) {
        const esGrasa = nom.includes('grasa');
        return [
            { id: 'UNI', label: esGrasa ? '1 Kg' : '500ml', nombreCompleto: esGrasa ? '1 Kg (Unidad)' : '500ml (Unidad)', sufijo: 'UNI', factor: 1.0, multDesc: 1.0 },
            { id: 'CJ12', label: 'Caja x12', nombreCompleto: 'Caja Mayorista (x12)', sufijo: 'CJ12', factor: 12.0, multDesc: 10.8 }
        ];
    }

    return [
        { id: 'UNI', label: 'Unidad', nombreCompleto: 'Unidad', sufijo: 'UNI', factor: 1.0, multDesc: 1.0 },
        { id: 'PK6', label: 'Pack x6', nombreCompleto: 'Pack Taller (x6 unid.)', sufijo: 'PK6', factor: 6.0, multDesc: 5.4 }
    ];
}

function calcularDatosPresentacion(producto, presId, esOferta = false) {
    const presentaciones = obtenerPresentaciones(producto);
    const pres = presentaciones.find(p => p.id === presId) || presentaciones[0];
    const precioBaseUnitario = parseFloat(producto.precio || 0);

    const precioPresentacionBase = precioBaseUnitario * pres.multDesc;
    const precioFinal = esOferta
        ? Math.round(precioPresentacionBase * 0.85 * 100) / 100
        : Math.round(precioPresentacionBase * 100) / 100;

    const skuCompleto = `${producto.sku}-${pres.sufijo}`;

    let stockPresentacion = producto.stock;
    if (pres.factor > 1) {
        stockPresentacion = Math.floor(producto.stock / Math.min(pres.factor, 4));
        if (stockPresentacion < 1 && producto.stock > 0) stockPresentacion = 1;
    }

    return {
        presentacion: pres,
        precioOriginal: precioPresentacionBase,
        precioFinal: precioFinal,
        skuCompleto: skuCompleto,
        stockDisponible: stockPresentacion
    };
}

function cambiarPresentacion(prodId, presId, event) {
    if (event) event.stopPropagation();
    presentacionesSeleccionadas[prodId] = presId;

    const producto = productosTienda.find(p => p.id === prodId);
    if (!producto) return;

    const esOferta = Boolean(producto.en_oferta || producto.stock >= 20 || categoriaActual === 'Ofertas');
    const datos = calcularDatosPresentacion(producto, presId, esOferta);

    const contenedorBtn = document.getElementById(`presentaciones-prod-${prodId}`);
    if (contenedorBtn) {
        contenedorBtn.querySelectorAll('.btn-presentacion').forEach(btn => {
            if (btn.getAttribute('data-pres-id') === presId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    const precioElem = document.getElementById(`precio-prod-${prodId}`);
    const precioOrigElem = document.getElementById(`precio-orig-prod-${prodId}`);
    const skuElem = document.getElementById(`sku-prod-${prodId}`);
    const stockElem = document.getElementById(`stock-prod-${prodId}`);

    [precioElem, precioOrigElem, skuElem, stockElem].forEach(el => {
        if (el) {
            el.classList.remove('animate-num-flip');
            void el.offsetWidth;
            el.classList.add('animate-num-flip');
        }
    });

    if (skuElem) skuElem.innerText = datos.skuCompleto;
    if (precioElem) precioElem.innerText = `Bs. ${datos.precioFinal.toFixed(2)}`;
    if (precioOrigElem) precioOrigElem.innerText = `Bs. ${datos.precioOriginal.toFixed(2)}`;

    if (stockElem) {
        if (datos.stockDisponible <= 0) {
            stockElem.className = 'card-stock-label stock-out fw-bold text-uppercase';
            stockElem.style.background = '#FEE2E2';
            stockElem.style.color = '#B91C1C';
            stockElem.style.border = '1px solid #FCA5A5';
            stockElem.innerText = 'AGOTADO';
        } else if (producto.stock <= producto.stock_minimo) {
            stockElem.className = 'card-stock-label stock-alert';
            stockElem.style.background = '';
            stockElem.style.color = '';
            stockElem.style.border = '';
            stockElem.innerText = `Últimas ${datos.stockDisponible} unidades`;
        } else {
            stockElem.className = 'card-stock-label stock-ok';
            stockElem.style.background = '';
            stockElem.style.color = '';
            stockElem.style.border = '';
            stockElem.innerText = `En almacén: ${datos.stockDisponible} unid.`;
        }
    }

    const inputCard = document.getElementById(`cant-card-${prodId}`);
    if (inputCard) {
        inputCard.max = datos.stockDisponible;
        if (parseInt(inputCard.value) > datos.stockDisponible) {
            inputCard.value = Math.max(1, datos.stockDisponible);
        }
    }

    const wrapCompra = document.getElementById(`wrap-compra-${prodId}`);
    const btnCompra = document.getElementById(`btn-compra-${prodId}`);
    if (datos.stockDisponible <= 0) {
        if (wrapCompra) {
            wrapCompra.outerHTML = `<button class="btn btn-secondary btn-sm px-3 py-1 fw-bold opacity-50 text-uppercase" disabled id="btn-compra-${prodId}" style="font-size:0.75rem;">AGOTADO</button>`;
        }
    } else {
        if (btnCompra && !wrapCompra) {
            btnCompra.outerHTML = `
                <div class="d-flex align-items-center gap-1" id="wrap-compra-${prodId}" onclick="event.stopPropagation();">
                    <div class="input-group input-group-sm" style="width: 78px;">
                        <button class="btn btn-outline-secondary px-1 py-0" type="button" onclick="ajustarCantidadTarjeta(${prodId}, -1)">-</button>
                        <input type="number" id="cant-card-${prodId}" class="form-control text-center px-0 py-0 font-mono fw-bold" value="1" min="1" max="${datos.stockDisponible}" onchange="validarCantidadTarjeta(${prodId}, this)" style="font-size: 0.82rem; height: 26px;">
                        <button class="btn btn-outline-secondary px-1 py-0" type="button" onclick="ajustarCantidadTarjeta(${prodId}, 1)">+</button>
                    </div>
                    <button class="btn btn-primary btn-sm px-2 py-1 d-flex align-items-center gap-1" 
                            style="background-color: #B91C1C; border-color: #B91C1C; border-radius: 4px; height: 26px; font-size: 0.76rem;"
                            onclick="event.stopPropagation(); agregarDesdeTarjeta(${prodId})">
                        <i class="bi bi-cart-plus"></i>
                        <span>Agregar</span>
                    </button>
                </div>
            `;
        }
    }

    if (productoFichaActual && productoFichaActual.id === prodId) {
        actualizarFichaConPresentacion(datos);
    }
}

function cambiarPresentacionTecfil(prodId, presId, event) {
    if (event) event.stopPropagation();
    presentacionesSeleccionadas[prodId] = presId;

    const producto = productosTienda.find(p => p.id === prodId);
    if (!producto) return;

    const datos = calcularDatosPresentacion(producto, presId, true);

    const contenedorPres = document.getElementById(`tecfil-pres-${prodId}`);
    if (contenedorPres) {
        contenedorPres.querySelectorAll('.btn-presentacion').forEach(btn => {
            if (btn.getAttribute('data-pres-id') === presId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    const skuElem = document.getElementById(`tecfil-sku-${prodId}`);
    const precioElem = document.getElementById(`tecfil-precio-${prodId}`);
    const precioOrigElem = document.getElementById(`tecfil-precio-orig-${prodId}`);

    if (skuElem) skuElem.innerText = datos.skuCompleto;
    if (precioElem) precioElem.innerText = `Bs. ${datos.precioFinal.toFixed(2)}`;
    if (precioOrigElem) precioOrigElem.innerText = `Bs. ${datos.precioOriginal.toFixed(2)}`;

    cambiarPresentacion(prodId, presId);
}

// =========================================================================
// COMPATIBILIDAD VEHICULAR & ESPECIFICACIONES TÉCNICAS OFICIALES
// =========================================================================

function obtenerCompatibilidadVehicular(producto) {
    const nom = (producto.nombre || '').toLowerCase();
    const cat = (producto.categoria || '').toLowerCase();

    if (nom.includes('sintético') || nom.includes('sintetico') || nom.includes('0w-20') || nom.includes('5w-30')) {
        return {
            sae: 'SAE 5W-30 / 0W-20 API SP',
            motor: 'Gasolina / GNV / Híbridos VVT-i',
            modelosBolivia: 'Toyota Hilux, Corolla, RAV4; Nissan Versa, Kicks; Suzuki Grand Vitara, Swift; VW Gol',
            resumenModelos: 'Hilux, Corolla, Versa, Vitara, Gol',
            flotaPesada: 'Camiones Livianos Hino Dutro / Isuzu NPR (presentación 20L)',
            cambioKm: '10.000 km (100% Sintético Larga Vida)',
            cambioKmCorto: '10.000 km'
        };
    }

    if (nom.includes('mineral') || nom.includes('20w-50') || nom.includes('40w') || nom.includes('25w-60')) {
        return {
            sae: 'SAE 20W-50 / 25W-60 API SL/CF',
            motor: 'Gasolina / GNV / Diésel Convencional',
            modelosBolivia: 'Toyota Hilux 2.7, Hiace, Probox; Nissan Frontier D22; Suzuki Carry; Minibuses King Long',
            resumenModelos: 'Hilux 2.7, Hiace, Probox, Frontier D22',
            flotaPesada: 'Camiones Volvo FH, Hino 500, Nissan Cóndor (presentación 20L Balde)',
            cambioKm: '5.000 km (Servicio Mineral Severo)',
            cambioKmCorto: '5.000 km'
        };
    }

    if (nom.includes('refrigerante')) {
        return {
            sae: 'Norma ASTM D3306 / JIS K2234',
            motor: 'Gasolina / GNV / Diésel (Radiadores Aluminio/Cobre)',
            modelosBolivia: 'Toyota Hilux, Land Cruiser, Probox; Nissan Frontier; Suzuki Vitara; Camiones Hino',
            resumenModelos: 'Hilux, Land Cruiser, Frontier, Hino',
            flotaPesada: 'Flotas Interdepartamentales y Camiones de Carga',
            cambioKm: '40.000 km o 2 Años (OAT Larga Vida)',
            cambioKmCorto: '40.000 km'
        };
    }

    if (nom.includes('freno') || nom.includes('dot')) {
        return {
            sae: 'FMVSS 116 DOT-4 / SAE J1704',
            motor: 'Sistemas ABS / ESP / Frenos Hidráulicos',
            modelosBolivia: 'Universal: Toyota Hilux, Corolla; Nissan Frontier, Versa; Suzuki Vitara; VW Gol',
            resumenModelos: 'Toyota, Nissan, Suzuki, VW (Universal)',
            flotaPesada: 'Compatible con cajas de 12 para talleres y maestranzas',
            cambioKm: '20.000 km o 1 Año',
            cambioKmCorto: '20.000 km'
        };
    }

    if (nom.includes('grasa')) {
        return {
            sae: 'NLGI Grado 2 / DIN 51825 KP2K-30',
            motor: 'Rodamientos, Crucetas, Chasis y Masas',
            modelosBolivia: 'Flotas Pesadas Volvo, Scania, Hino; Camionetas 4x4 Toyota Hilux, Nissan Frontier',
            resumenModelos: 'Volvo, Scania, Hino, Hilux 4x4',
            flotaPesada: 'Maquinaria Pesada y Flotas de Transporte',
            cambioKm: '15.000 km o Engrase Periódico',
            cambioKmCorto: '15.000 km'
        };
    }

    if (nom.includes('filtro de aceite') || cat.includes('filtro de aceite')) {
        return {
            sae: 'Norma ISO 4548 / SAE J806 Spin-On',
            motor: 'Gasolina / Diésel / GNV',
            modelosBolivia: 'Toyota Hilux 1GD/2GD/2TR, Corolla, Hiace; Nissan Frontier YD25; Suzuki Vitara',
            resumenModelos: 'Hilux 1GD/2TR, Corolla, Frontier, Vitara',
            flotaPesada: 'Packs x6 para recambio continuo en talleres',
            cambioKm: '5.000 km - 10.000 km (Con cada cambio de aceite)',
            cambioKmCorto: '5.000-10.000 km'
        };
    }

    return {
        sae: 'Norma ISO 5011 Panel Seco / Microfibra',
        motor: 'Aspiración Motor e Interiores A/C',
        modelosBolivia: 'Toyota Hilux, Land Cruiser, Probox; Nissan Frontier; Suzuki Swift; VW Gol',
        resumenModelos: 'Hilux, Probox, Frontier, Swift, Gol',
        flotaPesada: 'Packs x6 para mantenimiento preventivo de flotas',
        cambioKm: '10.000 km (Inspección cada 5.000 km en caminos de tierra)',
        cambioKmCorto: '10.000 km'
    };
}

function obtenerSpecsTecfil(producto) {
    const nom = (producto.nombre || '').toLowerCase();
    const cat = (producto.categoria || '').toLowerCase();

    if (nom.includes('filtro de aceite') || (cat.includes('filtro') && nom.includes('aceite'))) {
        return {
            viscRosca: 'Rosca 3/4"-16 UNF',
            diamLitros: 'Ø 76mm • H 85mm',
            norma: 'ISO 4548 Spin-On'
        };
    }
    if (nom.includes('filtro') && (nom.includes('aire') || cat.includes('aire'))) {
        return {
            viscRosca: 'Flujo Radial / Panel',
            diamLitros: '280 x 165 x 42 mm',
            norma: 'ISO 5011 Seco'
        };
    }
    if (nom.includes('sintético') || nom.includes('sintetico') || nom.includes('5w-30') || nom.includes('0w-20')) {
        return {
            viscRosca: 'SAE 5W-30 API SP',
            diamLitros: '1L • 4L • 20L Balde',
            norma: 'ILSAC GF-6A'
        };
    }
    if (nom.includes('mineral') || nom.includes('20w-50') || nom.includes('15w-40') || nom.includes('40w') || nom.includes('25w-60')) {
        return {
            viscRosca: 'SAE 20W-50 / 40W',
            diamLitros: '1L • 4L • 20L Balde',
            norma: 'API SL / CF Heavy'
        };
    }
    if (nom.includes('refrigerante') || cat.includes('refrigerante')) {
        return {
            viscRosca: 'OAT Orgánico 50/50',
            diamLitros: 'Galón 3.785 Litros',
            norma: 'ASTM D3306'
        };
    }
    if (nom.includes('freno') || nom.includes('dot')) {
        return {
            viscRosca: 'DOT-4 Alto Hervor',
            diamLitros: '500ml • Caja x12',
            norma: 'FMVSS 116'
        };
    }
    if (nom.includes('grasa') || cat.includes('grasa')) {
        return {
            viscRosca: 'NLGI 2 Extrema Presión',
            diamLitros: '1 Kg • Balde 16 Kg',
            norma: 'DIN 51825 KP2K'
        };
    }
    return {
        viscRosca: 'Grado OEM Homologado',
        diamLitros: 'Presentación Taller',
        norma: 'ISO 9001:2015'
    };
}

// =========================================================================
// SECCIÓN "LANZAMIENTOS Y OFERTAS" CON PESTAÑAS + CARRUSEL TECFIL
// =========================================================================

function obtenerProductosPorLinea(linea) {
    if (!productosTienda || productosTienda.length === 0) return [];

    let filtrados = [];
    
    // 1. Filtrar por línea asignada o inferida
    const porLineaBD = productosTienda.filter(p => (p.linea || '').toLowerCase() === linea.toLowerCase());
    if (porLineaBD.length > 0) {
        filtrados = [...porLineaBD];
    } else {
        switch (linea) {
            case 'liviana':
                filtrados = productosTienda.filter(p => {
                    const nom = p.nombre.toLowerCase();
                    return nom.includes('5w-30') || nom.includes('corolla') || nom.includes('hilux') || nom.includes('dot-4') || (nom.includes('filtro') && !nom.includes('pesado'));
                });
                break;
            case 'pesada':
                filtrados = productosTienda.filter(p => {
                    const nom = p.nombre.toLowerCase();
                    return nom.includes('40w') || nom.includes('25w-60') || nom.includes('15w-40') || nom.includes('grasa') || nom.includes('pesado') || nom.includes('rojo') || nom.includes('frontier');
                });
                break;
            case 'agricola':
                filtrados = productosTienda.filter(p => {
                    const nom = p.nombre.toLowerCase();
                    return nom.includes('grasa') || nom.includes('40w') || nom.includes('refrigerante') || nom.includes('aire') || nom.includes('mineral');
                });
                break;
            case 'motos':
                filtrados = productosTienda.filter(p => {
                    const nom = p.nombre.toLowerCase();
                    return nom.includes('moto') || nom.includes('2t') || nom.includes('suzuki') || nom.includes('freno') || nom.includes('10w-40');
                });
                break;
            default:
                filtrados = [...productosTienda];
        }
    }

    // 2. Priorizar repuestos marcados en oferta (en_oferta = 1)
    filtrados.sort((a, b) => (b.en_oferta ? 1 : 0) - (a.en_oferta ? 1 : 0));

    // Asegurar mínimo 4 productos para la vitrina
    if (filtrados.length < 4) {
        const ids = new Set(filtrados.map(p => p.id));
        productosTienda.forEach(p => {
            if (!ids.has(p.id) && filtrados.length < 8) filtrados.push(p);
        });
    }

    return filtrados;
}

function cambiarLineaOfertas(linea, boton) {
    lineaOfertasActiva = linea;
    slideOfertasIndex = 0;

    const tabsContainer = document.getElementById('tecfilTabsContainer');
    if (tabsContainer) {
        tabsContainer.querySelectorAll('.tecfil-tab').forEach(tab => tab.classList.remove('active'));
    }
    if (boton) {
        boton.classList.add('active');
    }

    renderizarCarruselTecfil();
}

function renderizarCarruselTecfil() {
    const container = document.getElementById('tecfilCarouselContainer');
    const dotsContainer = document.getElementById('tecfilSquareDots');
    if (!container) return;

    const productosLinea = obtenerProductosPorLinea(lineaOfertasActiva);
    if (productosLinea.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5 text-muted">No hay ofertas disponibles para esta línea.</div>';
        return;
    }

    const itemsPorPagina = 4;
    const totalPaginas = Math.ceil(productosLinea.length / itemsPorPagina);
    if (slideOfertasIndex >= totalPaginas) slideOfertasIndex = 0;

    const inicio = slideOfertasIndex * itemsPorPagina;
    const itemsMostrar = productosLinea.slice(inicio, inicio + itemsPorPagina);

    let html = '';
    itemsMostrar.forEach((p, idx) => {
        const rutaImg = p.rutaImg || obtenerRutaImagenLocal(p, idx);
        const presActiva = presentacionesSeleccionadas[p.id] || obtenerPresentaciones(p)[0].id;
        const datos = calcularDatosPresentacion(p, presActiva, true);
        const compat = obtenerCompatibilidadVehicular(p);
        const specs = obtenerSpecsTecfil(p);

        html += `
            <div class="col-12 col-sm-6 col-lg-3">
                <div class="tecfil-tech-card position-relative" onclick="abrirFichaTecnica(${p.id})">
                    
                    ${(esAdminOTrabajador && modoEdicionActivo) ? `
                        <div class="admin-card-overlay-actions">
                            <button type="button" class="btn btn-warning" onclick="event.stopPropagation(); abrirModalEditarProducto(${p.id})" title="Editar repuesto">
                                <i class="bi bi-pencil-square"></i> Editar
                            </button>
                            <button type="button" class="btn ${p.en_oferta ? 'btn-danger' : 'btn-dark text-warning'}" onclick="event.stopPropagation(); alternarOfertaRapida(${p.id})" title="Activar/Desactivar en ofertas">
                                <i class="bi bi-tag-fill"></i> ${p.en_oferta ? 'Oferta ON' : 'Oferta OFF'}
                            </button>
                        </div>
                    ` : ''}

                    <!-- Marco Industrial Amarillo Ficha Técnica Tecfil -->
                    <div class="tecfil-tech-frame">
                        <div class="tecfil-tech-frame-top">
                            <span style="font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 0.82rem; color: #141619;">GOLDEN</span>
                            <span class="badge" style="background: #B91C1C; color: #FFFFFF; font-size: 0.65rem; font-family: 'Chivo Mono', monospace;">-15% MAYORISTA</span>
                        </div>
                        
                        <div class="tecfil-sku-code mb-1" id="tecfil-sku-${p.id}">
                            ${datos.skuCompleto}
                        </div>

                        <div class="text-center py-2" style="min-height: 120px; display: flex; align-items: center; justify-content: center;">
                            <img src="${rutaImg}" alt="${escaparHTML(p.nombre)}" style="max-height: 110px; max-width: 100%; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));" onerror="this.onerror=null; this.src=FALLBACK_IMG_OFFLINE;">
                        </div>

                        <div class="tecfil-spec-table">
                            <div><strong>Visc/Rosca:</strong> ${specs.viscRosca}</div>
                            <div><strong>Litraje/Dim:</strong> ${specs.diamLitros}</div>
                        </div>

                        <div class="tecfil-compat-badge text-truncate" title="${compat.resumenModelos}">
                            <i class="bi bi-car-front-fill me-1 text-danger"></i>${compat.resumenModelos}
                        </div>
                    </div>

                    <!-- Datos Comerciales y Compra -->
                    <div class="d-flex flex-column flex-grow-1 justify-content-between">
                        <div>
                            <span class="text-muted text-uppercase font-mono d-block mb-1" style="font-size: 0.68rem; letter-spacing: 0.5px;">${p.categoria}</span>
                            <h6 class="fw-bold text-dark mb-2 text-truncate-2" style="font-size: 0.88rem; min-height: 38px; line-height: 1.25; font-family: 'Archivo', sans-serif;" title="${escaparHTML(p.nombre)}">
                                ${escaparHTML(p.nombre)}
                            </h6>

                            <!-- Selector de Presentación -->
                            <div class="presentaciones-selector mb-3" id="tecfil-pres-${p.id}">
                                ${obtenerPresentaciones(p).map(pres => `
                                    <button type="button" 
                                            class="btn-presentacion ${pres.id === presActiva ? 'active' : ''}" 
                                            data-pres-id="${pres.id}" 
                                            onclick="cambiarPresentacionTecfil(${p.id}, '${pres.id}', event)">
                                        ${pres.label}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <div class="pt-2 border-top" style="border-color: #E2E8F0;">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div>
                                    <span class="text-muted text-decoration-line-through font-mono small d-block" id="tecfil-precio-orig-${p.id}" style="font-size: 0.7rem; line-height: 1;">
                                        Bs. ${datos.precioOriginal.toFixed(2)}
                                    </span>
                                    <span class="fw-bold font-mono text-dark" id="tecfil-precio-${p.id}" style="font-size: 1.25rem;">
                                        Bs. ${datos.precioFinal.toFixed(2)}
                                    </span>
                                </div>
                                <span class="badge" style="background: #F1F5F9; color: #475569; font-size: 0.68rem;">c/Factura</span>
                            </div>

                            <button class="btn btn-danger w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2" 
                                    style="background: #B91C1C; border-color: #B91C1C; border-radius: 4px; font-size: 0.82rem;" 
                                    onclick="event.stopPropagation(); agregarOfertaAlCarrito(${p.id}, this)">
                                <i class="bi bi-cart-plus-fill"></i>
                                <span>Agregar al pedido</span>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Renderizar dots cuadrados
    if (dotsContainer) {
        let dotsHTML = '';
        for (let i = 0; i < totalPaginas; i++) {
            dotsHTML += `
                <button type="button" 
                        class="tecfil-square-dot ${i === slideOfertasIndex ? 'active' : ''}" 
                        onclick="irASlideTecfil(${i})" 
                        title="Página ${i + 1}" 
                        aria-label="Página ${i + 1}">
                </button>
            `;
        }
        dotsContainer.innerHTML = dotsHTML;
    }
}

function deslizarOfertasTecfil(delta) {
    const productosLinea = obtenerProductosPorLinea(lineaOfertasActiva);
    const itemsPorPagina = 4;
    const totalPaginas = Math.ceil(productosLinea.length / itemsPorPagina);
    if (totalPaginas <= 1) return;

    slideOfertasIndex = (slideOfertasIndex + delta + totalPaginas) % totalPaginas;
    renderizarCarruselTecfil();
}

function irASlideTecfil(index) {
    slideOfertasIndex = index;
    renderizarCarruselTecfil();
}

function iniciarAutoPlayTecfil() {
    detenerAutoPlayTecfil();
    carruselTecfilTimer = setInterval(() => {
        deslizarOfertasTecfil(1);
    }, 4500);

    const seccion = document.getElementById('lanzamientosOfertas');
    if (seccion) {
        seccion.addEventListener('mouseenter', detenerAutoPlayTecfil);
        seccion.addEventListener('mouseleave', iniciarAutoPlayTecfil);
    }
}

function detenerAutoPlayTecfil() {
    if (carruselTecfilTimer) {
        clearInterval(carruselTecfilTimer);
        carruselTecfilTimer = null;
    }
}

// =========================================================================
// SHOWCASE TÉCNICO INTERACTIVO "CONOZCA NUESTROS PRODUCTOS"
// =========================================================================

function seleccionarShowcase(catKey, boton) {
    const data = showcaseTecnicoData[catKey];
    if (!data) return;

    document.querySelectorAll('.btn-showcase-tab').forEach(b => b.classList.remove('active'));
    if (boton) boton.classList.add('active');

    const elBadge = document.getElementById('showcaseBadge');
    const elTit = document.getElementById('showcaseTitulo');
    const elSub = document.getElementById('showcaseSubtitulo');
    const elDesc = document.getElementById('showcaseDescripcion');
    const elBeneficios = document.getElementById('showcaseBeneficios');
    const btnFiltrar = document.getElementById('btnShowcaseFiltrar');

    if (elBadge) elBadge.innerText = data.badge;
    if (elTit) elTit.innerText = data.titulo;
    if (elSub) elSub.innerText = data.subtitulo;
    if (elDesc) elDesc.innerText = data.descripcion;

    if (elBeneficios) {
        elBeneficios.innerHTML = data.beneficios.map(b => `
            <li class="mb-2 d-flex align-items-start gap-2">
                <i class="bi bi-check-circle-fill text-success fs-6 mt-1 flex-shrink-0"></i>
                <span>${b}</span>
            </li>
        `).join('');
    }

    if (btnFiltrar) {
        btnFiltrar.setAttribute('onclick', `filtrarDesdeShowcase('${data.categoriaFiltro}')`);
    }

    const imgPri = document.getElementById('showcaseImgPrincipal');
    const imgSec = document.getElementById('showcaseImgSecundaria');
    const codDest = document.getElementById('showcaseCodigoDestacado');

    if (imgPri) imgPri.src = data.imgPrincipal;
    if (imgSec) imgSec.src = data.imgSecundaria;
    if (codDest) codDest.innerText = data.codigoDestacado;
}

function filtrarDesdeShowcase(categoria) {
    filtrarCategoria(categoria);
    const catalogo = document.getElementById('catalogoGeneral');
    if (catalogo) {
        catalogo.scrollIntoView({ behavior: 'smooth' });
    }
}

// =========================================================================
// SECCIÓN "SEGMENTOS GOLDEN" & CATÁLOGO GENERAL
// =========================================================================

function filtrarPorSegmento(segmento, cardElemento) {
    document.querySelectorAll('.tecfil-segment-card').forEach(c => c.classList.remove('active'));
    if (cardElemento) cardElemento.classList.add('active');

    const selectVehiculo = document.getElementById('filtroVehiculo');

    switch (segmento) {
        case 'liviana':
            vehiculoSeleccionado = 'hilux';
            if (selectVehiculo) selectVehiculo.value = 'hilux';
            break;
        case 'pesado':
            vehiculoSeleccionado = 'pesado';
            if (selectVehiculo) selectVehiculo.value = 'pesado';
            break;
        case 'flotas':
            vehiculoSeleccionado = 'pesado';
            if (selectVehiculo) selectVehiculo.value = 'pesado';
            break;
        case 'maquinaria':
            vehiculoSeleccionado = 'pesado';
            if (selectVehiculo) selectVehiculo.value = 'pesado';
            break;
        default:
            vehiculoSeleccionado = '';
            if (selectVehiculo) selectVehiculo.value = '';
    }

    renderizarCatalogo();
    const catalogo = document.getElementById('catalogoGeneral');
    if (catalogo) {
        catalogo.scrollIntoView({ behavior: 'smooth' });
    }
}

async function cargarCatalogo() {
    const contenedor = document.getElementById('catalogoProductos');
    if (contenedor && (!productosTienda || productosTienda.length === 0)) {
        contenedor.innerHTML = '<div class="col-12 text-center py-5"><span class="spinner-border spinner-border-sm text-danger me-2"></span><span class="text-muted">Cargando catálogo oficial de repuestos...</span></div>';
    }

    try {
        const res = await fetch(`${API_URL}/productos?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar productos');
        const data = await res.json();
        
        productosTienda = data.map((p, idx) => {
            p.categoria = normalizarCategoriaProducto(p);
            p.rutaImg = (p.imagen_url && p.imagen_url.startsWith('./img/') && !p.imagen_url.includes('placehold.co'))
                ? p.imagen_url 
                : obtenerRutaImagenLocal(p, idx);
            p.en_oferta = Boolean(p.en_oferta);
            return p;
        });
        
        renderizarCarruselTecfil();
        renderizarCatalogo();
        iniciarEfectoTiltCards();
    } catch (error) {
        console.error("Error al cargar catálogo:", error);
        if (contenedor) {
            contenedor.innerHTML = '<div class="col-12 text-center py-5 text-danger"><i class="bi bi-exclamation-triangle me-1"></i>Error al conectar con el servidor de inventario.</div>';
        }
        Toast.fire({ icon: 'error', title: 'Error al cargar catálogo de productos' });
    }
}

function generarTarjetaProductoHTML(producto, index = 0, esOfertaForzada = false) {
    const p = producto;
    const rutaImg = p.rutaImg || obtenerRutaImagenLocal(p, index);
    p.rutaImg = rutaImg;
    const nombreEsc = escaparHTML(p.nombre);

    const esOferta = esOfertaForzada || Boolean(p.en_oferta || p.stock >= 20 || categoriaActual === 'Ofertas');
    const presActiva = presentacionesSeleccionadas[p.id] || obtenerPresentaciones(p)[0].id;
    const datos = calcularDatosPresentacion(p, presActiva, esOferta);
    const compat = obtenerCompatibilidadVehicular(p);

    const sinStock = datos.stockDisponible <= 0;
    
    let badgeStockHTML = '';
    if (sinStock) {
        badgeStockHTML = `<span class="card-stock-label stock-out fw-bold text-uppercase" id="stock-prod-${p.id}" style="background:#FEE2E2; color:#B91C1C; border:1px solid #FCA5A5; font-size:0.75rem;">AGOTADO</span>`;
    } else if (p.stock <= p.stock_minimo) {
        badgeStockHTML = `<span class="card-stock-label stock-alert" id="stock-prod-${p.id}">Últimas ${datos.stockDisponible} unidades</span>`;
    } else {
        badgeStockHTML = `<span class="card-stock-label stock-ok" id="stock-prod-${p.id}">En almacén: ${datos.stockDisponible} unid.</span>`;
    }

    let controlCompraHTML = '';
    if (sinStock) {
        controlCompraHTML = `<button class="btn btn-secondary btn-sm px-3 py-1 fw-bold opacity-50 text-uppercase" disabled id="btn-compra-${p.id}" style="font-size:0.75rem;">AGOTADO</button>`;
    } else {
        controlCompraHTML = `
            <div class="d-flex align-items-center gap-1" id="wrap-compra-${p.id}" onclick="event.stopPropagation();">
                <div class="input-group input-group-sm" style="width: 78px;">
                    <button class="btn btn-outline-secondary px-1 py-0" type="button" onclick="ajustarCantidadTarjeta(${p.id}, -1)">-</button>
                    <input type="number" id="cant-card-${p.id}" class="form-control text-center px-0 py-0 font-mono fw-bold" value="1" min="1" max="${datos.stockDisponible}" onchange="validarCantidadTarjeta(${p.id}, this)" style="font-size: 0.82rem; height: 26px;">
                    <button class="btn btn-outline-secondary px-1 py-0" type="button" onclick="ajustarCantidadTarjeta(${p.id}, 1)">+</button>
                </div>
                <button class="btn btn-primary btn-sm px-2 py-1 d-flex align-items-center gap-1" 
                        style="background-color: #B91C1C; border-color: #B91C1C; border-radius: 4px; height: 26px; font-size: 0.76rem;"
                        onclick="event.stopPropagation(); agregarDesdeTarjeta(${p.id})">
                    <i class="bi bi-cart-plus"></i>
                    <span>Agregar</span>
                </button>
            </div>
        `;
    }

    return `
        <div class="col-12 col-sm-6 col-md-4 col-lg-3 stagger-card" style="--stagger-i: ${index};">
            <div class="card-producto-wix h-100 d-flex flex-column border position-relative" onclick="abrirFichaTecnica(${p.id})" title="Ver Ficha Técnica y Aplicaciones">
                
                ${(esAdminOTrabajador && modoEdicionActivo) ? `
                    <div class="admin-card-overlay-actions">
                        <button type="button" class="btn btn-warning" onclick="event.stopPropagation(); abrirModalEditarProducto(${p.id})" title="Editar repuesto">
                            <i class="bi bi-pencil-square"></i> Editar
                        </button>
                        <button type="button" class="btn ${p.en_oferta ? 'btn-danger' : 'btn-dark text-warning'}" onclick="event.stopPropagation(); alternarOfertaRapida(${p.id})" title="Activar/Desactivar en ofertas">
                            <i class="bi bi-tag-fill"></i> ${p.en_oferta ? 'Oferta ON' : 'Oferta OFF'}
                        </button>
                    </div>
                ` : ''}

                <div class="card-prod-topbar">
                    <span class="card-prod-categoria">${p.categoria}</span>
                    <span class="card-prod-sku" id="sku-prod-${p.id}">${datos.skuCompleto}</span>
                </div>

                <div class="wix-img-wrapper">
                    <img src="${rutaImg}" alt="${nombreEsc}" onerror="this.onerror=null; this.src=FALLBACK_IMG_OFFLINE;">
                    ${esOferta ? `
                        <div class="position-absolute top-0 start-0 m-2">
                            <span class="badge" style="background: #B91C1C; color: #FFFFFF; font-family: 'Chivo Mono', monospace; font-size: 0.7rem; font-weight: 700; padding: 3px 6px; border-radius: 4px;">
                                -15% DTO
                            </span>
                        </div>
                    ` : ''}
                </div>

                <div class="card-prod-body">
                    <h6 class="card-prod-title" title="${nombreEsc}">
                        ${nombreEsc}
                    </h6>

                    <div class="card-compat-text">
                        <strong>Ideal para:</strong> ${p.compatibilidad || compat.resumenModelos}
                    </div>

                    <div class="presentaciones-selector" id="presentaciones-prod-${p.id}">
                        ${obtenerPresentaciones(p).map(pres => `
                            <button type="button" 
                                    class="btn-presentacion ${pres.id === presActiva ? 'active' : ''}" 
                                    data-pres-id="${pres.id}" 
                                    onclick="cambiarPresentacion(${p.id}, '${pres.id}', event)">
                                ${pres.label}
                            </button>
                        `).join('')}
                    </div>

                    <div class="card-price-action-row">
                        <div class="card-price-block">
                            ${esOferta ? `
                                <span class="text-muted small text-decoration-line-through font-mono d-block" id="precio-orig-prod-${p.id}" style="font-size: 0.72rem; line-height: 1;">
                                    Bs. ${datos.precioOriginal.toFixed(2)}
                                </span>
                            ` : ''}
                            <div class="card-price-tag" id="precio-prod-${p.id}">
                                Bs. ${datos.precioFinal.toFixed(2)}
                            </div>
                            <span class="card-price-sublabel">Precio taller c/factura</span>
                            ${badgeStockHTML}
                        </div>

                        <div>
                            ${controlCompraHTML}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;
}

function inicializarBuscadorCatalogo() {
    const input = document.getElementById('buscadorCatalogo');
    const btnLimpiar = document.getElementById('btnLimpiarBuscador');
    if (!input) return;

    input.addEventListener('input', (e) => {
        terminoBusqueda = e.target.value.toLowerCase().trim();
        if (btnLimpiar) {
            if (terminoBusqueda) btnLimpiar.classList.remove('d-none');
            else btnLimpiar.classList.add('d-none');
        }
        renderizarCatalogo();
    });
}

function limpiarBuscadorCatalogo() {
    const input = document.getElementById('buscadorCatalogo');
    const btnLimpiar = document.getElementById('btnLimpiarBuscador');
    if (input) {
        input.value = '';
        terminoBusqueda = '';
        input.focus();
    }
    if (btnLimpiar) btnLimpiar.classList.add('d-none');
    renderizarCatalogo();
}

function renderizarCatalogo() {
    const contenedor = document.getElementById('catalogoProductos');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    let productosFiltrados = productosTienda;

    if (categoriaActual === 'Ofertas') {
        productosFiltrados = productosFiltrados.filter(p => p.en_oferta || p.stock >= 20);
    } else if (categoriaActual === 'Aceites Minerales') {
        productosFiltrados = productosFiltrados.filter(p => p.categoria.toUpperCase().includes('MINERAL'));
    } else if (categoriaActual === 'Aceites Sintéticos') {
        productosFiltrados = productosFiltrados.filter(p => p.categoria.toUpperCase().includes('SINT'));
    } else if (categoriaActual === 'Filtros de Aceite') {
        productosFiltrados = productosFiltrados.filter(p => p.categoria.toUpperCase().includes('FILTRO') && p.categoria.toUpperCase().includes('ACEITE'));
    } else if (categoriaActual === 'Filtros de Aire') {
        productosFiltrados = productosFiltrados.filter(p => p.categoria.toUpperCase().includes('FILTRO') && p.categoria.toUpperCase().includes('AIRE'));
    } else if (categoriaActual === 'Refrigerantes y Líquidos') {
        productosFiltrados = productosFiltrados.filter(p => 
            p.categoria.toUpperCase().includes('REFRIGERANTE') || 
            p.categoria.toUpperCase().includes('FLUIDO') || 
            p.categoria.toUpperCase().includes('LÍQUIDO') || 
            p.categoria.toUpperCase().includes('LIQUIDO') || 
            p.categoria.toUpperCase().includes('GRASA')
        );
    } else if (categoriaActual !== 'Todos') {
        productosFiltrados = productosFiltrados.filter(p => p.categoria === categoriaActual);
    }

    if (viscosidadActual) {
        const saeRaw = viscosidadActual.toLowerCase();
        const saeClean = saeRaw.replace('-', '');
        productosFiltrados = productosFiltrados.filter(p => {
            const nom = (p.nombre || '').toLowerCase();
            const nomClean = nom.replace('-', '');
            const compat = obtenerCompatibilidadVehicular(p);
            const saeCompat = (compat.sae || '').toLowerCase();
            return nom.includes(saeRaw) || nomClean.includes(saeClean) || saeCompat.includes(saeRaw) || saeCompat.includes(saeClean);
        });
    }

    if (vehiculoSeleccionado) {
        productosFiltrados = productosFiltrados.filter(p => esCompatibleConVehiculo(p, vehiculoSeleccionado));
    }

    if (terminoBusqueda) {
        productosFiltrados = productosFiltrados.filter(p => {
            const sku = (p.sku || '').toLowerCase();
            const nom = (p.nombre || '').toLowerCase();
            const cat = (p.categoria || '').toLowerCase();
            const compat = obtenerCompatibilidadVehicular(p);
            const vehiculos = (compat.modelosBolivia + ' ' + compat.sae + ' ' + compat.motor + ' ' + compat.flotaPesada).toLowerCase();
            const presList = obtenerPresentaciones(p).map(pr => pr.label + ' ' + pr.nombreCompleto).join(' ').toLowerCase();

            return sku.includes(terminoBusqueda) || 
                   nom.includes(terminoBusqueda) || 
                   cat.includes(terminoBusqueda) || 
                   vehiculos.includes(terminoBusqueda) || 
                   presList.includes(terminoBusqueda);
        });
    }

    if (productosFiltrados.length === 0) {
        contenedor.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="d-inline-flex align-items-center justify-content-center mb-3" style="width: 56px; height: 56px; background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 6px;">
                    <i class="bi bi-search fs-3 text-muted"></i>
                </div>
                <h5 class="text-dark fw-bold">No se encontraron repuestos con los filtros seleccionados</h5>
                <p class="text-muted small mx-auto" style="max-width: 480px;">
                    Intenta cambiar la viscosidad, el modelo de vehículo o restablecer los filtros de búsqueda.
                </p>
                <button class="btn btn-secondary btn-sm px-3 mt-2" onclick="limpiarTodosFiltros()">
                    <i class="bi bi-arrow-counterclockwise me-1"></i> Restablecer Filtros
                </button>
            </div>`;
        return;
    }

    let html = '';
    productosFiltrados.forEach((producto, index) => {
        html += generarTarjetaProductoHTML(producto, index, false);
    });

    contenedor.innerHTML = html;
    iniciarEfectoTiltCards();
}

function filtrarCategoria(categoria, botonElemento) {
    categoriaActual = categoria;
    document.querySelectorAll('.btn-secondary, .btn-filter-stitch').forEach(btn => btn.classList.remove('active'));
    if (botonElemento) {
        botonElemento.classList.add('active');
    }
    renderizarCatalogo();
}

function filtrarViscosidad(sae, botonElemento) {
    if (viscosidadActual === sae && sae !== '') {
        viscosidadActual = '';
        document.querySelectorAll('.btn-viscosidad-pill').forEach(btn => btn.classList.remove('active'));
        const todasPill = document.querySelector('.btn-viscosidad-pill');
        if (todasPill) todasPill.classList.add('active');
    } else {
        viscosidadActual = sae;
        document.querySelectorAll('.btn-viscosidad-pill').forEach(btn => btn.classList.remove('active'));
        if (botonElemento) botonElemento.classList.add('active');
    }
    renderizarCatalogo();
}

function filtrarPorVehiculo(valor) {
    vehiculoSeleccionado = valor;
    renderizarCatalogo();
}

function esCompatibleConVehiculo(producto, vehiculo) {
    if (!vehiculo) return true;
    const nom = (producto.nombre || '').toLowerCase();
    const sku = (producto.sku || '').toLowerCase();
    const compat = obtenerCompatibilidadVehicular(producto);
    const modelos = ((compat.modelosBolivia || '') + ' ' + (compat.resumenModelos || '') + ' ' + (compat.flotaPesada || '')).toLowerCase();
    
    let specsStr = '';
    if (producto.especificaciones) {
        specsStr = (typeof producto.especificaciones === 'string' 
            ? producto.especificaciones 
            : JSON.stringify(producto.especificaciones)).toLowerCase();
    }
    const todo = nom + ' ' + sku + ' ' + modelos + ' ' + specsStr;

    switch (vehiculo) {
        case 'hilux':
            return todo.includes('hilux') || todo.includes('toyota') || nom.includes('freno') || nom.includes('dot-4') || nom.includes('refrigerante');
        case 'corolla_probox':
            return todo.includes('corolla') || todo.includes('probox') || todo.includes('toyota') || (nom.includes('sintético') && !nom.includes('moto')) || nom.includes('freno');
        case 'frontier':
            return todo.includes('frontier') || todo.includes('nissan') || todo.includes('sentra') || nom.includes('freno') || nom.includes('grasa');
        case 'suzuki':
            return todo.includes('suzuki') || todo.includes('vitara') || todo.includes('swift') || todo.includes('carry') || (nom.includes('5w-30') || nom.includes('10w-40')) || nom.includes('freno');
        case 'pesado':
            return todo.includes('pesado') || todo.includes('volvo') || todo.includes('hino') || todo.includes('camion') || todo.includes('scania') || nom.includes('40w') || nom.includes('25w-60') || nom.includes('grasa') || (nom.includes('refrigerante') && nom.includes('rojo'));
        default:
            return true;
    }
}

function limpiarTodosFiltros() {
    categoriaActual = 'Todos';
    viscosidadActual = '';
    vehiculoSeleccionado = '';
    terminoBusqueda = '';

    const inputBuscador = document.getElementById('buscadorCatalogo');
    if (inputBuscador) inputBuscador.value = '';

    const selectVehiculo = document.getElementById('filtroVehiculo');
    if (selectVehiculo) selectVehiculo.value = '';

    document.querySelectorAll('.btn-secondary').forEach((b, i) => {
        if (i === 0) b.classList.add('active');
        else b.classList.remove('active');
    });

    document.querySelectorAll('.btn-viscosidad-pill').forEach((b, i) => {
        if (i === 0) b.classList.add('active');
        else b.classList.remove('active');
    });

    renderizarCatalogo();
}

// =========================================================================
// BUSCADOR RÁPIDO DEL NAVBAR CON DESPLEGABLE INTELIGENTE
// =========================================================================

function manejarBusquedaNavbar(termino) {
    const dropdown = document.getElementById('navbarSearchDropdown');
    if (!dropdown) return;

    const term = (termino || '').trim().toLowerCase();
    if (term.length < 2) {
        dropdown.classList.add('d-none');
        dropdown.innerHTML = '';
        return;
    }

    const matches = productosTienda.filter(p => {
        const nom = (p.nombre || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const cat = (p.categoria || '').toLowerCase();
        const compat = obtenerCompatibilidadVehicular(p);
        const veh = (compat.resumenModelos + ' ' + compat.sae).toLowerCase();
        return nom.includes(term) || sku.includes(term) || cat.includes(term) || veh.includes(term);
    }).slice(0, 5);

    if (matches.length === 0) {
        dropdown.innerHTML = `
            <div class="p-3 text-center text-muted small">
                <i class="bi bi-search me-1"></i> No se encontraron repuestos para "${escaparHTML(termino)}"
            </div>
        `;
        dropdown.classList.remove('d-none');
        return;
    }

    let itemsHTML = '<div class="list-group list-group-flush">';
    matches.forEach(p => {
        const rutaImg = p.rutaImg || obtenerRutaImagenLocal(p);
        itemsHTML += `
            <a href="javascript:void(0)" 
               class="list-group-item list-group-item-action d-flex align-items-center gap-2 p-2" 
               onclick="seleccionarResultadoNavbar(${p.id})">
                <img src="${rutaImg}" alt="${escaparHTML(p.nombre)}" style="width: 38px; height: 38px; object-fit: contain; border-radius: 4px; border: 1px solid #E2E8F0; padding: 2px;">
                <div class="flex-grow-1 text-truncate">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="font-mono text-danger fw-bold" style="font-size: 0.72rem;">${p.sku}</span>
                        <strong class="font-mono text-dark" style="font-size: 0.78rem;">Bs. ${parseFloat(p.precio).toFixed(2)}</strong>
                    </div>
                    <div class="text-truncate fw-semibold text-dark small" style="font-size: 0.8rem;">${escaparHTML(p.nombre)}</div>
                </div>
            </a>
        `;
    });

    itemsHTML += `
        <a href="#catalogoGeneral" 
           class="list-group-item list-group-item-action text-center py-2 bg-light text-danger fw-bold small" 
           onclick="buscarEnCatalogoDirecto('${escaparHTML(term)}')">
            Ver todos los resultados en el catálogo &rarr;
        </a>
    </div>`;

    dropdown.innerHTML = itemsHTML;
    dropdown.classList.remove('d-none');
}

function seleccionarResultadoNavbar(prodId) {
    const dropdown = document.getElementById('navbarSearchDropdown');
    if (dropdown) dropdown.classList.add('d-none');
    abrirFichaTecnica(prodId);
}

function buscarEnCatalogoDirecto(termino) {
    const dropdown = document.getElementById('navbarSearchDropdown');
    if (dropdown) dropdown.classList.add('d-none');

    const inputCat = document.getElementById('buscadorCatalogo');
    if (inputCat) inputCat.value = termino;
    terminoBusqueda = termino.toLowerCase();

    renderizarCatalogo();
    const catalogo = document.getElementById('catalogoGeneral');
    if (catalogo) {
        catalogo.scrollIntoView({ behavior: 'smooth' });
    }
}

// =========================================================================
// MICRO-INTERACCIONES FÍSICAS: 3D TILT EFFECT EN CATÁLOGO GENERAL
// =========================================================================

function iniciarEfectoTiltCards() {
    const cards = document.querySelectorAll('.card-producto-wix');
    cards.forEach(card => {
        if (card.dataset.tiltInitialized === 'true') return;
        card.dataset.tiltInitialized = 'true';

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centroX = rect.width / 2;
            const centroY = rect.height / 2;
            const deltaX = (x - centroX) / centroX;
            const deltaY = (y - centroY) / centroY;

            const rotateX = (-deltaY * 7).toFixed(2);
            const rotateY = (deltaX * 7).toFixed(2);

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            card.classList.add('is-tilting');

            const img = card.querySelector('.wix-img-wrapper img');
            if (img) {
                img.style.transform = `translateZ(26px) scale(1.07)`;
            }
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            card.classList.remove('is-tilting');
            const img = card.querySelector('.wix-img-wrapper img');
            if (img) {
                img.style.transform = 'translateZ(0) scale(1)';
            }
        });
    });
}

// =========================================================================
// ANIMACIÓN MAGNÉTICA "FLY-TO-CART" & REBOTE EN BARRA SUPERIOR
// =========================================================================

function animarVueloAlCarrito(elementoOrigen) {
    const targetCart = document.getElementById('topBarCartCount') || document.querySelector('[data-bs-target="#carritoLateral"]');
    if (!targetCart) return;

    let origenRect = null;
    let imgSrc = null;

    if (elementoOrigen && elementoOrigen.getBoundingClientRect) {
        const card = elementoOrigen.closest ? elementoOrigen.closest('.card-producto-wix, .tecfil-tech-card') : null;
        if (card) {
            const img = card.querySelector('img');
            if (img) {
                imgSrc = img.src;
                origenRect = img.getBoundingClientRect();
            }
        }
        if (!origenRect) origenRect = elementoOrigen.getBoundingClientRect();
    }

    if (!origenRect) {
        origenRect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 40, height: 40 };
    }

    const destinoRect = targetCart.getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.className = 'fly-to-cart-ghost';
    ghost.style.left = `${origenRect.left + (origenRect.width / 2) - 25}px`;
    ghost.style.top = `${origenRect.top + (origenRect.height / 2) - 25}px`;
    ghost.style.width = '50px';
    ghost.style.height = '50px';

    if (imgSrc) {
        ghost.style.backgroundImage = `url("${imgSrc}")`;
        ghost.style.backgroundSize = 'contain';
        ghost.style.backgroundRepeat = 'no-repeat';
        ghost.style.backgroundPosition = 'center';
    } else {
        ghost.innerHTML = '<i class="bi bi-cart-fill text-danger fs-3"></i>';
    }

    document.body.appendChild(ghost);
    void ghost.offsetWidth;

    ghost.style.transition = 'all 0.65s cubic-bezier(0.2, 0.8, 0.2, 1)';
    ghost.style.left = `${destinoRect.left + (destinoRect.width / 2) - 15}px`;
    ghost.style.top = `${destinoRect.top + (destinoRect.height / 2) - 15}px`;
    ghost.style.width = '24px';
    ghost.style.height = '24px';
    ghost.style.opacity = '0.3';
    ghost.style.transform = 'scale(0.3) rotate(360deg)';

    setTimeout(() => {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);

        const badgeContador = document.getElementById('topBarCartCount');
        const botonCarrito = document.querySelector('[data-bs-target="#carritoLateral"]');
        if (badgeContador) {
            badgeContador.classList.remove('cart-bounce-active');
            void badgeContador.offsetWidth;
            badgeContador.classList.add('cart-bounce-active');
            setTimeout(() => badgeContador.classList.remove('cart-bounce-active'), 650);
        }
        if (botonCarrito) {
            botonCarrito.classList.remove('cart-bounce-active');
            void botonCarrito.offsetWidth;
            botonCarrito.classList.add('cart-bounce-active');
            setTimeout(() => botonCarrito.classList.remove('cart-bounce-active'), 650);
        }
    }, 650);
}

// =========================================================================
// MODAL DE FICHA TÉCNICA OFICIAL & COMPATIBILIDAD VEHICULAR
// =========================================================================

function abrirFichaTecnica(idProducto) {
    const producto = productosTienda.find(p => p.id === idProducto);
    if (!producto) return;
    productoFichaActual = producto;

    const presActiva = presentacionesSeleccionadas[producto.id] || obtenerPresentaciones(producto)[0].id;
    const esOferta = Boolean(producto.en_oferta || producto.stock >= 20 || categoriaActual === 'Ofertas');
    const datos = calcularDatosPresentacion(producto, presActiva, esOferta);
    const compat = obtenerCompatibilidadVehicular(producto);

    const elSku = document.getElementById('fichaModalSku');
    const elCat = document.getElementById('fichaModalCategoria');
    const elTit = document.getElementById('fichaModalTitulo');
    const elPre = document.getElementById('fichaModalPrecio');
    const elImg = document.getElementById('fichaModalImagen');

    if (elSku) elSku.innerText = datos.skuCompleto;
    if (elCat) elCat.innerText = producto.categoria;
    if (elTit) elTit.innerText = producto.nombre;
    if (elPre) elPre.innerText = `Bs. ${datos.precioFinal.toFixed(2)}`;
    if (elImg) {
        elImg.src = producto.rutaImg || obtenerRutaImagenLocal(producto);
        elImg.alt = producto.nombre;
    }

    const elPresCont = document.getElementById('fichaModalPresentaciones');
    if (elPresCont) {
        elPresCont.innerHTML = obtenerPresentaciones(producto).map(pres => `
            <button type="button" 
                    class="btn-presentacion ${pres.id === presActiva ? 'active' : ''}" 
                    data-modal-pres-id="${pres.id}"
                    onclick="cambiarPresentacionModal(${producto.id}, '${pres.id}')">
                ${pres.nombreCompleto}
            </button>
        `).join('');
    }

    const sinStock = datos.stockDisponible <= 0;
    const badgeStock = sinStock
        ? '<span class="badge" style="background:#FEE2E2; color:#B91C1C; font-weight:700;">Agotado</span>'
        : (producto.stock <= producto.stock_minimo
            ? `<span class="badge" style="background:#FEF3C7; color:#B45309; font-weight:700;">¡Últimas ${datos.stockDisponible} unid.!</span>`
            : `<span class="badge" style="background:#DCFCE7; color:#15803D; font-weight:700;">En Almacén: ${datos.stockDisponible} unid.</span>`);
    
    const elBadgeStock = document.getElementById('fichaModalBadgeStock');
    const elStockMax = document.getElementById('fichaModalStockMax');
    if (elBadgeStock) elBadgeStock.innerHTML = badgeStock;
    if (elStockMax) elStockMax.innerText = `(${datos.stockDisponible} disponibles)`;

    const inputCant = document.getElementById('fichaInputCantidad');
    if (inputCant) {
        inputCant.value = 1;
        inputCant.max = datos.stockDisponible;
        inputCant.disabled = sinStock;
    }

    const btnAgregar = document.getElementById('btnFichaAgregarCarrito');
    if (btnAgregar) {
        if (sinStock) {
            btnAgregar.disabled = true;
            btnAgregar.className = 'btn btn-secondary w-100 py-3 fw-bold fs-5 opacity-50';
            btnAgregar.innerHTML = '<i class="bi bi-x-circle me-1"></i> Sin Stock Disponible';
        } else {
            btnAgregar.disabled = false;
            btnAgregar.className = 'btn btn-primary w-100 py-3 fw-bold fs-5 shadow-sm d-flex align-items-center justify-content-center gap-2';
            btnAgregar.style.backgroundColor = '#B91C1C';
            btnAgregar.style.borderColor = '#B91C1C';
            btnAgregar.innerHTML = '<i class="bi bi-cart-plus-fill fs-4"></i><span>Agregar al pedido</span>';
            btnAgregar.onclick = () => {
                const cant = parseInt(inputCant ? inputCant.value : 1) || 1;
                agregarAlCarrito(producto.id, cant, datos.precioFinal, esOferta, btnAgregar);
                const modalEl = document.getElementById('modalFichaTecnica');
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
            };
        }
    }

    const tbodySpecs = document.getElementById('fichaModalEspecificaciones');
    if (tbodySpecs) {
        tbodySpecs.innerHTML = `
            <tr><td class="spec-key" style="font-weight: 600; width: 40%;"><i class="bi bi-droplet-half text-danger me-2"></i>Viscosidad / Grado</td><td class="spec-val font-mono">${compat.sae}</td></tr>
            <tr><td class="spec-key" style="font-weight: 600;"><i class="bi bi-fuel-pump text-danger me-2"></i>Tipo de Combustible</td><td class="spec-val">${compat.motor}</td></tr>
            <tr><td class="spec-key" style="font-weight: 600;"><i class="bi bi-speedometer2 text-danger me-2"></i>Intervalo de Cambio</td><td class="spec-val font-mono text-success fw-bold">${compat.cambioKm}</td></tr>
            <tr><td class="spec-key" style="font-weight: 600;"><i class="bi bi-box-seam text-danger me-2"></i>Presentación Activa</td><td class="spec-val font-mono">${datos.presentacion.nombreCompleto}</td></tr>
            <tr><td class="spec-key" style="font-weight: 600;"><i class="bi bi-truck text-danger me-2"></i>Flota Pesada / B2B</td><td class="spec-val">${compat.flotaPesada}</td></tr>
        `;
    }

    const barcodeCode = '775' + String(producto.id).padStart(9, '0') + '1';
    const elBarcodeVis = document.getElementById('fichaModalBarcodeVisual');
    const elBarcodeTxt = document.getElementById('fichaModalBarcodeTexto');
    if (elBarcodeVis) elBarcodeVis.innerText = `*${barcodeCode}*`;
    if (elBarcodeTxt) elBarcodeTxt.innerText = barcodeCode;

    const tbodyApp = document.getElementById('fichaModalAplicaciones');
    if (tbodyApp) {
        tbodyApp.innerHTML = `
            <tr>
                <td class="ps-3 fw-bold text-dark"><i class="bi bi-car-front text-danger me-2"></i>Toyota</td>
                <td>Hilux (1GD, 2GD, 2TR), Land Cruiser, Corolla, Hiace, Probox</td>
                <td>Gasolina / GNV / Diésel D-4D</td>
                <td class="text-end pe-3 font-mono text-dark fw-bold">${compat.cambioKmCorto}</td>
            </tr>
            <tr>
                <td class="ps-3 fw-bold text-dark"><i class="bi bi-car-front text-danger me-2"></i>Nissan</td>
                <td>Frontier (YD25, QR25), Patrol, Sentra, Versa, Kicks</td>
                <td>Gasolina / Diésel Turbo Intercooler</td>
                <td class="text-end pe-3 font-mono text-dark fw-bold">${compat.cambioKmCorto}</td>
            </tr>
            <tr>
                <td class="ps-3 fw-bold text-dark"><i class="bi bi-car-front text-danger me-2"></i>Suzuki</td>
                <td>Grand Vitara (J20A, J24B), Carry, Swift, Jimny</td>
                <td>Gasolina / GNV Inyección Secuencial</td>
                <td class="text-end pe-3 font-mono text-dark fw-bold">${compat.cambioKmCorto}</td>
            </tr>
            <tr>
                <td class="ps-3 fw-bold text-dark"><i class="bi bi-car-front text-danger me-2"></i>Volkswagen</td>
                <td>Gol 1.6 MSI, Saveiro, Suran, Amarok 2.0 BiTDI</td>
                <td>TotalFlex Gasolina / GNV / Diésel</td>
                <td class="text-end pe-3 font-mono text-dark fw-bold">${compat.cambioKmCorto}</td>
            </tr>
            <tr>
                <td class="ps-3 fw-bold text-dark"><i class="bi bi-truck text-danger me-2"></i>Flotas Pesadas</td>
                <td>Camiones Volvo FH, Hino 300/500, Isuzu Forward, Scania</td>
                <td>Diésel Pesado Euro III / IV / V (Baldes 20L)</td>
                <td class="text-end pe-3 font-mono text-dark fw-bold">15.000 km</td>
            </tr>
        `;
    }

    const tbodyEquiv = document.getElementById('fichaModalEquivalencias');
    if (tbodyEquiv) {
        tbodyEquiv.innerHTML = `
            <tr>
                <td class="ps-3 fw-bold text-dark"><i class="bi bi-patch-check text-success me-2"></i>TECFIL Brasil</td>
                <td class="font-mono text-dark fw-bold">PSL-${(producto.id * 17) % 800 + 100}</td>
                <td class="text-end pe-3 small text-muted">Intercambio Directo Homologado</td>
            </tr>
            <tr>
                <td class="ps-3 fw-bold text-dark"><i class="bi bi-patch-check text-success me-2"></i>WIX Filters</td>
                <td class="font-mono text-dark fw-bold">WIX-${producto.sku.replace(/\D/g, '').padEnd(5, '0')}</td>
                <td class="text-end pe-3 small text-muted">Equivalencia Grado OEM</td>
            </tr>
            <tr>
                <td class="ps-3 fw-bold text-dark"><i class="bi bi-patch-check text-success me-2"></i>MANN-FILTER</td>
                <td class="font-mono text-dark fw-bold">W ${producto.id + 70}/80</td>
                <td class="text-end pe-3 small text-muted">Grado Calidad Original</td>
            </tr>
        `;
    }

    const modalEl = document.getElementById('modalFichaTecnica');
    if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

function cambiarPresentacionModal(prodId, presId) {
    cambiarPresentacion(prodId, presId);
    if (productoFichaActual) {
        const esOferta = Boolean(productoFichaActual.en_oferta || productoFichaActual.stock >= 20 || categoriaActual === 'Ofertas');
        const datos = calcularDatosPresentacion(productoFichaActual, presId, esOferta);
        actualizarFichaConPresentacion(datos);
    }
}

function actualizarFichaConPresentacion(datos) {
    const elSku = document.getElementById('fichaModalSku');
    const elPre = document.getElementById('fichaModalPrecio');
    const elStockMax = document.getElementById('fichaModalStockMax');
    const elPresCont = document.getElementById('fichaModalPresentaciones');

    if (elSku) elSku.innerText = datos.skuCompleto;
    if (elPre) elPre.innerText = `Bs. ${datos.precioFinal.toFixed(2)}`;
    if (elStockMax) elStockMax.innerText = `(${datos.stockDisponible} disponibles)`;

    if (elPresCont) {
        elPresCont.querySelectorAll('.btn-presentacion').forEach(btn => {
            if (btn.getAttribute('data-modal-pres-id') === datos.presentacion.id) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    const inputCant = document.getElementById('fichaInputCantidad');
    if (inputCant) {
        inputCant.max = datos.stockDisponible;
        if (parseInt(inputCant.value) > datos.stockDisponible) {
            inputCant.value = datos.stockDisponible || 1;
        }
    }
}

function ajustarCantidadFicha(delta) {
    const input = document.getElementById('fichaInputCantidad');
    if (!input || !productoFichaActual) return;
    const presActiva = presentacionesSeleccionadas[productoFichaActual.id] || obtenerPresentaciones(productoFichaActual)[0].id;
    const datos = calcularDatosPresentacion(productoFichaActual, presActiva);

    let actual = parseInt(input.value) || 1;
    let nuevo = actual + delta;
    if (nuevo < 1) nuevo = 1;
    if (nuevo > datos.stockDisponible) nuevo = datos.stockDisponible;
    input.value = nuevo;
}

// =========================================================================
// CONTROLES DE CANTIDAD Y VALIDACIÓN ESTRICTA DE STOCK EN TARJETAS
// =========================================================================

function ajustarCantidadTarjeta(prodId, delta) {
    const input = document.getElementById(`cant-card-${prodId}`);
    if (!input) return;
    const producto = productosTienda.find(p => p.id === prodId);
    if (!producto) return;
    const presActiva = presentacionesSeleccionadas[prodId] || obtenerPresentaciones(producto)[0].id;
    const datos = calcularDatosPresentacion(producto, presActiva);
    
    let cantActual = parseInt(input.value) || 1;
    let nueva = cantActual + delta;
    if (nueva < 1) nueva = 1;
    if (nueva > datos.stockDisponible) {
        if (datos.stockDisponible <= 0) {
            Toast.fire({ icon: 'warning', title: 'Producto agotado por el momento' });
        } else {
            Toast.fire({ icon: 'warning', title: `Solo quedan ${datos.stockDisponible} unidades disponibles en almacén` });
        }
        nueva = Math.max(1, datos.stockDisponible);
    }
    input.value = nueva;
}

function validarCantidadTarjeta(prodId, input) {
    const producto = productosTienda.find(p => p.id === prodId);
    if (!producto || !input) return;
    const presActiva = presentacionesSeleccionadas[prodId] || obtenerPresentaciones(producto)[0].id;
    const datos = calcularDatosPresentacion(producto, presActiva);

    let val = parseInt(input.value) || 1;
    if (val < 1) val = 1;
    if (val > datos.stockDisponible) {
        if (datos.stockDisponible <= 0) {
            Toast.fire({ icon: 'warning', title: 'Producto agotado por el momento' });
        } else {
            Toast.fire({ icon: 'warning', title: `Solo quedan ${datos.stockDisponible} unidades disponibles en almacén` });
        }
        val = Math.max(1, datos.stockDisponible);
    }
    input.value = val;
}

function agregarDesdeTarjeta(prodId) {
    const input = document.getElementById(`cant-card-${prodId}`);
    const cant = input ? parseInt(input.value) || 1 : 1;
    const producto = productosTienda.find(p => p.id === prodId);
    if (!producto) return;
    const esOferta = Boolean(producto.en_oferta || producto.stock >= 20 || categoriaActual === 'Ofertas');
    const presActiva = presentacionesSeleccionadas[prodId] || obtenerPresentaciones(producto)[0].id;
    const datos = calcularDatosPresentacion(producto, presActiva, esOferta);

    if (cant > datos.stockDisponible) {
        if (datos.stockDisponible <= 0) {
            Toast.fire({ icon: 'warning', title: 'Producto agotado por el momento' });
        } else {
            Toast.fire({ icon: 'warning', title: `Solo quedan ${datos.stockDisponible} unidades disponibles en almacén` });
        }
        return;
    }
    agregarAlCarrito(prodId, cant, datos.precioFinal, esOferta);
}

// =========================================================================
// GESTIÓN DEL CARRITO (ORDEN B2B LIMPIA Y TRANSPARENTE)
// =========================================================================

function agregarOfertaAlCarrito(idProducto, elementoOrigen = null) {
    const producto = productosTienda.find(p => p.id === idProducto);
    if (!producto) return;
    const presActiva = presentacionesSeleccionadas[idProducto] || obtenerPresentaciones(producto)[0].id;
    const datos = calcularDatosPresentacion(producto, presActiva, true);
    agregarAlCarrito(idProducto, 1, datos.precioFinal, true, elementoOrigen);
}

function agregarAlCarrito(idProducto, cantidadDeseada = 1, precioEspecial = null, esOferta = false, elementoOrigen = null) {
    const producto = productosTienda.find(p => p.id === idProducto);
    if (!producto || producto.stock <= 0) {
        Toast.fire({ icon: 'warning', title: 'Producto agotado por el momento' });
        return;
    }

    const presActiva = presentacionesSeleccionadas[idProducto] || obtenerPresentaciones(producto)[0].id;
    const datos = calcularDatosPresentacion(producto, presActiva, esOferta);

    if (datos.stockDisponible <= 0) {
        Toast.fire({ icon: 'warning', title: 'Producto agotado por el momento' });
        return;
    }

    const precioFinal = precioEspecial !== null ? parseFloat(precioEspecial) : datos.precioFinal;
    const cantAgregar = Math.max(1, parseInt(cantidadDeseada) || 1);

    animarVueloAlCarrito(elementoOrigen || document.querySelector(`.card-producto-wix[onclick*="abrirFichaTecnica(${idProducto})"]`));

    const cartKey = `${producto.id}_${datos.presentacion.id}`;
    const itemExistente = carrito.find(item => item.cartKey === cartKey);
    const nombreCompletoItem = `${producto.nombre} - ${datos.presentacion.nombreCompleto}`;

    if (itemExistente) {
        if (itemExistente.cantidad + cantAgregar > datos.stockDisponible) {
            Toast.fire({ icon: 'warning', title: `Solo quedan ${datos.stockDisponible} unidades disponibles en almacén` });
            return;
        }
        itemExistente.cantidad += cantAgregar;
        Toast.fire({ icon: 'success', title: `+${cantAgregar} en el pedido (${itemExistente.cantidad} en total)` });
    } else {
        if (cantAgregar > datos.stockDisponible) {
            Toast.fire({ icon: 'warning', title: `Solo quedan ${datos.stockDisponible} unidades disponibles en almacén` });
            return;
        }
        carrito.push({
            cartKey: cartKey,
            id: producto.id,
            nombre: nombreCompletoItem,
            sku: datos.skuCompleto,
            presentacion: datos.presentacion.label,
            precio: precioFinal,
            stockMaximo: datos.stockDisponible,
            cantidad: cantAgregar,
            esOferta: Boolean(esOferta || precioEspecial !== null)
        });
        Toast.fire({ 
            icon: 'success', 
            title: esOferta || precioEspecial !== null 
                ? `Oferta agregada: ${datos.presentacion.label} (-15% DTO)` 
                : `Agregado al pedido (${datos.presentacion.label})` 
        });
    }

    actualizarCarrito();

    const panel = document.getElementById('carritoLateral');
    if (panel) {
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(panel) || new bootstrap.Offcanvas(panel);
        bsOffcanvas.show();
    }
}

function modificarCantidad(cartKey, delta) {
    const item = carrito.find(i => i.cartKey === cartKey);
    if (!item) return;

    const nuevaCantidad = item.cantidad + delta;
    if (nuevaCantidad <= 0) {
        eliminarDelCarrito(cartKey);
        return;
    }

    if (nuevaCantidad > item.stockMaximo) {
        Toast.fire({ icon: 'warning', title: `Solo quedan ${item.stockMaximo} unidades disponibles en almacén` });
        return;
    }

    item.cantidad = nuevaCantidad;
    actualizarCarrito();
}

function cambiarCantidadDirectaCarrito(cartKey, input) {
    const item = carrito.find(i => i.cartKey === cartKey);
    if (!item || !input) return;
    let cant = parseInt(input.value) || 1;
    if (cant < 1) cant = 1;
    if (cant > item.stockMaximo) {
        Toast.fire({ icon: 'warning', title: `Solo quedan ${item.stockMaximo} unidades disponibles en almacén` });
        cant = item.stockMaximo;
    }
    item.cantidad = cant;
    input.value = cant;
    actualizarCarrito();
}

function eliminarDelCarrito(cartKey) {
    const item = carrito.find(i => i.cartKey === cartKey);
    carrito = carrito.filter(i => i.cartKey !== cartKey);
    actualizarCarrito();
    if (item) {
        Toast.fire({ icon: 'info', title: `"${item.nombre}" quitado del pedido` });
    }
}

function actualizarCarrito() {
    const lista = document.getElementById('listaCarrito');
    const topBarCount = document.getElementById('topBarCartCount');
    const contador = document.getElementById('contadorCarrito');
    const subtotalElemento = document.getElementById('subtotalCarrito');
    const totalElemento = document.getElementById('totalCarrito');

    if (!lista) return;
    lista.innerHTML = '';
    let total = 0;
    let cantidadTotal = 0;

    if (carrito.length === 0) {
        lista.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-cart-x display-4 d-block mb-2 text-muted opacity-50"></i>
                <h6 class="fw-bold text-dark">Tu lista de pedido está vacía</h6>
                <p class="small text-muted">Selecciona repuestos y presentaciones desde el mostrador.</p>
            </div>`;
        if (topBarCount) topBarCount.innerText = '0';
        if (contador) contador.innerText = '0';
        if (subtotalElemento) subtotalElemento.innerText = 'Bs. 0.00';
        if (totalElemento) totalElemento.innerText = 'Bs. 0.00';
        return;
    }

    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        cantidadTotal += item.cantidad;

        lista.innerHTML += `
            <div class="receipt-item-card mb-2 p-2 border rounded bg-white">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            <h6 class="mb-0 fw-bold text-dark" style="font-size: 0.88rem;">${item.nombre}</h6>
                            ${item.esOferta ? '<span class="badge" style="background:#B91C1C; color:#FFF; font-size:0.65rem;">-15% DTO</span>' : ''}
                        </div>
                        <small class="font-mono text-muted" style="font-size: 0.72rem;">${item.sku} • Bs. ${item.precio.toFixed(2)} c/u (Stock: ${item.stockMaximo})</small>
                    </div>
                    <button class="btn btn-sm text-danger p-0 border-0" onclick="eliminarDelCarrito('${item.cartKey}')" title="Quitar">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <div class="input-group input-group-sm" style="width: 104px;">
                        <button type="button" class="btn btn-outline-secondary px-2 py-0" onclick="modificarCantidad('${item.cartKey}', -1)">-</button>
                        <input type="number" class="form-control text-center px-0 py-0 font-mono fw-bold" value="${item.cantidad}" min="1" max="${item.stockMaximo}" onchange="cambiarCantidadDirectaCarrito('${item.cartKey}', this)" style="font-size: 0.85rem; height: 26px;">
                        <button type="button" class="btn btn-outline-secondary px-2 py-0" onclick="modificarCantidad('${item.cartKey}', 1)">+</button>
                    </div>
                    <span class="fw-bold text-danger fs-6 font-mono">Bs. ${subtotal.toFixed(2)}</span>
                </div>
            </div>
        `;
    });

    const totalFinal = Math.max(0, total);

    if (topBarCount) topBarCount.innerText = cantidadTotal;
    if (contador) contador.innerText = cantidadTotal;
    if (subtotalElemento) subtotalElemento.innerText = `Bs. ${total.toFixed(2)}`;
    if (totalElemento) totalElemento.innerText = `Bs. ${totalFinal.toFixed(2)}`;
}

// =========================================================================
// PROCESAMIENTO ATÓMICO Y CHECKOUT MULTI-PASARELA (QR, DEPÓSITO & PAYPAL API)
// =========================================================================

let ordenEnProcesoCheckout = null;
let paypalButtonsRendered = false;

function abrirModalCheckout() {
    if (carrito.length === 0) {
        Toast.fire({ icon: 'warning', title: 'Tu pedido está vacío. Añade repuestos antes de proceder al pago.' });
        return;
    }

    let subtotalVenta = 0;
    carrito.forEach(item => {
        subtotalVenta += (item.precio * item.cantidad);
    });
    const totalBs = parseFloat(subtotalVenta.toFixed(2));
    const totalUsd = (totalBs / 6.96).toFixed(2);

    ordenEnProcesoCheckout = {
        totalBs: totalBs,
        totalUsd: totalUsd
    };

    const elTotalBs = document.getElementById('checkoutMontoTotalBs');
    const elPpBs = document.getElementById('paypalMontoBs');
    const elPpUsd = document.getElementById('paypalMontoUsd');

    if (elTotalBs) elTotalBs.innerText = `Bs. ${totalBs.toFixed(2)}`;
    if (elPpBs) elPpBs.innerText = `Bs. ${totalBs.toFixed(2)}`;
    if (elPpUsd) elPpUsd.innerText = `$${totalUsd} USD`;

    // Generar código QR dinámico con la orden y monto exacto
    generarQRCheckout(totalBs);

    // Inicializar botones PayPal si el SDK está disponible
    setTimeout(inicializarPayPalSDK, 300);

    // Ocultar panel lateral y mostrar modal de checkout
    const panel = document.getElementById('carritoLateral');
    if (panel) {
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(panel);
        if (bsOffcanvas) bsOffcanvas.hide();
    }

    const modalEl = document.getElementById('modalCheckoutPago');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

function procesarCompra() {
    abrirModalCheckout();
}

function generarQRCheckout(totalBs) {
    const contenedor = document.getElementById('checkoutCodigoQR');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const qrPayload = `GOLDEN-PAY-B2B|ORDEN-${Date.now()}|BS-${totalBs.toFixed(2)}|CTA-UNION-1000458921|NIT-1029384756`;

    if (window.QRCode && typeof window.QRCode === 'function') {
        new QRCode(contenedor, {
            text: qrPayload,
            width: 170,
            height: 170,
            colorDark: "#141619",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        contenedor.innerHTML = `<img id="imgQRDescargable" src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(qrPayload)}" alt="QR Simple" style="width: 170px; height: 170px; display: block; margin: 0 auto; border-radius: 4px;">`;
    }
}

function descargarQRPago() {
    const img = document.querySelector('#checkoutCodigoQR img') || document.querySelector('#checkoutCodigoQR canvas');
    if (!img) {
        Toast.fire({ icon: 'info', title: 'Generando imagen QR...' });
        return;
    }

    let url = '';
    if (img.tagName && img.tagName.toLowerCase() === 'canvas') {
        url = img.toDataURL('image/png');
    } else {
        url = img.src;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = `QR_Pago_GOLDEN_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    Toast.fire({ icon: 'success', title: 'Código QR descargado correctamente' });
}

function simularConfirmacionBancariaDirecta() {
    const refInput = document.getElementById('checkoutComprobanteRef');
    const bancoSelect = document.getElementById('checkoutBancoOrigen');
    const randomRef = 'TRANSF-' + Math.floor(100000 + Math.random() * 900000);

    if (refInput) refInput.value = randomRef;
    if (bancoSelect) bancoSelect.value = 'Banco Unión';

    Toast.fire({
        icon: 'success',
        title: `Comprobante simulado: N° ${randomRef} generado para demostración.`
    });
}

async function confirmarPagoQR() {
    if (carrito.length === 0) return;
    const usuario = obtenerUsuarioSesion();
    if (!usuario) {
        window.location.href = 'index.html';
        return;
    }

    const ref = (document.getElementById('checkoutComprobanteRef')?.value || '').trim() || ('REF-' + Date.now().toString().slice(-6));
    const banco = document.getElementById('checkoutBancoOrigen')?.value || 'Banco Unión';
    const totalVenta = ordenEnProcesoCheckout ? ordenEnProcesoCheckout.totalBs : 0;

    const payload = {
        cliente_id: usuario.id,
        total: totalVenta,
        metodo_pago: 'QR_SIMPLE',
        comprobante_ref: ref,
        banco_origen: banco,
        estado_pago: 'VERIFICADO',
        carrito: carrito.map(item => ({
            id: item.id,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad
        }))
    };

    const btn = document.getElementById('btnConfirmarPagoQR');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Registrando pedido...`;
    }

    try {
        const res = await fetch(`${API_URL}/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
            Toast.fire({ icon: 'error', title: data.error || 'No se pudo completar el pedido' });
            return;
        }

        const modalEl = document.getElementById('modalCheckoutPago');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }

        Toast.fire({ icon: 'success', title: 'Comprobante registrado. Pedido recibido con éxito.' });

        abrirModalConfirmacion(data.pedidoId, usuario, carrito, totalVenta);

        carrito = [];
        actualizarCarrito();
        cargarCatalogo();

    } catch (e) {
        console.error('Error al confirmar pago QR:', e);
        Toast.fire({ icon: 'error', title: 'Error de comunicación con el servidor ERP' });
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="bi bi-check-circle-fill"></i><span>Confirmar Pago y Registrar Orden</span>`;
        }
    }
}

// =========================================================================
// INTEGRACIÓN PAYPAL SDK & REST API
// =========================================================================

function inicializarPayPalSDK() {
    const contenedor = document.getElementById('paypal-button-container');
    if (!contenedor || contenedor.children.length > 0) return;

    if (window.paypal && typeof window.paypal.Buttons === 'function') {
        try {
            window.paypal.Buttons({
                style: {
                    layout: 'vertical',
                    color: 'gold',
                    shape: 'rect',
                    label: 'paypal'
                },
                createOrder: (data, actions) => {
                    const totalUsd = ordenEnProcesoCheckout ? ordenEnProcesoCheckout.totalUsd : '10.00';
                    return actions.order.create({
                        purchase_units: [{
                            description: 'Lote de Repuestos Automotrices GOLDEN ERP',
                            amount: {
                                currency_code: 'USD',
                                value: totalUsd
                            }
                        }]
                    });
                },
                onApprove: (data, actions) => {
                    return actions.order.capture().then(details => {
                        const transactionId = details.id || data.orderID;
                        completarCompraPayPal(transactionId, ordenEnProcesoCheckout.totalBs, details);
                    });
                },
                onError: (err) => {
                    console.warn('PayPal SDK Error o entorno local:', err);
                    Toast.fire({ icon: 'info', title: 'Se habilitó el botón directo de Sandbox API para prueba local.' });
                }
            }).render('#paypal-button-container');
            paypalButtonsRendered = true;
        } catch (e) {
            console.warn('No se pudo inicializar widget de PayPal:', e);
        }
    }
}

async function simularPagoPayPalSandbox() {
    if (carrito.length === 0) return;
    const totalBs = ordenEnProcesoCheckout ? ordenEnProcesoCheckout.totalBs : 0;
    const totalUsd = ordenEnProcesoCheckout ? ordenEnProcesoCheckout.totalUsd : (totalBs / 6.96).toFixed(2);

    try {
        const resCreate = await fetch(`${API_URL}/paypal/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totalBs, totalUsd })
        });
        const orderData = await resCreate.json();
        const orderId = orderData.id || ('PAYPAL-' + Date.now().toString(36).toUpperCase());

        const resCapture = await fetch(`${API_URL}/paypal/capture-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: orderId })
        });
        const captureData = await resCapture.json();
        const transactionId = captureData.id || orderId;

        await completarCompraPayPal(transactionId, totalBs, captureData);

    } catch (e) {
        console.error('Error en simulación PayPal:', e);
        Toast.fire({ icon: 'error', title: 'Error al simular pago en PayPal API' });
    }
}

async function completarCompraPayPal(transactionId, totalBs, details) {
    const usuario = obtenerUsuarioSesion();
    if (!usuario) {
        window.location.href = 'index.html';
        return;
    }

    const payload = {
        cliente_id: usuario.id,
        total: totalBs,
        metodo_pago: 'PAYPAL',
        comprobante_ref: transactionId,
        banco_origen: 'PayPal Commerce Platform (USD)',
        estado_pago: `PAGADO (PayPal API - ID: ${transactionId})`,
        carrito: carrito.map(item => ({
            id: item.id,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad
        }))
    };

    try {
        const res = await fetch(`${API_URL}/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
            Toast.fire({ icon: 'error', title: data.error || 'Error al asentar venta de PayPal' });
            return;
        }

        const modalEl = document.getElementById('modalCheckoutPago');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }

        Toast.fire({
            icon: 'success',
            title: `¡Pago con PayPal Aprobado! Transacción ID: ${transactionId}`
        });

        abrirModalConfirmacion(data.pedidoId, usuario, carrito, totalBs);

        carrito = [];
        actualizarCarrito();
        cargarCatalogo();

    } catch (e) {
        console.error('Error al registrar compra PayPal:', e);
        Toast.fire({ icon: 'error', title: 'Error al conectar con el servidor' });
    }
}

// =========================================================================
// MIS PEDIDOS & SEGUIMIENTO EN VIVO (STEPPER EN 5 ETAPAS)
// =========================================================================

async function abrirModalSeguimiento() {
    const usuario = obtenerUsuarioSesion();
    const contenedor = document.getElementById('contenedorListaSeguimiento');
    if (!contenedor) return;

    contenedor.innerHTML = '<div class="text-center py-5"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Consultando historial y estado de despachos...</div>';

    const modalEl = document.getElementById('modalSeguimientoPedidos');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }

    try {
        const url = (usuario && usuario.id) ? `${API_URL}/mis-pedidos?cliente_id=${usuario.id}&t=${Date.now()}` : `${API_URL}/mis-pedidos?t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('No se pudo consultar el servidor de pedidos');
        const pedidos = await res.json();

        if (!pedidos || pedidos.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center py-5 text-muted bg-white border rounded">
                    <i class="bi bi-box2 display-4 d-block mb-3 text-secondary opacity-50"></i>
                    <h5 class="fw-bold text-dark">No tienes pedidos registrados aún</h5>
                    <p class="small text-muted">Realiza tu primera compra desde el catálogo para hacerle seguimiento en tiempo real.</p>
                </div>
            `;
            return;
        }

        contenedor.innerHTML = pedidos.map(p => renderizarTarjetaSeguimiento(p)).join('');

    } catch (e) {
        console.error('Error al abrir seguimiento:', e);
        contenedor.innerHTML = `<div class="text-center py-4 text-danger fw-bold"><i class="bi bi-exclamation-triangle me-1"></i>Error: ${e.message}</div>`;
    }
}

function renderizarTarjetaSeguimiento(p) {
    const etapas = [
        { id: 1, nombre: 'Pago Verificado', desc: 'Orden recibida en sistema' },
        { id: 2, nombre: 'En Preparación', desc: 'Picking en almacén' },
        { id: 3, nombre: 'Empacado y Rotulado', desc: 'Listo para reparto' },
        { id: 4, nombre: 'En Ruta de Entrega', desc: 'Móvil en camino al taller' },
        { id: 5, nombre: 'Entregado & Conforme', desc: 'Recepción finalizada' }
    ];

    let pasoActual = 1;
    const estLog = p.estado_logistica || '';
    if (estLog.includes('PREPARACIÓN')) pasoActual = 2;
    else if (estLog.includes('EMPACADO')) pasoActual = 3;
    else if (estLog.includes('RUTA')) pasoActual = 4;
    else if (estLog.includes('ENTREGADO')) pasoActual = 5;

    const fechaStr = p.fecha_compra ? new Date(p.fecha_compra).toLocaleString('es-BO') : '-';
    const totalStr = parseFloat(p.total || 0).toFixed(2);

    return `
        <div class="card mb-4 border shadow-sm" style="border-radius: 8px; overflow: hidden; background: #FFFFFF;">
            <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2 py-3 px-4" style="background: #141619; border-bottom: 2px solid #F59E0B;">
                <div class="d-flex align-items-center gap-2">
                    <span class="badge" style="background:#F59E0B; color:#141619; font-family:'Chivo Mono', monospace; font-size:0.85rem; font-weight:800;">
                        ORDEN #${String(p.id).padStart(4, '0')}
                    </span>
                    <span class="text-white small font-mono">${fechaStr}</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-secondary font-mono">${p.metodo_pago || 'QR_SIMPLE'}</span>
                    <span class="badge ${p.estado_pago && (p.estado_pago.includes('PAGADO') || p.estado_pago === 'VERIFICADO') ? 'bg-success' : 'bg-warning text-dark'} font-mono">
                        ${p.estado_pago || 'PENDIENTE'}
                    </span>
                    <span class="fw-bold text-warning font-mono fs-5 ms-2">Bs. ${totalStr}</span>
                </div>
            </div>

            <div class="card-body p-4">
                <!-- Stepper Visual de 5 Pasos -->
                <div class="stepper-horizontal mb-4 d-flex justify-content-between align-items-center gap-2 flex-wrap">
                    ${etapas.map(et => {
                        const completado = et.id < pasoActual;
                        const activo = et.id === pasoActual;
                        let circleClass = 'bg-secondary text-white';
                        let textColor = 'text-muted';

                        if (completado) {
                            circleClass = 'bg-success text-white shadow-sm';
                            textColor = 'text-success fw-bold';
                        } else if (activo) {
                            circleClass = 'bg-danger text-white shadow';
                            textColor = 'text-danger fw-bold';
                        }

                        return `
                            <div class="step-item text-center flex-fill position-relative p-2" style="min-width: 140px;">
                                <div class="step-circle mx-auto d-flex align-items-center justify-content-center rounded-circle ${circleClass}" style="width: 38px; height: 38px; font-weight: 800; font-size: 0.95rem; margin-bottom: 6px;">
                                    ${completado ? '<i class="bi bi-check-lg"></i>' : et.id}
                                </div>
                                <div class="step-title small ${textColor}" style="font-size: 0.78rem; line-height: 1.2;">
                                    ${et.nombre}
                                </div>
                                <small class="text-muted d-block font-mono" style="font-size: 0.68rem;">${et.desc}</small>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Detalles Logísticos y Trazabilidad -->
                <div class="row g-3 p-3 bg-light rounded border font-mono small">
                    <div class="col-md-4">
                        <strong class="text-dark d-block mb-1"><i class="bi bi-box-seam text-danger me-1"></i>Empaque & Almacén:</strong>
                        <span>Responsable: ${p.empaque_responsable || 'Marcos Almacén'}</span><br>
                        <span>Embalaje: ${p.empaque_tipo || 'Caja sellada'} (${p.empaque_bultos || 1} bultos, ${p.empaque_peso || 4.5} kg)</span>
                    </div>
                    <div class="col-md-4">
                        <strong class="text-dark d-block mb-1"><i class="bi bi-truck text-warning me-1"></i>Despacho & Reparto:</strong>
                        <span>Chofer: ${p.despacho_chofer || (pasoActual >= 4 ? 'Rodrigo Chofer' : 'Por asignar')}</span><br>
                        <span>Móvil: ${p.despacho_placa || (pasoActual >= 4 ? 'Placa 4029-YHT' : '-')}</span>
                    </div>
                    <div class="col-md-4">
                        <strong class="text-dark d-block mb-1"><i class="bi bi-geo-alt text-success me-1"></i>Entrega en Taller:</strong>
                        <span>Receptor: ${p.entrega_receptor_nombre || (pasoActual >= 5 ? 'Recepción Taller' : 'Pendiente')}</span><br>
                        <span>CI: ${p.entrega_receptor_ci || '-'} • PIN: ${p.entrega_pin || '-'}</span>
                    </div>
                </div>

                <!-- Botón Imprimir Factura / Comprobante -->
                <div class="mt-3 text-end">
                    <button type="button" class="btn btn-outline-dark btn-sm fw-bold d-inline-flex align-items-center gap-1" onclick="generarRecibo(${p.id})">
                        <i class="bi bi-file-earmark-pdf-fill text-danger"></i>
                        <span>Descargar Nota de Entrega / Factura (PDF)</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// =========================================================================
// CONFIRMACIÓN, QR Y WHATSAPP
// =========================================================================

function abrirModalConfirmacion(pedidoId, usuario, itemsComprados, totalVenta) {
    ultimoPedidoId = pedidoId;
    
    const subTit = document.getElementById('modalSubtituloOrden');
    if (subTit) subTit.innerText = `Nota de Pedido #00${pedidoId} • Cliente: ${usuario.nombre || 'Taller Los Primos'}`;

    const totalEl = document.getElementById('totalResumenVenta');
    if (totalEl) totalEl.innerText = `Bs. ${totalVenta.toFixed(2)}`;

    const tbody = document.getElementById('listaResumenVenta');
    if (tbody) {
        tbody.innerHTML = '';
        let detalleTextoWhatsApp = '';

        itemsComprados.forEach(item => {
            const subtotal = item.precio * item.cantidad;
            tbody.innerHTML += `
                <tr>
                    <td class="ps-2 fw-semibold text-dark small">${item.nombre}</td>
                    <td class="text-center font-mono small">${item.cantidad}</td>
                    <td class="text-end pe-2 fw-bold text-danger font-mono small">Bs. ${subtotal.toFixed(2)}</td>
                </tr>
            `;
            detalleTextoWhatsApp += `  • ${item.cantidad}x ${item.nombre} (Bs. ${item.precio.toFixed(2)} c/u) = Bs. ${subtotal.toFixed(2)}\n`;
        });

        generarQRPago(pedidoId, totalVenta);

        const mensajeWA = 
`PEDIDO CONFIRMADO - GOLDEN LUBRICANTES & FILTROS
Orden N°: #00${pedidoId}
Cliente: ${usuario.nombre || 'Taller Los Primos'} (${usuario.email || 'ventas@goldenlubricantes.bo'})
Fecha: ${new Date().toLocaleDateString('es-BO')}
━━━━━━━━━━━━━━━━━━━━
DETALLE DE REPUESTOS:
${detalleTextoWhatsApp}━━━━━━━━━━━━━━━━━━━━
TOTAL A CANCELAR: Bs. ${totalVenta.toFixed(2)}
MÉTODO: Pago QR / Transferencia Bancaria
ESTADO: PENDIENTE DE DESPACHO
Almacén Central: Sucre, Bolivia

¡Muchas gracias por su pedido!`;

        const urlWA = `https://wa.me/59171234567?text=${encodeURIComponent(mensajeWA)}`;
        const btnWA = document.getElementById('btnWhatsappVenta');
        if (btnWA) btnWA.setAttribute('href', urlWA);
    }

    const modalEl = document.getElementById('modalVentaExitosa');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

function generarQRPago(pedidoId, totalVenta) {
    const contenedor = document.getElementById('codigoQR');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const qrData = `GOLDEN-PAY|ORDEN-00${pedidoId}|BS-${totalVenta.toFixed(2)}|BANCO-UNION-BCP`;

    if (window.QRCode && typeof window.QRCode === 'function') {
        new QRCode(contenedor, {
            text: qrData,
            width: 150,
            height: 150,
            colorDark: "#141619",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        contenedor.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}" alt="QR de Pago" style="width: 150px; height: 150px; display: block; margin: 0 auto;">`;
    }
}

// =========================================================================
// FACTURA COMPUTARIZADA OFICIAL SIN (BOLIVIA) & EXPORTACIÓN PDF
// =========================================================================

function verFacturaDesdeModal() {
    const modalVenta = document.getElementById('modalVentaExitosa');
    if (modalVenta) {
        const bsVenta = bootstrap.Modal.getInstance(modalVenta);
        if (bsVenta) bsVenta.hide();
    }

    const usuario = obtenerUsuarioSesion() || { nombre: 'Taller Los Primos', nit: '1029384756', direccion: 'Sucre, Bolivia' };
    const pedidoNum = ultimoPedidoId || 1042;

    const elNum = document.getElementById('factura-numero');
    const elNom = document.getElementById('factura-cliente-nombre');
    const elNit = document.getElementById('factura-cliente-nit');
    const elDir = document.getElementById('factura-cliente-dir');
    const elFec = document.getElementById('factura-fecha');

    if (elNum) elNum.innerText = `FACTURA N°: ${String(pedidoNum).padStart(5, '0')}`;
    if (elNom) elNom.innerText = usuario.nombre || 'Taller Los Primos';
    if (elNit) elNit.innerText = usuario.nit || '1029384756';
    if (elDir) elDir.innerText = usuario.direccion || 'Av. Jaime Mendoza #1420, Sucre';
    if (elFec) elFec.innerText = new Date().toLocaleDateString('es-BO');

    const totalEl = document.getElementById('totalResumenVenta');
    const totalTexto = totalEl ? totalEl.innerText.replace('Bs.', '').trim() : '0.00';
    const totalMonto = parseFloat(totalTexto) || 0;
    const subtotalMonto = Math.round((totalMonto / 1.13) * 100) / 100;
    const ivaMonto = Math.round((totalMonto - subtotalMonto) * 100) / 100;

    const elSub = document.getElementById('factura-subtotal');
    const elIva = document.getElementById('factura-iva');
    const elTot = document.getElementById('factura-total');
    const elLit = document.getElementById('factura-total-literal');
    const elCtrl = document.getElementById('factura-codigo-control');

    if (elSub) elSub.innerText = `Bs. ${subtotalMonto.toFixed(2)}`;
    if (elIva) elIva.innerText = `Bs. ${ivaMonto.toFixed(2)}`;
    if (elTot) elTot.innerText = `Bs. ${totalMonto.toFixed(2)}`;
    if (elLit) elLit.innerText = numeroALetras(totalMonto);
    if (elCtrl) elCtrl.innerText = `4B-${Math.floor(10 + Math.random() * 89)}-8C-${Math.floor(10 + Math.random() * 89)}`;

    const tbody = document.getElementById('factura-items-body');
    const tbodyVenta = document.getElementById('listaResumenVenta');
    if (tbody) {
        if (tbodyVenta && tbodyVenta.children.length > 0) {
            tbody.innerHTML = '';
            Array.from(tbodyVenta.children).forEach((tr, i) => {
                const cols = tr.querySelectorAll('td');
                if (cols.length >= 3) {
                    const desc = cols[0].innerText;
                    const cant = cols[1].innerText;
                    const sub = cols[2].innerText.replace('Bs.', '').trim();
                    const pUnit = (parseFloat(sub) / (parseInt(cant) || 1)).toFixed(2);
                    tbody.innerHTML += `
                        <tr>
                            <td>SKU-${100 + i}</td>
                            <td>${desc}</td>
                            <td class="text-center">${cant}</td>
                            <td class="text-end">Bs. ${pUnit}</td>
                            <td class="text-end fw-bold">Bs. ${sub}</td>
                        </tr>
                    `;
                }
            });
        } else {
            tbody.innerHTML = `
                <tr>
                    <td>SYN-5W30</td>
                    <td>Aceite Sintético Golden Ultra 5W-30 (Galón 4L)</td>
                    <td class="text-center">2</td>
                    <td class="text-end">Bs. 210.00</td>
                    <td class="text-end fw-bold">Bs. 420.00</td>
                </tr>
            `;
        }
    }

    const modalFactura = document.getElementById('modalFacturaOficial');
    if (modalFactura) {
        const bsFactura = new bootstrap.Modal(modalFactura);
        bsFactura.show();
    }
}

function descargarFacturaPDF() {
    const contenedor = document.getElementById('factura-render-container');
    if (!contenedor) return;

    if (window.html2pdf) {
        const opt = {
            margin: 10,
            filename: `Factura_GOLDEN_${ultimoPedidoId || '000'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().from(contenedor).set(opt).save();
    } else {
        window.print();
    }
}

function imprimirFacturaOficial() {
    window.print();
}

function numeroALetras(monto) {
    const enteros = Math.floor(monto);
    const centavos = Math.round((monto - enteros) * 100);
    const centavosStr = String(centavos).padStart(2, '0');

    if (enteros === 0) return `CERO ${centavosStr}/100 BOLIVIANOS`;

    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = {
        11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
        16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
        21: 'VEINTIÚN', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
        25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
    };
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function convertirGrupo(n) {
        let salida = '';
        const c = Math.floor(n / 100);
        const d = Math.floor((n % 100) / 10);
        const u = n % 10;
        const du = n % 100;

        if (n === 100) return 'CIEN ';
        if (c > 0) salida += centenas[c] + ' ';

        if (du > 10 && du < 30 && especiales[du]) {
            salida += especiales[du] + ' ';
        } else {
            if (d > 0) {
                if (u > 0) salida += decenas[d] + ' Y ';
                else salida += decenas[d] + ' ';
            }
            if (u > 0) salida += unidades[u] + ' ';
        }
        return salida;
    }

    let resultado = '';
    const miles = Math.floor(enteros / 1000);
    const resto = enteros % 1000;

    if (miles > 0) {
        if (miles === 1) resultado += 'MIL ';
        else resultado += convertirGrupo(miles) + 'MIL ';
    }

    if (resto > 0) {
        resultado += convertirGrupo(resto);
    }

    return `${resultado.trim()} ${centavosStr}/100 BOLIVIANOS`;
}

// =========================================================================
// FOOTER & UTILIDADES
// =========================================================================

function solicitarListaMayorista() {
    const input = document.getElementById('newsletterInput');
    if (!input || !input.value.trim()) return;

    Toast.fire({
        icon: 'success',
        title: '¡Solicitud recibida! Le enviaremos la lista mayorista quincenal a su contacto.'
    });
    input.value = '';
}

function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}
