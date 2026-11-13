/**
 * ERP GOLDEN - Módulo de Créditos B2B, Cartera y Amortizaciones
 */
const API_URL = '/api';
let creditosGlobal = [];
let resumenCarteraGlobal = null;

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

    renderizarMenu('creditos');
    cargarCreditos();

    // Buscador en tiempo real de clientes con evento 'input'
    const inputBuscar = document.getElementById('inputBuscarCreditos');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', filtrarCreditos);
    }

    // Filtro por situación crediticia
    const filtroSituacion = document.getElementById('filtroSituacion');
    if (filtroSituacion) {
        filtroSituacion.addEventListener('change', filtrarCreditos);
    }
});

/**
 * Cargar cartera de créditos B2B desde el Backend
 */
async function cargarCreditos() {
    const tbody = document.getElementById('tablaCreditos');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-5 text-secondary">
                <span class="spinner-border spinner-border-sm text-warning me-2"></span>Sincronizando cartera mayorista y líneas activas...
            </td>
        </tr>
    `;

    try {
        const res = await fetch(`${API_URL}/creditos?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar cartera de créditos');

        const data = await res.json();
        creditosGlobal = data.creditos || [];
        resumenCarteraGlobal = data.resumen || {};

        actualizarKPIs(resumenCarteraGlobal, creditosGlobal);
        renderizarTablaCreditos(creditosGlobal);
        Toast.fire({ icon: 'success', title: 'Cartera sincronizada' });
    } catch (error) {
        console.error("Error al cargar créditos B2B:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger py-5">
                    <i class="bi bi-exclamation-triangle me-2"></i>Error al conectar con la base de datos de créditos.
                </td>
            </tr>
        `;
        Toast.fire({ icon: 'error', title: 'Error al consultar créditos' });
    }
}

/**
 * Actualizar los KPIs superiores de Cartera y Cobranzas
 */
function actualizarKPIs(resumen, creditos) {
    const elLimite = document.getElementById('kpiLimiteTotal');
    const elDeuda = document.getElementById('kpiDeudaTotal');
    const elDisponible = document.getElementById('kpiDisponibleTotal');
    const elTalleres = document.getElementById('kpiTotalTalleres');
    const elBadge = document.getElementById('badgeTotalCreditos');

    const totalTalleres = resumen.total_clientes_b2b || creditos.length;
    const limiteTotal = resumen.total_limite_asignado || creditos.reduce((a, c) => a + c.limite_credito, 0);
    const deudaTotal = resumen.total_cartera_deudora || creditos.reduce((a, c) => a + c.saldo_deudor, 0);
    const disponibleTotal = resumen.total_credito_disponible || Math.max(0, limiteTotal - deudaTotal);

    if (elLimite) elLimite.textContent = `$${limiteTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elDeuda) elDeuda.textContent = `$${deudaTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elDisponible) elDisponible.textContent = `$${disponibleTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elTalleres) elTalleres.textContent = totalTalleres;
    if (elBadge) elBadge.textContent = `${totalTalleres} Talleres B2B`;
}

/**
 * Renderizar la tabla de clientes B2B con sus créditos
 */
function renderizarTablaCreditos(creditos) {
    const tbody = document.getElementById('tablaCreditos');
    const infoCount = document.getElementById('infoCreditosCount');

    if (!creditos || creditos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5 text-secondary">
                    <i class="bi bi-search fs-3 d-block mb-2 text-warning opacity-50"></i>
                    No se encontraron registros que coincidan con la búsqueda.
                </td>
            </tr>
        `;
        if (infoCount) infoCount.textContent = 'Mostrando 0 talleres';
        return;
    }

    let html = '';
    creditos.forEach(c => {
        const saldoDeudor = parseFloat(c.saldo_deudor || 0);
        const limiteCredito = parseFloat(c.limite_credito || 0);
        const creditoDisponible = parseFloat(c.credito_disponible || 0);
        const pct = Math.min(100, parseFloat(c.porcentaje_utilizado || 0));

        // Color de barra según porcentaje de utilización
        let colorBarra = 'bg-success';
        if (pct >= 80 || c.situacion === 'SOBREGIRO') colorBarra = 'bg-danger';
        else if (pct >= 50) colorBarra = 'bg-warning';

        // Badge de Situación
        let badgeSituacion = '';
        if (c.situacion === 'SOBREGIRO') {
            badgeSituacion = '<span class="badge rounded-pill bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50"><i class="bi bi-x-octagon me-1"></i>Sobregiro</span>';
        } else if (c.situacion === 'ALERTA') {
            badgeSituacion = '<span class="badge rounded-pill bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50"><i class="bi bi-exclamation-triangle me-1"></i>En Alerta</span>';
        } else {
            badgeSituacion = '<span class="badge rounded-pill bg-success bg-opacity-25 text-success border border-success border-opacity-50"><i class="bi bi-check2-circle me-1"></i>Normal</span>';
        }

        html += `
            <tr class="align-middle">
                <td class="ps-3 text-nowrap">
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle d-flex align-items-center justify-content-center text-warning fw-bold" 
                             style="width: 36px; height: 36px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35);">
                            <i class="bi bi-wrench-adjustable"></i>
                        </div>
                        <div>
                            <span class="fw-bold text-white d-block" style="font-size: 0.95rem;">${escaparHTML(c.cliente_nombre)}</span>
                            <span class="text-secondary small font-monospace">ID #${c.cliente_id}</span>
                        </div>
                    </div>
                </td>
                <td class="small text-secondary font-monospace">${escaparHTML(c.cliente_email)}</td>
                <td class="text-end font-monospace text-white fw-semibold">$${limiteCredito.toFixed(2)}</td>
                <td class="text-end font-monospace ${saldoDeudor > 0 ? 'text-danger fw-bold' : 'text-secondary'}">
                    $${saldoDeudor.toFixed(2)}
                </td>
                <td class="text-end font-monospace text-emerald fw-bold">$${creditoDisponible.toFixed(2)}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="progress flex-grow-1" style="height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 999px;">
                            <div class="progress-bar ${colorBarra}" role="progressbar" style="width: ${pct}%; border-radius: 999px;"></div>
                        </div>
                        <span class="small font-monospace text-secondary text-nowrap" style="font-size: 0.78rem;">${pct.toFixed(0)}%</span>
                    </div>
                </td>
                <td class="text-center">${badgeSituacion}</td>
                <td class="text-end pe-3 text-nowrap">
                    <button class="btn btn-sm btn-outline-success rounded-pill px-3 py-1 me-1 fw-semibold" 
                            onclick="abrirModalAmortizacion(${c.cliente_id}, '${escaparHTML(c.cliente_nombre)}', ${saldoDeudor})"
                            ${saldoDeudor <= 0 ? 'disabled title="Cliente sin deuda"' : ''}>
                        <i class="bi bi-cash-stack me-1"></i>Amortizar
                    </button>
                    <button class="btn btn-vip-outline btn-sm rounded-pill px-2 py-1 text-white" 
                            onclick="verEstadoCuenta(${c.cliente_id})" title="Ver extracto y movimientos">
                        <i class="bi bi-receipt"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    if (infoCount) {
        infoCount.textContent = `Mostrando ${creditos.length} de ${creditosGlobal.length} talleres B2B`;
    }
}

/**
 * Filtrar cartera en tiempo real
 */
function filtrarCreditos() {
    const termino = (document.getElementById('inputBuscarCreditos')?.value || '').toLowerCase().trim();
    const situacion = document.getElementById('filtroSituacion')?.value || 'TODOS';

    const filtrados = creditosGlobal.filter(c => {
        // Filtro por situación
        if (situacion !== 'TODOS' && c.situacion !== situacion) return false;

        // Filtro por texto
        if (!termino) return true;

        const nom = (c.cliente_nombre || '').toLowerCase();
        const mail = (c.cliente_email || '').toLowerCase();
        const idStr = String(c.cliente_id || '');
        const tel = String(c.telefono || c.cliente_telefono || '').toLowerCase();
        const nit = String(c.nit || c.cliente_nit || '').toLowerCase();

        return nom.includes(termino) || mail.includes(termino) || idStr.includes(termino) || tel.includes(termino) || nit.includes(termino);
    });

    renderizarTablaCreditos(filtrados);
}

/**
 * Modal SweetAlert2 para Registrar Amortización de Deuda
 */
async function abrirModalAmortizacion(clienteId, clienteNombre, saldoDeudor) {
    const { value: monto } = await Swal.fire({
        title: `<div class="d-flex align-items-center justify-content-center gap-2 text-emerald"><i class="bi bi-cash-stack"></i><span>Registrar Amortización</span></div>`,
        html: `
            <div class="text-start small text-secondary mb-3">
                Cliente: <strong class="text-white">${clienteNombre}</strong> (ID #${clienteId})<br>
                Saldo Deudor Actual: <strong class="text-danger font-monospace fs-6">$${saldoDeudor.toFixed(2)}</strong>
            </div>
            <label class="form-label text-white small fw-bold">Monto del Abono / Pago ($):</label>
        `,
        input: 'number',
        inputValue: saldoDeudor > 0 ? Math.min(saldoDeudor, 500) : 100,
        inputAttributes: {
            min: 1,
            max: saldoDeudor + 1000,
            step: 0.5
        },
        background: '#0d121f',
        color: '#f8fafc',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-lg me-1"></i> Confirmar Pago',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#475569',
        inputValidator: (val) => {
            const num = parseFloat(val);
            if (!val || isNaN(num) || num <= 0) {
                return 'Ingrese un monto válido mayor a 0.';
            }
        }
    });

    if (monto) {
        const sesion = obtenerUsuarioSesion();
        try {
            Swal.fire({
                title: 'Registrando Amortización...',
                background: '#0d121f',
                color: '#f8fafc',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const res = await fetch(`${API_URL}/creditos/amortizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente_id: clienteId,
                    monto: parseFloat(monto),
                    usuario_admin: sesion ? sesion.nombre : 'ADMINISTRADOR'
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al procesar la amortización');

            await Swal.fire({
                icon: 'success',
                title: '¡Amortización Registrada!',
                html: `
                    <p class="text-secondary mb-2">${data.mensaje}</p>
                    <div class="p-3 rounded-3 text-start font-monospace small" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(16, 185, 129, 0.3);">
                        <div><strong class="text-white">Abono Realizado:</strong> <span class="text-emerald">+$${parseFloat(monto).toFixed(2)}</span></div>
                        <div><strong class="text-white">Nuevo Saldo Deudor:</strong> <span class="text-warning">$${parseFloat(data.nuevo_saldo).toFixed(2)}</span></div>
                        <div><strong class="text-white">Comprobante ID:</strong> <span class="text-info">#REC-${data.pago_id}</span></div>
                    </div>
                `,
                background: '#0d121f',
                color: '#f8fafc',
                confirmButtonColor: '#10b981',
                confirmButtonText: 'Aceptar'
            });

            cargarCreditos();
        } catch (err) {
            console.error('Error al amortizar:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error al Registrar Amortización',
                text: err.message,
                background: '#0d121f',
                color: '#f8fafc',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}

/**
 * Consultar y desplegar el Estado de Cuenta de un taller específico
 */
async function verEstadoCuenta(clienteId) {
    try {
        const modal = new bootstrap.Modal(document.getElementById('modalDetalleCredito'));
        const cuerpo = document.getElementById('modalDetalleCuerpo');
        cuerpo.innerHTML = '<div class="text-center py-4 text-secondary"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Cargando estado de cuenta...</div>';
        modal.show();

        const res = await fetch(`${API_URL}/creditos/${clienteId}?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar estado de cuenta');

        const data = await res.json();
        const cli = data.cliente || {};
        const cred = data.credito || {};
        const pagos = data.ultimos_pagos || [];
        const pedidos = data.ultimos_pedidos || [];

        let pagosHTML = '';
        if (pagos.length === 0) {
            pagosHTML = '<div class="text-secondary small py-2">Sin historial de pagos registrados aún.</div>';
        } else {
            pagosHTML = `
                <table class="table table-sm table-vip font-monospace small mb-0">
                    <thead>
                        <tr>
                            <th>ID Recibo</th>
                            <th>Fecha</th>
                            <th class="text-end">Monto Abonado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagos.map(p => `
                            <tr>
                                <td class="text-warning">#REC-${p.id}</td>
                                <td class="text-secondary">${p.fecha || 'Reciente'}</td>
                                <td class="text-end text-emerald fw-bold">+$${parseFloat(p.monto).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        let pedidosHTML = '';
        if (pedidos.length === 0) {
            pedidosHTML = '<div class="text-secondary small py-2">Sin pedidos recientes en cuenta corriente.</div>';
        } else {
            pedidosHTML = `
                <table class="table table-sm table-vip font-monospace small mb-0">
                    <thead>
                        <tr>
                            <th>Orden</th>
                            <th>Fecha</th>
                            <th>Estado</th>
                            <th class="text-end">Total Facturado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pedidos.map(pe => `
                            <tr>
                                <td class="text-warning">#PED-${pe.id}</td>
                                <td class="text-secondary">${pe.fecha_compra ? pe.fecha_compra.split('T')[0] : 'Reciente'}</td>
                                <td><span class="badge bg-secondary bg-opacity-25 text-light">${pe.estado}</span></td>
                                <td class="text-end text-white fw-bold">$${parseFloat(pe.total).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        cuerpo.innerHTML = `
            <div class="p-3 rounded-3 mb-3" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.25);">
                <div class="row g-2 align-items-center">
                    <div class="col-12 col-md-6">
                        <h6 class="fw-bold text-white mb-0">${escaparHTML(cli.nombre)}</h6>
                        <span class="small text-secondary font-monospace">${escaparHTML(cli.email)} | Rol: ${cli.rol}</span>
                    </div>
                    <div class="col-12 col-md-6 text-md-end font-monospace">
                        <span class="small text-secondary d-block">Límite Aprobado: <strong class="text-white">$${cred.limite_credito?.toFixed(2)}</strong></span>
                        <span class="small text-secondary d-block">Saldo Deudor: <strong class="text-danger">$${cred.saldo_deudor?.toFixed(2)}</strong></span>
                        <span class="small text-secondary d-block">Disponible: <strong class="text-emerald">$${cred.credito_disponible?.toFixed(2)}</strong></span>
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <h6 class="fw-bold text-white mb-2 d-flex align-items-center">
                    <i class="bi bi-clock-history text-warning me-2"></i>Últimos Pagos y Amortizaciones Realizadas
                </h6>
                <div class="p-2 rounded-3" style="background: rgba(13, 18, 31, 0.5); border: 1px solid rgba(255, 255, 255, 0.08);">
                    ${pagosHTML}
                </div>
            </div>

            <div>
                <h6 class="fw-bold text-white mb-2 d-flex align-items-center">
                    <i class="bi bi-bag-check text-warning me-2"></i>Últimos Pedidos Facturados a Crédito
                </h6>
                <div class="p-2 rounded-3" style="background: rgba(13, 18, 31, 0.5); border: 1px solid rgba(255, 255, 255, 0.08);">
                    ${pedidosHTML}
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error al ver estado de cuenta:', err);
        Toast.fire({ icon: 'error', title: 'Error al consultar estado de cuenta' });
    }
}

/**
 * Resumen consolidado modal de cartera
 */
function abrirReporteCartera() {
    if (!resumenCarteraGlobal) return;
    const r = resumenCarteraGlobal;

    Swal.fire({
        title: '<div class="d-flex align-items-center justify-content-center gap-2"><i class="bi bi-pie-chart-fill text-warning"></i><span>Resumen Financiero de Cartera</span></div>',
        html: `
            <div class="text-start p-3 rounded-3 font-monospace small" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.3);">
                <div class="d-flex justify-content-between mb-2">
                    <span class="text-secondary">Talleres Mayoristas:</span>
                    <span class="text-white fw-bold">${r.total_clientes_b2b} clientes</span>
                </div>
                <div class="d-flex justify-content-between mb-2">
                    <span class="text-secondary">Línea de Crédito Global:</span>
                    <span class="text-white fw-bold">$${r.total_limite_asignado?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="d-flex justify-content-between mb-2">
                    <span class="text-secondary">Cartera Deudora Activa:</span>
                    <span class="text-danger fw-bold">$${r.total_cartera_deudora?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="d-flex justify-content-between mb-2">
                    <span class="text-secondary">Crédito Libre Disponible:</span>
                    <span class="text-emerald fw-bold">$${r.total_credito_disponible?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="d-flex justify-content-between pt-2 border-top border-secondary border-opacity-25">
                    <span class="text-secondary">Talleres en Riesgo (&ge;80%):</span>
                    <span class="${r.clientes_en_riesgo > 0 ? 'text-danger' : 'text-success'} fw-bold">${r.clientes_en_riesgo} clientes</span>
                </div>
            </div>
        `,
        background: '#0d121f',
        color: '#f8fafc',
        confirmButtonColor: '#f59e0b',
        confirmButtonText: 'Cerrar'
    });
}

function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}
