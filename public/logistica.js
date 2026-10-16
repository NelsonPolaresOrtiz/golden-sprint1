const API_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem('usuario_golden');
    if (!usuarioGuardado) { window.location.href = 'index.html'; return; }
    
    renderizarMenu('logistica');
    const usuario = JSON.parse(usuarioGuardado);
    document.getElementById('userInfoBadge').innerHTML = `<i class="bi bi-person-circle me-1"></i> ${usuario.nombre} <span class="badge bg-warning text-dark ms-1">${usuario.rol}</span>`;
    
    cargarPedidos(); 
});

async function cargarPedidos() {
    const tbody = document.getElementById('tablaPedidos');
    try {
        const res = await fetch(`${API_URL}/pedidos?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error("Error en el servidor BD");
        
        const pedidos = await res.json();
        
        let pend = 0, ruta = 0, ent = 0;
        tbody.innerHTML = '';

        // Si la base de datos devuelve vacío
        if (!pedidos || pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-secondary fw-bold"><i class="bi bi-inbox display-4 d-block mb-3"></i>Aún no hay pedidos.<br>Ve a "Catálogo de Ventas", agrega un producto al carrito y haz una compra de prueba.</td></tr>';
            return;
        }

        pedidos.forEach(p => {
            if(p.estado === 'PENDIENTE') pend++;
            if(p.estado === 'EN CAMINO') ruta++;
            if(p.estado === 'ENTREGADO') ent++;

            let bgSelect = p.estado === 'PENDIENTE' ? 'bg-danger text-white' : (p.estado === 'EN CAMINO' ? 'bg-warning text-dark' : 'bg-success text-white');

            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold text-secondary">#00${p.id}</td>
                    <td class="fw-bold"><i class="bi bi-person me-1 text-muted"></i> ${p.cliente}</td>
                    <td>${new Date(p.fecha_compra).toLocaleString()}</td>
                    <td class="fw-bold text-success">Bs. ${p.total}</td>
                    <td>
                        <select class="form-select form-select-sm fw-bold border-0 shadow-sm ${bgSelect}" onchange="cambiarEstado(${p.id}, this.value)">
                            <option value="PENDIENTE" class="bg-white text-dark" ${p.estado === 'PENDIENTE' ? 'selected' : ''}>⏳ Por Preparar</option>
                            <option value="EN CAMINO" class="bg-white text-dark" ${p.estado === 'EN CAMINO' ? 'selected' : ''}>🚚 En Camino</option>
                            <option value="ENTREGADO" class="bg-white text-dark" ${p.estado === 'ENTREGADO' ? 'selected' : ''}>✅ Entregado</option>
                        </select>
                    </td>
                </tr>
            `;
        });

        document.getElementById('countPendientes').innerText = pend;
        document.getElementById('countRuta').innerText = ruta;
        document.getElementById('countEntregados').innerText = ent;

    } catch (error) { 
        console.error("Error detectado:", error); 
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-danger fw-bold"><i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>Error de Conexión.<br>Apaga el servidor, borra tu archivo golden_seguridad.db y vuelve a escribir npm start.</td></tr>';
    }
}

async function cambiarEstado(id, nuevoEstado) {
    await fetch(`${API_URL}/pedidos/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
    });
    cargarPedidos(); 
}