/**
 * ERP GOLDEN - Módulo de Logística y Despachos con KPIs en Tiempo Real (Stitch UI Automotriz)
 */
const API_URL = '/api';
let pedidosGlobal = [];
let rangoActual = 'todos';

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

let usuarioLogueado = null;
let pedidoSeleccionadoOperativo = null;

document.addEventListener('DOMContentLoaded', () => {
    // Control de Acceso RBAC: Administradores, Encargados de Empaque y Encargados de Despacho
    usuarioLogueado = protegerRuta('logistica', ['ADMIN', 'EMPAQUE', 'DESPACHO', 'ALMACENERO', 'REPARTIDOR']);
    if (!usuarioLogueado) return;

    renderizarMenu('logistica');
    cargarPedidos();
});

// ==========================================
// 1. FILTRO DE FECHA GERENCIAL
// ==========================================
function cambiarRangoLogistica(nuevoRango) {
    rangoActual = nuevoRango;
    cargarPedidos();
}

// ==========================================
// 2. CARGA DE PEDIDOS Y CÁLCULO DE KPIS
// ==========================================
async function cargarPedidos() {
    const tbody = document.getElementById('tablaPedidos');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Sincronizando despachos y flujo de almacén...</td></tr>';
    }

    try {
        const res = await fetch(`${API_URL}/pedidos?rango=${encodeURIComponent(rangoActual)}&t=${Date.now()}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detalle || errData.error || "Error en servidor al consultar pedidos");
        }

        pedidosGlobal = await res.json();
        actualizarKPIsLogistica();
        renderizarTablaPedidos();

    } catch (error) {
        console.error("Error al cargar pedidos:", error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5 text-danger fw-bold">
                        <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
                        ${error.message || 'Error de conexión con la base de datos de despachos.'}
                    </td>
                </tr>`;
        }
        Toast.fire({ icon: 'error', title: error.message || 'Error al sincronizar lista de despachos' });
    }
}

function calcularPasoEtapa(p) {
    const est = p.estado_logistica || '';
    if (est.includes('ENTREGADO')) return 5;
    if (est.includes('RUTA')) return 4;
    if (est.includes('EMPACADO')) return 3;
    if (est.includes('PREPARACIÓN')) return 2;
    return 1;
}

function actualizarKPIsLogistica() {
    let pend = 0;
    let ruta = 0;
    let ent = 0;

    if (Array.isArray(pedidosGlobal)) {
        pedidosGlobal.forEach(p => {
            const paso = calcularPasoEtapa(p);
            if (paso < 3) pend++;
            else if (paso === 4) ruta++;
            else if (paso === 5) ent++;
        });
    }

    const elPendientes = document.getElementById('countPendientes');
    if (elPendientes) elPendientes.innerText = pend;

    const elEnCamino = document.getElementById('countEnCamino') || document.getElementById('countRuta');
    if (elEnCamino) elEnCamino.innerText = ruta;

    const elEntregados = document.getElementById('countEntregados');
    if (elEntregados) elEntregados.innerText = ent;

    const elBadgeTotal = document.getElementById('badgeTotalOrdenes');
    if (elBadgeTotal) elBadgeTotal.innerText = `${Array.isArray(pedidosGlobal) ? pedidosGlobal.length : 0} Pedidos`;
}

