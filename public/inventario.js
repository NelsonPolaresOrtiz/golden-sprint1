const API_URL = '/api';
let productosGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem('usuario_golden');
    if (!usuarioGuardado) {
        window.location.href = 'index.html'; 
        return;
    }
    
    // 1. INYECTAR EL MENÚ COMPARTIDO (Pestaña activa: inventario)
    renderizarMenu('inventario');

    // 2. PONER EL NOMBRE DEL USUARIO
    const usuario = JSON.parse(usuarioGuardado);
    document.getElementById('userInfoBadge').innerHTML = `
        <i class="bi bi-person-circle me-1"></i> ${usuario.nombre} 
        <span class="badge bg-warning text-dark ms-1">${usuario.rol}</span>
    `;
    
    cargarProductos(); 
});

// 1. OBTENER DATOS DE LA BASE DE DATOS
async function cargarProductos() {
    try {
        const res = await fetch(`${API_URL}/productos?t=${new Date().getTime()}`);
        productosGlobal = await res.json();
        renderizarTabla(productosGlobal); 
    } catch (error) {
        console.error("Error cargando productos", error);
    }
}

// 2. DIBUJAR LA TABLA
function renderizarTabla(productos) {
    const tbody = document.getElementById('tablaProductos');
    tbody.innerHTML = '';
    
    if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No se encontraron repuestos.</td></tr>';
        return;
    }

    productos.forEach(p => {
        const stockBadge = p.stock <= p.stock_minimo ? 'bg-danger' : 'bg-success';
        tbody.innerHTML += `
            <tr>
                <td><strong>${p.sku}</strong></td>
                <td>${p.nombre} <br><small class="text-muted">${p.categoria}</small></td>
                <td>Bs. ${p.precio}</td>
                <td><span class="badge ${stockBadge}">${p.stock} unid.</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="editarProducto(${p.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto(${p.id})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

// 3. LÓGICA DEL BUSCADOR EN TIEMPO REAL
document.getElementById('buscadorInventario').addEventListener('input', (e) => {
    const textoBusqueda = e.target.value.toLowerCase(); 
    const productosFiltrados = productosGlobal.filter(p => 
        p.nombre.toLowerCase().includes(textoBusqueda) || 
        p.sku.toLowerCase().includes(textoBusqueda) ||
        p.categoria.toLowerCase().includes(textoBusqueda)
    );
    renderizarTabla(productosFiltrados);
});

// 4. GUARDAR, EDITAR Y ELIMINAR (CRUD)
document.getElementById('productoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const datos = {
        sku: document.getElementById('sku').value,
        nombre: document.getElementById('nombre').value,
        categoria: document.getElementById('categoria').value,
        precio: document.getElementById('precio').value,
        stock: document.getElementById('stock').value,
        stock_minimo: 5
    };

    const url = id ? `${API_URL}/productos/${id}` : `${API_URL}/productos`;
    const metodo = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        const data = await res.json();
        if (!res.ok) {
            alert('❌ Hubo un error: ' + data.error);
            return;
        }

        document.getElementById('productoForm').reset();
        document.getElementById('prodId').value = '';
        cargarProductos();
    } catch (error) {
        alert("Error de conexión con el servidor");
    }
});

function editarProducto(id) {
    const p = productosGlobal.find(item => item.id === id);
    document.getElementById('prodId').value = p.id;
    document.getElementById('sku').value = p.sku;
    document.getElementById('nombre').value = p.nombre;
    document.getElementById('categoria').value = p.categoria;
    document.getElementById('precio').value = p.precio;
    document.getElementById('stock').value = p.stock;
}

async function eliminarProducto(id) {
    if (confirm('¿Eliminar este repuesto?')) {
        await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' });
        cargarProductos();
    }
}

// ==========================================
// 5. EXPORTAR REPORTE A PDF (NUEVO)
// ==========================================
function exportarPDF() {
    if (productosGlobal.length === 0) {
        alert("No hay productos en el inventario para exportar.");
        return;
    }

    // Inicializar la librería jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Dibujar el Título del Documento
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // Azul oscuro
    doc.text("Reporte de Inventario - Distribuidora GOLDEN", 14, 20);
    
    // Dibujar la Fecha
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()} - Generado por el sistema ERP`, 14, 28);

    // Preparar los datos de la tabla
    const columnas = ["SKU", "Nombre del Repuesto", "Categoría", "Precio (Bs)", "Stock Actual"];
    const filas = productosGlobal.map(p => [
        p.sku, 
        p.nombre, 
        p.categoria, 
        `Bs. ${parseFloat(p.precio).toFixed(2)}`, 
        p.stock.toString()
    ]);

    // Generar la tabla con diseño
    doc.autoTable({
        startY: 35,
        head: [columnas],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }, // Colores corporativos
        alternateRowStyles: { fillColor: [248, 249, 250] }
    });

    // Descargar el archivo automáticamente
    doc.save("Reporte_Inventario_GOLDEN.pdf");
}