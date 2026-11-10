/**
 * ERP GOLDEN - Módulo de Cadena de Suministro (SCM), Compras y Reabastecimiento Inteligente
 */
const API_URL = '/api';
let sugerenciasGlobal = [];
let proveedoresGlobal = [];
let resumenGlobal = null;

// Helper Toast con SweetAlert2 Dark VIP
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
    if (elInversion) elInversion.textContent = `$${totalInversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
                <td colspan="10" class="text-center py-5 text-emerald">
                    <i class="bi bi-check-circle-fill fs-3 d-block mb-2 text-emerald"></i>
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
            ? '<span class="badge bg-danger text-white fw-bold px-2 py-1">0 AGOTADO</span>'
            : `<span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50 px-2 py-1">${s.stock_actual} un.</span>`;

        const urgenciaBadge = s.urgencia === 'AGOTADO'
            ? '<span class="badge rounded-pill bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50 px-2 py-1"><i class="bi bi-fire me-1"></i>Crítico</span>'
            : '<span class="badge rounded-pill bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50 px-2 py-1"><i class="bi bi-exclamation-triangle me-1"></i>Bajo Stock</span>';

        html += `
            <tr class="align-middle">
                <td class="ps-3 font-monospace text-warning fw-bold small">${s.sku}</td>
                <td>
                    <span class="text-white fw-semibold d-block">${escaparHTML(s.nombre)}</span>
                    <span class="text-secondary small">${escaparHTML(s.categoria || 'Repuestos')}</span>
                </td>
                <td class="text-center">${stockActualBadge}</td>
                <td class="text-center text-secondary">${s.stock_minimo}</td>
                <td class="text-center text-secondary">${s.nivel_optimo}</td>
                <td class="text-center">
                    <span class="badge-pill-vip badge-pill-gold fw-bold px-3 py-1 font-monospace" style="font-size: 0.95rem;">
                        +${s.cantidad_sugerida} un.
                    </span>
                </td>
                <td class="text-end font-monospace text-secondary">$${parseFloat(s.costo_unitario_estimado).toFixed(2)}</td>
                <td class="text-end font-monospace text-white fw-bold">$${parseFloat(s.inversion_estimada).toFixed(2)}</td>
                <td class="text-center">${urgenciaBadge}</td>
                <td class="text-end pe-3">
                    <button class="btn btn-vip-outline btn-sm rounded-pill px-3 py-1" onclick="abrirOrdenIndividual('${s.sku}')" title="Generar Orden para este SKU">
                        <i class="bi bi-cart-plus me-1 text-warning"></i>Pedir
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
        contenedor.innerHTML = '<div class="col-12 text-secondary small">No hay proveedores registrados en el sistema.</div>';
        return;
    }

    let html = '';
    proveedores.forEach(p => {
        html += `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="p-3 rounded-3" style="background: rgba(13, 18, 31, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); transition: all 0.25s ease;">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="fw-bold text-white mb-0 d-flex align-items-center">
                            <i class="bi bi-truck text-warning me-2"></i>${escaparHTML(p.razon_social)}
                        </h6>
                        <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50">Homologado</span>
                    </div>
                    <div class="small text-secondary mb-1">
                        <i class="bi bi-telephone text-warning me-1"></i>${escaparHTML(p.telefono || 'Sin teléfono')}
                    </div>
                    <div class="small text-secondary mb-2">
                        <i class="bi bi-envelope text-warning me-1"></i>${escaparHTML(p.email || 'Sin correo')}
                    </div>
                    <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary border-opacity-15">
                        <span class="small text-muted font-monospace">OEM / Aftermarket</span>
                        <button class="btn btn-vip-outline btn-sm rounded-pill px-2 py-0" style="font-size: 0.75rem;" onclick="abrirModalProveedor('${escaparHTML(p.razon_social)}', ${p.id})">
                            <i class="bi bi-send-fill me-1"></i>Cotizar
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
            background: '#0d121f',
            color: '#f8fafc',
            confirmButtonColor: '#f59e0b'
        });
        return;
    }

    const opcionesProveedores = (proveedoresGlobal && proveedoresGlobal.length > 0)
        ? proveedoresGlobal.map(p => `<option value="${p.id}">${escaparHTML(p.razon_social)}</option>`).join('')
        : '<option value="1">Proveedor Principal OEM</option>';

    const totalUnidades = sugerenciasGlobal.reduce((acc, s) => acc + (s.cantidad_sugerida || 0), 0);
    const totalInversion = sugerenciasGlobal.reduce((acc, s) => acc + (s.inversion_estimada || 0), 0);

    const { value: formValues } = await Swal.fire({
        title: '<div class="d-flex align-items-center justify-content-center gap-2"><i class="bi bi-file-earmark-plus-fill text-warning"></i><span>Generar Orden de Compra SCM</span></div>',
        html: `
            <div class="text-start small text-secondary mb-3">
                Se consolidarán los <strong class="text-white">${sugerenciasGlobal.length} repuestos en estado crítico</strong> detectados por el motor predictivo.
            </div>
            <div class="p-3 mb-3 rounded-3 text-start" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.25);">
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-secondary">Total ítems críticos:</span>
                    <span class="text-white fw-bold">${sugerenciasGlobal.length} SKUs</span>
                </div>
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-secondary">Unidades a solicitar:</span>
                    <span class="text-warning fw-bold">${totalUnidades} unidades</span>
                </div>
                <div class="d-flex justify-content-between">
                    <span class="text-secondary">Presupuesto estimado:</span>
                    <span class="text-emerald fw-bold">$${totalInversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>
            <div class="text-start mb-2">
                <label class="form-label text-white fw-semibold small">Seleccionar Proveedor Homologado:</label>
                <select id="swalProveedorSelect" class="form-select form-select-vip mb-3">
                    ${opcionesProveedores}
                </select>
                <label class="form-label text-white fw-semibold small">Observaciones / Prioridad de Despacho:</label>
                <textarea id="swalNotasOC" class="form-control form-control-vip" rows="2" placeholder="Ej: Entrega urgente en almacén central."></textarea>
            </div>
        `,
        background: '#0d121f',
        color: '#f8fafc',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-send-fill me-1"></i> Emitir y Enviar Orden',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#475569',
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
                background: '#0d121f',
                color: '#f8fafc',
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
                    <div class="p-3 rounded-3 text-start font-monospace small" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(16, 185, 129, 0.3);">
                        <div><strong class="text-white">Código de Orden:</strong> <span class="text-warning">${data.codigo_orden}</span></div>
                        <div><strong class="text-white">Total Valorizado:</strong> <span class="text-emerald">$${parseFloat(data.total).toFixed(2)}</span></div>
                        <div><strong class="text-white">Estado SCM:</strong> <span class="text-info">TRANSMITIDA A PROVEEDOR</span></div>
                    </div>
                `,
                background: '#0d121f',
                color: '#f8fafc',
                confirmButtonColor: '#10b981',
                confirmButtonText: 'Aceptar'
            });

            cargarSugerenciasCompras();
        } catch (err) {
            console.error('Error al emitir orden de compra:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error al Generar Orden',
                text: err.message,
                background: '#0d121f',
                color: '#f8fafc',
                confirmButtonColor: '#ef4444'
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
        title: `<div class="d-flex align-items-center justify-content-center gap-2"><i class="bi bi-box-arrow-in-down text-warning"></i><span>Reabastecer SKU</span></div>`,
        html: `
            <div class="text-start small text-secondary mb-3">
                Producto: <strong class="text-white">${escaparHTML(item.nombre)}</strong> (${item.sku})<br>
                Stock Actual: <span class="text-danger fw-bold">${item.stock_actual}</span> | Stock Mínimo: ${item.stock_minimo}
            </div>
            <label class="form-label text-white small fw-bold">Cantidad a Solicitar al Proveedor:</label>
        `,
        input: 'number',
        inputValue: item.cantidad_sugerida,
        inputAttributes: { min: 1, step: 1 },
        background: '#0d121f',
        color: '#f8fafc',
        showCancelButton: true,
        confirmButtonText: 'Generar Pedido',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#475569',
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
        title: `<div class="d-flex align-items-center justify-content-center gap-2"><i class="bi bi-building text-warning"></i><span>${razonSocial}</span></div>`,
        html: `
            <p class="text-secondary small mb-3">Canal de comunicación directa con el departamento de ventas mayoristas.</p>
            <div class="d-grid gap-2 text-start">
                <a href="mailto:ventas@${razonSocial.toLowerCase().replace(/\s+/g, '')}.com?subject=Solicitud de Cotización ERP GOLDEN" class="btn btn-vip-outline btn-sm rounded-pill text-white">
                    <i class="bi bi-envelope me-2 text-warning"></i>Enviar Correo de Cotización
                </a>
                <button class="btn btn-gold btn-sm rounded-pill fw-bold" onclick="Swal.close(); abrirModalGenerarOrden();">
                    <i class="bi bi-cart-plus-fill me-2"></i>Emitir Orden Directa a este Proveedor
                </button>
            </div>
        `,
        background: '#0d121f',
        color: '#f8fafc',
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
