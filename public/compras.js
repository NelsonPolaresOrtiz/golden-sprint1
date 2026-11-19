/**
 * ERP GOLDEN - Módulo de Cadena de Suministro (SCM), Compras y Reabastecimiento Inteligente
 */
const API_URL = '/api';
let sugerenciasGlobal = [];
let proveedoresGlobal = [];
let resumenGlobal = null;

// Helper Toast con SweetAlert2
const Toast = window.Toast || (typeof Swal !== 'undefined' ? Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#FFFFFF',
    color: '#1C1917',
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
}) : {
    fire: ({ title }) => alert(title)
});

document.addEventListener('DOMContentLoaded', () => {
    // Control de Acceso RBAC: Solo Administradores
    const usuario = protegerRuta("ADMIN");
    if (!usuario) return;

    renderizarMenu('compras');
    cargarSugerenciasCompras();
    cargarProveedores();

    // Buscador en tiempo real de sugerencias de reposición
    const inputBuscar = document.getElementById('inputBuscarSugerencias');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', filtrarSugerencias);
    }
});

/**
 * Consumir el algoritmo de sugerencias de compra desde el Backend
 */
async function cargarSugerenciasCompras() {
    const tbody = document.getElementById('tablaSugerenciasCompras');
    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="text-center py-5 text-secondary">
                <span class="spinner-border spinner-border-sm text-warning me-2"></span>Analizando niveles de stock y demandas...
            </td>
        </tr>
    `;

    try {
        const res = await fetch(`${API_URL}/compras/sugerencias?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar sugerencias de compra');

        const data = await res.json();
        sugerenciasGlobal = data.sugerencias || [];
        resumenGlobal = data.resumen || {};

        actualizarKPIs(resumenGlobal, sugerenciasGlobal);
        renderizarTablaSugerencias(sugerenciasGlobal);
    } catch (error) {
        console.error("Error al cargar sugerencias SCM:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-danger py-5">
                    <i class="bi bi-exclamation-triangle me-2"></i>Error al conectar con el motor SCM de compras.
                </td>
            </tr>
        `;
        Toast.fire({ icon: 'error', title: 'Error al conectar con SCM' });
    }
}

/**
 * Consumir catálogo de proveedores homologados
 */
async function cargarProveedores() {
    try {
        const res = await fetch(`${API_URL}/proveedores?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar proveedores');
        proveedoresGlobal = await res.json();
        
        const elTotalProv = document.getElementById('kpiTotalProveedores');
        const elBadgeProv = document.getElementById('badgeProveedoresCount');
        if (elTotalProv) elTotalProv.textContent = proveedoresGlobal.length;
        if (elBadgeProv) elBadgeProv.textContent = `${proveedoresGlobal.length} Proveedores Activos`;

        renderizarProveedores(proveedoresGlobal);
    } catch (error) {
        console.error("Error al cargar proveedores:", error);
    }
}

/**
 * Actualizar los KPIs superiores
 */
