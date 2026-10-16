const API_URL = '/api';

// Verificar si hay sesión activa al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem('usuario_golden');
    if (usuarioGuardado) {
        mostrarPanelCRUD(JSON.parse(usuarioGuardado));
    }
});

// ==========================================
// 1. LÓGICA DE LOGIN Y SESIÓN
// ==========================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const alertBox = document.getElementById('loginAlert');

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            alertBox.textContent = data.error || 'Error al iniciar sesión';
            alertBox.classList.remove('d-none');
            return;
        }

        alertBox.classList.add('d-none');
        localStorage.setItem('usuario_golden', JSON.stringify(data.usuario));
        mostrarPanelCRUD(data.usuario);
    } catch (error) {
        alertBox.textContent = 'Error de conexión con el servidor';
        alertBox.classList.remove('d-none');
    }
});

function mostrarPanelCRUD(usuario) {
    document.getElementById('loginView').classList.add('d-none');
    document.getElementById('crudView').classList.remove('d-none');
    document.getElementById('navUserSection').classList.remove('d-none');
    document.getElementById('userInfoBadge').innerHTML = `
        <i class="bi bi-person-circle me-1"></i> ${usuario.nombre} <span class="badge bg-warning text-dark">${usuario.rol}</span>
    `;
    cargarUsuarios();
}

function cerrarSesion() {
    localStorage.removeItem('usuario_golden');
    document.getElementById('crudView').classList.add('d-none');
    document.getElementById('navUserSection').classList.add('d-none');
    document.getElementById('loginView').classList.remove('d-none');
    document.getElementById('loginForm').reset();
}

// ==========================================
// 2. LÓGICA CRUD DE USUARIOS
// ==========================================
let listaUsuariosGlobal = [];

async function cargarUsuarios() {
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3">Cargando usuarios...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/usuarios`);
        listaUsuariosGlobal = await res.json();

        tbody.innerHTML = '';
        listaUsuariosGlobal.forEach(u => {
            const badgeEstado = u.estado === 'ACTIVO' ? 'bg-success' : 'bg-secondary';
            tbody.innerHTML += `
                <tr>
                    <td>#${u.id}</td>
                    <td class="fw-semibold">${u.nombre}</td>
                    <td>${u.email}</td>
                    <td><span class="badge bg-dark">${u.rol}</span></td>
                    <td><span class="badge ${badgeEstado}">${u.estado}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="prepararEdicion(${u.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarUsuario(${u.id}, '${u.nombre}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar usuarios</td></tr>';
    }
}

// CREAR O ACTUALIZAR USUARIO
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rol = document.getElementById('rol').value;
    const estado = document.getElementById('estado').value;

    const esEdicion = id !== '';
    const url = esEdicion ? `${API_URL}/usuarios/${id}` : `${API_URL}/usuarios`;
    const metodo = esEdicion ? 'PUT' : 'POST';

    if (!esEdicion && !password) {
        mostrarAlerta('Debe ingresar una contraseña para el nuevo usuario', 'danger');
        return;
    }

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, rol, estado })
        });
        const data = await res.json();

        if (!res.ok) {
            mostrarAlerta(data.error || 'Ocurrió un error', 'danger');
            return;
        }

        mostrarAlerta(data.mensaje, 'success');
        resetFormulario();
        cargarUsuarios();
    } catch (error) {
        mostrarAlerta('Error de conexión con el servidor', 'danger');
    }
});

// CARGAR DATOS EN EL FORMULARIO PARA EDITAR
function prepararEdicion(id) {
    const u = listaUsuariosGlobal.find(item => item.id === id);
    if (!u) return;

    document.getElementById('userId').value = u.id;
    document.getElementById('nombre').value = u.nombre;
    document.getElementById('email').value = u.email;
    document.getElementById('password').value = '';
    document.getElementById('rol').value = u.rol;
    document.getElementById('estado').value = u.estado;

    document.getElementById('formTitle').innerHTML = `<i class="bi bi-pencil-square me-1"></i> Editar Usuario #${u.id}`;
    document.getElementById('passHint').textContent = '(Opcional: dejar en blanco para mantener)';
    document.getElementById('btnGuardar').innerHTML = `<i class="bi bi-check2-circle me-1"></i> Actualizar Usuario`;
    document.getElementById('btnCancelar').classList.remove('d-none');
}

// ELIMINAR USUARIO
async function eliminarUsuario(id, nombre) {
    if (!confirm(`¿Está seguro de eliminar al usuario "${nombre}"?`)) return;

    try {
        const res = await fetch(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            mostrarAlerta(data.mensaje, 'warning');
            cargarUsuarios();
        } else {
            mostrarAlerta(data.error, 'danger');
        }
    } catch (error) {
        mostrarAlerta('Error al eliminar usuario', 'danger');
    }
}

function resetFormulario() {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('formTitle').innerHTML = `<i class="bi bi-person-plus me-1"></i> Registrar Nuevo Usuario`;
    document.getElementById('passHint').textContent = '';
    document.getElementById('btnGuardar').innerHTML = `<i class="bi bi-save me-1"></i> Guardar Usuario`;
    document.getElementById('btnCancelar').classList.add('d-none');
}

function mostrarAlerta(mensaje, tipo) {
    const alertBox = document.getElementById('crudAlert');
    alertBox.className = `alert alert-${tipo} py-2 small`;
    alertBox.textContent = mensaje;
    alertBox.classList.remove('d-none');
    setTimeout(() => alertBox.classList.add('d-none'), 3500);
}