function renderizarTablaPedidos(lista = null) {
    const tbody = document.getElementById('tablaPedidos');
    if (!tbody) return;

    const items = lista !== null ? lista : pedidosGlobal;

    if (!Array.isArray(items) || items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-secondary">
                    <i class="bi bi-search display-4 text-warning d-block mb-3 opacity-50"></i>
                    <h6 class="fw-bold text-dark">No se encontraron registros que coincidan con la búsqueda</h6>
                    <p class="small text-secondary">Intenta con otro número de orden, nombre de cliente o modifica el período.</p>
                </td>
            </tr>`;
        return;
    }

    const rol = usuarioLogueado ? usuarioLogueado.rol : 'ADMIN';
    const esAdmin = rol === 'ADMIN';
    const esEmpaque = rol === 'EMPAQUE' || rol === 'ALMACENERO' || rol === 'TRABAJADOR' || esAdmin;
    const esDespacho = rol === 'DESPACHO' || rol === 'REPARTIDOR' || esAdmin;

    let html = '';
    items.forEach(p => {
        const paso = calcularPasoEtapa(p);
        const fechaFormateada = p.fecha_compra ? new Date(p.fecha_compra).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente';

        // Badge y textos de etapas del Stepper
        let badgeEtapa = '';
        let colorPaso = '#F59E0B';
        if (paso === 1) {
            badgeEtapa = `<span class="badge" style="background:#141619; color:#F59E0B; border:1px solid #F59E0B; font-family: 'Inter', sans-serif; font-size:0.75rem;"><i class="bi bi-receipt me-1"></i>1. PAGO VERIFICADO</span>`;
        } else if (paso === 2) {
            badgeEtapa = `<span class="badge bg-warning text-dark font-mono" style="font-size:0.75rem;"><i class="bi bi-hourglass-split me-1"></i>2. EN PREPARACIÓN</span>`;
            colorPaso = '#D97706';
        } else if (paso === 3) {
            badgeEtapa = `<span class="badge bg-info text-dark font-mono fw-bold" style="font-size:0.75rem;"><i class="bi bi-box-seam me-1"></i>3. EMPACADO Y ETIQUETADO</span>`;
            colorPaso = '#0284C7';
        } else if (paso === 4) {
            badgeEtapa = `<span class="badge bg-primary text-white font-mono" style="font-size:0.75rem;"><i class="bi bi-truck me-1"></i>4. EN RUTA DE ENTREGA</span>`;
            colorPaso = '#2563EB';
        } else if (paso === 5) {
            badgeEtapa = `<span class="badge bg-success text-white font-mono" style="font-size:0.75rem;"><i class="bi bi-check-circle-fill me-1"></i>5. ENTREGADO Y FINALIZADO</span>`;
            colorPaso = '#15803D';
        }

        // Mini Stepper Gráfico
        const miniStepper = `
            <div class="d-flex align-items-center gap-1 my-1">
                ${[1,2,3,4,5].map(step => `
                    <div style="height: 6px; flex: 1; border-radius: 3px; background: ${step <= paso ? colorPaso : '#E2E8F0'};" title="Paso ${step}"></div>
                `).join('')}
            </div>
            <div class="small font-mono text-muted" style="font-size:0.72rem;">
                ${p.estado_logistica || 'ORDEN RECIBIDA'}
            </div>
        `;

        // Generar botones operativos según el rol y la etapa actual
        let accionesOperativas = '';

        if (esEmpaque && paso < 3) {
            accionesOperativas += `
                <button class="btn btn-warning btn-sm py-1 px-2 fw-bold d-inline-flex align-items-center gap-1 text-dark shadow-sm" onclick="abrirModalControlEmpaque(${p.id})" title="Control de Preparación, Picking y Empaque">
                    <i class="bi bi-box-seam-fill"></i>
                    <span>Control Empaque</span>
                </button>
            `;
        }

        if (paso >= 3 && p.empaque_responsable) {
            accionesOperativas += `
                <span class="badge bg-light text-dark border font-mono small d-none d-md-inline" title="Empacado en almacén">
                    <i class="bi bi-check2 text-success me-1"></i>Empaque: ${escaparHTML(p.empaque_responsable)}
                </span>
            `;
        }

        if (esDespacho) {
            if (paso < 3) {
                // Bloqueo estricto: no puede despachar si no está empacado
                accionesOperativas += `
                    <span class="badge bg-secondary opacity-75 py-1 px-2 font-mono" title="Bloqueo Logístico: Requiere ser empacado previamente en almacén">
                        <i class="bi bi-lock-fill me-1"></i>Requiere Empaque
                    </span>
                `;
            } else if (paso === 3) {
                accionesOperativas += `
                    <button class="btn btn-primary btn-sm py-1 px-2 fw-bold d-inline-flex align-items-center gap-1 shadow-sm" style="background:#B91C1C; border-color:#B91C1C;" onclick="abrirModalDespachoRuta(${p.id})" title="Asignar Chofer y Placa para Salir a Ruta">
                        <i class="bi bi-truck"></i>
                        <span>Despachar a Ruta</span>
                    </button>
                `;
            } else if (paso === 4) {
                accionesOperativas += `
                    <button class="btn btn-success btn-sm py-1 px-2 fw-bold d-inline-flex align-items-center gap-1 shadow-sm" onclick="abrirModalActaEntrega(${p.id})" title="Registrar Acta de Entrega y Cierre con Receptor">
                        <i class="bi bi-clipboard-check"></i>
                        <span>Registrar Entrega</span>
                    </button>
                `;
            } else if (paso === 5) {
                accionesOperativas += `
                    <span class="badge bg-success-subtle text-success border border-success border-opacity-25 py-1 px-2 font-mono">
                        <i class="bi bi-check-all me-1"></i>Entrega Finalizada
                    </span>
                `;
            }
        }

        html += `
            <tr>
                <td class="ps-4 fw-bold">
                    <span class="badge font-monospace px-2 py-1" style="background: #141619; color: #FFFFFF; font-family: 'Inter', sans-serif; font-size: 0.85rem;">
                        #00${p.id}
                    </span>
                    <div class="small font-mono text-muted mt-1" style="font-size: 0.7rem;">
                        ${p.metodo_pago || 'QR_SIMPLE'}
                    </div>
                </td>
                <td>
                    <div class="fw-bold text-dark"><i class="bi bi-person-fill me-1 text-danger"></i>${escaparHTML(p.nombre_destinatario || p.cliente || 'Consumidor Final')}</div>
                    ${(p.telefono_contacto || p.telefono_final) ? `
                        <div class="small fw-semibold mt-1">
                            <a href="https://wa.me/591${escaparHTML(p.telefono_contacto || p.telefono_final).replace(/\D/g, '')}" target="_blank" class="text-decoration-none text-success" title="Escribir al WhatsApp">
                                <i class="bi bi-whatsapp me-1 text-success"></i>${escaparHTML(p.telefono_contacto || p.telefono_final)}
                            </a>
                        </div>
                    ` : ''}
                    <div class="small text-secondary mt-1" style="font-size: 0.78rem;">
                        <i class="bi bi-geo-alt-fill text-danger me-1"></i><strong>${escaparHTML(p.direccion_entrega || p.direccion_final || 'Sucre, Bolivia')}</strong>
                        ${p.referencia_entrega ? `<span class="text-muted d-block ps-3" style="font-size: 0.72rem;">Ref: ${escaparHTML(p.referencia_entrega)}</span>` : ''}
                    </div>
                </td>
                <td class="small text-secondary font-mono">
                    <i class="bi bi-calendar3 me-1 text-warning"></i>${fechaFormateada}
                </td>
                <td class="fw-bold fs-6 font-mono text-success">
                    Bs. ${parseFloat(p.total || 0).toFixed(2)}
                </td>
                <td>
                    ${badgeEtapa}
                    ${miniStepper}
                </td>
                <td class="text-end pe-4">
                    <div class="d-flex align-items-center justify-content-end gap-1 flex-wrap">
                        ${accionesOperativas}
                        <button class="btn btn-outline-warning btn-sm py-1 px-2 rounded d-inline-flex align-items-center gap-1 shadow-sm fw-semibold" onclick="generarRecibo(${p.id})" style="font-size: 0.75rem;" title="Descargar Recibo / Factura en PDF">
                            <i class="bi bi-file-earmark-pdf-fill text-danger"></i>
                            <span>PDF</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function filtrarPedidosLogistica() {
    const query = (document.getElementById('buscadorLogistica')?.value || '').toLowerCase().trim();
    if (!query) {
        renderizarTablaPedidos();
        return;
    }

    const filtrados = pedidosGlobal.filter(p => {
        const idStr = String(p.id).toLowerCase();
        const ordStr = `00${p.id}`.toLowerCase();
        const cliStr = String(p.cliente || '').toLowerCase();
        const mailStr = String(p.cliente_email || '').toLowerCase();
        const estStr = String(p.estado_logistica || p.estado || '').toLowerCase();
        const choferStr = String(p.despacho_chofer || '').toLowerCase();
        const placaStr = String(p.despacho_placa || '').toLowerCase();

        return idStr.includes(query) || 
               ordStr.includes(query) || 
               cliStr.includes(query) || 
               mailStr.includes(query) || 
               estStr.includes(query) ||
               choferStr.includes(query) ||
               placaStr.includes(query);
    });

    renderizarTablaPedidos(filtrados);
}

// =========================================================================
// GESTOR DE MODALES DEL STEPPER (EMPAQUE, DESPACHO Y ENTREGA FINAL)
// =========================================================================

async function abrirModalControlEmpaque(pedidoId) {
    pedidoSeleccionadoOperativo = pedidoId;
    const pedido = pedidosGlobal.find(p => p.id === pedidoId);

    const elId = document.getElementById('empaqueOrdenId');
    const elCli = document.getElementById('empaqueClienteNombre');
    const elEst = document.getElementById('empaqueEstadoActual');
    const elChk = document.getElementById('empaqueItemsChecklist');
    const elResp = document.getElementById('empaqueResponsableInput');

    if (elId) elId.innerText = `ORDEN #00${pedidoId}`;
    if (elCli && pedido) elCli.innerText = pedido.cliente || 'Taller Central';
    if (elEst && pedido) elEst.innerText = pedido.estado_logistica || 'ORDEN RECIBIDA';
    if (elResp && usuarioLogueado) elResp.value = usuarioLogueado.nombre || 'Marcos Almacén (Empaque)';

    if (elChk) {
        elChk.innerHTML = '<span class="spinner-border spinner-border-sm text-warning me-2"></span>Cargando repuestos de la orden...';
        try {
            const res = await fetch(`${API_URL}/pedidos/${pedidoId}`);
            if (res.ok) {
                const data = await res.json();
                const detalles = data.detalles || [];
                if (detalles.length > 0) {
                    elChk.innerHTML = detalles.map((d, i) => `
                        <div class="form-check mb-2">
                            <input class="form-check-input chk-item-empaque" type="checkbox" checked id="chk_item_${i}">
                            <label class="form-check-label fw-bold text-dark font-mono" for="chk_item_${i}" style="font-size: 0.85rem;">
                                ${d.cantidad}x ${escaparHTML(d.producto_nombre)} (Bs. ${parseFloat(d.precio_unitario).toFixed(2)} c/u)
                            </label>
                            <span class="badge bg-success ms-2" style="font-size: 0.65rem;">Stock Verificado</span>
                        </div>
                    `).join('');
                } else {
                    elChk.innerHTML = '<span class="text-muted">Orden con repuestos generales verificados.</span>';
                }
            }
        } catch (e) {
            elChk.innerHTML = '<span class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i>Repuestos listos en mostrador de almacén.</span>';
        }
    }

    const modalEl = document.getElementById('modalControlEmpaque');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

async function iniciarPickingDesdeModal() {
    if (!pedidoSeleccionadoOperativo) return;
    const resp = usuarioLogueado?.nombre || 'Marcos Almacén';

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoSeleccionadoOperativo}/flujo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ etapa: 'PREPARACION', operario: resp })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al iniciar picking');

        Toast.fire({ icon: 'info', title: `Picking iniciado para la Orden #00${pedidoSeleccionadoOperativo}` });
        
        const modalEl = document.getElementById('modalControlEmpaque');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }

        cargarPedidos();
    } catch (e) {
        Toast.fire({ icon: 'error', title: e.message });
    }
}

