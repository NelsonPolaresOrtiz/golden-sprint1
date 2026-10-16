const API_URL = '/api';
let miGrafico = null; // Variable para almacenar el gráfico

document.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem('usuario_golden');
    if (!usuarioGuardado) { window.location.href = 'index.html'; return; }
    
    renderizarMenu('dashboard');
    const usuario = JSON.parse(usuarioGuardado);
    document.getElementById('userInfoBadge').innerHTML = `<i class="bi bi-person-circle me-1"></i> ${usuario.nombre} <span class="badge bg-warning text-dark ms-1">${usuario.rol}</span>`;
    
    cargarEstadisticas(); 
});

async function cargarEstadisticas() {
    try {
        const res = await fetch(`${API_URL}/estadisticas?t=${new Date().getTime()}`);
        const data = await res.json();
        
        // 1. Llenar las Tarjetas (KPIs)
        document.getElementById('kpiIngresos').innerText = parseFloat(data.ingresos).toFixed(2);
        document.getElementById('kpiVentas').innerText = data.ventas;
        document.getElementById('kpiAlertas').innerText = data.bajo_stock;

        // 2. Llenar la Tabla de Pedidos
        const tbody = document.getElementById('tablaUltimosPedidos');
        tbody.innerHTML = '';

        if (data.ultimos_pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No se han registrado ventas aún.</td></tr>';
        } else {
            data.ultimos_pedidos.forEach(p => {
                let bgBadge = p.estado === 'PENDIENTE' ? 'bg-danger' : (p.estado === 'EN CAMINO' ? 'bg-warning text-dark' : 'bg-success');
                tbody.innerHTML += `
                    <tr>
                        <td class="fw-bold text-secondary ps-4">#00${p.id}</td>
                        <td class="fw-bold"><i class="bi bi-person me-1 text-muted"></i> ${p.cliente}</td>
                        <td><small class="text-muted">${new Date(p.fecha_compra).toLocaleString()}</small></td>
                        <td class="fw-bold text-dark">Bs. ${p.total}</td>
                        <td class="text-end pe-4"><span class="badge ${bgBadge}">${p.estado}</span></td>
                    </tr>
                `;
            });
        }

        // 3. Obtener datos para el gráfico (Vamos a buscar el Inventario para saber qué hay)
        const resProd = await fetch(`${API_URL}/productos`);
        const productos = await resProd.json();
        dibujarGrafico(productos);

    } catch (error) { 
        console.error("Error al cargar dashboard", error); 
    }
}

// 4. LA MAGIA DE CHART.JS
function dibujarGrafico(productos) {
    // Contamos cuántos Aceites y cuántos Filtros tenemos
    let totalAceites = productos.filter(p => p.categoria.includes('Aceite')).length;
    let totalFiltros = productos.filter(p => p.categoria.includes('Filtro')).length;

    const ctx = document.getElementById('graficoVentas').getContext('2d');
    
    // Si ya existe un gráfico, lo destruimos para que no se superponga al recargar
    if (miGrafico) { miGrafico.destroy(); }

    miGrafico = new Chart(ctx, {
        type: 'doughnut', // Tipo "Dona" o Torta agujereada
        data: {
            labels: ['Aceites / Lubricantes', 'Filtros (Aire/Aceite)'],
            datasets: [{
                data: [totalAceites, totalFiltros],
                backgroundColor: [
                    '#f59e0b', // Amarillo Golden
                    '#1e293b'  // Azul oscuro
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' } // Pone los nombres abajo
            }
        }
    });
}