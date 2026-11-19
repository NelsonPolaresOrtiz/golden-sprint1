/**
 * ERP GOLDEN - Control de Almacén, Kardex y Reposición
 */
const API_URL = '/api';
let productosGlobal = [];

/**
 * Función utilitaria para sanitizar textos HTML contra ataques XSS
 */
function escaparHTML(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escaparHTML = escaparHTML;

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
    // Control de Acceso RBAC: Administradores, Trabajadores, Almaceneros, Empaque
    const usuario = (typeof protegerRuta === 'function') 
        ? protegerRuta('inventario', ['ADMIN', 'TRABAJADOR', 'ALMACENERO', 'EMPAQUE'])
        : (typeof obtenerUsuarioSesion === 'function' ? obtenerUsuarioSesion() : null);

    if (typeof renderizarMenu === 'function') {
        renderizarMenu('inventario');
    }
    cargarProductos();
});

// ==========================================
// 1. CARGA DE PRODUCTOS Y KPIS
// ==========================================
async function cargarProductos() {
    const tbody = document.getElementById('tablaProductos');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Sincronizando inventario de repuestos...</td></tr>';
    }

    let data = null;

    // Bloque 1: Petición HTTP al backend
    try {
        const res = await fetch(`${API_URL}/productos?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        data = await res.json();
    } catch (fetchError) {
        console.error("Error al obtener productos desde la API de inventario:", fetchError);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5">No se pudieron mostrar los registros de almacén en este momento. Intenta recargar la vista.</td></tr>';
        }
        if (typeof Toast !== 'undefined') {
            Toast.fire({ icon: 'error', title: 'Error al conectar con el inventario' });
        }
        return;
    }

    // Bloque 2: Procesamiento y renderizado en DOM (aislado para no enmascarar errores de red)
    try {
        if (Array.isArray(data)) {
            productosGlobal = data;
        } else if (data && Array.isArray(data.productos)) {
            productosGlobal = data.productos;
        } else {
            productosGlobal = [];
        }

        actualizarMiniKPIs(productosGlobal);
        renderizarTabla(productosGlobal);
    } catch (renderError) {
        console.error("Error al procesar o renderizar filas en la tabla de inventario:", renderError);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5">No se pudieron mostrar los registros de almacén en este momento. Intenta recargar la vista.</td></tr>';
        }
    }
}

function actualizarMiniKPIs(lista) {
    const arr = Array.isArray(lista) ? lista : [];
    const totalItems = arr.length;
    let totalUnidades = 0;
    let bajoStock = 0;

    arr.forEach(p => {
        if (!p) return;
        const s = parseInt(p.stock, 10) || 0;
        const sMin = parseInt(p.stock_minimo, 10) || 5;
        totalUnidades += s;
        if (s <= sMin) bajoStock++;
    });

    const elTotal = document.getElementById('kpiTotalItems');
    const elUnid = document.getElementById('kpiTotalUnidades');
    const elBajo = document.getElementById('kpiBajoStock');

    if (elTotal) elTotal.innerText = totalItems;
    if (elUnid) elUnid.innerText = totalUnidades;
    if (elBajo) elBajo.innerText = bajoStock;
}

// ==========================================
// 2. DIBUJAR LA TABLA DE ALMACÉN
// ==========================================
function renderizarTabla(productos, filtroBusqueda = '') {
    const tbody = document.getElementById('tablaProductos');
    if (!tbody) return;

    const lista = Array.isArray(productos) ? productos : [];

    if (lista.length === 0) {
        if (filtroBusqueda) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary py-5"><i class="bi bi-search fs-3 d-block mb-2 text-warning"></i>No se encontraron repuestos que coincidan con la búsqueda.</td></tr>`;
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-5"><i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>No se registran repuestos en el inventario.</td></tr>';
        }
        return;
    }

    const htmlFilas = lista.map(p => {
        if (!p || typeof p !== 'object') return '';

        const id = Number(p.id) || 0;
        const sku = String(p.sku || '').trim() || 'GLD-REP';
        const nombre = String(p.nombre || '').trim() || 'Repuesto sin descripción';
        const categoria = String(p.categoria || '').trim() || 'General';
        const marca = String(p.marca || '').trim() || '';
        const imagen = String(p.imagen || p.imagen_url || '').trim() || '';
        const precio = Number(p.precio) || 0;
        const stockActual = Number(p.stock) || 0;
        const stockMin = Number(p.stock_minimo) || 5;

        const esBajoStock = stockActual <= stockMin;
        const stockBadge = esBajoStock ? 'badge-pill-ruby' : 'badge-pill-emerald';
        const estadoTexto = esBajoStock
            ? '<span class="badge-pill-stitch badge-pill-ruby"><span class="pulse-dot pulse-dot-ruby me-1"></span>Crítico</span>'
            : '<span class="badge-pill-stitch badge-pill-emerald"><span class="pulse-dot pulse-dot-emerald me-1"></span>Óptimo</span>';

        const nombreEscapado = escaparHTML(nombre);
        const skuEscapado = escaparHTML(sku);
        const categoriaEscapada = escaparHTML(categoria);
        const marcaEscapada = escaparHTML(marca);

        // Strings seguros para atributos onclick=""
        const nombreJsSafe = nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const skuJsSafe = sku.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        return `
            <tr>
                <td class="ps-4">
                    <span class="badge font-monospace px-2 py-1" style="background: #292524; color: #FFFFFF; font-family: 'Inter', sans-serif;">${skuEscapado}</span>
                </td>
                <td>
                    <div class="fw-bold text-dark">${nombreEscapado}</div>
                    <div class="d-flex align-items-center gap-1 mt-1">
                        <span class="badge-pill-stitch badge-pill-slate small" style="font-size: 0.72rem;">${categoriaEscapada}</span>
                        ${marca ? `<span class="badge font-monospace px-1 text-secondary border" style="font-size: 0.68rem; background: #FAF8F5;">${marcaEscapada}</span>` : ''}
                    </div>
                </td>
                <td class="fw-bold fs-6" style="color: #15803D; font-family: 'Inter', sans-serif;">Bs. ${precio.toFixed(2)}</td>
                <td>
                    <span class="badge-pill-stitch ${stockBadge}">${stockActual} unid.</span>
                    <small class="text-secondary d-block mt-1" style="font-size: 0.7rem;">Mínimo: ${stockMin}</small>
                </td>
                <td>${estadoTexto}</td>
                <td class="text-end pe-4 text-nowrap">
                    <button type="button" class="btn btn-sm btn-outline-warning rounded-2 me-1" onclick="editarProducto(${id})" title="Editar Stock / Datos del Repuesto">
                        <i class="bi bi-pencil-square me-1"></i><span>Editar Stock</span>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-success rounded-2 me-1" onclick="registrarEntradaStock(${id}, '${nombreJsSafe}', ${stockActual})" title="Registrar Entrada Rápida de Stock (+)">
                        <i class="bi bi-plus-circle me-1"></i><span>Entrada (+)</span>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-info rounded-2 me-1" onclick="abrirKardex('${skuJsSafe}')" title="Historial Kardex Físico">
                        <i class="bi bi-clock-history"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger rounded-2" onclick="eliminarProducto(${id}, '${nombreJsSafe}')" title="Eliminar Repuesto">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = htmlFilas;
}

/**
 * Registro directo de entrada rápida (+) a depósito
 */
async function registrarEntradaStock(id, nombre, stockActual) {
    if (typeof Swal === 'undefined') {
        const cant = prompt(`Ingresar unidades adicionales para "${nombre}":`, '5');
        if (cant && parseInt(cant) > 0) {
            aplicarEntradaStockAPI(id, stockActual, parseInt(cant));
        }
        return;
    }

    const { value: cantidad } = await Swal.fire({
        title: '<span style="font-family: \'Archivo\', sans-serif; font-weight: 800; color: #141619;">Entrada de Almacén</span>',
        html: `
            <div class="text-start p-2" style="font-size: 0.9rem;">
                <p class="mb-1 text-secondary">Repuesto: <strong class="text-dark">${nombre}</strong></p>
                <p class="mb-3 text-secondary">Stock actual en depósito: <span class="badge bg-secondary">${stockActual} unidades</span></p>
                <label class="form-label fw-bold text-dark mb-1">Cantidad a ingresar (+):</label>
            </div>
        `,
        input: 'number',
        inputAttributes: { min: 1, step: 1 },
        inputValue: 5,
        showCancelButton: true,
        confirmButtonColor: '#15803D',
        cancelButtonColor: '#64748B',
        confirmButtonText: '<i class="bi bi-plus-circle-fill me-1"></i> Añadir al Stock',
        cancelButtonText: 'Cancelar',
        background: '#FFFFFF',
        color: '#1C1917'
    });

    if (cantidad && parseInt(cantidad, 10) > 0) {
        await aplicarEntradaStockAPI(id, stockActual, parseInt(cantidad, 10));
    }
}

function obtenerHeadersAuthInventario() {
    const raw = localStorage.getItem('usuario_golden') || localStorage.getItem('usuario');
    let rol = '';
    let email = '';
    if (raw) {
        try {
            const u = JSON.parse(raw);
            rol = u.rol || '';
            email = u.email || u.correo || '';
        } catch(e) {}
    }
    return {
        'x-usuario-rol': rol,
        'x-usuario-email': email
    };
}

async function aplicarEntradaStockAPI(id, stockActual, incremento) {
    const nuevoStock = stockActual + incremento;
    try {
        const res = await fetch(`${API_URL}/productos/${id}`, {
            method: 'PUT',
            headers: { ...obtenerHeadersAuthInventario(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock: nuevoStock })
        });
        if (res.ok) {
            if (typeof Toast !== 'undefined') {
                Toast.fire({ icon: 'success', title: `+${incremento} unidades ingresadas con éxito` });
            }
            cargarProductos();
        } else {
            if (typeof Toast !== 'undefined') {
                Toast.fire({ icon: 'error', title: 'Error al actualizar stock' });
            }
        }
    } catch (e) {
        if (typeof Toast !== 'undefined') {
            Toast.fire({ icon: 'error', title: 'Error de conexión con el servidor' });
        }
    }
}
window.registrarEntradaStock = registrarEntradaStock;

// ==========================================
// 3. BUSCADOR EN TIEMPO REAL (EVENTO INPUT)
// ==========================================
const inputBuscadorInv = document.getElementById('buscadorInventario');
if (inputBuscadorInv) {
    inputBuscadorInv.addEventListener('input', (e) => {
        const texto = e.target.value.toLowerCase().trim();
        const filtrados = productosGlobal.filter(p =>
            (p.nombre && p.nombre.toLowerCase().includes(texto)) ||
            (p.sku && p.sku.toLowerCase().includes(texto)) ||
            (p.categoria && p.categoria.toLowerCase().includes(texto))
        );
        renderizarTabla(filtrados, texto);
    });
}

// ==========================================
// 4. CRUD DE PRODUCTOS (GUARDAR, EDITAR, ELIMINAR)
// ==========================================
const formProductoInv = document.getElementById('productoForm');
if (formProductoInv) {
    formProductoInv.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('prodId').value;
        const sku = document.getElementById('sku').value.trim();
        const nombre = document.getElementById('nombre').value.trim();
        const categoria = document.getElementById('categoria').value;
        const precio = parseFloat(document.getElementById('precio').value);
        const stock = parseInt(document.getElementById('stock').value, 10);
        const stock_minimo = parseInt(document.getElementById('stockMinimo').value, 10) || 5;

        const btnGuardar = document.getElementById('btnGuardarProd');
        const datos = { sku, nombre, categoria, precio, stock, stock_minimo };

        const esEdicion = id !== '';
        const url = esEdicion ? `${API_URL}/productos/${id}` : `${API_URL}/productos`;
        const metodo = esEdicion ? 'PUT' : 'POST';

        // Feedback visual y protección contra doble clic
        const textoOriginalBtn = btnGuardar ? btnGuardar.innerHTML : '';
        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Guardando Repuesto...`;
        }

        try {
            const res = await fetch(url, {
                method: metodo,
                headers: { ...obtenerHeadersAuthInventario(), 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            const data = await res.json();

            if (!res.ok) {
                if (typeof Toast !== 'undefined') Toast.fire({ icon: 'error', title: data.error || 'Error al procesar el producto' });
                mostrarAlerta(data.error || 'Error al procesar el producto.', 'danger');
                return;
            }

            const mensajeExito = esEdicion ? 'Repuesto actualizado con éxito' : 'Repuesto registrado con éxito';
            if (typeof Toast !== 'undefined') Toast.fire({ icon: 'success', title: data.mensaje || mensajeExito });
            mostrarAlerta(data.mensaje || 'Operación completada exitosamente.', 'success');
            resetFormularioProducto();
            cargarProductos();
        } catch (error) {
            if (typeof Toast !== 'undefined') Toast.fire({ icon: 'error', title: 'Error de conexión con el servidor' });
            mostrarAlerta('Error de conexión con el servidor.', 'danger');
        } finally {
            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = textoOriginalBtn;
            }
        }
    });
}