async function confirmarEmpaqueListoDesdeModal() {
    if (!pedidoSeleccionadoOperativo) return;

    const tipo = document.getElementById('empaqueTipoSelect')?.value || 'Caja sellada industrial';
    const bultos = parseInt(document.getElementById('empaqueBultosInput')?.value) || 1;
    const peso = parseFloat(document.getElementById('empaquePesoInput')?.value) || 4.5;
    const resp = (document.getElementById('empaqueResponsableInput')?.value || '').trim() || (usuarioLogueado?.nombre || 'Marcos Almacén (Empaque)');

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoSeleccionadoOperativo}/flujo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                etapa: 'EMPACADO',
                operario: resp,
                empaque_tipo: tipo,
                empaque_bultos: bultos,
                empaque_peso: peso,
                empaque_checklist: 'Todos los ítems verificados y rotulados'
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al confirmar empaque');

        Toast.fire({ icon: 'success', title: `Orden #00${pedidoSeleccionadoOperativo} empacada y rotulada con éxito` });

        const modalEl = document.getElementById('modalControlEmpaque');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }

        cargarPedidos();
    } catch (e) {
        Toast.fire({ icon: 'error', title: e.message });
    }
}

function abrirModalDespachoRuta(pedidoId) {
    pedidoSeleccionadoOperativo = pedidoId;
    const inpChofer = document.getElementById('despachoChoferInput');
    if (inpChofer && usuarioLogueado && usuarioLogueado.rol === 'DESPACHO') {
        inpChofer.value = usuarioLogueado.nombre;
    }

    const pedido = (pedidosGlobal || []).find(p => p.id === pedidoId);
    if (pedido) {
        const elDir = document.getElementById('despachoDestinoDireccion');
        const elTel = document.getElementById('despachoDestinoTelefono');
        const elCli = document.getElementById('despachoDestinoCliente');
        const dirTexto = (pedido.direccion_entrega || pedido.direccion_final || 'Sucre, Bolivia') + (pedido.referencia_entrega ? ` (${pedido.referencia_entrega})` : '');
        if (elDir) elDir.innerText = dirTexto;
        if (elTel) elTel.innerText = pedido.telefono_contacto || pedido.telefono_final || 'Sin teléfono';
        if (elCli) elCli.innerText = pedido.nombre_destinatario || pedido.cliente || 'Cliente';
    }

    const modalEl = document.getElementById('modalDespachoRuta');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

async function confirmarSalidaRutaDesdeModal() {
    if (!pedidoSeleccionadoOperativo) return;

    const chofer = (document.getElementById('despachoChoferInput')?.value || '').trim() || 'Rodrigo Chofer';
    const placa = (document.getElementById('despachoPlacaInput')?.value || '').trim() || '4029-YHT';

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoSeleccionadoOperativo}/flujo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                etapa: 'DESPACHO',
                despacho_chofer: chofer,
                despacho_placa: placa
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrar salida a ruta');

        Toast.fire({ icon: 'success', title: `Orden #00${pedidoSeleccionadoOperativo} en ruta con móvil ${placa}` });

        const modalEl = document.getElementById('modalDespachoRuta');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }

        cargarPedidos();
    } catch (e) {
        Toast.fire({ icon: 'error', title: e.message });
    }
}

