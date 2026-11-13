/**
 * ERP GOLDEN - Módulo de Cobranza & Facturación Electrónica B2B/B2C
 */

let facturasGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Proteger ruta y validar sesión activa
    const usuario = (typeof protegerRuta === 'function') 
        ? protegerRuta('facturacion') 
        : JSON.parse(localStorage.getItem('usuario_golden') || '{}');

    // 2. Renderizar Menú Glassmorphic Horizontal Superior
    if (typeof renderizarMenu === 'function') {
        renderizarMenu('facturacion');
    }

    // 3. Sincronizar datos del usuario activo
    if (usuario && usuario.nombre) {
        const elName = document.getElementById('navUserName') || document.getElementById('sidebarUserName');
        const elRol = document.getElementById('navUserRol') || document.getElementById('sidebarUserRol');
        if (elName) elName.innerText = usuario.nombre;
        if (elRol) elRol.innerText = usuario.rol || 'USUARIO';
    }

    // 4. Iniciar monitor de alertas de stock para la campanita
    if (typeof iniciarMonitorAlertasStock === 'function') {
        setTimeout(iniciarMonitorAlertasStock, 300);
    }

    // 5. Cargar facturación y cobranzas
    cargarFacturacion();
});

// =========================================================================
// 1. CARGA DE DATOS DE FACTURACIÓN Y CÁLCULO DE KPIS
// =========================================================================
async function cargarFacturacion() {
    const tbody = document.getElementById('tablaFacturasBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-secondary">
                    <span class="spinner-border spinner-border-sm text-warning me-2"></span>Sincronizando cobranzas y facturación oficial...
                </td>
            </tr>
        `;
    }

    try {
        const [resPedidos, resStats] = await Promise.all([
            fetch('/api/pedidos?t=' + Date.now()),
            fetch('/api/estadisticas?t=' + Date.now()).catch(() => null)
        ]);

        if (!resPedidos.ok) throw new Error('No se pudo conectar con el servicio de pedidos');
        facturasGlobal = await resPedidos.json();

        let stats = null;
        if (resStats && resStats.ok) {
            stats = await resStats.json();
        }

        actualizarKPIsFacturacion(stats);
        renderizarTablaFacturas(facturasGlobal);

    } catch (error) {
        console.error("Error al cargar facturación:", error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5 text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>Error al consultar facturación: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
}

// =========================================================================
// 2. ACTUALIZACIÓN DE LOS 3 KPIS EJECUTIVOS
// =========================================================================
function actualizarKPIsFacturacion(stats) {
    let totalIngresos = 0;
    let totalPendiente = 0;
    let cantPendientes = 0;
    const totalEmitidas = facturasGlobal.length;

    facturasGlobal.forEach(f => {
        const monto = parseFloat(f.total || 0);
        const estadoUpper = String(f.estado || '').toUpperCase();

        if (estadoUpper === 'ENTREGADO' || estadoUpper === 'PAGADO') {
            totalIngresos += monto;
        } else {
            // PENDIENTE o EN CAMINO
            totalPendiente += monto;
            cantPendientes++;
        }
    });

    // Si viene estadística de ingresos globales mayores, asegurar consistencia
    if (stats && stats.ingresos && stats.ingresos > totalIngresos) {
        totalIngresos = stats.ingresos;
    }

    const elIngresos = document.getElementById('kpiIngresosTotales');
    if (elIngresos) {
        elIngresos.innerHTML = `Bs. <span class="text-success">${totalIngresos.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
    }

    const elPendientes = document.getElementById('kpiPendientesCobro');
    if (elPendientes) {
        elPendientes.innerHTML = `Bs. <span class="text-warning">${totalPendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
    }

    const elBadgePend = document.getElementById('badgeCountPendientes');
    if (elBadgePend) {
        elBadgePend.innerText = `${cantPendientes} Órdenes`;
    }

    const elEmitidas = document.getElementById('kpiTotalFacturas');
    if (elEmitidas) {
        elEmitidas.innerHTML = `<span class="text-info">${totalEmitidas}</span> <small class="fs-6 text-secondary fw-normal">Emitidas</small>`;
    }

    const elBadgeTabla = document.getElementById('badgeTotalFacturasTabla');
    if (elBadgeTabla) {
        elBadgeTabla.innerText = `${totalEmitidas} Facturas`;
    }
}

// =========================================================================
// 3. RENDERIZADO DE LA TABLA DE COBRANZAS
// =========================================================================
function renderizarTablaFacturas(lista) {
    const tbody = document.getElementById('tablaFacturasBody');
    if (!tbody) return;

    if (!Array.isArray(lista) || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-secondary">
                    <i class="bi bi-search fs-3 d-block mb-2 text-warning opacity-50"></i>
                    No se encontraron registros que coincidan con la búsqueda.
                </td>
            </tr>
        `;
        return;
    }

    const html = lista.map(f => {
        const idFactura = String(f.id).padStart(3, '0');
        const estadoUpper = String(f.estado || 'PENDIENTE').toUpperCase();
        const esPagado = estadoUpper === 'ENTREGADO' || estadoUpper === 'PAGADO';
        
        const fechaStr = f.fecha_compra 
            ? new Date(f.fecha_compra).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
            : '10/11/2026, 01:08';

        const totalNum = parseFloat(f.total || 0).toFixed(2);

        return `
            <tr>
                <td class="ps-4">
                    <span class="badge px-2 py-1 rounded-2" style="background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); font-family: monospace; font-size: 0.88rem;">
                        FAC-${idFactura}
                    </span>
                </td>
                <td>
                    <div class="fw-bold text-white">${escaparHTML(f.cliente || 'Consumidor Final')}</div>
                    <small class="text-secondary">${escaparHTML(f.cliente_email || 'ventas@goldenerp.com')}</small>
                </td>
                <td class="text-secondary small">
                    <i class="bi bi-calendar3 me-1 text-warning opacity-75"></i>${fechaStr}
                </td>
                <td class="text-end fw-extrabold text-success" style="font-family: monospace; font-size: 0.95rem;">
                    Bs. ${totalNum}
                </td>
                <td class="text-center">
                    <span class="badge rounded-pill px-3 py-1 ${esPagado ? 'bg-success-subtle text-success border border-success border-opacity-25' : 'bg-warning-subtle text-warning border border-warning border-opacity-25'}" style="font-size: 0.75rem; letter-spacing: 0.5px;">
                        ${esPagado ? '<i class="bi bi-check-circle me-1"></i>PAGADO' : '<i class="bi bi-clock me-1"></i>PENDIENTE'}
                    </span>
                </td>
                <td class="pe-4 text-end">
                    <button class="btn btn-outline-warning btn-sm py-1 px-3 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm fw-semibold" onclick="generarRecibo(${f.id})" title="Descargar Factura Oficial en PDF (Carta / A4)">
                        <i class="bi bi-file-earmark-pdf-fill text-danger"></i>
                        <span>Recibo PDF</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

// =========================================================================
// 4. BÚSQUEDA Y FILTRADO EN TIEMPO REAL
// =========================================================================
function filtrarTablaFacturacion() {
    const query = (document.getElementById('buscadorFacturas')?.value || '').toLowerCase().trim();
    const filtroEstado = document.getElementById('filtroEstadoFactura')?.value || 'TODOS';

    const filtrados = facturasGlobal.filter(f => {
        const idStr = String(f.id).toLowerCase();
        const facStr = `fac-${String(f.id).padStart(3, '0')}`.toLowerCase();
        const clienteStr = String(f.cliente || '').toLowerCase();
        const emailStr = String(f.cliente_email || '').toLowerCase();
        const telStr = String(f.telefono || f.cliente_telefono || '').toLowerCase();
        const nitStr = String(f.nit || f.cliente_nit || '').toLowerCase();

        const coincideTexto = !query || idStr.includes(query) || facStr.includes(query) || clienteStr.includes(query) || emailStr.includes(query) || telStr.includes(query) || nitStr.includes(query);

        const estadoUpper = String(f.estado || 'PENDIENTE').toUpperCase();
        const esPagado = estadoUpper === 'ENTREGADO' || estadoUpper === 'PAGADO';

        let coincideEstado = true;
        if (filtroEstado === 'PAGADO') coincideEstado = esPagado;
        if (filtroEstado === 'PENDIENTE') coincideEstado = !esPagado;

        return coincideTexto && coincideEstado;
    });

    renderizarTablaFacturas(filtrados);
}

// =========================================================================
// 5. EXPORTACIÓN A EXCEL / CSV
// =========================================================================
function exportarFacturasCSV() {
    if (typeof exportarTablaCSV === 'function') {
        exportarTablaCSV('tablaFacturacionEl', 'Facturacion_Cobranzas_GOLDEN');
    } else {
        alert('Exportando registros a archivo CSV...');
    }
}

function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}