function editarProducto(id) {
    const numId = Number(id);
    const p = productosGlobal.find(item => Number(item.id) === numId);
    if (!p) return;

    const elId = document.getElementById('prodId');
    const elSku = document.getElementById('sku');
    const elNom = document.getElementById('nombre');
    const elCat = document.getElementById('categoria');
    const elPre = document.getElementById('precio');
    const elStk = document.getElementById('stock');
    const elMin = document.getElementById('stockMinimo');

    if (elId) elId.value = p.id;
    if (elSku) elSku.value = p.sku || '';
    if (elNom) elNom.value = p.nombre || '';
    if (elCat) elCat.value = p.categoria || '';
    if (elPre) elPre.value = p.precio || '';
    if (elStk) elStk.value = p.stock || 0;
    if (elMin) elMin.value = p.stock_minimo || 5;

    const elTitle = document.getElementById('formTitle');
    const elBtnGuardar = document.getElementById('btnGuardarProd');
    const elBtnCancelar = document.getElementById('btnCancelarProd');

    if (elTitle) elTitle.innerHTML = `<i class="bi bi-pencil-square me-2 fs-5"></i> Editar Repuesto #${p.id}`;
    if (elBtnGuardar) elBtnGuardar.innerHTML = `<i class="bi bi-check2-circle me-1"></i> Guardar Cambios`;
    if (elBtnCancelar) elBtnCancelar.classList.remove('d-none');

    const formCard = document.getElementById('productoForm');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ELIMINACIÓN CON DIÁLOGO MODAL SWEETALERT2
async function eliminarProducto(id, nombre) {
    const confirmacion = typeof Swal !== 'undefined'
        ? await Swal.fire({
            title: '¿Eliminar Repuesto?',
            html: `¿Estás seguro de eliminar el repuesto <strong class="text-warning">"${escaparHTML(nombre)}"</strong> del catálogo? Esta acción no se puede revertir.`,
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
        : { isConfirmed: confirm(`¿Está seguro de eliminar el repuesto "${nombre}" del catálogo?`) };

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok) {
            if (typeof Toast !== 'undefined') Toast.fire({ icon: 'success', title: data.mensaje || 'Repuesto eliminado del catálogo' });
            mostrarAlerta(data.mensaje || 'Repuesto eliminado del catálogo.', 'warning');
            cargarProductos();
        } else {
            if (typeof Toast !== 'undefined') Toast.fire({ icon: 'error', title: data.error || 'Error al eliminar producto' });
            mostrarAlerta(data.error || 'Error al eliminar producto.', 'danger');
        }
    } catch (error) {
        if (typeof Toast !== 'undefined') Toast.fire({ icon: 'error', title: 'Error al contactar con el servidor' });
        mostrarAlerta('Error al eliminar producto.', 'danger');
    }
}

function resetFormularioProducto() {
    const form = document.getElementById('productoForm');
    if (form) form.reset();
    const elId = document.getElementById('prodId');
    const elMin = document.getElementById('stockMinimo');
    const elTitle = document.getElementById('formTitle');
    const elBtnGuardar = document.getElementById('btnGuardarProd');
    const elBtnCancelar = document.getElementById('btnCancelarProd');

    if (elId) elId.value = '';
    if (elMin) elMin.value = '5';
    if (elTitle) elTitle.innerHTML = `<i class="bi bi-plus-circle-fill me-2 fs-5"></i> Registrar Repuesto`;
    if (elBtnGuardar) elBtnGuardar.innerHTML = `<i class="bi bi-cloud-arrow-up-fill me-1"></i> Guardar Producto`;
    if (elBtnCancelar) elBtnCancelar.classList.add('d-none');
}

function mostrarAlerta(mensaje, tipo) {
    const alertBox = document.getElementById('inventarioAlert');
    if (!alertBox) return;
    alertBox.className = `alert alert-${tipo} py-2 px-3 small rounded-3 fw-semibold`;
    alertBox.textContent = mensaje;
    alertBox.classList.remove('d-none');
    setTimeout(() => alertBox.classList.add('d-none'), 4000);
}

// ==========================================
// 5. EXPORTACIÓN PROFESIONAL A PDF
// ==========================================
async function exportarPDF() {
    if (!productosGlobal || productosGlobal.length === 0) {
        if (typeof Toast !== 'undefined') Toast.fire({ icon: 'warning', title: 'No hay productos en el inventario para exportar' });
        return;
    }

    const fechaStr = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `Reporte_Inventario_GOLDEN_${fechaStr}.pdf`;

    // 1. Motor editorial industrial limpio con membrete de GOLDEN
    if (typeof window.generarReporteInventarioHTML === 'function' && typeof window.descargarDocumentoPDF === 'function') {
        try {
            const html = window.generarReporteInventarioHTML(productosGlobal);
            await window.descargarDocumentoPDF(html, nombreArchivo);
            return;
        } catch (e) {
            console.warn('Recurriendo a motor jsPDF:', e);
        }
    }

    // 2. Respaldo directo con jsPDF
    if (!window.jspdf || !window.jspdf.jsPDF) {
        if (typeof Toast !== 'undefined') Toast.fire({ icon: 'error', title: 'La librería jsPDF no está disponible en este momento' });
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const usuario = typeof obtenerUsuarioSesion === 'function' ? obtenerUsuarioSesion() : null;
    const fechaEmision = new Date().toLocaleString('es-BO');

    let valorTotalInventario = 0;
    let unidadesTotales = 0;
    productosGlobal.forEach(p => {
        const s = parseInt(p.stock) || 0;
        const pr = parseFloat(p.precio) || 0;
        valorTotalInventario += (pr * s);
        unidadesTotales += s;
    });

    // Encabezado Corporativo
    doc.setFillColor(20, 22, 25); // #141619
    doc.rect(0, 0, 210, 30, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(245, 158, 11); // #f59e0b (Ámbar)
    doc.text("GOLDEN LUBRICANTES & FILTROS S.R.L. — SUCRE, BOLIVIA", 14, 11);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text("Casa Matriz: Av. Jaime Mendoza #1420 • Sucre, Bolivia • NIT: 1029384756", 14, 17);
    doc.text("REPORTE OFICIAL DE EXISTENCIAS Y VALORACIÓN FÍSICA DE ALMACÉN", 14, 23);

    // Metadatos
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Fecha y Hora de Emisión: ${fechaEmision} | Tel: (+591) 4 64-52890`, 14, 36);
    doc.text(`Generado por: ${usuario ? usuario.nombre : 'Usuario Autorizado'} (${usuario ? usuario.rol : 'SISTEMA'})`, 14, 41);

    // Resumen de Métricas en Caja
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 45, 182, 16, 2, 2, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`Total de Repuestos: ${productosGlobal.length} ítems`, 18, 53);
    doc.text(`Unidades Físicas: ${unidadesTotales} unidades`, 80, 53);
    doc.setTextColor(185, 28, 28);
    doc.text(`Valorización Total: Bs. ${valorTotalInventario.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 135, 53);

    // Tabla con jsPDF-AutoTable
    const columnas = ["SKU", "Descripción del Repuesto", "Categoría", "P. Unit (Bs.)", "Stock", "Valor (Bs.)"];
    const filas = productosGlobal.map(p => {
        const sku = String(p.sku || '').trim() || 'GLD-REP';
        const nombre = String(p.nombre || '').trim() || 'Sin descripción';
        const categoria = String(p.categoria || '').trim() || 'General';
        const precio = Number(p.precio) || 0;
        const stock = Number(p.stock) || 0;
        return [
            sku,
            nombre,
            categoria,
            `Bs. ${precio.toFixed(2)}`,
            `${stock} unid.`,
            `Bs. ${(precio * stock).toFixed(2)}`
        ];
    });

    doc.autoTable({
        startY: 65,
        head: [columnas],
        body: filas,
        theme: 'striped',
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [245, 158, 11],
            fontStyle: 'bold',
            fontSize: 9
        },
        bodyStyles: {
            fontSize: 8.5,
            textColor: [30, 41, 59]
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 28 },
            1: { cellWidth: 55 },
            2: { cellWidth: 35 },
            3: { halign: 'right', cellWidth: 22 },
            4: { halign: 'center', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 22 }
        },
        didDrawPage: function (data) {
            const str = "Página " + doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("ERP GOLDEN - Documento confidencial para control de almacén.", 14, 290);
            doc.text(str, 195, 290, { align: 'right' });
        }
    });

    doc.save(nombreArchivo);
    if (typeof Toast !== 'undefined') Toast.fire({ icon: 'success', title: 'Reporte PDF descargado con éxito' });
}

// ==========================================
// 6. KARDEX & TRAZABILIDAD DE MOVIMIENTOS
// ==========================================
async function abrirKardex(sku) {
    const modalEl = document.getElementById('modalKardex');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

    // Resetear valores de vista previa
    document.getElementById('kardexSkuBadge').innerText = sku;
    document.getElementById('kardexNombreProducto').innerText = 'Cargando datos del repuesto...';
    document.getElementById('kardexCategoriaBadge').innerText = '...';
    document.getElementById('kardexPrecioRef').innerText = '...';
    document.getElementById('kardexStockActual').innerText = '...';
    document.getElementById('kardexTotalVendido').innerText = '...';
    document.getElementById('kardexTotalRecaudado').innerText = '...';

    const tbody = document.getElementById('tablaKardexMovimientos');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Consultando movimientos de Kardex en almacén...</td></tr>';

    modal.show();

    try {
        const res = await fetch(`${API_URL}/kardex/${encodeURIComponent(sku)}?t=${Date.now()}`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Error al obtener Kardex');
        }

        const data = await res.json();
        const prod = data.producto;
        const movs = data.movimientos;

        // Actualizar Cabecera y KPIs del Modal
        document.getElementById('kardexSkuBadge').innerText = prod.sku;
        document.getElementById('kardexNombreProducto').innerText = prod.nombre;
        document.getElementById('kardexCategoriaBadge').innerText = prod.categoria;
        document.getElementById('kardexPrecioRef').innerText = `Bs. ${prod.precio.toFixed(2)}`;
        document.getElementById('kardexStockActual').innerText = `${prod.stock_actual} unid.`;
        document.getElementById('kardexTotalVendido').innerText = `${prod.total_vendido} unid.`;
        document.getElementById('kardexTotalRecaudado').innerText = `Bs. ${prod.total_recaudado.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        tbody.innerHTML = '';
        if (!movs || movs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-secondary">
                        <i class="bi bi-journal-x fs-1 d-block mb-2 text-warning opacity-50"></i>
                        <h6 class="text-dark fw-bold">Sin movimientos de salida registrados</h6>
                        <p class="small text-secondary mb-0">Este repuesto aún no registra compras ni despachos en el sistema.</p>
                    </td>
                </tr>`;
            return;
        }

        movs.forEach(m => {
            let badgeEstado = '<span class="badge-pill-stitch badge-pill-ruby">PENDIENTE</span>';
            if (m.estado_pedido === 'EN CAMINO') badgeEstado = '<span class="badge-pill-stitch badge-pill-gold">EN CAMINO</span>';
            if (m.estado_pedido === 'ENTREGADO') badgeEstado = '<span class="badge-pill-stitch badge-pill-emerald">ENTREGADO</span>';

            const fechaStr = new Date(m.fecha).toLocaleString();

            tbody.innerHTML += `
                <tr>
                    <td class="ps-4 text-nowrap font-monospace small" style="color: #57534E; font-family: 'Inter', sans-serif;">
                        <i class="bi bi-calendar3 text-warning me-1"></i>${fechaStr}
                    </td>
                    <td>
                        <span class="badge font-monospace px-2 py-1" style="background: #292524; color: #FFFFFF; font-family: 'Inter', sans-serif;">#00${m.pedido_id}</span>
                    </td>
                    <td>
                        <span class="fw-bold text-dark d-block">${m.cliente}</span>
                        <small class="text-secondary font-monospace" style="font-size: 0.72rem;">${m.cliente_email}</small>
                    </td>
                    <td class="text-center">
                        <span class="badge-pill-stitch badge-pill-ruby fw-bold">-${m.cantidad} unid.</span>
                    </td>
                    <td class="text-end font-monospace" style="color: #57534E; font-family: 'Inter', sans-serif;">
                        Bs. ${m.precio_unitario.toFixed(2)}
                    </td>
                    <td class="text-end font-monospace fw-bold" style="color: #34d399;">
                        Bs. ${m.subtotal.toFixed(2)}
                    </td>
                    <td class="text-end pe-4">
                        ${badgeEstado}
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-danger">
                    <i class="bi bi-exclamation-triangle fs-2 d-block mb-2"></i>
                    ${error.message}
                </td>
            </tr>`;
        Toast.fire({ icon: 'error', title: error.message });
    }
}

// =========================================================================
// EXPORTACIÓN GERENCIAL A EXCEL NATIVO REAL (.XLSX)
// =========================================================================
function exportarInventarioExcel() {
    if (!productosGlobal || productosGlobal.length === 0) {
        if (typeof Toast !== 'undefined') Toast.fire({ icon: 'warning', title: 'No hay productos en el inventario para exportar' });
        return;
    }

    if (typeof window.exportarReporteExcel === 'function') {
        window.exportarReporteExcel({
            titulo: 'CATÁLOGO OFICIAL DE REPUESTOS Y EXISTENCIAS DE ALMACÉN',
            subtitulo: 'Almacén Central Sucre — Av. Jaime Mendoza #1420',
            columnas: ['SKU / CÓDIGO', 'DESCRIPCIÓN DEL REPUESTO', 'CATEGORÍA', 'P. UNITARIO (BS.)', 'STOCK DISPONIBLE', 'STOCK MÍNIMO', 'VALOR TOTAL (BS.)', 'ESTADO ALMACÉN'],
            filas: productosGlobal.map(p => {
                const stock = Number(p.stock) || 0;
                const min = Number(p.stock_minimo) || 5;
                const precio = Number(p.precio) || 0;
                return [
                    String(p.sku || '').trim() || 'GLD-REP',
                    String(p.nombre || '').trim() || 'Sin descripción',
                    String(p.categoria || '').trim() || 'General',
                    precio,
                    stock,
                    min,
                    stock * precio,
                    (stock <= min ? 'CRÍTICO' : 'ÓPTIMO')
                ];
            }),
            anchos: [16, 44, 22, 18, 18, 16, 20, 16],
            nombreArchivo: 'Inventario_GOLDEN'
        });
        return;
    }

    if (typeof window.exportarTablaCSV === 'function') {
        window.exportarTablaCSV('tablaInventarioCompleta', 'Inventario_GOLDEN', 'Inventario de Repuestos');
    }
}
window.exportarInventarioExcel = exportarInventarioExcel;
window.exportarTablaCSV = exportarInventarioExcel;
window.exportarPDF = exportarPDF;
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.registrarEntradaStock = registrarEntradaStock;
window.resetFormularioProducto = resetFormularioProducto;
window.abrirKardex = abrirKardex;
window.renderizarTabla = renderizarTabla;
window.renderizarInventario = renderizarTabla;
window.cargarProductos = cargarProductos;
window.cargarInventario = cargarProductos;
