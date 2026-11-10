/**
 * ERP GOLDEN - Módulo de Inventario VIP, Búsqueda en Tiempo Real, Kardex y Exportación PDF
 */
const API_URL = '/api';
let productosGlobal = [];

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
    // Control de Acceso RBAC: Solo Administradores y Almaceneros
    const usuario = protegerRuta('inventario', ['ADMIN', 'ALMACENERO']);
    if (!usuario) return;

    renderizarMenu('inventario');
    cargarProductos();
});

// ==========================================
// 1. CARGA DE PRODUCTOS Y KPIS
// ==========================================
async function cargarProductos() {
    const tbody = document.getElementById('tablaProductos');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Sincronizando inventario...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/productos?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar inventario');
        productosGlobal = await res.json();

        actualizarMiniKPIs(productosGlobal);
        renderizarTabla(productosGlobal);
    } catch (error) {
        console.error("Error al cargar productos:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5"><i class="bi bi-exclamation-triangle me-1"></i>Error al conectar con la base de datos de inventario.</td></tr>';
        Toast.fire({ icon: 'error', title: 'Error al conectar con el inventario' });
    }
}

function actualizarMiniKPIs(lista) {
    const totalItems = lista.length;
    let totalUnidades = 0;
    let bajoStock = 0;

    lista.forEach(p => {
        totalUnidades += p.stock;
        if (p.stock <= p.stock_minimo) bajoStock++;
    });

    document.getElementById('kpiTotalItems').innerText = totalItems;
    document.getElementById('kpiTotalUnidades').innerText = totalUnidades;
    document.getElementById('kpiBajoStock').innerText = bajoStock;
}

