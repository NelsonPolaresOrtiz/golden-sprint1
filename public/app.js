/**
 * ERP GOLDEN - Gestión de Autenticación y CRUD de Usuarios (VIP Glassmorphism)
 */
const API_URL = '/api';
let listaUsuariosGlobal = [];

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
    const usuarioGuardado = localStorage.getItem('usuario_golden');
    if (usuarioGuardado) {
        try {
            const usuario = JSON.parse(usuarioGuardado);
            // Si es cliente externo, redirigir de inmediato al catálogo de la tienda
            if (usuario.rol === 'CLIENTE_B2B' || usuario.rol === 'CLIENTE_B2C') {
                window.location.href = 'tienda.html';
                return;
            }
            mostrarPanelCRUD(usuario);
        } catch (e) {
            localStorage.removeItem('usuario_golden');
        }
    }

    // Configurar buscador en tiempo real con evento 'input'
    const inputBuscador = document.getElementById('buscadorUsuarios');
    if (inputBuscador) {
        inputBuscador.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase().trim();
            const filtrados = listaUsuariosGlobal.filter(u =>
                (u.nombre && u.nombre.toLowerCase().includes(texto)) ||
                (u.email && u.email.toLowerCase().includes(texto)) ||
                (u.rol && u.rol.toLowerCase().includes(texto)) ||
                (u.telefono && u.telefono.toLowerCase().includes(texto)) ||
                (u.nit && u.nit.toLowerCase().includes(texto)) ||
                (u.id && String(u.id).includes(texto))
            );
            renderizarUsuarios(filtrados, texto);
        });
    }
});

// Función de ayuda para la defensa universitaria: autocompletar credenciales
window.llenarLogin = function (email, pass) {
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = pass;
    document.getElementById('loginEmail').focus();
};

// ==========================================
// 1. LÓGICA DE LOGIN Y CONTROL DE ACCESO
// ==========================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const alertBox = document.getElementById('loginAlert');
    const btnLogin = document.getElementById('btnLogin');

    alertBox.classList.add('d-none');

    // Feedback visual y protección contra doble clic
    const contenidoOriginalBtn = btnLogin ? btnLogin.innerHTML : '';
    if (btnLogin) {
        btnLogin.disabled = true;
        btnLogin.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Validando acceso...`;
    }

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            alertBox.textContent = data.error || 'Error al iniciar sesión.';
            alertBox.classList.remove('d-none');
            Toast.fire({ icon: 'error', title: data.error || 'Credenciales no autorizadas' });
            return;
        }

        // Guardar sesión en localStorage
        localStorage.setItem('usuario_golden', JSON.stringify(data.usuario));

        Toast.fire({ icon: 'success', title: `Bienvenido, ${data.usuario.nombre}` });

        // RBAC: Clientes van directo a la Tienda; personal interno va al panel correspondiente
        if (data.usuario.rol === 'CLIENTE_B2B' || data.usuario.rol === 'CLIENTE_B2C') {
            window.location.href = 'tienda.html';
            return;
        }

        if (data.usuario.rol === 'REPARTIDOR') {
            window.location.href = 'logistica.html';
            return;
        }

        mostrarPanelCRUD(data.usuario);
    } catch (error) {
        alertBox.textContent = 'Error de conexión con el servidor ERP.';
        alertBox.classList.remove('d-none');
        Toast.fire({ icon: 'error', title: 'Error de conexión con el servidor ERP' });
    } finally {
        if (btnLogin) {
            btnLogin.disabled = false;
            btnLogin.innerHTML = contenidoOriginalBtn;
        }
    }
});

function mostrarPanelCRUD(usuario) {
    // Si no es ADMIN, no tiene acceso a la gestión de usuarios
    if (usuario.rol !== 'ADMIN') {
        window.location.href = 'tienda.html';
        return;
    }

    document.getElementById('loginView').classList.add('d-none');
    document.getElementById('crudView').classList.remove('d-none');

    // Renderizar menú compartido con pestaña de usuarios activa
    const menuContenedor = document.getElementById('menu-contenedor');
    menuContenedor.classList.remove('d-none');
    renderizarMenu('usuarios');

    cargarUsuarios();
}

// ==========================================
// 2. LÓGICA CRUD DE USUARIOS CON DISEÑO VIP
// ==========================================
async function cargarUsuarios() {
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm text-warning me-2"></span>Sincronizando directorio...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/usuarios?t=${Date.now()}`);
        if (!res.ok) throw new Error('Error al consultar usuarios');
        listaUsuariosGlobal = await res.json();
        renderizarUsuarios(listaUsuariosGlobal);
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5"><i class="bi bi-exclamation-triangle me-1"></i>Error al cargar lista de usuarios.</td></tr>';
        Toast.fire({ icon: 'error', title: 'Error al sincronizar directorio de usuarios' });
    }
}