function abrirModalActaEntrega(pedidoId) {
    pedidoSeleccionadoOperativo = pedidoId;

    const pedido = (pedidosGlobal || []).find(p => p.id === pedidoId);
    if (pedido) {
        const elDir = document.getElementById('actaDestinoDireccion');
        const elTel = document.getElementById('actaDestinoTelefono');
        const elCli = document.getElementById('actaDestinoCliente');
        const dirTexto = (pedido.direccion_entrega || pedido.direccion_final || 'Sucre, Bolivia') + (pedido.referencia_entrega ? ` (${pedido.referencia_entrega})` : '');
        if (elDir) elDir.innerText = dirTexto;
        if (elTel) elTel.innerText = pedido.telefono_contacto || pedido.telefono_final || 'Sin teléfono';
        if (elCli) elCli.innerText = pedido.nombre_destinatario || pedido.cliente || 'Cliente';
    }

    const modalEl = document.getElementById('modalActaEntrega');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

async function confirmarEntregaFinalDesdeModal() {
    if (!pedidoSeleccionadoOperativo) return;

    const receptor = (document.getElementById('entregaReceptorInput')?.value || '').trim() || 'Receptor Taller';
    const ci = (document.getElementById('entregaCiInput')?.value || '').trim() || 'S/N';
    const pin = (document.getElementById('entregaPinInput')?.value || '').trim() || '8842';
    const obs = (document.getElementById('entregaObsInput')?.value || '').trim() || 'Entregado conforme y sellado.';
    const operario = usuarioLogueado?.nombre || 'Rodrigo Chofer';

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoSeleccionadoOperativo}/flujo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                etapa: 'ENTREGA_FINAL',
                operario: operario,
                entrega_receptor_nombre: receptor,
                entrega_receptor_ci: ci,
                entrega_pin: pin,
                entrega_observaciones: obs
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrar entrega final');

        Toast.fire({ icon: 'success', title: 'Pedido entregado y cerrado' });

        const modalEl = document.getElementById('modalActaEntrega');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }

        cargarPedidos();
    } catch (e) {
        Toast.fire({ icon: 'error', title: e.message });
    }
}

