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
        const estPagoUpper = String(f.estado_pago || '').toUpperCase();
        const esPagado = estPagoUpper.includes('PAGADO') || estPagoUpper === 'VERIFICADO' || estadoUpper === 'ENTREGADO' || estadoUpper === 'PAGADO';
        
        const fechaStr = f.fecha_compra 
            ? new Date(f.fecha_compra).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
            : '10/11/2026, 01:08';

        const totalNum = parseFloat(f.total || 0).toFixed(2);
        const mPago = String(f.metodo_pago || 'QR_DIRECTO').toUpperCase();
        const banco = f.banco_origen || 'Banco Unión S.A.';
        const numBoleta = f.numero_operacion || f.comprobante_ref || 'S/N';
        const tieneImagen = Boolean(f.comprobante_img);

        let metodoHTML = '';
        if (mPago === 'DEPOSITO_BANCARIO') {
            metodoHTML = `
                <div class="d-flex flex-column gap-1">
                    <div>
                        <span class="badge px-2 py-1 rounded-pill" style="background: #F59E0B !important; color: #18181B; font-weight: 700; font-size: 0.72rem;">
                            <i class="bi bi-bank2 me-1"></i>Depósito Bancario
                        </span>
                    </div>
                    <div class="font-mono text-dark fw-bold small" style="font-size: 0.82rem;">
                        <i class="bi bi-receipt text-danger me-1"></i>Boleta #${escaparHTML(numBoleta)}
                    </div>
                    <small class="text-secondary" style="font-size: 0.72rem;">${escaparHTML(banco)}</small>
                </div>
            `;
        } else if (mPago === 'QR_DIRECTO' || mPago === 'QR_SIMPLE') {
            metodoHTML = `
                <div class="d-flex flex-column gap-1">
                    <div>
                        <span class="badge px-2 py-1 rounded-pill text-white" style="background: #7C3AED !important; font-weight: 700; font-size: 0.72rem;">
                            <i class="bi bi-qr-code-scan me-1"></i>QR Directo
                        </span>
                    </div>
                    <div class="font-mono text-secondary small" style="font-size: 0.78rem;">
                        <span class="text-dark fw-semibold">Ref:</span> ${escaparHTML(numBoleta)}
                    </div>
                    <small class="text-muted" style="font-size: 0.72rem;">${escaparHTML(banco)}</small>
                </div>
            `;
        } else if (mPago === 'PAYPAL') {
            metodoHTML = `
                <div class="d-flex flex-column gap-1">
                    <div>
                        <span class="badge px-2 py-1 rounded-pill bg-primary text-white" style="font-weight: 700; font-size: 0.72rem;">
                            <i class="bi bi-paypal me-1"></i>PayPal Internacional
                        </span>
                    </div>
                    <div class="font-mono text-secondary small" style="font-size: 0.78rem;">
                        <span class="text-dark fw-semibold">ID:</span> ${escaparHTML(numBoleta)}
                    </div>
                </div>
            `;
        } else {
            metodoHTML = `
                <div class="d-flex flex-column gap-1">
                    <div>
                        <span class="badge px-2 py-1 rounded-pill bg-secondary text-white" style="font-weight: 700; font-size: 0.72rem;">
                            ${mPago}
                        </span>
                    </div>
                    <small class="text-secondary font-mono">${escaparHTML(numBoleta)}</small>
                </div>
            `;
        }

        return `
            <tr>
                <td class="ps-4">
                    <span class="badge px-2 py-1 rounded-2" style="background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); font-family: 'Chivo Mono', monospace; font-size: 0.88rem;">
                        FAC-${idFactura}
                    </span>
                </td>
                <td>
                    <div class="fw-bold text-dark">${escaparHTML(f.cliente || 'Consumidor Final')}</div>
                    <small class="text-secondary">${escaparHTML(f.cliente_email || 'ventas@goldenerp.com')}</small>
                </td>
                <td>
                    ${metodoHTML}
                </td>
                <td class="text-secondary small">
                    <i class="bi bi-calendar3 me-1 text-warning opacity-75"></i>${fechaStr}
                </td>
                <td class="text-end fw-extrabold text-success" style="font-family: 'Chivo Mono', monospace; font-size: 0.95rem;">
                    Bs. ${totalNum}
                </td>
                <td class="text-center">
                    <span class="badge rounded-pill px-3 py-1 ${esPagado ? 'bg-success-subtle text-success border border-success border-opacity-25' : 'bg-warning-subtle text-warning border border-warning border-opacity-25'}" style="font-size: 0.75rem; letter-spacing: 0.5px;">
                        ${esPagado ? '<i class="bi bi-check-circle me-1"></i>VERIFICADO' : '<i class="bi bi-clock me-1"></i>PENDIENTE'}
                    </span>
                </td>
                <td class="pe-4 text-end">
                    <div class="d-inline-flex align-items-center gap-1">
                        ${tieneImagen ? `
                            <button class="btn btn-sm btn-outline-info py-1 px-2 rounded fw-semibold d-inline-flex align-items-center gap-1 shadow-sm" onclick="verComprobanteAdjunto(${f.id})" style="font-size: 0.75rem;" title="Ver captura o boleta adjunta">
                                <i class="bi bi-image"></i>
                                <span>Ver Boleta</span>
                            </button>
                        ` : ''}
                        ${!esPagado ? `
                            <button class="btn btn-sm btn-success py-1 px-2 rounded fw-bold d-inline-flex align-items-center gap-1 shadow-sm" onclick="verificarYAprobarCobro(${f.id})" style="font-size: 0.75rem;" title="Verificar cobro y pasar a Empaque / Almacén">
                                <i class="bi bi-check2-circle"></i>
                                <span>Aprobar a Empaque</span>
                            </button>
                        ` : ''}
                        <button class="btn btn-outline-warning btn-sm py-1 px-2 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm fw-semibold" onclick="generarRecibo(${f.id})" style="font-size: 0.75rem;" title="Descargar Factura Oficial en PDF (Carta / A4)">
                            <i class="bi bi-file-earmark-pdf-fill text-danger"></i>
                            <span>PDF</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

function verComprobanteAdjunto(id) {
    const f = facturasGlobal.find(item => item.id == id);
    if (!f || !f.comprobante_img) {
        if (typeof Toast !== 'undefined') Toast.fire({ icon: 'info', title: 'Esta orden no tiene archivo adjunto' });
        return;
    }
    const numBoleta = f.numero_operacion || f.comprobante_ref || 'S/N';
    const esDeposito = (f.metodo_pago || '').toUpperCase() === 'DEPOSITO_BANCARIO';

    Swal.fire({
        title: `<div class="d-flex align-items-center justify-content-center gap-2"><i class="bi bi-receipt-cutoff text-warning"></i><span>Comprobante de Pago - Orden #${id}</span></div>`,
        html: `
            <div class="text-start p-2 mb-3 rounded bg-light border font-mono small text-dark">
                <div><strong>Tipo de Pago:</strong> ${esDeposito ? 'Depósito en Ventanilla / ACH' : 'Pago QR Directo'}</div>
                <div><strong>N° Boleta / Ref:</strong> <span class="text-danger fw-bold">${escaparHTML(numBoleta)}</span></div>
                <div><strong>Banco Emisor:</strong> ${escaparHTML(f.banco_origen || 'Banco Unión S.A.')}</div>
                <div><strong>Monto:</strong> <span class="text-success fw-bold">Bs. ${parseFloat(f.total || 0).toFixed(2)}</span></div>
            </div>
            <div class="text-center p-2 rounded" style="background: #0f172a; max-height: 520px; overflow-y: auto;">
                <img src="${f.comprobante_img}" alt="Comprobante de Pago" class="img-fluid rounded shadow" style="max-height: 480px; object-fit: contain;">
            </div>
        `,
        confirmButtonColor: '#B91C1C',
        confirmButtonText: 'Cerrar Comprobante',
        width: 620,
        background: '#FAF8F5',
        color: '#141619'
    });
}
window.verComprobanteAdjunto = verComprobanteAdjunto;