function renderizarUsuarios(usuarios, filtroBusqueda = '') {
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = '';

    if (!usuarios || usuarios.length === 0) {
        if (filtroBusqueda) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-secondary"><i class="bi bi-search fs-3 d-block mb-2 text-warning opacity-50"></i>No se encontraron registros que coincidan con la búsqueda.</td></tr>`;
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary">No existen usuarios registrados.</td></tr>';
        }
        return;
    }

    usuarios.forEach(u => {
        const pillEstado = u.estado === 'ACTIVO'
            ? `<span class="badge-pill-vip badge-pill-emerald"><span class="pulse-dot pulse-dot-emerald me-1"></span>ACTIVO</span>`
            : `<span class="badge-pill-vip badge-pill-ruby"><span class="pulse-dot pulse-dot-ruby me-1"></span>INACTIVO</span>`;

        let pillRol = `<span class="badge-pill-vip badge-pill-slate">${u.rol}</span>`;
        if (u.rol === 'ADMIN') {
            pillRol = `<span class="badge-pill-vip badge-pill-gold"><i class="bi bi-shield-lock-fill me-1"></i>ADMIN</span>`;
        } else if (u.rol === 'CLIENTE_B2B') {
            pillRol = `<span class="badge-pill-vip badge-pill-slate"><i class="bi bi-building me-1"></i>CLIENTE B2B</span>`;
        } else if (u.rol === 'REPARTIDOR') {
            pillRol = `<span class="badge-pill-vip badge-pill-gold"><i class="bi bi-truck me-1"></i>REPARTIDOR</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold font-monospace" style="color: #cbd5e1;">#${u.id}</td>
                <td>
                    <span class="fw-bold text-white d-block">${u.nombre}</span>
                </td>
                <td class="small font-monospace" style="color: #cbd5e1;">${u.email}</td>
                <td>${pillRol}</td>
                <td>${pillEstado}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-warning rounded-2 me-1" onclick="prepararEdicion(${u.id})" title="Editar Usuario">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger rounded-2" onclick="eliminarUsuario(${u.id}, '${u.nombre.replace(/'/g, "\\'")}')" title="Eliminar Usuario">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// GUARDAR / ACTUALIZAR USUARIO CON PROTECCIÓN CONTRA DOBLE CLIC
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rol = document.getElementById('rol').value;
    const estado = document.getElementById('estado').value;

    const btnGuardar = document.getElementById('btnGuardar');
    const esEdicion = id !== '';
    const url = esEdicion ? `${API_URL}/usuarios/${id}` : `${API_URL}/usuarios`;
    const metodo = esEdicion ? 'PUT' : 'POST';

    if (!esEdicion && (!password || password.length < 6)) {
        Toast.fire({ icon: 'warning', title: 'La contraseña debe tener al menos 6 caracteres' });
        mostrarAlerta('La contraseña debe tener al menos 6 caracteres para un nuevo usuario.', 'danger');
        return;
    }

    const payload = { nombre, email, rol, estado };
    if (password && password.trim().length > 0) {
        payload.password = password.trim();
    }

    // Feedback visual y bloqueo del botón mientras se ejecuta la petición
    const textoOriginalBtn = btnGuardar ? btnGuardar.innerHTML : '';
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Guardando Usuario...`;
    }

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
            Toast.fire({ icon: 'error', title: data.error || 'Error al procesar usuario' });
            mostrarAlerta(data.error || 'Ocurrió un error al procesar el usuario.', 'danger');
            return;
        }

        const mensajeExito = esEdicion ? 'Usuario actualizado con éxito' : 'Usuario registrado con éxito';
        Toast.fire({ icon: 'success', title: data.mensaje || mensajeExito });
        mostrarAlerta(data.mensaje || 'Operación completada exitosamente.', 'success');
        resetFormulario();
        cargarUsuarios();
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Error de comunicación con el servidor' });
        mostrarAlerta('Error de comunicación con el servidor ERP.', 'danger');
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = textoOriginalBtn;
        }
    }
});