function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}

function mostrarToastLogistica(mensaje) {
    const alertBox = document.getElementById('logisticaAlert');
    if (!alertBox) return;
    alertBox.innerHTML = `<i class="bi bi-check2-circle me-2 fs-5"></i>${mensaje}`;
    alertBox.classList.remove('d-none');
    setTimeout(() => {
        if (alertBox) alertBox.classList.add('d-none');
    }, 3500);
}

// =========================================================================
// MOTOR DE FACTURACIÓN PDF (html2pdf.js) - RECIBO OFICIAL ENTERPRISE
// =========================================================================
async function generarRecibo(pedidoId, modo = 'descargar') {
    // Si el motor centralizado oficial está cargado, usarlo directamente
    if (typeof window.generarFacturaNotaEntregaHTML === 'function') {
        try {
            if (typeof Toast !== 'undefined') {
                Toast.fire({ icon: 'info', title: 'Generando comprobante oficial...' });
            }
            let pedido = (pedidosGlobal || []).find(p => p.id === pedidoId);
            if (!pedido) {
                const res = await fetch(`${API_URL}/pedidos/${pedidoId}`);
                if (res.ok) pedido = await res.json();
            }
            if (!pedido) throw new Error('Pedido no encontrado en el servidor');

            const htmlFactura = window.generarFacturaNotaEntregaHTML(pedido);
            const nombreArchivo = `Factura_GOLDEN_#00${String(pedido.id).padStart(4, '0')}.pdf`;

            if (modo === 'imprimir') {
                window.imprimirDocumento(htmlFactura, nombreArchivo);
            } else {
                await window.descargarDocumentoPDF(htmlFactura, nombreArchivo);
            }
            return;
        } catch (err) {
            console.error('Error al generar comprobante oficial:', err);
            if (typeof Toast !== 'undefined') {
                Toast.fire({ icon: 'error', title: 'Error al exportar comprobante' });
            }
            return;
        }
    }

    const elemento = document.getElementById('plantilla-factura');
    if (!elemento) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Plantilla no encontrada',
                text: 'No se localizó el contenedor #plantilla-factura en el documento.'
            });
        } else {
            alert('Error: No se localizó la plantilla de la factura.');
        }
        return;
    }

    // Poblado dinámico si se especifica pedidoId
    if (pedidoId) {
        try {
            let pedido = pedidosGlobal.find(p => p.id === pedidoId);
            if (!pedido) {
                const res = await fetch(`${API_URL}/pedidos/${pedidoId}`);
                if (res.ok) pedido = await res.json();
            }

            if (pedido) {
                const elNum = document.getElementById('factura-numero');
                if (elNum) elNum.innerText = `Factura Comercial N° 00${pedido.id || pedidoId}`;

                const elCli = document.getElementById('factura-cliente');
                if (elCli) elCli.innerText = pedido.cliente || 'Consumidor Final';

                const elEmail = document.getElementById('factura-email');
                if (elEmail) elEmail.innerText = pedido.cliente_email || 'ventas@goldenerp.com';

                const elFecha = document.getElementById('factura-fecha');
                if (elFecha) {
                    elFecha.innerText = pedido.fecha_compra 
                        ? new Date(pedido.fecha_compra).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
                        : new Date().toLocaleString('es-BO');
                }

                const elEstado = document.getElementById('factura-estado');
                if (elEstado) elEstado.innerText = (pedido.estado || 'PAGADO').toUpperCase();

                const totalNum = parseFloat(pedido.total || 0);
                const subtotalNeto = totalNum / 1.13;
                const iva = totalNum - subtotalNeto;

                const elSub = document.getElementById('factura-subtotal');
                if (elSub) elSub.innerText = `Bs. ${subtotalNeto.toFixed(2)}`;

                const elIva = document.getElementById('factura-iva');
                if (elIva) elIva.innerText = `Bs. ${iva.toFixed(2)}`;

                const elTot = document.getElementById('factura-total');
                if (elTot) elTot.innerText = `Bs. ${totalNum.toFixed(2)}`;

                const qrImg = document.getElementById('factura-qr-img');
                if (qrImg) {
                    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=GOLDEN-ERP-FACTURA-00${pedido.id || pedidoId}-TOTAL-${totalNum}`;
                }

                const itemsTbody = document.getElementById('factura-items');
                if (itemsTbody && Array.isArray(pedido.detalles) && pedido.detalles.length > 0) {
                    itemsTbody.innerHTML = pedido.detalles.map((d, idx) => `
                        <tr style="border-bottom: 1px solid #cbd5e1; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: center; color: #000000;">${d.cantidad}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; color: #000000;">${d.producto_nombre || 'Repuesto Automotriz'}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; color: #000000;">Bs. ${parseFloat(d.precio_unitario || 0).toFixed(2)}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #000000;">Bs. ${parseFloat(d.subtotal || 0).toFixed(2)}</td>
                        </tr>
                    `).join('');
                }
            }
        } catch (err) {
            console.warn("Aviso: usando plantilla con datos predeterminados:", err);
        }
    }

    if (typeof Toast !== 'undefined') {
        Toast.fire({ icon: 'info', title: 'Generando PDF oficial en formato Carta/A4...' });
    }

    // 1. Mostrar temporalmente para que html2pdf lo capture correctamente
    elemento.style.display = 'block';

    // 2. Configuración estricta de html2pdf
    const opt = {
        margin:       0.5,
        filename:     pedidoId ? `Factura_GOLDEN_#00${pedidoId}.pdf` : 'Factura_GOLDEN.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // 3. Generación y ocultamiento seguro tras completar la descarga
    html2pdf().set(opt).from(elemento).save().then(() => {
        elemento.style.display = 'none';
        if (typeof Toast !== 'undefined') {
            Toast.fire({ icon: 'success', title: 'Factura PDF descargada exitosamente' });
        }
    }).catch(err => {
        console.error("Error al exportar PDF con html2pdf:", err);
        elemento.style.display = 'none';
        if (typeof Toast !== 'undefined') {
            Toast.fire({ icon: 'error', title: 'Error al exportar PDF' });
        }
    });
}

// Compatibilidad de nombres de función
window.generarRecibo = generarRecibo;
window.generarFacturaPDF = generarRecibo;

function exportarLogisticaExcel() {
    if (!pedidosGlobal || pedidosGlobal.length === 0) {
        if (typeof Toast !== 'undefined') {
            Toast.fire({ icon: 'warning', title: 'No hay pedidos en logística para exportar' });
        }
        return;
    }
    if (typeof window.exportarReporteExcel === 'function') {
        window.exportarReporteExcel({
            titulo: 'MANIFIESTO OFICIAL DE LOGÍSTICA Y DESPACHOS',
            subtitulo: 'Control de Envíos, Empaque y Rutas de Reparto — Sucre, Bolivia',
            columnas: ['N° ORDEN', 'FECHA COMPRA', 'CLIENTE / TALLER', 'NIT / CI', 'MÉTODO DE PAGO', 'TOTAL (BS.)', 'ESTADO ENTREGA', 'ESTADO LOGÍSTICA', 'RESPONSABLE EMPAQUE', 'CHOFER DESPACHO'],
            filas: pedidosGlobal.map(p => [
                `#00${p.id}`,
                p.fecha_compra ? new Date(p.fecha_compra).toLocaleString('es-BO') : '',
                typeof window.limpiarTextoCelda === 'function' ? window.limpiarTextoCelda(p.cliente_nombre || p.cliente || 'Taller Mecánico') : (p.cliente_nombre || p.cliente || 'Taller Mecánico'),
                p.cliente_nit || p.nit || '1029384756',
                (p.metodo_pago || 'QR_SIMPLE').toUpperCase(),
                parseFloat(p.total || 0),
                (p.estado || 'PENDIENTE').toUpperCase(),
                (p.estado_logistica || 'ORDEN RECIBIDA').toUpperCase(),
                p.empaque_responsable || 'Almacén Central',
                p.despacho_chofer || 'Distribución Sucre'
            ]),
            anchos: [12, 22, 32, 16, 18, 16, 18, 30, 24, 24],
            nombreArchivo: 'Manifiesto_Logistica_GOLDEN'
        });
    }
}
window.exportarLogisticaExcel = exportarLogisticaExcel;