function actualizarKPIs(resumen, sugerencias) {
    const elCriticos = document.getElementById('kpiRepuestosCriticos');
    const elUnidades = document.getElementById('kpiUnidadesSugeridas');
    const elInversion = document.getElementById('kpiInversionTotal');
    const elBadge = document.getElementById('badgeTotalSugerencias');

    const totalCriticos = resumen.total_repuestos_criticos || sugerencias.length;
    const totalUnidades = resumen.unidades_totales_sugeridas || sugerencias.reduce((acc, s) => acc + (s.cantidad_sugerida || 0), 0);
    const totalInversion = resumen.inversion_total_estimada || sugerencias.reduce((acc, s) => acc + (s.inversion_estimada || 0), 0);

    if (elCriticos) elCriticos.textContent = totalCriticos;
    if (elUnidades) elUnidades.textContent = totalUnidades;
    if (elInversion) {
        elInversion.textContent = `Bs. ${totalInversion.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (elBadge) elBadge.textContent = `${totalCriticos} Repuestos Críticos`;
}

/**
 * Renderizar la tabla de sugerencias inteligentes
 */
function renderizarTablaSugerencias(sugerencias) {
    const tbody = document.getElementById('tablaSugerenciasCompras');
    const infoCount = document.getElementById('infoSugerenciasCount');

    if (!sugerencias || sugerencias.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-5 text-success">
                    <i class="bi bi-check-circle-fill fs-3 d-block mb-2 text-success"></i>
                    ¡Inventario en equilibrio óptimo! No existen repuestos con quiebre de stock en este momento.
                </td>
            </tr>
        `;
        if (infoCount) infoCount.textContent = '0 repuestos críticos detectados';
        return;
    }

    let html = '';
    sugerencias.forEach(s => {
        const esAgotado = s.stock_actual <= 0;
        const stockActualBadge = esAgotado
            ? '<span class="badge bg-danger text-white fw-bold px-2 py-1 font-monospace" style="font-size: 0.75rem;">0 AGOTADO</span>'
            : `<span class="badge font-monospace px-2 py-1" style="background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; font-size: 0.75rem;">${s.stock_actual} un.</span>`;

        const urgenciaBadge = s.urgencia === 'AGOTADO'
            ? '<span class="badge-pill-stitch badge-pill-ruby small"><span class="pulse-dot pulse-dot-ruby me-1"></span>Crítico</span>'
            : '<span class="badge-pill-stitch badge-pill-gold small"><span class="pulse-dot pulse-dot-gold me-1"></span>Bajo Stock</span>';

        const costoUnitFormateado = parseFloat(s.costo_unitario_estimado || 0).toLocaleString('es-BO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const inversionFormateada = parseFloat(s.inversion_estimada || 0).toLocaleString('es-BO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        html += `
            <tr class="align-middle">
                <td class="ps-3">
                    <span class="badge font-monospace px-2 py-1" style="background: #27272A; color: #FAFAFA; font-family: 'Chivo Mono', monospace; font-size: 0.76rem;">
                        ${s.sku}
                    </span>
                </td>
                <td>
                    <span class="text-dark fw-bold d-block" style="font-size: 0.88rem;">${escaparHTML(s.nombre)}</span>
                    <span class="text-secondary small">${escaparHTML(s.categoria || 'Repuestos')}</span>
                </td>
                <td class="text-center">${stockActualBadge}</td>
                <td class="text-center font-monospace text-secondary small" style="font-family: 'Chivo Mono', monospace;">${s.stock_minimo}</td>
                <td class="text-center font-monospace text-secondary small" style="font-family: 'Chivo Mono', monospace;">${s.nivel_optimo}</td>
                <td class="text-center">
                    <span class="badge font-monospace px-2 py-1 fw-bold" style="background: #F3EFEA; color: #18181B; border: 1px solid #DFDBD2; font-family: 'Chivo Mono', monospace; font-size: 0.85rem;">
                        +${s.cantidad_sugerida} un.
                    </span>
                </td>
                <td class="text-end font-monospace text-secondary text-nowrap" style="font-family: 'Chivo Mono', monospace; font-size: 0.82rem; white-space: nowrap;">
                    Bs. ${costoUnitFormateado}
                </td>
                <td class="text-end font-monospace fw-bold text-nowrap" style="font-family: 'Chivo Mono', monospace; font-size: 0.88rem; color: #15803D; white-space: nowrap;">
                    Bs. ${inversionFormateada}
                </td>
                <td class="text-center">${urgenciaBadge}</td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-outline-danger py-1 px-3 d-inline-flex align-items-center gap-1 text-nowrap" style="border-color: #B91C1C; color: #B91C1C; font-size: 0.78rem; font-weight: 600; border-radius: 4px; white-space: nowrap;" onclick="abrirOrdenIndividual('${s.sku}')" title="Generar orden de compra para este SKU">
                        <i class="bi bi-cart-plus"></i>
                        <span>Pedir</span>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    if (infoCount) {
        infoCount.textContent = `Mostrando ${sugerencias.length} de ${sugerenciasGlobal.length} sugerencias de reabastecimiento`;
    }
}

/**
 * Filtrar sugerencias en tiempo real
 */
function filtrarSugerencias() {
    const termino = (document.getElementById('inputBuscarSugerencias')?.value || '').toLowerCase().trim();
    if (!termino) {
        renderizarTablaSugerencias(sugerenciasGlobal);
        return;
    }

    const filtradas = sugerenciasGlobal.filter(s => {
        const sku = (s.sku || '').toLowerCase();
        const nom = (s.nombre || '').toLowerCase();
        const cat = (s.categoria || '').toLowerCase();
        return sku.includes(termino) || nom.includes(termino) || cat.includes(termino);
    });

    renderizarTablaSugerencias(filtradas);
}

/**
 * Renderizar tarjetas de proveedores
 */
function renderizarProveedores(proveedores) {
    const contenedor = document.getElementById('contenedorProveedores');
    if (!contenedor) return;

    if (!proveedores || proveedores.length === 0) {
        contenedor.innerHTML = '<div class="col-12 text-secondary small py-3">No hay proveedores registrados en el sistema.</div>';
        return;
    }

    // Metadatos bolivianos por proveedor (NIT y Ciudad)
    const metaProveedores = {
        1: { ciudad: 'Santa Cruz', nit: 'NIT: 1028394012', rubro: 'Lubricantes & Fluidos OEM' },
        2: { ciudad: 'Cochabamba', nit: 'NIT: 3049182019', rubro: 'Filtros Heavy Duty & Liviano' },
        3: { ciudad: 'La Paz', nit: 'NIT: 2049182015', rubro: 'Repuestos & Filtración Japonesa' }
    };

    let html = '';
    proveedores.forEach(p => {
        const meta = metaProveedores[p.id] || {
            ciudad: p.direccion && p.direccion.includes('Santa Cruz') ? 'Santa Cruz' : (p.direccion && p.direccion.includes('Cochabamba') ? 'Cochabamba' : 'La Paz'),
            nit: `NIT: 1029485019`,
            rubro: 'Distribuidor Mayorista Autorizado'
        };

        const direccionVisual = p.direccion || 'Distribución Mayorista Nacional';

        html += `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="card h-100 p-3" style="background: #FFFFFF !important; border: 1px solid #DFDBD2 !important; border-left: 4px solid #18181B !important; border-radius: 6px; box-shadow: 0 1px 3px rgba(28, 25, 23, 0.05); transition: transform 0.15s ease, box-shadow 0.15s ease;">
                    <div class="d-flex justify-content-between align-items-start mb-2 gap-2">
                        <div>
                            <h6 class="fw-bold mb-1" style="color: #18181B; font-family: 'Archivo', sans-serif; font-size: 0.95rem; line-height: 1.25;">
                                ${escaparHTML(p.razon_social)}
                            </h6>
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <span class="badge" style="background: #F3EFEA; color: #18181B; border: 1px solid #DFDBD2; font-size: 0.7rem; font-weight: 600;">
                                    <i class="bi bi-geo-alt-fill me-1" style="color: #B91C1C;"></i>${meta.ciudad}
                                </span>
                                <span class="font-monospace text-secondary" style="font-family: 'Chivo Mono', monospace; font-size: 0.72rem; color: #57534E !important;">
                                    ${meta.nit}
                                </span>
                            </div>
                        </div>
                        <span class="badge" style="background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0; font-size: 0.68rem; font-weight: 600;">
                            Homologado
                        </span>
                    </div>

                    <div class="mt-2 pt-2 border-top" style="border-color: #F3EFEA !important; font-size: 0.8rem;">
                        <div class="d-flex align-items-center gap-2 mb-1" style="color: #3F3F46;">
                            <i class="bi bi-telephone-fill" style="color: #57534E; font-size: 0.82rem;"></i>
                            <span class="font-monospace fw-semibold" style="font-family: 'Chivo Mono', monospace;">${escaparHTML(p.telefono || '+591 70000000')}</span>
                        </div>
                        <div class="d-flex align-items-center gap-2 mb-1" style="color: #3F3F46;">
                            <i class="bi bi-envelope-fill" style="color: #57534E; font-size: 0.82rem;"></i>
                            <span class="text-truncate">${escaparHTML(p.email || 'ventas@proveedor.bo')}</span>
                        </div>
                        <div class="d-flex align-items-center gap-2 mb-2" style="color: #71717A; font-size: 0.75rem;">
                            <i class="bi bi-pin-map" style="color: #71717A;"></i>
                            <span class="text-truncate">${escaparHTML(direccionVisual)}</span>
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center pt-2 mt-auto border-top" style="border-color: #E6E1DA !important;">
                        <span class="small font-monospace" style="color: #78716C; font-size: 0.72rem;">${meta.rubro}</span>
                        <button class="btn btn-sm px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1 text-nowrap" style="background: #18181B; color: #FFFFFF; border: 1px solid #18181B; border-radius: 4px; font-size: 0.76rem;" onclick="abrirModalProveedor('${escaparHTML(p.razon_social)}', ${p.id})">
                            <i class="bi bi-send me-1"></i>Solicitar cotización
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}

/**
 * Modal SweetAlert2 para Generar Orden de Compra Global
 */
async function abrirModalGenerarOrden() {
    if (!sugerenciasGlobal || sugerenciasGlobal.length === 0) {
        Swal.fire({
            title: 'Sin Repuestos Críticos',
            text: 'Actualmente el inventario no posee ítems por debajo del stock mínimo. No es necesario generar órdenes urgentes.',
            icon: 'info',
            background: '#FFFFFF',
            color: '#1C1917',
            confirmButtonColor: '#18181B'
        });
        return;
    }

    const opcionesProveedores = (proveedoresGlobal && proveedoresGlobal.length > 0)
        ? proveedoresGlobal.map(p => `<option value="${p.id}">${escaparHTML(p.razon_social)}</option>`).join('')
        : '<option value="1">Proveedor Principal OEM</option>';

    const totalUnidades = sugerenciasGlobal.reduce((acc, s) => acc + (s.cantidad_sugerida || 0), 0);
    const totalInversion = sugerenciasGlobal.reduce((acc, s) => acc + (s.inversion_estimada || 0), 0);

    const { value: formValues } = await Swal.fire({
        title: '<div class="d-flex align-items-center justify-content-center gap-2" style="font-family: \'Archivo\', sans-serif; font-size: 1.15rem;"><i class="bi bi-file-earmark-plus-fill" style="color: #B91C1C;"></i><span>Generar Orden de Compra SCM</span></div>',
        html: `
            <div class="text-start small text-secondary mb-3">
                Se consolidarán los <strong class="text-dark">${sugerenciasGlobal.length} repuestos en estado crítico</strong> detectados en depósito.
            </div>
            <div class="p-3 mb-3 rounded-2 text-start" style="background: #F3EFEA; border: 1px solid #DFDBD2;">
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-secondary small">Total ítems críticos:</span>
                    <span class="text-dark fw-bold font-monospace">${sugerenciasGlobal.length} SKUs</span>
                </div>
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-secondary small">Unidades a solicitar:</span>
                    <span class="text-dark fw-bold font-monospace">${totalUnidades} unidades</span>
                </div>
                <div class="d-flex justify-content-between">
                    <span class="text-secondary small">Presupuesto estimado:</span>
                    <span class="fw-bold font-monospace" style="color: #15803D; font-size: 0.95rem;">Bs. ${totalInversion.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>
            <div class="text-start mb-2">
                <label class="form-label text-dark fw-semibold small">Seleccionar Proveedor Homologado:</label>
                <select id="swalProveedorSelect" class="form-select form-select-sm mb-3">
                    ${opcionesProveedores}
                </select>
                <label class="form-label text-dark fw-semibold small">Observaciones / Prioridad de Despacho:</label>
                <textarea id="swalNotasOC" class="form-control form-control-sm" rows="2" placeholder="Ej: Entrega urgente en almacén central."></textarea>
            </div>
        `,
        background: '#FFFFFF',
        color: '#1C1917',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-send me-1"></i> Emitir y Enviar Orden',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#B91C1C',
        cancelButtonColor: '#64748B',
        preConfirm: () => {
            return {
                proveedor_id: document.getElementById('swalProveedorSelect').value,
                notas: document.getElementById('swalNotasOC').value
            };
        }
    });

    if (formValues) {
        // Ejecutar llamada a API para registrar y simular transmisión
        const sesion = obtenerUsuarioSesion();
        const detalles = sugerenciasGlobal.map(s => ({
            sku: s.sku,
            cantidad: s.cantidad_sugerida,
            costo_unitario: s.costo_unitario_estimado
        }));

        try {
            Swal.fire({
                title: 'Transmitiendo Orden SCM...',
                text: 'Generando comprobante y notificando al proveedor homologado...',
                background: '#FFFFFF',
                color: '#1C1917',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const res = await fetch(`${API_URL}/compras/ordenes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proveedor_id: formValues.proveedor_id,
                    detalles: detalles,
                    usuario: sesion ? sesion.nombre : 'ADMINISTRADOR'
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fallo al procesar la orden de compra');

            await Swal.fire({
                icon: 'success',
                title: '¡Orden de Compra Emitida!',
                html: `
                    <p class="text-secondary mb-2">${data.mensaje}</p>
                    <div class="p-3 rounded-2 text-start font-monospace small" style="background: #F3EFEA; border: 1px solid #DFDBD2;">
                        <div><strong class="text-dark">Código de Orden:</strong> <span class="fw-bold" style="color: #B91C1C;">${data.codigo_orden}</span></div>
                        <div><strong class="text-dark">Total Valorizado:</strong> <span class="fw-bold" style="color: #15803D;">Bs. ${parseFloat(data.total).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <div><strong class="text-dark">Estado SCM:</strong> <span class="badge" style="background: #ECFDF5; color: #15803D; border: 1px solid #A7F3D0;">TRANSMITIDA A PROVEEDOR</span></div>
                    </div>
                `,
                background: '#FFFFFF',
                color: '#1C1917',
                confirmButtonColor: '#18181B',
                confirmButtonText: 'Aceptar'
            });

            cargarSugerenciasCompras();
        } catch (err) {
            console.error('Error al emitir orden de compra:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error al Generar Orden',
                text: err.message,
                background: '#FFFFFF',
                color: '#1C1917',
                confirmButtonColor: '#B91C1C'
            });
        }
    }
}

/**
 * Generar orden puntual para un solo SKU
 */
async function abrirOrdenIndividual(sku) {
    const item = sugerenciasGlobal.find(s => s.sku === sku);
    if (!item) return;

    const { value: cantidad } = await Swal.fire({
        title: `<div class="d-flex align-items-center justify-content-center gap-2" style="font-family: 'Archivo', sans-serif; font-size: 1.15rem;"><i class="bi bi-box-arrow-in-down" style="color: #B91C1C;"></i><span>Reabastecer SKU</span></div>`,
        html: `
            <div class="text-start small text-secondary mb-3">
                Repuesto: <strong class="text-dark">${escaparHTML(item.nombre)}</strong> (<span class="font-monospace">${item.sku}</span>)<br>
                Stock Actual: <span class="text-danger fw-bold font-monospace">${item.stock_actual} un.</span> | Stock Mínimo: <span class="font-monospace">${item.stock_minimo} un.</span>
            </div>
            <label class="form-label text-dark small fw-bold text-start d-block">Cantidad a Solicitar al Proveedor:</label>
        `,
        input: 'number',
        inputValue: item.cantidad_sugerida,
        inputAttributes: { min: 1, step: 1 },
        background: '#FFFFFF',
        color: '#1C1917',
        showCancelButton: true,
        confirmButtonText: 'Generar Pedido',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#B91C1C',
        cancelButtonColor: '#64748B',
        inputValidator: (val) => {
            if (!val || parseInt(val) <= 0) return 'Ingrese una cantidad válida mayor a 0.';
        }
    });

    if (cantidad) {
        const sesion = obtenerUsuarioSesion();
        try {
            const res = await fetch(`${API_URL}/compras/ordenes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proveedor_id: 1,
                    detalles: [{
                        sku: item.sku,
                        cantidad: parseInt(cantidad),
                        costo_unitario: item.costo_unitario_estimado
                    }],
                    usuario: sesion ? sesion.nombre : 'ADMINISTRADOR'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al emitir orden');

            Toast.fire({ icon: 'success', title: `Orden ${data.codigo_orden} generada (+${cantidad} un.)` });
            cargarSugerenciasCompras();
        } catch (err) {
            Toast.fire({ icon: 'error', title: err.message });
        }
    }
}

/**
 * Modal rápido para contactar proveedor
 */
function abrirModalProveedor(razonSocial, proveedorId) {
    Swal.fire({
        title: `<div class="d-flex align-items-center justify-content-center gap-2" style="font-family: 'Archivo', sans-serif; font-size: 1.1rem;"><i class="bi bi-building" style="color: #18181B;"></i><span>${razonSocial}</span></div>`,
        html: `
            <p class="text-secondary small mb-3">Canal de comunicación directa con el departamento de ventas mayoristas.</p>
            <div class="d-grid gap-2 text-start">
                <a href="mailto:ventas@${razonSocial.toLowerCase().replace(/\s+/g, '')}.com?subject=Solicitud de Cotización ERP GOLDEN" class="btn btn-outline-dark btn-sm d-flex align-items-center justify-content-center gap-2 py-2">
                    <i class="bi bi-envelope-fill" style="color: #B91C1C;"></i>
                    <span>Enviar Correo de Cotización</span>
                </a>
                <button class="btn btn-dark btn-sm d-flex align-items-center justify-content-center gap-2 py-2" style="background: #18181B;" onclick="Swal.close(); abrirModalGenerarOrden();">
                    <i class="bi bi-cart-plus"></i>
                    <span>Emitir Orden Directa a este Proveedor</span>
                </button>
            </div>
        `,
        background: '#FFFFFF',
        color: '#1C1917',
        showConfirmButton: false,
        showCloseButton: true
    });
}

function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// =========================================================================
// EXPORTACIÓN A EXCEL / CSV DE COMPRAS Y REABASTECIMIENTO
// =========================================================================
function exportarComprasExcel() {
    if (!sugerenciasGlobal || sugerenciasGlobal.length === 0) {
        Toast.fire({ icon: 'warning', title: 'No hay sugerencias de compra para exportar' });
        return;
    }

    if (typeof window.exportarReporteExcel === 'function') {
        window.exportarReporteExcel({
            titulo: 'REPORTE DE COMPRAS Y REABASTECIMIENTO DE ALMACÉN',
            subtitulo: 'Análisis SCM de Stock Mínimo y Sugerencias de Reposición — Sucre, Bolivia',
            columnas: ['SKU', 'REPUESTO / LUBRICANTE', 'CATEGORÍA', 'PROVEEDOR', 'STOCK ACTUAL', 'STOCK MÍNIMO', 'CANT. A COMPRAR', 'COSTO UNIT. (BS.)', 'INVERSIÓN TOTAL (BS.)', 'NIVEL URGENCIA'],
            filas: sugerenciasGlobal.map(s => [
                s.sku,
                s.nombre,
                s.categoria,
                s.proveedor_nombre || 'Distribuidor Mayorista',
                parseInt(s.stock_actual || 0),
                parseInt(s.stock_minimo || 0),
                parseInt(s.unidades_a_comprar || 0),
                parseFloat(s.costo_unitario || (s.inversion_total / (s.unidades_a_comprar || 1)) || 0),
                parseFloat(s.inversion_total || 0),
                (s.nivel_urgencia || 'NORMAL').toUpperCase()
            ]),
            anchos: [16, 40, 22, 26, 16, 16, 18, 18, 22, 18],
            nombreArchivo: 'Orden_Compras_SCM_GOLDEN'
        });
        return;
    }

    if (typeof exportarTablaCSV === 'function') {
        exportarTablaCSV('tablaSugerenciasCompras', 'Compras_GOLDEN', 'Reporte de Compras y Suministros');
    }
}
window.exportarComprasExcel = exportarComprasExcel;