// ==========================================
// 2. DIBUJAR LA TABLA DE CATÁLOGO VIP
// ==========================================
function renderizarTabla(productos, filtroBusqueda = '') {
    const tbody = document.getElementById('tablaProductos');
    tbody.innerHTML = '';

    if (!productos || productos.length === 0) {
        if (filtroBusqueda) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary py-5"><i class="bi bi-search fs-3 d-block mb-2 text-warning"></i>No se encontraron repuestos que coincidan con "<strong>${filtroBusqueda}</strong>".</td></tr>`;
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-5"><i class="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>No se registran repuestos en el inventario.</td></tr>';
        }
        return;
    }

    productos.forEach(p => {
        const esBajoStock = p.stock <= p.stock_minimo;
        const stockBadge = esBajoStock ? 'badge-pill-ruby' : 'badge-pill-emerald';
        const estadoTexto = esBajoStock
            ? '<span class="badge-pill-vip badge-pill-ruby"><span class="pulse-dot pulse-dot-ruby me-1"></span>Crítico</span>'
            : '<span class="badge-pill-vip badge-pill-emerald"><span class="pulse-dot pulse-dot-emerald me-1"></span>Óptimo</span>';

        tbody.innerHTML += `
            <tr>
                <td class="ps-4">
                    <span class="badge bg-dark font-monospace text-warning px-2 py-1 border border-secondary border-opacity-50">${p.sku}</span>
                </td>
                <td>
                    <div class="fw-bold text-white">${p.nombre}</div>
                    <span class="badge-pill-vip badge-pill-slate small mt-1" style="font-size: 0.72rem;">${p.categoria}</span>
                </td>
                <td class="fw-bold fs-6" style="color: #34d399;">Bs. ${parseFloat(p.precio).toFixed(2)}</td>
                <td>
                    <span class="badge-pill-vip ${stockBadge}">${p.stock} unid.</span>
                    <small class="text-secondary d-block mt-1" style="font-size: 0.7rem;">Mínimo: ${p.stock_minimo}</small>
                </td>
                <td>${estadoTexto}</td>
                <td class="text-end pe-4 text-nowrap">
                    <button class="btn btn-sm btn-outline-info rounded-2 me-1" onclick="abrirKardex('${p.sku}')" title="Historial Kardex (Trazabilidad)">
                        <i class="bi bi-clock-history"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning rounded-2 me-1" onclick="editarProducto(${p.id})" title="Editar Repuesto">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger rounded-2" onclick="eliminarProducto(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')" title="Eliminar Repuesto">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// ==========================================
// 3. BUSCADOR EN TIEMPO REAL (EVENTO INPUT)
// ==========================================
document.getElementById('buscadorInventario').addEventListener('input', (e) => {
    const texto = e.target.value.toLowerCase().trim();
    const filtrados = productosGlobal.filter(p =>
        (p.nombre && p.nombre.toLowerCase().includes(texto)) ||
        (p.sku && p.sku.toLowerCase().includes(texto)) ||
        (p.categoria && p.categoria.toLowerCase().includes(texto))
    );
    renderizarTabla(filtrados, texto);
});

// ==========================================
// 4. CRUD DE PRODUCTOS (GUARDAR, EDITAR, ELIMINAR)
// ==========================================
document.getElementById('productoForm').addEventListener('submit', async (e) => {
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const data = await res.json();

        if (!res.ok) {
            Toast.fire({ icon: 'error', title: data.error || 'Error al procesar el producto' });
            mostrarAlerta(data.error || 'Error al procesar el producto.', 'danger');
            return;
        }

        const mensajeExito = esEdicion ? 'Repuesto actualizado con éxito' : 'Repuesto registrado con éxito';
        Toast.fire({ icon: 'success', title: data.mensaje || mensajeExito });
        mostrarAlerta(data.mensaje || 'Operación completada exitosamente.', 'success');
        resetFormularioProducto();
        cargarProductos();
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Error de conexión con el servidor' });
        mostrarAlerta('Error de conexión con el servidor.', 'danger');
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = textoOriginalBtn;
        }
    }
});

function editarProducto(id) {
    const p = productosGlobal.find(item => item.id === id);
    if (!p) return;

    document.getElementById('prodId').value = p.id;
    document.getElementById('sku').value = p.sku;
    document.getElementById('nombre').value = p.nombre;
    document.getElementById('categoria').value = p.categoria;
    document.getElementById('precio').value = p.precio;
    document.getElementById('stock').value = p.stock;
    document.getElementById('stockMinimo').value = p.stock_minimo || 5;

    document.getElementById('formTitle').innerHTML = `<i class="bi bi-pencil-square me-2 fs-5"></i> Editar Repuesto #${p.id}`;
    document.getElementById('btnGuardarProd').innerHTML = `<i class="bi bi-check2-circle me-1"></i> Guardar Cambios`;
    document.getElementById('btnCancelarProd').classList.remove('d-none');
}

// ELIMINACIÓN CON DIÁLOGO MODAL SWEETALERT2
async function eliminarProducto(id, nombre) {
    const confirmacion = typeof Swal !== 'undefined'
        ? await Swal.fire({
            title: '¿Eliminar Repuesto?',
            html: `¿Estás seguro de eliminar el repuesto <strong class="text-warning">"${nombre}"</strong> del catálogo? Esta acción no se puede revertir.`,
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
            Toast.fire({ icon: 'success', title: data.mensaje || 'Repuesto eliminado del catálogo' });
            mostrarAlerta(data.mensaje, 'warning');
            cargarProductos();
        } else {
            Toast.fire({ icon: 'error', title: data.error || 'Error al eliminar producto' });
            mostrarAlerta(data.error, 'danger');
        }
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Error al contactar con el servidor' });
        mostrarAlerta('Error al eliminar producto.', 'danger');
    }
}

function resetFormularioProducto() {
    document.getElementById('productoForm').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('stockMinimo').value = '5';
    document.getElementById('formTitle').innerHTML = `<i class="bi bi-plus-circle-fill me-2 fs-5"></i> Registrar Repuesto`;
    document.getElementById('btnGuardarProd').innerHTML = `<i class="bi bi-cloud-arrow-up-fill me-1"></i> Guardar Producto`;
    document.getElementById('btnCancelarProd').classList.add('d-none');
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
// 5. EXPORTACIÓN PROFESIONAL A PDF (jsPDF)
// ==========================================
function exportarPDF() {
    if (!productosGlobal || productosGlobal.length === 0) {
        Toast.fire({ icon: 'warning', title: 'No hay productos en el inventario para exportar' });
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        Toast.fire({ icon: 'error', title: 'La librería jsPDF no está disponible en este momento' });
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const usuario = obtenerUsuarioSesion();
    const fechaEmision = new Date().toLocaleString();

    let valorTotalInventario = 0;
    let unidadesTotales = 0;
    productosGlobal.forEach(p => {
        valorTotalInventario += (p.precio * p.stock);
        unidadesTotales += p.stock;
    });

    // Encabezado Corporativo
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, 210, 28, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(245, 158, 11); // #f59e0b (Ámbar)
    doc.text("DISTRIBUIDORA GOLDEN S.R.L.", 14, 12);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text("Sistema ERP de Control de Inventario y Cadena de Suministro", 14, 18);
    doc.text("REPORTE OFICIAL DE EXISTENCIAS Y VALORACIÓN FÍSICA", 14, 24);

    // Metadatos
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Fecha y Hora de Emisión: ${fechaEmision}`, 14, 35);
    doc.text(`Generado por: ${usuario ? usuario.nombre : 'Usuario Autorizado'} (${usuario ? usuario.rol : 'SISTEMA'})`, 14, 40);

    // Resumen de Métricas en Caja
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 44, 182, 16, 2, 2, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`Total de Repuestos: ${productosGlobal.length} ítems`, 18, 51);
    doc.text(`Unidades Físicas: ${unidadesTotales} unidades`, 80, 51);
    doc.setTextColor(217, 119, 6);
    doc.text(`Valorización Total: Bs. ${valorTotalInventario.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 140, 51);

    // Tabla con jsPDF-AutoTable
    const columnas = ["SKU", "Descripción del Repuesto", "Categoría", "P. Unit (Bs.)", "Stock", "Valor (Bs.)"];
    const filas = productosGlobal.map(p => [
        p.sku,
        p.nombre,
        p.categoria,
        `Bs. ${parseFloat(p.precio).toFixed(2)}`,
        `${p.stock} unid.`,
        `Bs. ${(p.precio * p.stock).toFixed(2)}`
    ]);

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
            doc.text("ERP GOLDEN - Documento confidencial para control de auditoría interna.", 14, 290);
            doc.text(str, 195, 290, { align: 'right' });
        }
    });

    doc.save(`Reporte_Inventario_GOLDEN_${new Date().toISOString().slice(0, 10)}.pdf`);
    Toast.fire({ icon: 'success', title: 'Reporte PDF descargado con éxito' });
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
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Consultando movimientos de Kardex en SQLite...</td></tr>';

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
                        <h6 class="text-white fw-bold">Sin movimientos de salida registrados</h6>
                        <p class="small text-secondary mb-0">Este repuesto aún no registra compras ni despachos en el sistema.</p>
                    </td>
                </tr>`;
            return;
        }

        movs.forEach(m => {
            let badgeEstado = '<span class="badge-pill-vip badge-pill-ruby">PENDIENTE</span>';
            if (m.estado_pedido === 'EN CAMINO') badgeEstado = '<span class="badge-pill-vip badge-pill-gold">EN CAMINO</span>';
            if (m.estado_pedido === 'ENTREGADO') badgeEstado = '<span class="badge-pill-vip badge-pill-emerald">ENTREGADO</span>';

            const fechaStr = new Date(m.fecha).toLocaleString();

            tbody.innerHTML += `
                <tr>
                    <td class="ps-4 text-nowrap font-monospace small" style="color: #cbd5e1;">
                        <i class="bi bi-calendar3 text-warning me-1"></i>${fechaStr}
                    </td>
                    <td>
                        <span class="badge bg-dark font-monospace text-warning px-2 py-1 border border-secondary border-opacity-50">#00${m.pedido_id}</span>
                    </td>
                    <td>
                        <span class="fw-bold text-white d-block">${m.cliente}</span>
                        <small class="text-secondary font-monospace" style="font-size: 0.72rem;">${m.cliente_email}</small>
                    </td>
                    <td class="text-center">
                        <span class="badge-pill-vip badge-pill-ruby fw-bold">-${m.cantidad} unid.</span>
                    </td>
                    <td class="text-end font-monospace" style="color: #cbd5e1;">
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
// EXPORTACIÓN GERENCIAL A EXCEL / CSV
// =========================================================================
function exportarTablaCSV(tablaId, nombreArchivo = 'Inventario_GOLDEN') {
    let tabla = document.getElementById(tablaId);
    if (!tabla) {
        const el = document.getElementById(tablaId);
        if (el && el.tagName === 'TBODY') tabla = el.closest('table');
    }

    if (!tabla) {
        Toast.fire({ icon: 'warning', title: 'Tabla no encontrada para exportar' });
        return;
    }

    const filas = Array.from(tabla.querySelectorAll('tr'));
    if (filas.length === 0) {
        Toast.fire({ icon: 'info', title: 'Sin datos para exportar' });
        return;
    }

    const lineasCSV = [];

    filas.forEach(fila => {
        const colspanTd = fila.querySelector('td[colspan]');
        if (colspanTd && parseInt(colspanTd.getAttribute('colspan')) >= 3) return;

        const celdas = Array.from(fila.querySelectorAll('th, td'));
        const datosFila = [];

        celdas.forEach(celda => {
            const textoCabecera = celda.innerText.trim().toLowerCase();
            if (textoCabecera === 'acciones' || celda.classList.contains('col-acciones')) return;
            if (celda.querySelector('button') && !celda.innerText.trim()) return;

            let valor = celda.innerText
                .replace(/(\r\n|\n|\r)/gm, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/"/g, '""');

            datosFila.push(`"${valor}"`);
        });

        if (datosFila.length > 0) {
            lineasCSV.push(datosFila.join(';'));
        }
    });

    if (lineasCSV.length === 0) {
        Toast.fire({ icon: 'info', title: 'No se encontraron registros exportables' });
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

    Toast.fire({ icon: 'success', title: `Inventario exportado a CSV con éxito` });
}
