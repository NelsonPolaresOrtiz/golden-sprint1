const API_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem('usuario_golden');
    if (!usuarioGuardado) { window.location.href = 'index.html'; return; }
    
    // Inyectar menú y resaltar "dashboard"
    renderizarMenu('dashboard');
    
    const usuario = JSON.parse(usuarioGuardado);
    document.getElementById('userInfoBadge').innerHTML = `<i class="bi bi-person-circle me-1"></i> ${usuario.nombre} <span class="badge bg-warning text-dark ms-1">${usuario.rol}</span>`;
    
    cargarEstadisticas(); 
});

async function cargarEstadisticas() {
    try {
        const res = await fetch(`${API_URL}/estadisticas?t=${new Date().getTime()}`);
        const data = await res.json();
        
        // Llenar las Tarjetas Grandes (KPIs)
        document.getElementById('kpiIngresos').innerText = parseFloat(data.ingresos).toFixed(2);
        document.getElementById('kpiVentas').innerText = data.ventas;
        document.getElementById('kpiAlertas').innerText = data.bajo_stock;

        // Llenar la Tabla de Últimos Pedidos
        const tbody = document.getElementById('tablaUltimosPedidos');
        tbody.innerHTML = '';

        if (data.ultimos_pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No se han registrado ventas aún.</td></tr>';
            return;
        }

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

    } catch (error) { 
        console.error("Error al cargar dashboard", error); 
    }
}