function prepararEdicion(id) {
    const u = listaUsuariosGlobal.find(item => item.id === id);
    if (!u) return;

    document.getElementById('userId').value = u.id;
    document.getElementById('nombre').value = u.nombre;
    document.getElementById('email').value = u.email;
    document.getElementById('password').value = '';
    document.getElementById('rol').value = u.rol;
    document.getElementById('estado').value = u.estado;

    document.getElementById('formTitle').innerHTML = `<i class="bi bi-pencil-square me-2 fs-5"></i> Editar Usuario #${u.id}`;
    document.getElementById('passHint').textContent = '(Opcional: en blanco para conservar)';
    document.getElementById('btnGuardar').innerHTML = `<i class="bi bi-check2-circle me-1"></i> Guardar Cambios`;
    document.getElementById('btnCancelar').classList.remove('d-none');
}

// ELIMINACIÓN CON DIÁLOGO MODAL SWEETALERT2
async function eliminarUsuario(id, nombre) {
    const confirmacion = typeof Swal !== 'undefined'
        ? await Swal.fire({
            title: '¿Eliminar Usuario?',
            html: `¿Estás seguro de revocar el acceso y eliminar al usuario <strong class="text-warning">"${nombre}"</strong>? Esta acción no se puede revertir.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: '<i class="bi bi-trash3 me-1"></i> Sí, eliminar',
            cancelButtonText: 'Cancelar',
            background: '#0d121f',
            color: '#f8fafc',
            reverseButtons: true
        })
        : { isConfirmed: confirm(`¿Está seguro de eliminar al usuario "${nombre}"?`) };

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok) {
            Toast.fire({ icon: 'success', title: data.mensaje || 'Usuario eliminado con éxito' });
            mostrarAlerta(data.mensaje, 'warning');
            cargarUsuarios();
        } else {
            Toast.fire({ icon: 'error', title: data.error || 'Error al eliminar usuario' });
            mostrarAlerta(data.error, 'danger');
        }
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Error al contactar con el servidor' });
        mostrarAlerta('Error al eliminar usuario.', 'danger');
    }
}

function resetFormulario() {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('formTitle').innerHTML = `<i class="bi bi-person-plus-fill me-2 fs-5"></i> Registrar Nuevo Usuario`;
    document.getElementById('passHint').textContent = '';
    document.getElementById('btnGuardar').innerHTML = `<i class="bi bi-save me-1"></i> Guardar Usuario`;
    document.getElementById('btnCancelar').classList.add('d-none');
}

function mostrarAlerta(mensaje, tipo) {
    const alertBox = document.getElementById('crudAlert');
    if (!alertBox) return;
    alertBox.className = `alert alert-${tipo} py-2 px-3 small rounded-3 fw-semibold`;
    alertBox.textContent = mensaje;
    alertBox.classList.remove('d-none');
    setTimeout(() => alertBox.classList.add('d-none'), 4000);
}
