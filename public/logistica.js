/**
 * ERP GOLDEN - Módulo de Logística y Despachos con KPIs en Tiempo Real (VIP Glassmorphism)
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

document.addEventListener('DOMContentLoaded', () => {
    // Control de Acceso RBAC: Solo Administradores, Almaceneros y Repartidores
    const usuario = protegerRuta('logistica', ['ADMIN', 'ALMACENERO', 'REPARTIDOR']);
    if (!usuario) return;

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
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Sincronizando despachos del período...</td></tr>';
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
                    <td colspan="5" class="text-center py-5 text-danger fw-bold">
                        <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
                        ${error.message || 'Error de conexión con la base de datos de despachos.'}
                    </td>
                </tr>`;
        }
        Toast.fire({ icon: 'error', title: error.message || 'Error al sincronizar lista de despachos' });
    }
}

function actualizarKPIsLogistica() {
    let pend = 0;
    let ruta = 0;
    let ent = 0;

    if (Array.isArray(pedidosGlobal)) {
        pedidosGlobal.forEach(p => {
            if (p.estado === 'PENDIENTE') pend++;
            else if (p.estado === 'EN CAMINO') ruta++;
            else if (p.estado === 'ENTREGADO') ent++;
        });
    }

    const elPendientes = document.getElementById('countPendientes');
    if (elPendientes) elPendientes.innerText = pend;

    // Compatibilidad tanto con 'countEnCamino' como con 'countRuta'
    const elEnCamino = document.getElementById('countEnCamino') || document.getElementById('countRuta');
    if (elEnCamino) elEnCamino.innerText = ruta;

    const elEntregados = document.getElementById('countEntregados');
    if (elEntregados) elEntregados.innerText = ent;

    const elBadgeTotal = document.getElementById('badgeTotalOrdenes');
    if (elBadgeTotal) elBadgeTotal.innerText = `${Array.isArray(pedidosGlobal) ? pedidosGlobal.length : 0} Pedidos`;
}

function renderizarTablaPedidos() {
    const tbody = document.getElementById('tablaPedidos');
    if (!tbody) {
        console.warn("Elemento 'tablaPedidos' no encontrado en el DOM.");
        return;
    }

    if (!Array.isArray(pedidosGlobal) || pedidosGlobal.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-secondary">
                    <i class="bi bi-calendar-x display-4 text-warning d-block mb-3 opacity-40"></i>
                    <h6 class="fw-bold text-white">No hay órdenes en el período seleccionado</h6>
                    <p class="small text-secondary">Modifica el rango de fechas en la parte superior o genera compras en el catálogo.</p>
                </td>
            </tr>`;
        return;
    }

    let html = '';
    pedidosGlobal.forEach(p => {
        let claseEstado = 'select-pendiente';
        if (p.estado === 'EN CAMINO') claseEstado = 'select-camino';
        if (p.estado === 'ENTREGADO') claseEstado = 'select-entregado';

        const fechaFormateada = p.fecha_compra ? new Date(p.fecha_compra).toLocaleString() : 'Reciente';

        html += `
            <tr>
                <td class="ps-4 fw-bold">
                    <span class="badge bg-dark font-monospace text-warning px-2 py-1 border border-secondary border-opacity-50">#00${p.id}</span>
                </td>
                <td>
                    <div class="fw-bold text-white"><i class="bi bi-person-fill me-1 text-warning"></i>${p.cliente || 'Consumidor Final'}</div>
                    <small class="font-monospace d-block" style="color: #cbd5e1;">${p.cliente_email || ''}</small>
                </td>
                <td class="small" style="color: #e2e8f0;">
                    <i class="bi bi-calendar3 me-1 text-warning"></i>${fechaFormateada}
                </td>
                <td class="fw-extrabold fs-6" style="color: #34d399;">
                    Bs. ${parseFloat(p.total || 0).toFixed(2)}
                </td>
                <td class="text-end pe-4">
                    <div class="d-flex align-items-center justify-content-end gap-2">
                        <button class="btn btn-outline-warning btn-sm py-1 px-2 rounded-2 d-inline-flex align-items-center gap-1 shadow-sm" onclick="generarRecibo(${p.id})" title="Descargar Factura Oficial en PDF (html2pdf)">
                            <i class="bi bi-file-earmark-pdf-fill text-danger fs-6"></i>
                            <span class="small fw-bold">Recibo</span>
                        </button>
                        <select id="select-estado-${p.id}" class="form-select form-select-sm select-estado-vip ${claseEstado}" style="width: auto; min-width: 140px;" onchange="cambiarEstado(${p.id}, this.value, this)">
                            <option value="PENDIENTE" class="bg-dark text-white" ${p.estado === 'PENDIENTE' ? 'selected' : ''}>⏳ Por Preparar</option>
                            <option value="EN CAMINO" class="bg-dark text-white" ${p.estado === 'EN CAMINO' ? 'selected' : ''}>🚚 En Camino</option>
                            <option value="ENTREGADO" class="bg-dark text-white" ${p.estado === 'ENTREGADO' ? 'selected' : ''}>✅ Entregado</option>
                        </select>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ========================================================
// 3. ACTUALIZACIÓN EN TIEMPO REAL DEL ESTADO Y KPIS
// ========================================================
async function cambiarEstado(id, nuevoEstado, selectElement) {
    selectElement.className = 'form-select form-select-sm select-estado-vip';
    if (nuevoEstado === 'PENDIENTE') selectElement.classList.add('select-pendiente');
    else if (nuevoEstado === 'EN CAMINO') selectElement.classList.add('select-camino');
    else if (nuevoEstado === 'ENTREGADO') selectElement.classList.add('select-entregado');

    const pedido = pedidosGlobal.find(p => p.id === id);
    if (pedido) {
        pedido.estado = nuevoEstado;
        actualizarKPIsLogistica();
    }

    try {
        const res = await fetch(`${API_URL}/pedidos/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'No se pudo actualizar el estado');
        }

        Toast.fire({
            icon: 'success',
            title: `Orden #00${id} actualizada con éxito a: "${nuevoEstado}"`
        });
        mostrarToastLogistica(`Orden #00${id} actualizada con éxito a: "${nuevoEstado}"`);

    } catch (error) {
        Toast.fire({
            icon: 'error',
            title: `Error al actualizar estado: ${error.message}`
        });
        cargarPedidos();
    }
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
async function generarRecibo(pedidoId) {
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