async function verificarYAprobarCobro(id) {
    const f = facturasGlobal.find(item => item.id == id);
    const numBoleta = f ? (f.numero_operacion || f.comprobante_ref || 'S/N') : 'S/N';
    const tipoPago = f && f.metodo_pago === 'DEPOSITO_BANCARIO' ? 'Depósito Bancario' : 'Pago QR Directo';

    const resp = await (typeof Swal !== 'undefined' ? Swal.fire({
        title: `¿Aprobar Pago y Pasar a Empaque?`,
        html: `
            <p class="text-secondary small mb-2">Orden <strong>#${id}</strong> por <strong>Bs. ${f ? parseFloat(f.total).toFixed(2) : ''}</strong></p>
            <div class="p-2 border rounded bg-light font-mono small text-start">
                <strong>Método:</strong> ${tipoPago}<br>
                <strong>Boleta / Ref:</strong> ${escaparHTML(numBoleta)}
            </div>
            <p class="text-muted small mt-2 mb-0">Al confirmar, el pago queda <strong>VERIFICADO</strong> y la orden pasará inmediatamente a la bandeja de <strong>Empaque y Picking de Almacén</strong>.</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#15803D',
        cancelButtonColor: '#64748B',
        confirmButtonText: '<i class="bi bi-box-seam me-1"></i> Sí, Aprobar y Pasar a Empaque',
        cancelButtonText: 'Cancelar'
    }) : { isConfirmed: confirm(`¿Aprobar cobro de Orden #${id}?`) });

    if (!resp.isConfirmed) return;

    try {
        const usuario = JSON.parse(localStorage.getItem('usuario_golden') || '{}');
        const res = await fetch(`/api/pedidos/${id}/aprobar-cobro`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_nombre: usuario.nombre || 'Cobranzas / Administración' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al aprobar cobro');

        if (typeof Toast !== 'undefined') {
            Toast.fire({ icon: 'success', title: `Cobro de Orden #${id} verificado. ¡Pasado a Empaque/Almacén!` });
        } else {
            alert(`Cobro de Orden #${id} verificado y pasado a empaque.`);
        }
        cargarFacturacion();
    } catch (e) {
        if (typeof Toast !== 'undefined') {
            Toast.fire({ icon: 'error', title: e.message });
        } else {
            alert(e.message);
        }
    }
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
    if (typeof window.exportarReporteExcel === 'function' && Array.isArray(facturasGlobal) && facturasGlobal.length > 0) {
        window.exportarReporteExcel({
            titulo: 'LIBRO DE VENTAS Y FACTURACIÓN FISCAL',
            subtitulo: 'Control Oficial de Cobranzas y Comprobantes — Sucre, Bolivia',
            columnas: ['N° FACTURA', 'FECHA EMISIÓN', 'CLIENTE / TALLER', 'NIT / CI', 'MÉTODO DE PAGO', 'TOTAL FACTURADO (BS.)', 'ESTADO'],
            filas: facturasGlobal.map(f => [
                `#00${String(f.id).padStart(4, '0')}`,
                f.fecha_compra ? new Date(f.fecha_compra).toLocaleString('es-BO') : '',
                typeof window.limpiarTextoCelda === 'function' ? window.limpiarTextoCelda(f.cliente || f.cliente_nombre || 'Consumidor Final') : (f.cliente || f.cliente_nombre || 'Consumidor Final'),
                f.nit || f.cliente_nit || '1029384756',
                (f.metodo_pago || 'QR SIMPLE').toUpperCase(),
                parseFloat(f.total || 0),
                (f.estado || 'CONFIRMADO').toUpperCase()
            ]),
            anchos: [16, 22, 34, 18, 20, 22, 18],
            nombreArchivo: 'Facturacion_Cobranzas_GOLDEN'
        });
        return;
    }

    if (typeof exportarTablaCSV === 'function') {
        exportarTablaCSV('tablaFacturacionEl', 'Facturacion_Cobranzas_GOLDEN', 'Libro de Ventas y Cobranzas');
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

window.exportarFacturasCSV = exportarFacturasCSV;
window.exportarFacturasExcel = exportarFacturasCSV;
