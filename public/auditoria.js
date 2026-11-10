/**
 * ERP GOLDEN - Módulo de Auditoría y Trazabilidad Transaccional VIP
 */
const API_URL = '/api';
let logsAuditoriaGlobal = [];

// Helper Toast con SweetAlert2 para notificaciones Dark VIP
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
    // Control de Acceso RBAC Estricto: Solo ADMIN
    const usuario = protegerRuta("ADMIN");
    if (!usuario) return;

    renderizarMenu('auditoria');
    cargarAuditoria();

    // Buscador en tiempo real con evento 'input'
    const inputBuscar = document.getElementById('inputBuscarLogs');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', filtrarLogs);
    }

    // Filtro por módulo
    const filtroModulo = document.getElementById('filtroModulo');
    if (filtroModulo) {
        filtroModulo.addEventListener('change', filtrarLogs);
    }
});

/**
 * Cargar los últimos 100 registros de auditoría desde la API
 */
async function cargarAuditoria() {
    const tbody = document.getElementById('tablaAuditoria');
    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-5 text-secondary">
                <span class="spinner-border spinner-border-sm text-warning me-2"></span>Sincronizando pistas de auditoría...
            </td>
        </tr>
    `;

    try {
        const res = await fetch(`${API_URL}/auditoria?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar los registros de auditoría');
        
        logsAuditoriaGlobal = await res.json();
        actualizarKPIs(logsAuditoriaGlobal);
        renderizarTabla(logsAuditoriaGlobal);
        Toast.fire({ icon: 'success', title: 'Pistas de auditoría actualizadas' });
    } catch (error) {
        console.error("Error al cargar auditoría:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger py-5">
                    <i class="bi bi-exclamation-triangle me-2"></i>Error al conectar con la base de datos de auditoría.
                </td>
            </tr>
        `;
        Toast.fire({ icon: 'error', title: 'Error al consultar auditoría' });
    }
}

/**
 * Actualizar las métricas y KPIs superiores
 */
function actualizarKPIs(logs) {
    const elTotal = document.getElementById('kpiTotalLogs');
    const elHoy = document.getElementById('kpiLogsHoy');
    const elModulos = document.getElementById('kpiModulosActivos');
    const elBadge = document.getElementById('badgeTotalLogs');

    if (!Array.isArray(logs)) return;

    const total = logs.length;
    const hoyStr = new Date().toISOString().split('T')[0];
    const hoyCount = logs.filter(l => l.fecha && l.fecha.startsWith(hoyStr)).length;
    const modulosSet = new Set(logs.map(l => l.modulo).filter(Boolean));

    if (elTotal) elTotal.textContent = total;
    if (elHoy) elHoy.textContent = hoyCount;
    if (elModulos) elModulos.textContent = modulosSet.size;
    if (elBadge) elBadge.textContent = `${total} Eventos`;
}

/**
 * Renderizar filas de la tabla de auditoría
 */
function renderizarTabla(logs) {
    const tbody = document.getElementById('tablaAuditoria');
    const infoPaginacion = document.getElementById('infoPaginacion');

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-secondary">
                    <i class="bi bi-inbox fs-3 d-block mb-2 text-secondary opacity-50"></i>
                    No se encontraron registros de auditoría que coincidan con la búsqueda.
                </td>
            </tr>
        `;
        if (infoPaginacion) infoPaginacion.textContent = 'Mostrando 0 registros';
        return;
    }

    let html = '';
    logs.forEach(log => {
        const badgeModulo = obtenerBadgeModulo(log.modulo);
        const fechaFormateada = formatearFecha(log.fecha);
        const badgeNivel = obtenerBadgeNivel(log.accion, log.modulo);

        html += `
            <tr class="align-middle">
                <td class="ps-3 font-monospace small text-nowrap" style="color: #94a3b8;">
                    <i class="bi bi-clock me-1 text-warning"></i>${fechaFormateada}
                </td>
                <td class="text-nowrap">
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" 
                             style="width: 30px; height: 30px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); font-size: 0.75rem;">
                            ${(log.usuario_nombre || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <span class="fw-semibold text-white d-block" style="font-size: 0.9rem;">${log.usuario_nombre || 'Sistema'}</span>
                        </div>
                    </div>
                </td>
                <td>
                    ${badgeModulo}
                </td>
                <td>
                    <span class="text-light" style="font-size: 0.9rem;">${escaparHTML(log.accion)}</span>
                </td>
                <td class="text-center">
                    ${badgeNivel}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    if (infoPaginacion) {
        infoPaginacion.textContent = `Mostrando ${logs.length} de ${logsAuditoriaGlobal.length} registros`;
    }
}

/**
 * Filtrar logs en tiempo real por texto o por módulo seleccionado
 */
function filtrarLogs() {
    const termino = (document.getElementById('inputBuscarLogs')?.value || '').toLowerCase().trim();
    const moduloSeleccionado = document.getElementById('filtroModulo')?.value || 'TODOS';

    const logsFiltrados = logsAuditoriaGlobal.filter(log => {
        // Filtro por módulo
        if (moduloSeleccionado !== 'TODOS') {
            if (log.modulo !== moduloSeleccionado) return false;
        }

        // Filtro por texto
        if (!termino) return true;

        const u = (log.usuario_nombre || '').toLowerCase();
        const a = (log.accion || '').toLowerCase();
        const m = (log.modulo || '').toLowerCase();
        const f = (log.fecha || '').toLowerCase();

        return u.includes(termino) || a.includes(termino) || m.includes(termino) || f.includes(termino);
    });

    renderizarTabla(logsFiltrados);
}

/**
 * Generar badge VIP según el módulo de origen
 */
function obtenerBadgeModulo(modulo) {
    const mod = (modulo || '').toUpperCase();
    switch (mod) {
        case 'SCM_COMPRAS':
        case 'COMPRAS':
            return '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);"><i class="bi bi-truck-flatbed me-1"></i>SCM / Compras</span>';
        case 'CREDITOS':
            return '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);"><i class="bi bi-credit-card-2-front-fill me-1"></i>Créditos B2B</span>';
        case 'VENTAS':
            return '<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4);"><i class="bi bi-cart-check-fill me-1"></i>Ventas</span>';
        case 'LOGISTICA':
            return '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4);"><i class="bi bi-truck me-1"></i>Logística</span>';
        case 'USUARIOS':
            return '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);"><i class="bi bi-people-fill me-1"></i>Usuarios</span>';
        case 'PRODUCTOS':
            return '<span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.4);"><i class="bi bi-box-seam-fill me-1"></i>Inventario</span>';
        case 'AUTH':
            return '<span class="badge" style="background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.4);"><i class="bi bi-key-fill me-1"></i>Autenticación</span>';
        case 'SISTEMA':
        default:
            return '<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.4);"><i class="bi bi-cpu-fill me-1"></i>Sistema</span>';
    }
}

/**
 * Indicador visual de severidad o categoría de la acción
 */
function obtenerBadgeNivel(accion, modulo) {
    const act = (accion || '').toLowerCase();
    if (act.includes('elimin') || act.includes('baja') || act.includes('bloqueo')) {
        return '<span class="badge rounded-pill bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50"><i class="bi bi-shield-x me-1"></i>Alerta</span>';
    } else if (act.includes('crea') || act.includes('generaci') || act.includes('alta') || act.includes('amortiza')) {
        return '<span class="badge rounded-pill bg-success bg-opacity-25 text-success border border-success border-opacity-50"><i class="bi bi-check-circle me-1"></i>Éxito</span>';
    } else {
        return '<span class="badge rounded-pill bg-secondary bg-opacity-25 text-light border border-secondary border-opacity-50"><i class="bi bi-info-circle me-1"></i>Info</span>';
    }
}

/**
 * Formatear fecha y hora para visualización
 */
function formatearFecha(fechaStr) {
    if (!fechaStr) return 'Reciente';
    try {
        const d = new Date(fechaStr.replace(' ', 'T'));
        if (isNaN(d.getTime())) return fechaStr;
        return d.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        }) + ' ' + d.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    } catch (e) {
        return fechaStr;
    }
}

/**
 * Exportar registros a formato CSV compatible con Excel
 */
function exportarAuditoriaCSV() {
    if (!logsAuditoriaGlobal || logsAuditoriaGlobal.length === 0) {
        Toast.fire({ icon: 'warning', title: 'No hay registros de auditoría para exportar' });
        return;
    }

    const encabezados = ['ID', 'Fecha y Hora', 'Usuario', 'Modulo', 'Accion'];
    const filas = logsAuditoriaGlobal.map(l => [
        l.id,
        `"${l.fecha || ''}"`,
        `"${(l.usuario_nombre || '').replace(/"/g, '""')}"`,
        `"${l.modulo || ''}"`,
        `"${(l.accion || '').replace(/"/g, '""')}"`
    ]);

    const csvContenido = '\uFEFF' + [encabezados.join(','), ...filas.map(f => f.join(','))].join('\n');
    const blob = new Blob([csvContenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `auditoria_golden_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Toast.fire({ icon: 'success', title: 'Auditoría exportada exitosamente en CSV' });
}

function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// Exportación Directa desde la Tabla HTML
function exportarTablaCSV(tablaId, nombreArchivo = 'Auditoria_GOLDEN') {
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

    Toast.fire({ icon: 'success', title: `Auditoría exportada a CSV con éxito` });
}
