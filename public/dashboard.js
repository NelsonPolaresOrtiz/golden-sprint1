/**
 * ERP GOLDEN - Módulo de Dashboard y Gráficos Analíticos con Chart.js (VIP Glassmorphism)
 */
const API_URL = '/api';
let miGrafico = null;
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
    // Protección estricta: Solo administradores
    const usuario = protegerRuta('dashboard', ['ADMIN']);
    if (!usuario) return;

    renderizarMenu('dashboard');
    cargarEstadisticas();
});

// ==========================================
// 1. FILTRO DE FECHA GERENCIAL
// ==========================================
function cambiarRangoDashboard(nuevoRango) {
    rangoActual = nuevoRango;
    cargarEstadisticas();
}

// ==========================================
// 2. CARGA DE ESTADÍSTICAS Y KPIS
// ==========================================
async function cargarEstadisticas() {
    const tbody = document.getElementById('tablaUltimosPedidos');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Calculando métricas del período...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/estadisticas?rango=${encodeURIComponent(rangoActual)}&t=${Date.now()}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detalle || errData.error || "Error al consultar estadísticas");
        }
        const data = await res.json();

        // 1. Tarjetas de Métricas (KPIs Superiores)
        const ingresosNum = parseFloat(data.ingresos) || 0;
        document.getElementById('kpiIngresos').innerText = ingresosNum.toLocaleString('es-BO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        document.getElementById('kpiVentas').innerText = data.ventas || 0;
        document.getElementById('kpiAlertas').innerText = data.bajo_stock || 0;

        // 2. Tabla de Últimas Transacciones (Contraste Nítido)
        tbody.innerHTML = '';

        if (!data.ultimos_pedidos || data.ultimos_pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-secondary"><i class="bi bi-calendar-x me-2 text-warning fs-4 d-block mb-2"></i>No se registran transacciones en el período seleccionado.</td></tr>';
        } else {
            data.ultimos_pedidos.forEach(p => {
                let badgeEstado = '<span class="badge-pill-vip badge-pill-ruby"><span class="pulse-dot pulse-dot-ruby me-1"></span>PENDIENTE</span>';
                if (p.estado === 'EN CAMINO') {
                    badgeEstado = '<span class="badge-pill-vip badge-pill-gold"><span class="pulse-dot pulse-dot-gold me-1"></span>EN CAMINO</span>';
                } else if (p.estado === 'ENTREGADO') {
                    badgeEstado = '<span class="badge-pill-vip badge-pill-emerald"><span class="pulse-dot pulse-dot-emerald me-1"></span>ENTREGADO</span>';
                }

                tbody.innerHTML += `
                    <tr>
                        <td class="ps-4 fw-bold">
                            <span class="badge bg-dark font-monospace text-warning px-2 py-1 border border-secondary border-opacity-50">#00${p.id}</span>
                        </td>
                        <td class="fw-bold text-white">
                            <i class="bi bi-person-circle me-1 text-warning"></i> ${p.cliente}
                        </td>
                        <td class="small font-monospace" style="color: #cbd5e1;">
                            ${new Date(p.fecha_compra).toLocaleString()}
                        </td>
                        <td class="fw-bold fs-6" style="color: #34d399;">
                            Bs. ${parseFloat(p.total).toFixed(2)}
                        </td>
                        <td class="text-end pe-4">
                            ${badgeEstado}
                        </td>
                    </tr>
                `;
            });
        }

        // 3. Renderizar Gráfico de Chart.js con la distribución real
        const tituloGrafico = document.getElementById('tituloGrafico');
        const badgeTipoGrafico = document.getElementById('badgeTipoGrafico');
        const chartLeyenda = document.getElementById('chartLeyendaExtra');

        if (data.tipo_distribucion === 'ventas') {
            if (tituloGrafico) tituloGrafico.innerText = 'Ventas por Categoría';
            if (badgeTipoGrafico) {
                badgeTipoGrafico.innerText = 'Salidas Reales';
                badgeTipoGrafico.className = 'badge-pill-vip badge-pill-emerald small';
            }
            if (chartLeyenda) chartLeyenda.innerText = `Volumen de repuestos despachados según el filtro (${data.rango}).`;
        } else {
            if (tituloGrafico) tituloGrafico.innerText = 'Distribución de Inventario';
            if (badgeTipoGrafico) {
                badgeTipoGrafico.innerText = 'Stock Físico';
                badgeTipoGrafico.className = 'badge-pill-vip badge-pill-slate small';
            }
            if (chartLeyenda) chartLeyenda.innerText = 'Categorías físicas del catálogo de repuestos.';
        }

        if (data.distribucion_categorias && data.distribucion_categorias.length > 0) {
            dibujarGrafico(data.distribucion_categorias);
        } else {
            const resProd = await fetch(`${API_URL}/productos`);
            const productos = await resProd.json();
            agruparYRenderizarGrafico(productos);
        }

    } catch (error) {
        console.error("Error al cargar dashboard:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error al cargar métricas del servidor.</td></tr>';
        Toast.fire({ icon: 'error', title: 'Error al sincronizar analítica del Dashboard' });
    }
}

function agruparYRenderizarGrafico(productos) {
    const mapa = {};
    productos.forEach(p => {
        mapa[p.categoria] = (mapa[p.categoria] || 0) + 1;
    });
    const categorias = Object.keys(mapa).map(cat => ({
        categoria: cat,
        cantidad: mapa[cat]
    }));
    dibujarGrafico(categorias);
}

// ==========================================
// 3. INTEGRACIÓN DE CHART.JS PERFECTAMENTE CENTRADO
// ==========================================
function dibujarGrafico(categoriasData) {
    if (!window.Chart) {
        console.warn("Chart.js no está disponible.");
        return;
    }

    const canvas = document.getElementById('graficoVentas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (miGrafico) {
        miGrafico.destroy();
    }

    const etiquetas = categoriasData.map(c => c.categoria);
    const valores = categoriasData.map(c => c.cantidad);

    const coloresFondo = [
        '#f59e0b', // Ámbar Golden
        '#3b82f6', // Azul Cobalto
        '#10b981', // Verde Esmeralda
        '#8b5cf6', // Violeta
        '#06b6d4', // Cyan
        '#64748b'  // Gris Acero
    ];

    miGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                backgroundColor: coloresFondo.slice(0, etiquetas.length),
                borderWidth: 2,
                borderColor: '#0d121f',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 0
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        padding: 8,
                        font: {
                            family: "'Plus Jakarta Sans', sans-serif",
                            size: 11,
                            weight: '600'
                        },
                        color: '#cbd5e1'
                    }
                },
                tooltip: {
                    backgroundColor: '#0d121f',
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                    borderWidth: 1,
                    titleColor: '#fbbf24',
                    bodyColor: '#ffffff',
                    padding: 10,
                    cornerRadius: 12,
                    callbacks: {
                        label: function (context) {
                            return ` ${context.label}: ${context.raw} unidades / registros`;
                        }
                    }
                }
            },
            cutout: '72%'
        }
    });
}
