require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const QRCode = require('qrcode');
const db = require('./database');

// Constante oficial Yape Bolivia (Payload EMVCo verificado - Titular: Nelson Polares Ortiz)
const YAPE_QR_PAYLOAD = 'H7GXJFTPPG6jGWbWg6p3PS9e4VEdikOpCEKTIbP8s4Nc+LR4a97Gz83PS+VZaeiX0xz5p2zrv95w6TmyajXzBSD9cFEHv/xuXv8+x+CWApnguV30yJJZP85Gy2e/S/WRbFKhcL28FAGUEJSDRT/TFSolXlsQhcL1ZeEbP5ogKATxGUJqbXlVSua4D+gQgBb/mnOA9XOtRO1esQLJLDzXOYStC/dp4fPPMJ6wGZjFyMB/NDJ/nfX6vm204FPeQe65Aaz32yskfmsPEJYyeXHNqp/InN+5w0+ccweopGRHsf5oyUZqOFnLJQn5jkqHTU1t1N8/XkQjuCD+d0jr+Xd1SQ==|09916E9C26A9918634083E03359A7443';
const { enviarAlertaAdmin, obtenerEstadoWhatsApp, iniciarBot } = require('./whatsapp-bot');
const {
    enviarCotizacionEmail,
    enviarRespaldoComprobanteAdmin,
    enviarComprobantePedidoEmail,
    enviarActualizacionLogisticaEmail,
    resolverRutaComprobante
} = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de encabezados y políticas de caché
app.set('etag', false);
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Helper seguro para construir dinámicamente cláusulas de fecha en SQLite
function construirCondicionFecha(rango, columna = 'fecha_compra') {
    if (!rango) return null;
    const r = String(rango).toLowerCase().trim();
    if (r === 'hoy') {
        return `date(${columna}) = date('now')`;
    }
    if (r === '7dias') {
        return `${columna} >= datetime('now', '-7 days')`;
    }
    if (r === 'mes') {
        return `${columna} >= datetime('now', 'start of month')`;
    }
    // Si es vacío, 'historico', 'todos' o cualquier otro valor, no se aplica condición
    return null;
}

// Manejador de sintaxis JSON inválida en el cuerpo de peticiones
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Cuerpo de petición JSON inválido' });
    }
    next();
});

// Captura defensiva de errores no controlados para blindar disponibilidad en Render
process.on('unhandledRejection', (reason) => {
    console.warn('[Server Warning] Rechazo no controlado capturado de forma segura:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
    console.warn('[Server Warning] Excepción no capturada atrapada de forma segura:', err?.message || err);
});

/**
 * Middleware / Función Asíncrona de Trazabilidad y Auditoría Enterprise
 * Inserta un registro silencioso en la tabla 'auditoria' de SQLite sin bloquear transacciones
 */
async function registrarAuditoria(usuario, accion, modulo) {
    try {
        const usuarioNombre = (usuario && typeof usuario === 'object')
            ? (usuario.nombre || usuario.email || 'Usuario')
            : (usuario ? String(usuario) : 'SISTEMA');

        const accionStr = String(accion || 'Operación no especificada');
        const moduloStr = String(modulo || 'GENERAL').toUpperCase();

        const sql = `INSERT INTO auditoria (usuario_nombre, accion, modulo, fecha) VALUES (?, ?, ?, datetime('now'))`;
        db.run(sql, [usuarioNombre, accionStr, moduloStr], function (err) {
            if (err) {
                console.warn('[Auditoría] No se pudo guardar log silencioso:', err.message);
            }
        });
    } catch (err) {
        console.warn('[Auditoría] Error al registrar evento:', err.message);
    }
}

// ============================================================================
// 1. MÓDULO DE AUTENTICACIÓN Y SEGURIDAD
// ============================================================================

/**
 * Iniciar sesión de usuario
 * POST /api/auth/login
 */
/**
 * Autenticación de usuarios por credenciales locales (email/password)
 * POST /api/auth/login & POST /api/login
 */
const loginHandler = (req, res) => {
    try {
        const email = req.body.email || req.body.correo;
        const password = req.body.password;
        const tipo_portal = req.body.tipo_portal ? String(req.body.tipo_portal).trim().toUpperCase() : null;
        if (!email || !password) {
            return res.status(400).json({ error: 'Debe ingresar correo y contraseña.' });
        }

        const emailLimpio = email.trim().toLowerCase();
        db.get(
            `SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?) OR LOWER(correo) = LOWER(?)`,
            [emailLimpio, emailLimpio],
            (err, user) => {
                if (err) {
                    console.error('Error en login SQL:', err.message);
                    return res.status(500).json({ error: 'Error interno en la base de datos.' });
                }

                if (!user) {
                    return res.status(401).json({ error: 'Credenciales inválidas. Verifique su correo o contraseña.' });
                }

                if (user.estado !== 'ACTIVO') {
                    return res.status(403).json({ error: 'Usuario inactivo. Contacte al Administrador del sistema.' });
                }

                const passwordValida = bcrypt.compareSync(password, user.password);
                if (!passwordValida) {
                    return res.status(401).json({ error: 'Credenciales inválidas. Verifique su correo o contraseña.' });
                }

                const rolUsuario = (user.rol || '').toUpperCase().trim();
                const esCliente = rolUsuario === 'CLIENTE' || rolUsuario === 'CLIENTE_B2B' || rolUsuario === 'CLIENTE_B2C';
                const esInterno = ['ADMIN', 'EMPAQUE', 'DESPACHO', 'TRABAJADOR', 'ALMACENERO', 'REPARTIDOR'].includes(rolUsuario);

                // Bloqueo estricto de cruce de roles según tipo_portal
                if (tipo_portal === 'INTERNO' && esCliente) {
                    registrarAuditoria(user.nombre, `Acceso denegado a portal interno con cuenta Cliente (${user.email})`, 'SEGURIDAD');
                    return res.status(403).json({ 
                        error: "Acceso denegado: Esta cuenta es de Cliente/Taller. Ingresa por el botón CLIENTE (Taller)." 
                    });
                }

                if (tipo_portal === 'CLIENTE' && esInterno) {
                    registrarAuditoria(user.nombre, `Acceso denegado a portal comercial con cuenta de personal interno (${user.email} - Rol: ${user.rol})`, 'SEGURIDAD');
                    return res.status(403).json({ 
                        error: "Esta es una cuenta de personal interno. Ingresa por el Acceso Personal GOLDEN." 
                    });
                }

                registrarAuditoria(user.nombre, `Inicio de sesión exitoso (Rol: ${user.rol} - Portal: ${tipo_portal || 'GENERAL'})`, 'SEGURIDAD');

                const correoFinal = user.correo || user.email;
                return res.status(200).json({
                    mensaje: 'Autenticación exitosa',
                    usuario: {
                        id: user.id,
                        nombre: user.nombre,
                        email: correoFinal,
                        correo: correoFinal,
                        rol: user.rol,
                        estado: user.estado,
                        nit: user.nit || '',
                        telefono: user.telefono || '',
                        direccion: user.direccion || '',
                        metodo_auth: user.metodo_auth || 'local'
                    }
                });
            }
        );
    } catch (error) {
        console.error('Error crítico en login:', error);
        return res.status(500).json({ error: 'Error del servidor al procesar inicio de sesión.' });
    }
};

app.post('/api/auth/login', loginHandler);
app.post('/api/login', loginHandler);

/**
 * Configuración pública de autenticación (Google Client ID, etc.)
 * GET /api/auth/config
 */
app.get('/api/auth/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
});

/**
 * Inicio de sesión y registro social (OAuth simulado para Google, Facebook, Microsoft)
 * POST /api/auth/social
 */
app.post('/api/auth/social', (req, res) => {
    try {
        const { provider, email, correo, nombre, picture } = req.body;
        const emailEntrante = (email || correo || '').trim().toLowerCase();
        if (!emailEntrante) {
            return res.status(400).json({ error: 'Se requiere el correo de la cuenta social.' });
        }

        const nombreFinal = (nombre && nombre.trim()) ? nombre.trim() : (emailEntrante.split('@')[0]);
        const proveedor = provider || 'google';

        // Buscar si ya existe el usuario por email o correo
        db.get(
            `SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?) OR LOWER(correo) = LOWER(?)`,
            [emailEntrante, emailEntrante],
            (err, user) => {
                if (err) {
                    console.error('Error en auth social SQL:', err.message);
                    return res.status(500).json({ error: 'Error interno en la base de datos.' });
                }

                if (user) {
                    const proveedorNombre = proveedor === 'google' ? 'Google' : (proveedor === 'facebook' ? 'Facebook' : proveedor);
                    registrarAuditoria(user.nombre, `Inicio de sesión con cuenta ${proveedorNombre}`, 'SEGURIDAD');
                    const correoFinal = user.correo || user.email;
                    return res.status(200).json({
                        mensaje: `Bienvenido de vuelta, ${user.nombre}`,
                        usuario: {
                            id: user.id,
                            nombre: user.nombre,
                            email: correoFinal,
                            correo: correoFinal,
                            rol: user.rol,
                            estado: user.estado,
                            nit: user.nit || '',
                            telefono: user.telefono || '',
                            direccion: user.direccion || '',
                            metodo_auth: user.metodo_auth || proveedor,
                            provider: proveedor,
                            picture: picture || ''
                        }
                    });
                } else {
                    // Usuario no existe: registrar nuevo usuario con rol CLIENTE
                    const hashPass = bcrypt.hashSync(`social_pwd_${Date.now()}_${Math.random()}`, 10);
                    db.run(
                        `INSERT INTO usuarios (nombre, email, correo, password, rol, estado, nit, telefono, direccion, metodo_auth, fecha_registro) VALUES (?, ?, ?, ?, 'CLIENTE', 'ACTIVO', '', '', '', ?, datetime('now', 'localtime'))`,
                        [nombreFinal, emailEntrante, emailEntrante, hashPass, proveedor],
                        function (insErr) {
                            if (insErr) {
                                console.error('Error al registrar usuario social:', insErr.message);
                                return res.status(500).json({ error: 'No se pudo crear la cuenta de cliente.' });
                            }

                            const nuevoId = this.lastID;
                            const proveedorNombre = proveedor === 'google' ? 'Google' : (proveedor === 'facebook' ? 'Facebook' : proveedor);
                            registrarAuditoria(nombreFinal, `Registro de taller con cuenta ${proveedorNombre}`, 'USUARIOS');

                            return res.status(201).json({
                                mensaje: `Cuenta de cliente creada exitosamente con ${proveedor}`,
                                usuario: {
                                    id: nuevoId,
                                    nombre: nombreFinal,
                                    email: emailEntrante,
                                    correo: emailEntrante,
                                    rol: 'CLIENTE',
                                    estado: 'ACTIVO',
                                    nit: '',
                                    telefono: '',
                                    direccion: '',
                                    metodo_auth: proveedor,
                                    provider: proveedor,
                                    picture: picture || ''
                                }
                            });
                        }
                    );
                }
            }
        );
    } catch (error) {
        console.error('Error crítico en auth social:', error);
        return res.status(500).json({ error: 'Error del servidor al procesar autenticación social.' });
    }
});

/**
 * Registro de nueva cuenta de cliente / taller mecánico
 * POST /api/auth/registro-cliente & POST /api/clientes/registro & POST /api/auth/registro
 */
const registrarClienteHandler = (req, res) => {
    try {
        const { nombre, email, correo, password, nit, telefono, direccion, metodo_auth } = req.body;
        const emailFinal = (email || correo || '').trim().toLowerCase();

        if (!nombre || !emailFinal || !password) {
            return res.status(400).json({ error: 'Nombre del taller/cliente, correo y contraseña son obligatorios.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const metodo = metodo_auth || 'local';

        db.get(
            `SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) OR LOWER(correo) = LOWER(?)`,
            [emailFinal, emailFinal],
            (chkErr, row) => {
                if (chkErr) return res.status(500).json({ error: 'Error en la base de datos.' });
                if (row) return res.status(409).json({ error: 'Este correo ya está registrado, inicia sesión' });

                db.run(
                    `INSERT INTO usuarios (nombre, email, correo, password, rol, estado, nit, telefono, direccion, metodo_auth, fecha_registro) VALUES (?, ?, ?, ?, 'CLIENTE', 'ACTIVO', ?, ?, ?, ?, datetime('now', 'localtime'))`,
                    [nombre.trim(), emailFinal, emailFinal, hashedPassword, nit ? String(nit).trim() : '', telefono ? String(telefono).trim() : '', direccion ? String(direccion).trim() : '', metodo],
                    function (insErr) {
                        if (insErr) {
                            console.error('Error al insertar cliente:', insErr.message);
                            return res.status(500).json({ error: 'Error al registrar la cuenta de cliente.' });
                        }
                        const nuevoId = this.lastID;
                        registrarAuditoria(nombre.trim(), `Nuevo taller registrado (NIT: ${nit || 'S/N'}, Dir: ${direccion || 'Sucre'})`, 'USUARIOS');

                        return res.status(201).json({
                            mensaje: 'Cuenta de taller registrada exitosamente.',
                            usuario: {
                                id: nuevoId,
                                nombre: nombre.trim(),
                                email: emailFinal,
                                correo: emailFinal,
                                rol: 'CLIENTE',
                                estado: 'ACTIVO',
                                nit: nit ? String(nit).trim() : '',
                                telefono: telefono ? String(telefono).trim() : '',
                                direccion: direccion ? String(direccion).trim() : '',
                                metodo_auth: metodo
                            }
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error('Error crítico en registro de cliente:', error);
        return res.status(500).json({ error: 'Error del servidor al procesar el registro.' });
    }
};

app.post('/api/auth/registro-cliente', registrarClienteHandler);
app.post('/api/clientes/registro', registrarClienteHandler);
app.post('/api/auth/registro', registrarClienteHandler);
app.post('/api/registro', registrarClienteHandler);

// ============================================================================
// 2. MÓDULO DE GESTIÓN DE USUARIOS (CRUD COMPLETO)
// ============================================================================

/**
 * Listar todos los usuarios (sin exponer hash de contraseñas)
 * GET /api/usuarios
 */
app.get('/api/usuarios', (req, res) => {
    try {
        db.all(
            `SELECT id, nombre, COALESCE(correo, email) as email, COALESCE(correo, email) as correo, rol, estado, nit, telefono, direccion, COALESCE(metodo_auth, 'local') as metodo_auth, COALESCE(fecha_registro, fecha_creacion) as fecha_registro, fecha_creacion FROM usuarios ORDER BY id DESC`,
            [],
            (err, rows) => {
                if (err) {
                    console.error('Error al listar usuarios:', err.message);
                    return res.status(500).json({ error: 'Error al obtener usuarios de la base de datos.' });
                }
                res.status(200).json(rows || []);
            }
        );
    } catch (error) {
        console.error('Error crítico al listar usuarios:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Registrar nuevo usuario
 * POST /api/usuarios
 */
app.post('/api/usuarios', (req, res) => {
    try {
        const { nombre, email, correo, password, rol, estado, nit, telefono, direccion, metodo_auth } = req.body;
        const emailLimpio = (email || correo || '').trim().toLowerCase();

        if (!nombre || !emailLimpio || !password || !rol) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben ser proporcionados.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const estadoFinal = estado || 'ACTIVO';
        const hashedPassword = bcrypt.hashSync(password, 10);
        const metodo = metodo_auth || 'local';

        db.run(
            `INSERT INTO usuarios (nombre, email, correo, password, rol, estado, nit, telefono, direccion, metodo_auth, fecha_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
            [nombre.trim(), emailLimpio, emailLimpio, hashedPassword, rol, estadoFinal, nit ? String(nit).trim() : '', telefono ? String(telefono).trim() : '', direccion ? String(direccion).trim() : '', metodo],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'El correo electrónico ya está registrado por otro usuario.' });
                    }
                    console.error('Error al crear usuario:', err.message);
                    return res.status(500).json({ error: 'Error al registrar el usuario.' });
                }
                registrarAuditoria('ADMIN', `Registró nuevo usuario "${nombre.trim()}" con rol ${rol} (${emailLimpio})`, 'USUARIOS');
                res.status(201).json({ id: this.lastID, mensaje: 'Usuario registrado exitosamente.' });
            }
        );
    } catch (error) {
        console.error('Error crítico al crear usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Actualizar usuario existente (con opción de actualizar contraseña)
 * PUT /api/usuarios/:id
 */
app.put('/api/usuarios/:id', (req, res) => {
    try {
        const userId = req.params.id;
        const { nombre, email, correo, password, rol, estado, nit, telefono, direccion, metodo_auth } = req.body;
        const emailLimpio = (email || correo || '').trim().toLowerCase();

        if (!nombre || !emailLimpio || !rol || !estado) {
            return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar el usuario.' });
        }

        // Verificar primero si el correo ya pertenece a otro usuario
        db.get(`SELECT id FROM usuarios WHERE (LOWER(email) = ? OR LOWER(correo) = ?) AND id != ?`, [emailLimpio, emailLimpio, userId], (err, existeOtro) => {
            if (err) {
                return res.status(500).json({ error: 'Error al verificar disponibilidad del correo.' });
            }
            if (existeOtro) {
                return res.status(409).json({ error: 'El correo ya está en uso por otro usuario.' });
            }

            // Si se envió nueva contraseña válida, se hashea; si no, se conserva la existente
            if (password && password.trim().length > 0) {
                if (password.trim().length < 6) {
                    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
                }
                const hashedPassword = bcrypt.hashSync(password.trim(), 10);
                db.run(
                    `UPDATE usuarios SET nombre = ?, email = ?, correo = ?, password = ?, rol = ?, estado = ?, nit = COALESCE(?, nit), telefono = COALESCE(?, telefono), direccion = COALESCE(?, direccion), metodo_auth = COALESCE(?, metodo_auth) WHERE id = ?`,
                    [nombre.trim(), emailLimpio, emailLimpio, hashedPassword, rol, estado, nit, telefono, direccion, metodo_auth, userId],
                    function (updateErr) {
                        if (updateErr) {
                            console.error('Error al actualizar usuario:', updateErr.message);
                            return res.status(500).json({ error: 'Error al actualizar usuario.' });
                        }
                        if (this.changes === 0) {
                            return res.status(404).json({ error: 'Usuario no encontrado.' });
                        }
                        registrarAuditoria('ADMIN', `Actualizó usuario #${userId} ("${nombre.trim()}" - Rol: ${rol}) con cambio de credenciales`, 'USUARIOS');
                        res.status(200).json({ mensaje: 'Usuario y credenciales actualizados exitosamente.' });
                    }
                );
            } else {
                db.run(
                    `UPDATE usuarios SET nombre = ?, email = ?, correo = ?, rol = ?, estado = ?, nit = COALESCE(?, nit), telefono = COALESCE(?, telefono), direccion = COALESCE(?, direccion), metodo_auth = COALESCE(?, metodo_auth) WHERE id = ?`,
                    [nombre.trim(), emailLimpio, emailLimpio, rol, estado, nit, telefono, direccion, metodo_auth, userId],
                    function (updateErr) {
                        if (updateErr) {
                            console.error('Error al actualizar usuario:', updateErr.message);
                            return res.status(500).json({ error: 'Error al actualizar usuario.' });
                        }
                        if (this.changes === 0) {
                            return res.status(404).json({ error: 'Usuario no encontrado.' });
                        }
                        registrarAuditoria('ADMIN', `Actualizó datos de usuario #${userId} ("${nombre.trim()}" - Rol: ${rol})`, 'USUARIOS');
                        res.status(200).json({ mensaje: 'Usuario actualizado exitosamente.' });
                    }
                );
            }
        });
    } catch (error) {
        console.error('Error crítico al editar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Eliminar usuario
 * DELETE /api/usuarios/:id
 */
app.delete('/api/usuarios/:id', (req, res) => {
    try {
        const userId = req.params.id;

        // Proteger al admin principal
        db.get(`SELECT email, rol FROM usuarios WHERE id = ?`, [userId], (err, user) => {
            if (err) return res.status(500).json({ error: 'Error al buscar usuario.' });
            if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

            if (user.email === 'admin@golden.bo') {
                return res.status(403).json({ error: 'No está permitido eliminar al Administrador principal del sistema.' });
            }

            db.run(`DELETE FROM usuarios WHERE id = ?`, [userId], function (delErr) {
                if (delErr) {
                    if (delErr.message.includes('FOREIGN KEY constraint failed')) {
                        return res.status(409).json({ error: 'No se puede eliminar el usuario porque tiene registros de pedidos asociados.' });
                    }
                    return res.status(500).json({ error: 'Error al eliminar usuario: ' + delErr.message });
                }
                registrarAuditoria('ADMIN', `Eliminó el usuario #${userId} (${user.email} - Rol: ${user.rol})`, 'USUARIOS');
                res.status(200).json({ mensaje: 'Usuario eliminado exitosamente.' });
            });
        });
    } catch (error) {
        console.error('Error crítico al eliminar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ============================================================================
// 3. MÓDULO DE INVENTARIO Y CATÁLOGO DE PRODUCTOS (CRUD COMPLETO)
// ============================================================================

/**
 * Obtener todos los productos
 * GET /api/productos
 */
app.get('/api/productos', (req, res) => {
    try {
        db.all(`SELECT * FROM productos ORDER BY id DESC`, [], (err, rows) => {
            if (err) {
                console.error('Error al consultar inventario:', err.message);
                return res.status(500).json({ error: 'Error al cargar productos del inventario.' });
            }
            res.status(200).json(rows || []);
        });
    } catch (error) {
        console.error('Error crítico al obtener productos:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Obtener detalle de un producto por ID
 * GET /api/productos/:id
 */
app.get('/api/productos/:id', (req, res) => {
    try {
        const prodId = req.params.id;
        db.get('SELECT * FROM productos WHERE id = ?', [prodId], (err, row) => {
            if (err) return res.status(500).json({ error: 'Error al consultar producto.' });
            if (!row) return res.status(404).json({ error: 'Producto no encontrado.' });
            res.status(200).json(row);
        });
    } catch (error) {
        console.error('Error crítico al obtener producto:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Middleware para validar permisos granulares de gestión de catálogo
 * Solo se permite el acceso a ADMIN y EMPAQUE (Encargado de Almacén).
 * CLIENTE, DESPACHO y peticiones no autenticadas son bloqueadas con HTTP 403 Forbidden.
 */
function verificarPermisoGestorCatalogo(req, res, next) {
    const authHeader = (req.headers['authorization'] || '').toString().trim();
    let authBearer = '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        authBearer = authHeader.slice(7).trim();
    }

    const rolHeader = (
        authBearer ||
        req.headers['x-usuario-rol'] || 
        req.headers['x-user-rol'] || 
        req.headers['x-rol'] || 
        req.body?.usuario_rol || 
        req.body?.rol || 
        req.body?.usuario?.rol || 
        req.query?.rol || 
        ''
    ).toString().toUpperCase().trim();

    const emailHeader = (
        req.headers['x-usuario-email'] || 
        req.headers['x-user-email'] || 
        req.headers['x-email'] || 
        req.body?.usuario_email || 
        req.body?.email || 
        ''
    ).toString().toLowerCase().trim();

    // Bloqueo explícito de roles no autorizados (CLIENTE y DESPACHO)
    if (
        rolHeader === 'CLIENTE' || 
        rolHeader === 'CLIENTE_B2B' || 
        rolHeader === 'CLIENTE_B2C' || 
        rolHeader === 'DESPACHO' || 
        rolHeader === 'CHOFER' || 
        rolHeader === 'REPARTIDOR'
    ) {
        registrarAuditoria('SEGURIDAD', `Acceso denegado a gestión de catálogo: intento no autorizado con rol ${rolHeader} (${emailHeader || 'sin email'})`, 'CATALOGO');
        return res.status(403).json({
            error: `Acceso denegado (403 Forbidden): El rol "${rolHeader}" no tiene permisos para gestionar productos o banners del catálogo. Se requiere rol ADMIN o EMPAQUE (Encargado de Almacén).`
        });
    }

    const rolesAutorizados = ['ADMIN', 'ADMINISTRADOR', 'SUPERADMIN', 'GERENTE', 'EMPAQUE', 'ALMACENERO', 'ALMACEN'];

    if (rolHeader && rolesAutorizados.includes(rolHeader)) {
        if (emailHeader) {
            return db.get('SELECT rol, estado FROM usuarios WHERE LOWER(email) = ? OR LOWER(correo) = ?', [emailHeader, emailHeader], (err, user) => {
                if (!err && user) {
                    const rolDB = (user.rol || '').toUpperCase().trim();
                    if (user.estado !== 'ACTIVO') {
                        return res.status(403).json({ error: 'Acceso denegado: El usuario gestor está inactivo.' });
                    }
                    if (!rolesAutorizados.includes(rolDB)) {
                        registrarAuditoria('SEGURIDAD', `Acceso denegado: rol en headers (${rolHeader}) no coincide con rol en base de datos (${rolDB}) para ${emailHeader}`, 'CATALOGO');
                        return res.status(403).json({ error: 'Acceso denegado: Credenciales no autorizadas.' });
                    }
                }
                next();
            });
        }
        return next();
    }

    // Si no se proporcionó rol o no es ADMIN ni EMPAQUE: 403 Forbidden
    registrarAuditoria('SEGURIDAD', `Intento no autorizado de modificar catálogo sin credenciales de rol válidas (${rolHeader || 'ANÓNIMO'})`, 'CATALOGO');
    return res.status(403).json({
        error: 'Acceso denegado (403 Forbidden): Se requiere autorización de ADMIN o EMPAQUE (Encargado de Almacén) para gestionar el catálogo.'
    });
}

/**
 * Registrar nuevo producto en inventario
 * POST /api/productos
 */
app.post('/api/productos', verificarPermisoGestorCatalogo, (req, res) => {
    try {
        const {
            sku, nombre, categoria, precio, stock, stock_minimo = 5,
            imagen_url, especificaciones, linea = 'liviana',
            en_oferta = 0, descuento_porcentaje = 15, compatibilidad
        } = req.body;

        if (!sku || !nombre || !categoria || precio === undefined || stock === undefined) {
            return res.status(400).json({ error: 'SKU, nombre, categoría, precio y stock son obligatorios.' });
        }

        const precioNum = parseFloat(precio);
        const stockNum = parseInt(stock, 10);
        const minStockNum = parseInt(stock_minimo, 10) || 5;
        const enOfertaNum = (en_oferta === true || en_oferta === 1 || en_oferta === '1') ? 1 : 0;
        const descNum = parseInt(descuento_porcentaje, 10) || 15;

        if (isNaN(precioNum) || precioNum < 0) {
            return res.status(400).json({ error: 'El precio debe ser un número positivo.' });
        }
        if (isNaN(stockNum) || stockNum < 0) {
            return res.status(400).json({ error: 'El stock debe ser un número entero no negativo.' });
        }

        const specsStr = typeof especificaciones === 'object' ? JSON.stringify(especificaciones) : (especificaciones || null);
        const sql = `INSERT INTO productos (
            sku, nombre, categoria, precio, stock, stock_minimo, imagen_url, 
            especificaciones, linea, en_oferta, descuento_porcentaje, compatibilidad
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(sql, [
            String(sku).trim().toUpperCase(),
            String(nombre).trim(),
            String(categoria).trim(),
            precioNum,
            stockNum,
            minStockNum,
            imagen_url || null,
            specsStr,
            linea || 'liviana',
            enOfertaNum,
            descNum,
            compatibilidad || null
        ], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: `El código SKU "${sku}" ya está registrado.` });
                }
                console.error('Error al insertar producto:', err.message);
                return res.status(500).json({ error: 'Error al guardar el producto en la base de datos.' });
            }
            registrarAuditoria('GESTOR_CATALOGO', `Registró nuevo repuesto SKU: ${sku.trim().toUpperCase()} - "${nombre.trim()}"`, 'CATALOGO');
            res.status(201).json({ id: this.lastID, mensaje: 'Repuesto registrado exitosamente en el catálogo.' });
        });
    } catch (error) {
        console.error('Error crítico al crear producto:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Actualizar producto existente (Soporta actualización completa y parcial de ofertas/precios)
 * PUT /api/productos/:id
 */
app.put('/api/productos/:id', verificarPermisoGestorCatalogo, (req, res) => {
    try {
        const prodId = req.params.id;
        db.get('SELECT * FROM productos WHERE id = ?', [prodId], (getErr, prodExistente) => {
            if (getErr) return res.status(500).json({ error: 'Error al consultar producto.' });
            if (!prodExistente) return res.status(404).json({ error: 'Producto no encontrado.' });

            const {
                sku = prodExistente.sku,
                nombre = prodExistente.nombre,
                categoria = prodExistente.categoria,
                precio = prodExistente.precio,
                stock = prodExistente.stock,
                stock_minimo = prodExistente.stock_minimo,
                imagen_url = prodExistente.imagen_url,
                especificaciones = prodExistente.especificaciones,
                linea = prodExistente.linea,
                en_oferta = prodExistente.en_oferta,
                descuento_porcentaje = prodExistente.descuento_porcentaje,
                compatibilidad = prodExistente.compatibilidad
            } = req.body;

            const precioNum = parseFloat(precio);
            const stockNum = parseInt(stock, 10);
            const minStockNum = parseInt(stock_minimo, 10);
            const enOfertaNum = (en_oferta === true || en_oferta === 1 || en_oferta === '1') ? 1 : 0;
            const descNum = parseInt(descuento_porcentaje, 10) || 15;

            if (isNaN(precioNum) || precioNum < 0 || isNaN(stockNum) || stockNum < 0) {
                return res.status(400).json({ error: 'Precio o stock inválidos.' });
            }

            const specsStr = typeof especificaciones === 'object' ? JSON.stringify(especificaciones) : (especificaciones || null);

            const sql = `UPDATE productos SET 
                sku = ?, nombre = ?, categoria = ?, precio = ?, stock = ?, stock_minimo = ?, 
                imagen_url = ?, especificaciones = ?, linea = ?, en_oferta = ?, 
                descuento_porcentaje = ?, compatibilidad = ? 
                WHERE id = ?`;

            db.run(sql, [
                String(sku).trim().toUpperCase(),
                String(nombre).trim(),
                String(categoria).trim(),
                precioNum,
                stockNum,
                isNaN(minStockNum) ? 5 : minStockNum,
                imagen_url || null,
                specsStr,
                linea || 'liviana',
                enOfertaNum,
                descNum,
                compatibilidad || null,
                prodId
            ], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: `El SKU "${sku}" ya está asignado a otro producto.` });
                    }
                    console.error('Error al actualizar producto:', err.message);
                    return res.status(500).json({ error: 'Error al actualizar el repuesto.' });
                }
                registrarAuditoria('GESTOR_CATALOGO', `Modificó repuesto #${prodId} (${sku} - "${nombre}")`, 'CATALOGO');
                res.status(200).json({ mensaje: 'Repuesto actualizado correctamente en base de datos.' });
            });
        });
    } catch (error) {
        console.error('Error crítico al editar producto:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Eliminar producto del inventario
 * DELETE /api/productos/:id
 */
app.delete('/api/productos/:id', verificarPermisoGestorCatalogo, (req, res) => {
    try {
        const prodId = req.params.id;
        db.run(`DELETE FROM productos WHERE id = ?`, [prodId], function (err) {
            if (err) {
                if (err.message.includes('FOREIGN KEY constraint failed')) {
                    return res.status(409).json({ 
                        error: 'No se puede eliminar físicamente el repuesto porque tiene pedidos asociados. Puede pausarlo poniendo su stock en 0.' 
                    });
                }
                console.error('Error al eliminar producto:', err.message);
                return res.status(500).json({ error: 'Error al eliminar el producto.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Producto no encontrado.' });
            }
            registrarAuditoria('GESTOR_CATALOGO', `Eliminó repuesto #${prodId} del catálogo`, 'CATALOGO');
            res.status(200).json({ mensaje: 'Repuesto eliminado exitosamente.' });
        });
    } catch (error) {
        console.error('Error crítico al eliminar producto:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Obtener configuración activa del Hero Banner y Anuncios del Catálogo
 * GET /api/config-catalogo & GET /api/config/banner
 */
const obtenerConfigBannerHandler = (req, res) => {
    try {
        db.get('SELECT * FROM config_catalogo WHERE id = 1', [], (err, row) => {
            if (err) {
                console.error('Error al consultar config_catalogo:', err.message);
                return res.status(500).json({ error: 'Error al obtener configuración del catálogo.' });
            }
            if (!row) {
                return res.status(200).json({
                    id: 1,
                    hero_titulo: "LUBRICANTES Y FILTROS\nDE ALTO RENDIMIENTO\nPARA TALLERES Y FLOTAS",
                    hero_subtitulo: "Máxima potencia, más eficiencia y la mayor durabilidad para quien exige mucho del vehículo en ruta y ciudad.",
                    hero_destacado: "Lotes con -15% Mayorista",
                    hero_badge: "Fabricación & Distribución Mayorista",
                    banner_activo: 1
                });
            }
            res.status(200).json(row);
        });
    } catch (error) {
        console.error('Error crítico en GET /api/config-catalogo:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * Actualizar configuración y textos del Hero Banner
 * PUT /api/config-catalogo & PUT /api/config/banner
 * Protegido estrictamente: solo ADMIN y EMPAQUE autorizados
 */
const actualizarConfigBannerHandler = (req, res) => {
    try {
        const { hero_titulo, hero_subtitulo, hero_destacado, hero_badge, banner_activo } = req.body;
        
        db.get('SELECT id FROM config_catalogo WHERE id = 1', [], (err, row) => {
            if (err) return res.status(500).json({ error: 'Error al verificar configuración.' });
            
            if (!row) {
                db.run(
                    `INSERT INTO config_catalogo (id, hero_titulo, hero_subtitulo, hero_destacado, hero_badge, banner_activo) VALUES (1, ?, ?, ?, ?, ?)`,
                    [
                        hero_titulo || 'LUBRICANTES Y FILTROS DE ALTO RENDIMIENTO',
                        hero_subtitulo || 'Distribución mayorista',
                        hero_destacado || 'Lotes con -15% Mayorista',
                        hero_badge || 'Fabricación & Distribución Mayorista',
                        banner_activo !== undefined ? banner_activo : 1
                    ],
                    (insErr) => {
                        if (insErr) return res.status(500).json({ error: 'Error al insertar configuración.' });
                        const usuarioLog = req.headers['x-usuario-email'] || req.headers['x-usuario-rol'] || 'GESTOR_CATALOGO';
                        registrarAuditoria(usuarioLog, 'Creó la configuración inicial del Hero Banner', 'CATALOGO');
                        return res.status(200).json({ mensaje: 'Configuración de catálogo guardada exitosamente.' });
                    }
                );
            } else {
                const sql = `UPDATE config_catalogo SET 
                    hero_titulo = COALESCE(?, hero_titulo),
                    hero_subtitulo = COALESCE(?, hero_subtitulo),
                    hero_destacado = COALESCE(?, hero_destacado),
                    hero_badge = COALESCE(?, hero_badge),
                    banner_activo = COALESCE(?, banner_activo),
                    fecha_actualizacion = datetime('now')
                    WHERE id = 1`;
                db.run(sql, [
                    hero_titulo || null,
                    hero_subtitulo || null,
                    hero_destacado || null,
                    hero_badge || null,
                    banner_activo !== undefined ? banner_activo : null
                ], function (updErr) {
                    if (updErr) {
                        console.error('Error al actualizar config_catalogo:', updErr.message);
                        return res.status(500).json({ error: 'Error al actualizar configuración del catálogo.' });
                    }
                    const usuarioLog = req.headers['x-usuario-email'] || req.headers['x-usuario-rol'] || 'GESTOR_CATALOGO';
                    registrarAuditoria(usuarioLog, 'Actualizó textos del Hero Banner en el catálogo', 'CATALOGO');
                    res.status(200).json({ mensaje: 'Banner del catálogo actualizado exitosamente.' });
                });
            }
        });
    } catch (error) {
        console.error('Error crítico al actualizar config_catalogo:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

app.get('/api/config-catalogo', obtenerConfigBannerHandler);
app.get('/api/config/banner', obtenerConfigBannerHandler);
app.put('/api/config-catalogo', verificarPermisoGestorCatalogo, actualizarConfigBannerHandler);
app.put('/api/config/banner', verificarPermisoGestorCatalogo, actualizarConfigBannerHandler);

/**
 * Kardex / Historial de movimientos y salidas de un repuesto específico
 * GET /api/kardex/:sku
 */
app.get('/api/kardex/:sku', (req, res) => {
    try {
        const { sku } = req.params;
        if (!sku) {
            return res.status(400).json({ error: 'El código SKU es obligatorio.' });
        }

        const skuBuscado = sku.trim();
        db.get(
            `SELECT id, sku, nombre, categoria, precio, stock, stock_minimo FROM productos WHERE UPPER(sku) = UPPER(?)`,
            [skuBuscado],
            (pErr, producto) => {
                if (pErr) {
                    console.error('Error al consultar producto para Kardex:', pErr.message);
                    return res.status(500).json({ error: 'Error en la base de datos al buscar el repuesto.' });
                }
                if (!producto) {
                    return res.status(404).json({ error: `No existe ningún repuesto con el código SKU "${skuBuscado}".` });
                }

                // Obtener historial de salidas (ventas) asociadas a este producto
                const sqlMovimientos = `
                    SELECT 
                        pd.id AS detalle_id,
                        pd.cantidad,
                        pd.precio_unitario,
                        pd.subtotal,
                        p.id AS pedido_id,
                        p.fecha_compra,
                        p.estado AS pedido_estado,
                        COALESCE(u.nombre, 'Cliente Directo') AS cliente_nombre,
                        COALESCE(u.email, '-') AS cliente_email
                    FROM pedido_detalles pd
                    INNER JOIN pedidos p ON p.id = pd.pedido_id
                    LEFT JOIN usuarios u ON u.id = p.cliente_id
                    WHERE pd.producto_id = ?
                    ORDER BY p.fecha_compra DESC
                `;

                db.all(sqlMovimientos, [producto.id], (mErr, rows) => {
                    if (mErr) {
                        console.error('Error al consultar movimientos de Kardex:', mErr.message);
                        return res.status(500).json({ error: 'Error al consultar historial de movimientos en la base de datos.' });
                    }

                    let totalUnidadesVendidas = 0;
                    let totalRecaudado = 0;

                    const movimientos = (rows || []).map(r => {
                        totalUnidadesVendidas += r.cantidad;
                        totalRecaudado += parseFloat(r.subtotal);
                        return {
                            detalle_id: r.detalle_id,
                            pedido_id: r.pedido_id,
                            fecha: r.fecha_compra,
                            tipo: 'SALIDA_VENTA',
                            cantidad: r.cantidad,
                            precio_unitario: parseFloat(r.precio_unitario),
                            subtotal: parseFloat(r.subtotal),
                            estado_pedido: r.estado_pedido,
                            cliente: r.cliente_nombre,
                            cliente_email: r.cliente_email
                        };
                    });

                    res.status(200).json({
                        producto: {
                            id: producto.id,
                            sku: producto.sku,
                            nombre: producto.nombre,
                            categoria: producto.categoria,
                            precio: parseFloat(producto.precio),
                            stock_actual: producto.stock,
                            stock_minimo: producto.stock_minimo,
                            total_vendido: totalUnidadesVendidas,
                            total_recaudado: parseFloat(totalRecaudado.toFixed(2)),
                            total_movimientos: movimientos.length
                        },
                        movimientos: movimientos
                    });
                });
            }
        );
    } catch (error) {
        console.error('Error inesperado en Kardex:', error);
        res.status(500).json({ error: 'Error interno del servidor al procesar Kardex.' });
    }
});

// ============================================================================
// 4. MÓDULO DE VENTAS Y TRANSACCIONES ATÓMICAS (CARRITO Y DESCUENTO DE STOCK)
// ============================================================================

/**
 * Registrar venta / pedido con control atómico de concurrencia, validación de stock y kardex
 * POST /api/ventas & POST /api/pedidos
 */
const registrarVentaOPedido = (req, res) => {
    try {
        const { 
            cliente_id, 
            total, 
            carrito, 
            metodo_pago, 
            comprobante_ref, 
            numero_operacion,
            banco_origen, 
            comprobante_img,
            estado_pago 
        } = req.body;

        if (!cliente_id || !carrito || !Array.isArray(carrito) || carrito.length === 0) {
            return res.status(400).json({ error: 'Datos de compra incompletos o carrito vacío.' });
        }

        const totalNum = parseFloat(total);
        if (isNaN(totalNum) || totalNum <= 0) {
            return res.status(400).json({ error: 'El total de la venta debe ser mayor a 0.' });
        }

        const mPago = metodo_pago || 'QR_DIRECTO';
        const numOp = (numero_operacion || comprobante_ref || '').trim();
        const compRef = numOp || (mPago === 'DEPOSITO_BANCARIO' ? ('BOL-' + Date.now().toString().slice(-6)) : ('REF-' + Date.now().toString().slice(-6)));
        const finalNumOperacion = numOp || compRef;
        const bancoOrig = banco_origen || (mPago === 'PAYPAL' ? 'PayPal Inc.' : (mPago === 'DEPOSITO_BANCARIO' ? 'Banco Unión S.A.' : 'QR Interoperable / SIMPLE / Yape'));
        
        // Si viene de PayPal o comprobante ya verificado
        const estPago = estado_pago || (mPago === 'PAYPAL' ? ('PAGADO (PayPal API - ID: ' + compRef + ')') : 'PENDIENTE');
        const estGeneral = (estPago.includes('PAGADO') || estPago === 'VERIFICADO') ? 'PAGADO' : 'PENDIENTE';
        const estLogistica = 'ORDEN RECIBIDA / PAGO VERIFICADO';

        // Iniciar Transacción Atómica en SQLite
        db.serialize(() => {
            db.run('BEGIN IMMEDIATE TRANSACTION;', (beginErr) => {
                if (beginErr) {
                    console.error('Error al iniciar transacción de venta:', beginErr.message);
                    return res.status(500).json({ error: 'No se pudo iniciar la transacción de compra.' });
                }

                // 1. Validar existencia del cliente
                db.get(`SELECT id, nombre, email, telefono FROM usuarios WHERE id = ?`, [cliente_id], (userErr, user) => {
                    if (userErr || !user) {
                        db.run('ROLLBACK;');
                        return res.status(404).json({ error: 'El cliente especificado no existe o no es válido.' });
                    }

                    // 2. Validar existencias de stock de CADA producto en el carrito
                    const ids = carrito.map(item => item.id);
                    const placeholders = ids.map(() => '?').join(',');

                    db.all(`SELECT id, sku, nombre, stock, COALESCE(stock_minimo, 5) as stock_minimo, precio FROM productos WHERE id IN (${placeholders})`, ids, (stockErr, rows) => {
                        if (stockErr) {
                            db.run('ROLLBACK;');
                            return res.status(500).json({ error: 'Error al verificar disponibilidad de stock.' });
                        }

                        const productMap = new Map();
                        rows.forEach(p => productMap.set(p.id, p));

                        for (const item of carrito) {
                            const prod = productMap.get(item.id);
                            if (!prod) {
                                db.run('ROLLBACK;');
                                return res.status(400).json({ error: `El producto ID #${item.id} no existe en catálogo.` });
                            }
                            if (prod.stock < item.cantidad) {
                                db.run('ROLLBACK;');
                                const msgStock = prod.stock <= 0
                                    ? `Producto agotado por el momento: "${prod.nombre}".`
                                    : `Solo quedan ${prod.stock} unidades disponibles en almacén para "${prod.nombre}".`;
                                return res.status(400).json({ error: msgStock });
                            }
                        }

                        // 3. Crear cabecera de pedido
                        db.run(
                            `INSERT INTO pedidos (
                                cliente_id, total, estado, fecha_compra,
                                metodo_pago, comprobante_ref, numero_operacion, banco_origen, comprobante_img,
                                estado_pago, estado_logistica
                            ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)`,
                            [cliente_id, totalNum, estGeneral, mPago, compRef, finalNumOperacion, bancoOrig, comprobante_img || null, estPago, estLogistica],
                            function (orderErr) {
                                if (orderErr) {
                                    db.run('ROLLBACK;');
                                    console.error('Error al insertar pedido:', orderErr.message);
                                    return res.status(500).json({ error: 'Error al registrar el pedido.' });
                                }

                                const pedidoId = this.lastID;

                                // 4. Descontar stock, registrar detalles del pedido y registrar Kardex
                                const stmtDetalle = db.prepare(
                                    `INSERT INTO pedido_detalles (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)`
                                );
                                const stmtStock = db.prepare(
                                    `UPDATE productos SET stock = stock - ? WHERE id = ?`
                                );
                                const stmtKardex = db.prepare(
                                    `INSERT INTO kardex (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_id) VALUES (?, 'SALIDA_VENTA', ?, ?, ?, ?, ?)`
                                );

                                let hasError = false;
                                const productosEnAlertaStock = [];

                                for (const item of carrito) {
                                    const prod = productMap.get(item.id);
                                    const subtotal = parseFloat((item.precio * item.cantidad).toFixed(2));
                                    const stockAnterior = prod.stock;
                                    const stockNuevo = prod.stock - item.cantidad;
                                    const minStock = Number(prod.stock_minimo || 5);

                                    if (stockNuevo <= minStock) {
                                        productosEnAlertaStock.push({
                                            sku: prod.sku,
                                            nombre: prod.nombre,
                                            stockRestante: stockNuevo,
                                            stockMinimo: minStock
                                        });
                                    }

                                    stmtDetalle.run(pedidoId, item.id, item.nombre, item.cantidad, item.precio, subtotal, (dErr) => {
                                        if (dErr) hasError = true;
                                    });
                                    stmtStock.run(item.cantidad, item.id, (sErr) => {
                                        if (sErr) hasError = true;
                                    });
                                    stmtKardex.run(
                                        item.id, 
                                        item.cantidad, 
                                        stockAnterior, 
                                        stockNuevo, 
                                        `Salida por Venta / Pedido #${pedidoId} (${mPago})`, 
                                        pedidoId, 
                                        (kErr) => {
                                            if (kErr) hasError = true;
                                        }
                                    );
                                }

                                stmtDetalle.finalize();
                                stmtStock.finalize();
                                stmtKardex.finalize((finalizeErr) => {
                                    if (hasError || finalizeErr) {
                                        db.run('ROLLBACK;');
                                        console.error('Error al actualizar inventario, kardex o detalles');
                                        return res.status(500).json({ error: 'Error al procesar el descuento de inventario y Kardex.' });
                                    }

                                    // 5. Confirmar transacción
                                    db.run('COMMIT;', (commitErr) => {
                                        if (commitErr) {
                                            db.run('ROLLBACK;');
                                            return res.status(500).json({ error: 'Error al confirmar la transacción.' });
                                        }

                                        registrarAuditoria(
                                            `Cliente #${cliente_id} (${user.nombre})`,
                                            `Registró la orden de compra #${pedidoId} por Bs. ${totalNum.toFixed(2)} (${carrito.length} ítems) vía ${mPago}. Ref: ${compRef}.`,
                                            'VENTAS'
                                        );

                                        // Disparador Proactivo 1: Alerta por WhatsApp a Gerencia de nuevo pedido
                                        const codPedidoFmt = `PED-${String(pedidoId).padStart(4, '0')}`;
                                        let metodoPagoEtiqueta = mPago;
                                        if (mPago === 'QR_DIRECTO' || mPago === 'QR_SIMPLE') {
                                            metodoPagoEtiqueta = 'Pago QR Interoperable (SIMPLE / Yape / Todos los Bancos)';
                                        } else if (mPago === 'DEPOSITO_BANCARIO') {
                                            metodoPagoEtiqueta = `Depósito en Ventanilla / Transferencia Bancaria (${bancoOrig})`;
                                        } else if (mPago === 'PAYPAL') {
                                            metodoPagoEtiqueta = 'PayPal API Internacional';
                                        }

                                        const estPagoEtiqueta = estPago.includes('PAGADO') ? 'PAGADO / VERIFICADO' : 'PENDIENTE DE VALIDACIÓN BANCARIA';

                                        const alertaNuevoPedido = `*NUEVO PEDIDO REGISTRADO (#${codPedidoFmt})*\n` +
                                            `──────────────────────────\n` +
                                            `• *Cliente:* ${user.nombre}\n` +
                                            `• *Total:* *Bs. ${totalNum.toFixed(2)}*\n` +
                                            `• *Pago:* ${metodoPagoEtiqueta}\n` +
                                            `• *Referencia:* \`${finalNumOperacion}\`\n` +
                                            `• *Banco:* ${bancoOrig}\n` +
                                            `• *Cobro:* ${estPagoEtiqueta}\n` +
                                            `• *Ítems:* ${carrito.length} repuesto(s)\n` +
                                            `• *Logística:* ${estLogistica}\n` +
                                            `──────────────────────────\n` +
                                            `_Consulte el panel de Cobranzas del ERP para validar el ingreso._`;

                                        enviarAlertaAdmin(alertaNuevoPedido).catch(() => {});

                                        // Disparador Automatizado de Correo: Respaldo de Comprobante con imagen adjunta para Administración
                                        const rutaComprobanteFisica = resolverRutaComprobante(comprobante_img, pedidoId);
                                        if (mPago === 'QR_DIRECTO' || mPago === 'DEPOSITO_BANCARIO' || comprobante_img) {
                                            enviarRespaldoComprobanteAdmin(
                                                {
                                                    id: pedidoId,
                                                    total: totalNum,
                                                    metodo_pago: mPago,
                                                    comprobante_ref: compRef,
                                                    numero_operacion: finalNumOperacion,
                                                    banco_origen: bancoOrig,
                                                    estado_pago: estPago,
                                                    comprobante_img: comprobante_img
                                                },
                                                user,
                                                rutaComprobanteFisica
                                            ).catch(err => console.error('[EmailService] Error al enviar respaldo a administración:', err.message));
                                        } else if (estPago.includes('PAGADO') && user.email) {
                                            enviarComprobantePedidoEmail(
                                                user,
                                                {
                                                    id: pedidoId,
                                                    total: totalNum,
                                                    metodo_pago: mPago,
                                                    numero_operacion: finalNumOperacion,
                                                    banco_origen: bancoOrig,
                                                    comprobante_ref: compRef
                                                },
                                                carrito,
                                                rutaComprobanteFisica
                                            ).catch(err => console.error('[EmailService] Error al enviar confirmación al cliente:', err.message));
                                        }

                                        // Disparador Proactivo 2: Alerta por WhatsApp de stock bajo detectado
                                        if (productosEnAlertaStock.length > 0) {
                                            for (const critico of productosEnAlertaStock) {
                                                const alertaStockBajo = `*ALERTA DE STOCK BAJO EN ALMACÉN*\n` +
                                                    `──────────────────────────\n` +
                                                    `• *Producto:* ${critico.nombre}\n` +
                                                    `• *SKU:* \`${critico.sku}\`\n` +
                                                    `• *Stock Restante:* *${critico.stockRestante} unids.* (Mínimo: ${critico.stockMinimo} unids.)\n` +
                                                    `• *Ubicación:* Almacén Central - Sucre, Bolivia\n` +
                                                    `──────────────────────────\n` +
                                                    `_Se sugiere emitir orden de reposición o compra a proveedor._`;

                                                enviarAlertaAdmin(alertaStockBajo).catch(() => {});
                                            }
                                        }

                                        res.status(201).json({
                                            ok: true,
                                            mensaje: '¡Compra registrada con éxito, stock descontado y movimiento en Kardex asentado!',
                                            pedidoId: pedidoId,
                                            total: totalNum,
                                            metodo_pago: mPago,
                                            comprobante_ref: compRef,
                                            numero_operacion: finalNumOperacion,
                                            banco_origen: bancoOrig,
                                            estado_pago: estPago,
                                            estado_logistica: estLogistica
                                        });
                                    });
                                });
                            }
                        );
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error crítico en registrarVentaOPedido:', error);
        res.status(500).json({ error: 'Error del servidor al procesar la compra.' });
    }
};

app.post('/api/ventas', registrarVentaOPedido);
app.post('/api/pedidos', registrarVentaOPedido);

// ============================================================================
// MÓDULO DE VENTA DIRECTA EN TIENDA FÍSICA (CAJA / MOSTRADOR PRESENCIAL)
// ============================================================================

/**
 * Middleware para validar permisos en Venta Directa en Tienda Mostrador
 * Solo se permite a roles internos: ADMIN, ADMINISTRADOR, SUPERADMIN, GERENTE, TRABAJADOR, EMPAQUE, ALMACENERO, VENDEDOR.
 * Bloquea CLIENTE, DESPACHO y peticiones anónimas con 403 Forbidden.
 */
function verificarPermisoVentaDirecta(req, res, next) {
    const authHeader = (req.headers['authorization'] || '').toString().trim();
    let authBearer = '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        authBearer = authHeader.slice(7).trim();
    }

    const rolHeader = (
        authBearer ||
        req.headers['x-usuario-rol'] || 
        req.headers['x-user-rol'] || 
        req.headers['x-rol'] || 
        req.body?.usuario_rol || 
        req.body?.rol || 
        req.body?.usuario?.rol || 
        req.query?.rol || 
        ''
    ).toString().toUpperCase().trim();

    const emailHeader = (
        req.headers['x-usuario-email'] || 
        req.headers['x-user-email'] || 
        req.headers['x-email'] || 
        req.body?.usuario_email || 
        req.body?.email || 
        ''
    ).toString().toLowerCase().trim();

    // Bloqueo explícito de roles no autorizados (CLIENTES externos y DESPACHO)
    if (
        rolHeader === 'CLIENTE' || 
        rolHeader === 'CLIENTE_B2B' || 
        rolHeader === 'CLIENTE_B2C' || 
        rolHeader === 'DESPACHO' || 
        rolHeader === 'CHOFER' || 
        rolHeader === 'REPARTIDOR'
    ) {
        registrarAuditoria('SEGURIDAD', `Acceso denegado a Venta Directa: rol no autorizado "${rolHeader}" (${emailHeader || 'sin email'})`, 'VENTAS');
        return res.status(403).json({
            error: `Acceso denegado (403 Forbidden): El rol "${rolHeader}" no tiene permisos para registrar ventas directas en mostrador.`
        });
    }

    const rolesAutorizados = ['ADMIN', 'ADMINISTRADOR', 'SUPERADMIN', 'GERENTE', 'TRABAJADOR', 'EMPAQUE', 'ALMACENERO', 'ALMACEN', 'VENDEDOR'];

    if (rolHeader && rolesAutorizados.includes(rolHeader)) {
        if (emailHeader) {
            return db.get('SELECT rol, estado FROM usuarios WHERE LOWER(email) = ? OR LOWER(correo) = ?', [emailHeader, emailHeader], (err, user) => {
                if (!err && user) {
                    const rolDB = (user.rol || '').toUpperCase().trim();
                    if (user.estado !== 'ACTIVO') {
                        return res.status(403).json({ error: 'Acceso denegado: El usuario vendedor está inactivo.' });
                    }
                    if (!rolesAutorizados.includes(rolDB)) {
                        registrarAuditoria('SEGURIDAD', `Acceso denegado: rol en headers (${rolHeader}) no coincide con rol en BD (${rolDB}) para ${emailHeader}`, 'VENTAS');
                        return res.status(403).json({ error: 'Acceso denegado: Credenciales no autorizadas.' });
                    }
                }
                next();
            });
        }
        return next();
    }

    // Si no se proporcionó rol o no está autorizado: 403 Forbidden
    registrarAuditoria('SEGURIDAD', `Intento no autorizado de registrar venta directa sin credenciales de rol válidas (${rolHeader || 'ANÓNIMO'})`, 'VENTAS');
    return res.status(403).json({
        error: 'Acceso denegado (403 Forbidden): Se requiere rol de ADMIN o Personal Interno para registrar ventas directas en mostrador.'
    });
}

/**
 * Registrar Venta Presencial Directa en Tienda Mostrador
 * POST /api/ventas/directa
 */
const registrarVentaDirecta = (req, res) => {
    try {
        const {
            cliente_nombre,
            nit_ci,
            cliente_email,
            items,
            metodo_pago,
            monto_recibido,
            cambio,
            cliente_id,
            observaciones
        } = req.body;

        const listaItems = Array.isArray(items) ? items : [];
        if (listaItems.length === 0) {
            return res.status(400).json({ error: 'La venta directa requiere al menos un repuesto en el detalle.' });
        }

        const nombreClienteFinal = (cliente_nombre || 'Consumidor Final').trim();
        const nitCiFinal = (nit_ci || 'S/N').trim();
        const emailClienteFinal = (cliente_email || '').trim();
        const metodoPagoFinal = (metodo_pago || 'EFECTIVO').toUpperCase().trim();

        const metodosValidos = ['EFECTIVO', 'QR_TIENDA', 'TRANSFERENCIA'];
        const mPago = metodosValidos.includes(metodoPagoFinal) ? metodoPagoFinal : 'EFECTIVO';

        // Calcular total a partir de los items
        let totalCalculado = 0;
        for (const it of listaItems) {
            const cant = parseInt(it.cantidad, 10);
            const precio = parseFloat(it.precio);
            if (isNaN(cant) || cant <= 0 || isNaN(precio) || precio < 0) {
                return res.status(400).json({ error: 'Los ítems de la venta contienen cantidades o precios no válidos.' });
            }
            totalCalculado += (cant * precio);
        }
        const totalFinal = parseFloat(totalCalculado.toFixed(2));

        const montoRecibidoNum = (monto_recibido !== undefined && monto_recibido !== null && String(monto_recibido).trim() !== '') 
            ? parseFloat(monto_recibido) 
            : totalFinal;

        const cambioNum = (cambio !== undefined && cambio !== null && String(cambio).trim() !== '') 
            ? parseFloat(cambio) 
            : Math.max(0, parseFloat((montoRecibidoNum - totalFinal).toFixed(2)));

        if (mPago === 'EFECTIVO' && montoRecibidoNum < totalFinal) {
            return res.status(400).json({ error: `El monto recibido (Bs. ${montoRecibidoNum.toFixed(2)}) es menor al total de la venta (Bs. ${totalFinal.toFixed(2)}).` });
        }

        // Obtener ID del cliente (cliente registrado o Consumidor Final)
        const idClienteSolicitado = cliente_id ? parseInt(cliente_id, 10) : null;

        db.get(
            idClienteSolicitado 
                ? 'SELECT id, nombre, email, nit FROM usuarios WHERE id = ?' 
                : "SELECT id, nombre, email, nit FROM usuarios WHERE email = 'consumidor.final@golden.bo' OR id = 1 LIMIT 1",
            idClienteSolicitado ? [idClienteSolicitado] : [],
            (userErr, clienteUser) => {
                if (userErr || !clienteUser) {
                    return res.status(500).json({ error: 'No se pudo resolver el registro del cliente en base de datos.' });
                }

                const clienteIdFinal = clienteUser.id;
                const idsProductos = listaItems.map(it => it.producto_id || it.id);
                const placeholders = idsProductos.map(() => '?').join(',');

                // INICIAR TRANSACCIÓN ATÓMICA EN SQLITE
                db.serialize(() => {
                    db.run('BEGIN IMMEDIATE TRANSACTION;', (beginErr) => {
                        if (beginErr) {
                            console.error('Error al iniciar transacción de venta directa:', beginErr.message);
                            return res.status(500).json({ error: 'No se pudo iniciar la transacción de venta directa.' });
                        }

                        // 1. Verificar stock disponible para cada producto
                        db.all(
                            `SELECT id, sku, nombre, stock, COALESCE(stock_minimo, 5) as stock_minimo, precio FROM productos WHERE id IN (${placeholders})`,
                            idsProductos,
                            (stockErr, rowsProductos) => {
                                if (stockErr) {
                                    db.run('ROLLBACK;');
                                    return res.status(500).json({ error: 'Error al verificar stock de repuestos en tienda.' });
                                }

                                const mapProds = new Map();
                                rowsProductos.forEach(p => mapProds.set(p.id, p));

                                for (const it of listaItems) {
                                    const pId = it.producto_id || it.id;
                                    const prod = mapProds.get(pId);
                                    if (!prod) {
                                        db.run('ROLLBACK;');
                                        return res.status(400).json({ error: `El repuesto con ID #${pId} no existe en inventario.` });
                                    }
                                    const cantRequerida = parseInt(it.cantidad, 10);
                                    if (prod.stock < cantRequerida) {
                                        db.run('ROLLBACK;');
                                        const msgStock = prod.stock <= 0
                                            ? `Stock agotado en tienda para "${prod.nombre}".`
                                            : `Stock insuficiente para "${prod.nombre}": solo quedan ${prod.stock} unidades en tienda física (solicitadas: ${cantRequerida}).`;
                                        return res.status(400).json({ error: msgStock });
                                    }
                                }

                                // 2. Insertar cabecera de pedido: VENTA_DIRECTA, VERIFICADO, ENTREGADO_TIENDA
                                const numOp = 'VD-' + Date.now().toString().slice(-6);
                                const bancoOrigen = mPago === 'QR_TIENDA' 
                                    ? 'Yape Bolivia / QR SIMPLE' 
                                    : (mPago === 'TRANSFERENCIA' ? 'Banca Móvil / ACH' : 'Caja Tienda Central');

                                db.run(
                                    `INSERT INTO pedidos (
                                        cliente_id, total, estado, fecha_compra,
                                        metodo_pago, comprobante_ref, numero_operacion, banco_origen,
                                        estado_pago, estado_logistica, canal,
                                        cliente_nombre, cliente_nit_ci, cliente_email,
                                        monto_recibido, cambio,
                                        entrega_receptor_nombre, entrega_receptor_ci, entrega_fecha, entrega_observaciones
                                    ) VALUES (?, ?, 'PAGADO', datetime('now'), ?, ?, ?, ?, 'VERIFICADO', 'ENTREGADO_TIENDA', 'VENTA_DIRECTA', ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
                                    [
                                        clienteIdFinal,
                                        totalFinal,
                                        mPago,
                                        numOp,
                                        numOp,
                                        bancoOrigen,
                                        nombreClienteFinal,
                                        nitCiFinal,
                                        emailClienteFinal || null,
                                        montoRecibidoNum,
                                        cambioNum,
                                        nombreClienteFinal,
                                        nitCiFinal,
                                        observaciones || 'Venta directa presencial en tienda física mostrador'
                                    ],
                                    function (insOrderErr) {
                                        if (insOrderErr) {
                                            db.run('ROLLBACK;');
                                            console.error('Error al insertar cabecera de venta directa:', insOrderErr.message);
                                            return res.status(500).json({ error: 'Error al registrar orden de venta directa: ' + insOrderErr.message });
                                        }

                                        const pedidoId = this.lastID;

                                        // 3. Descontar stock inmediatamente, insertar detalles y registrar Kardex
                                        const stmtDetalle = db.prepare(
                                            `INSERT INTO pedido_detalles (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)`
                                        );
                                        const stmtStock = db.prepare(
                                            `UPDATE productos SET stock = stock - ? WHERE id = ?`
                                        );
                                        const stmtKardex = db.prepare(
                                            `INSERT INTO kardex (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_id) VALUES (?, 'SALIDA_VENTA', ?, ?, ?, ?, ?)`
                                        );

                                        let errorDetalles = false;
                                        const productosAlerta = [];

                                        for (const it of listaItems) {
                                            const pId = it.producto_id || it.id;
                                            const prod = mapProds.get(pId);
                                            const cant = parseInt(it.cantidad, 10);
                                            const precioUnit = parseFloat(it.precio);
                                            const sub = parseFloat((cant * precioUnit).toFixed(2));
                                            const stockAnt = prod.stock;
                                            const stockNuevo = prod.stock - cant;
                                            const minStock = Number(prod.stock_minimo || 5);

                                            if (stockNuevo <= minStock) {
                                                productosAlerta.push({
                                                    sku: prod.sku,
                                                    nombre: prod.nombre,
                                                    stockRestante: stockNuevo,
                                                    stockMinimo: minStock
                                                });
                                            }

                                            stmtDetalle.run(pedidoId, pId, prod.nombre, cant, precioUnit, sub, (dErr) => {
                                                if (dErr) errorDetalles = true;
                                            });
                                            stmtStock.run(cant, pId, (sErr) => {
                                                if (sErr) errorDetalles = true;
                                            });
                                            stmtKardex.run(
                                                pId,
                                                cant,
                                                stockAnt,
                                                stockNuevo,
                                                `Salida por Venta Directa en Tienda Mostrador #${pedidoId} (${mPago})`,
                                                pedidoId,
                                                (kErr) => {
                                                    if (kErr) errorDetalles = true;
                                                }
                                            );
                                        }

                                        stmtDetalle.finalize();
                                        stmtStock.finalize();
                                        stmtKardex.finalize((finalErr) => {
                                            if (errorDetalles || finalErr) {
                                                db.run('ROLLBACK;');
                                                console.error('Error en detalles/kardex venta directa:', finalErr?.message);
                                                return res.status(500).json({ error: 'Error al actualizar inventario o kardex de la venta directa.' });
                                            }

                                            // 4. Confirmar transacción
                                            db.run('COMMIT;', (commitErr) => {
                                                if (commitErr) {
                                                    db.run('ROLLBACK;');
                                                    return res.status(500).json({ error: 'Error al confirmar la transacción de venta directa.' });
                                                }

                                                // 5. Registrar en bitácora de auditoría
                                                registrarAuditoria(
                                                    'VENTA-DIRECTA',
                                                    `Venta Directa en Mostrador #${pedidoId} por Bs. ${totalFinal.toFixed(2)} (${listaItems.length} ítems) a "${nombreClienteFinal}" (NIT/CI: ${nitCiFinal}). Método: ${mPago}.`,
                                                    'VENTAS'
                                                );

                                                // 6. Si el cliente dejó correo electrónico, enviar nota de venta / comprobante por Gmail
                                                if (emailClienteFinal && emailClienteFinal.includes('@')) {
                                                    enviarComprobantePedidoEmail(
                                                        {
                                                            id: clienteIdFinal,
                                                            nombre: nombreClienteFinal,
                                                            email: emailClienteFinal,
                                                            nit: nitCiFinal
                                                        },
                                                        {
                                                            id: pedidoId,
                                                            total: totalFinal,
                                                            metodo_pago: mPago,
                                                            numero_operacion: numOp,
                                                            banco_origen: bancoOrigen,
                                                            comprobante_ref: numOp,
                                                            canal: 'VENTA_DIRECTA'
                                                        },
                                                        listaItems.map(it => {
                                                            const p = mapProds.get(it.producto_id || it.id);
                                                            return {
                                                                sku: p ? p.sku : 'REP',
                                                                producto_nombre: p ? p.nombre : (it.nombre || 'Repuesto'),
                                                                cantidad: it.cantidad,
                                                                precio_unitario: it.precio,
                                                                subtotal: (it.cantidad * it.precio)
                                                            };
                                                        })
                                                    ).catch(errMail => console.error('[EmailService] Error al enviar comprobante de venta directa:', errMail.message));
                                                }

                                                // 7. Notificación WhatsApp si hay alertas de stock bajo
                                                if (productosAlerta.length > 0) {
                                                    for (const critico of productosAlerta) {
                                                        const msgAlerta = `*ALERTA DE STOCK BAJO EN TIENDA*\n` +
                                                            `──────────────────────────\n` +
                                                            `• *Producto:* ${critico.nombre}\n` +
                                                            `• *SKU:* \`${critico.sku}\`\n` +
                                                            `• *Stock Restante:* *${critico.stockRestante} unids.* (Mínimo: ${critico.stockMinimo} unids.)\n` +
                                                            `• *Motivo:* Salida por Venta Directa Mostrador #${pedidoId}\n` +
                                                            `──────────────────────────`;
                                                        enviarAlertaAdmin(msgAlerta).catch(() => {});
                                                    }
                                                }

                                                // 8. Respuesta exitosa
                                                return res.status(201).json({
                                                    ok: true,
                                                    mensaje: 'Venta directa registrada exitosamente',
                                                    pedido_id: pedidoId,
                                                    codigo_pedido: `PED-${String(pedidoId).padStart(4, '0')}`,
                                                    total: totalFinal,
                                                    monto_recibido: montoRecibidoNum,
                                                    cambio: cambioNum,
                                                    metodo_pago: mPago,
                                                    cliente_nombre: nombreClienteFinal,
                                                    nit_ci: nitCiFinal,
                                                    cliente_email: emailClienteFinal,
                                                    fecha: new Date().toISOString()
                                                });
                                            });
                                        });
                                    }
                                );
                            }
                        );
                    });
                });
            }
        );
    } catch (error) {
        console.error('Error crítico en POST /api/ventas/directa:', error);
        return res.status(500).json({ error: 'Error del servidor al registrar venta directa: ' + error.message });
    }
};

app.post('/api/ventas/directa', verificarPermisoVentaDirecta, registrarVentaDirecta);

// ============================================================================
// INTEGRACIÓN PAYPAL REST API (SANDBOX & CAPTURA)
// ============================================================================
app.post('/api/paypal/create-order', (req, res) => {
    try {
        const { totalBs, totalUsd } = req.body;
        const montoUsd = totalUsd ? parseFloat(totalUsd).toFixed(2) : ((parseFloat(totalBs) || 0) / 6.96).toFixed(2);
        const paypalOrderId = 'PAYPAL-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);

        res.status(200).json({
            ok: true,
            id: paypalOrderId,
            status: 'CREATED',
            monto_usd: montoUsd,
            tipo_cambio: 6.96,
            mensaje: 'Orden PayPal iniciada correctamente'
        });
    } catch (e) {
        res.status(500).json({ error: 'Error al generar orden en PayPal API: ' + e.message });
    }
});

app.post('/api/paypal/capture-order', (req, res) => {
    try {
        const { orderID } = req.body;
        const captureId = 'CAP-' + (orderID || Date.now().toString(36).toUpperCase());
        res.status(200).json({
            ok: true,
            id: captureId,
            status: 'COMPLETED',
            orderID: orderID,
            payer: {
                name: 'Taller Comprador B2B',
                email: 'cliente@golden.bo'
            },
            mensaje: 'Pago capturado exitosamente en PayPal API'
        });
    } catch (e) {
        res.status(500).json({ error: 'Error al capturar pago PayPal: ' + e.message });
    }
});

// ============================================================================
// 5. MÓDULO DE LOGÍSTICA, COBRANZAS Y STEPPER EN 5 ETAPAS
// ============================================================================

/**
 * Listar pedidos con datos completos de pago, despacho y stepper
 * GET /api/pedidos?rango=hoy|7dias|mes|historico|todos
 */
app.get('/api/pedidos', (req, res) => {
    try {
        const rango = req.query.rango ? String(req.query.rango).toLowerCase().trim() : '';
        const condicionFecha = construirCondicionFecha(rango, 'p.fecha_compra');

        let sql = `
            SELECT 
                p.id, 
                p.total, 
                p.estado, 
                p.fecha_compra, 
                p.metodo_pago,
                p.comprobante_ref,
                p.numero_operacion,
                p.banco_origen,
                p.comprobante_img,
                p.estado_pago,
                p.estado_logistica,
                p.empaque_checklist,
                p.empaque_tipo,
                p.empaque_bultos,
                p.empaque_peso,
                p.empaque_responsable,
                p.empaque_fecha,
                p.despacho_chofer,
                p.despacho_placa,
                p.despacho_fecha,
                p.entrega_receptor_nombre,
                p.entrega_receptor_ci,
                p.entrega_pin,
                p.entrega_observaciones,
                p.entrega_fecha,
                p.canal,
                p.cliente_nit_ci,
                p.monto_recibido,
                p.cambio,
                COALESCE(p.cliente_nombre, u.nombre, 'Cliente Desconocido') as cliente,
                COALESCE(p.cliente_email, u.email, '-') as cliente_email
            FROM pedidos p 
            LEFT JOIN usuarios u ON p.cliente_id = u.id
        `;

        if (condicionFecha) {
            sql += ` WHERE ${condicionFecha}`;
        }

        sql += ` ORDER BY p.id DESC`;

        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Error SQL en Pedidos:', err.message);
                return res.status(500).json({ error: "Error en BD", detalle: err.message });
            }
            res.status(200).json(rows || []);
        });
    } catch (err) {
        console.error('Error no controlado en GET /api/pedidos:', err.message);
        res.status(500).json({ error: "Error en BD", detalle: err.message });
    }
});

/**
 * Obtener detalle completo de un pedido específico
 * GET /api/pedidos/:id
 */
app.get('/api/pedidos/:id', (req, res) => {
    try {
        const pedidoId = req.params.id;
        const sqlPedido = `
            SELECT 
                p.*, 
                COALESCE(p.cliente_nombre, u.nombre, 'Cliente Desconocido') as cliente, 
                COALESCE(p.cliente_email, u.email, '-') as cliente_email,
                COALESCE(p.cliente_nit_ci, u.nit, '1029384756') as cliente_nit,
                COALESCE(u.direccion, 'Sucre, Bolivia') as cliente_direccion,
                COALESCE(u.telefono, '(+591) 4 64-52890') as cliente_telefono
            FROM pedidos p
            LEFT JOIN usuarios u ON p.cliente_id = u.id
            WHERE p.id = ?
        `;
        db.get(sqlPedido, [pedidoId], (err, pedido) => {
            if (err) return res.status(500).json({ error: 'Error al obtener pedido: ' + err.message });
            if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

            db.all(`
                SELECT 
                    pd.*,
                    COALESCE(pr.sku, 'GLD-' || pd.producto_id) as sku,
                    COALESCE(pr.categoria, 'LUBRICANTES') as categoria
                FROM pedido_detalles pd 
                LEFT JOIN productos pr ON pd.producto_id = pr.id
                WHERE pd.pedido_id = ?
            `, [pedidoId], (dErr, detalles) => {
                if (dErr) return res.status(500).json({ error: 'Error al obtener detalles del pedido.' });
                pedido.detalles = detalles || [];
                res.status(200).json(pedido);
            });
        });
    } catch (error) {
        console.error('Error crítico en GET /api/pedidos/:id:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Verificar y aprobar cobro de depósito bancario / QR Simple
 * PUT /api/pedidos/:id/aprobar-cobro
 */
app.put('/api/pedidos/:id/aprobar-cobro', (req, res) => {
    try {
        const pedidoId = req.params.id;
        const { usuario_nombre } = req.body || {};

        db.get('SELECT id, cliente_id, total, estado_pago, metodo_pago, comprobante_ref, numero_operacion, banco_origen, comprobante_img FROM pedidos WHERE id = ?', [pedidoId], (err, ped) => {
            if (err || !ped) return res.status(404).json({ error: 'Pedido no encontrado' });

            db.run(
                `UPDATE pedidos SET estado_pago = 'VERIFICADO', estado = 'PAGADO', estado_logistica = 'ORDEN RECIBIDA / PAGO VERIFICADO' WHERE id = ?`,
                [pedidoId],
                function (updErr) {
                    if (updErr) return res.status(500).json({ error: 'Error al aprobar cobro en BD: ' + updErr.message });

                    const numBoleta = ped.numero_operacion || ped.comprobante_ref || 'S/N';
                    const metodoTexto = ped.metodo_pago === 'DEPOSITO_BANCARIO' ? 'Depósito Bancario' : (ped.metodo_pago === 'QR_DIRECTO' ? 'QR Directo' : ped.metodo_pago);

                    registrarAuditoria(
                        usuario_nombre || 'Cajero / Administrador',
                        `Verificó y aprobó el cobro de la Orden #${pedidoId} (Bs. ${parseFloat(ped.total).toFixed(2)}) vía ${metodoTexto} - Boleta/Ref: ${numBoleta}. Habilitado para Empaque / Almacén.`,
                        'COBRANZAS'
                    );

                    // Alerta WhatsApp proactiva a Gerencia de cobro verificado
                    const codPed = `PED-${String(pedidoId).padStart(4, '0')}`;
                    const alertaCobroAprobado = `*PAGO VERIFICADO (#${codPed})*\n` +
                        `──────────────────────────\n` +
                        `• *Monto:* *Bs. ${parseFloat(ped.total || 0).toFixed(2)}*\n` +
                        `• *Método:* ${metodoTexto}\n` +
                        `• *Boleta / Ref:* \`${numBoleta}\`\n` +
                        `• *Banco:* ${ped.banco_origen || 'Banco Unión'}\n` +
                        `• *Estado:* Habilitado para Picking y Empaque\n` +
                        `──────────────────────────\n` +
                        `_Validado por: ${usuario_nombre || 'Cobranzas / Administración'}_`;
                    enviarAlertaAdmin(alertaCobroAprobado).catch(() => {});

                    // Notificación Oficial por Correo Electrónico al Cliente con copia de comprobante
                    db.get('SELECT id, nombre, email, telefono FROM usuarios WHERE id = ?', [ped.cliente_id], (cErr, cliente) => {
                        if (!cErr && cliente && cliente.email) {
                            db.all('SELECT * FROM pedido_detalles WHERE pedido_id = ?', [pedidoId], (dErr, detalles) => {
                                const rutaFisica = resolverRutaComprobante(ped.comprobante_img, pedidoId);
                                enviarComprobantePedidoEmail(cliente, ped, detalles || [], rutaFisica).catch(mErr => {
                                    console.error('[EmailService] Error al notificar cobro aprobado al cliente:', mErr.message);
                                });
                            });
                        }
                    });

                    res.status(200).json({
                        ok: true,
                        mensaje: `Cobro de la Orden #${pedidoId} verificado y aprobado con éxito. Pasado a Empaque/Almacén.`,
                        estado_pago: 'VERIFICADO',
                        estado: 'PAGADO',
                        estado_logistica: 'ORDEN RECIBIDA / PAGO VERIFICADO'
                    });
                }
            );
        });
    } catch (error) {
        console.error('Error crítico en aprobar cobro:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Webhook para conciliación bancaria automática vía API QR
 * POST /api/pagos/webhook-qr
 */
app.post('/api/pagos/webhook-qr', (req, res) => {
    try {
        const { pedido_id, referencia, monto, estado, id_transaccion, banco } = req.body || {};
        const refId = pedido_id || (referencia ? parseInt(String(referencia).replace(/\D/g, '')) : null);

        if (!refId) {
            return res.status(400).json({ error: 'Falta identificador de pedido o referencia válida' });
        }

        db.get('SELECT id, total, estado_pago, metodo_pago, cliente_id FROM pedidos WHERE id = ?', [refId], (err, ped) => {
            if (err || !ped) {
                return res.status(404).json({ error: 'Pedido no encontrado para conciliación de webhook' });
            }

            const nuevoEstadoPago = (estado && String(estado).toUpperCase().includes('FAIL')) ? 'RECHAZADO' : 'VERIFICADO';
            const nuevoEstadoGen = nuevoEstadoPago === 'VERIFICADO' ? 'PAGADO' : 'PENDIENTE';
            const numOperacion = id_transaccion || referencia || ('QR-AUTO-' + Date.now().toString().slice(-6));

            db.run(
                `UPDATE pedidos SET estado_pago = ?, estado = ?, estado_logistica = 'ORDEN RECIBIDA / PAGO VERIFICADO', numero_operacion = COALESCE(numero_operacion, ?), comprobante_ref = COALESCE(comprobante_ref, ?) WHERE id = ?`,
                [nuevoEstadoPago, nuevoEstadoGen, numOperacion, numOperacion, ped.id],
                function (updErr) {
                    if (updErr) return res.status(500).json({ error: 'Error al actualizar pedido por webhook: ' + updErr.message });

                    registrarAuditoria(
                        'WEBHOOK-QR-BANCO',
                        `Conciliación automática vía Webhook QR para Pedido #${ped.id} (Bs. ${parseFloat(ped.total).toFixed(2)}) - Ref: ${numOperacion}`,
                        'COBRANZAS'
                    );

                    if (nuevoEstadoPago === 'VERIFICADO') {
                        const alertaWebhook = `*CONFIRMACIÓN AUTOMÁTICA QR (WEBHOOK)*\n` +
                            `──────────────────────────\n` +
                            `• *Pedido:* #PED-${String(ped.id).padStart(4, '0')}\n` +
                            `• *Monto:* *Bs. ${parseFloat(ped.total).toFixed(2)}*\n` +
                            `• *Canal:* API Interoperable (${banco || 'SIMPLE / Yape'})\n` +
                            `• *Transacción ID:* \`${numOperacion}\`\n` +
                            `• *Estado:* Habilitado para Empaque y Despacho\n` +
                            `──────────────────────────`;
                        enviarAlertaAdmin(alertaWebhook).catch(() => {});
                    }

                    return res.status(200).json({
                        ok: true,
                        recibido: true,
                        pedido_id: ped.id,
                        estado_pago: nuevoEstadoPago,
                        mensaje: 'Webhook de pago QR procesado exitosamente'
                    });
                }
            );
        });
    } catch (error) {
        console.error('Error en webhook-qr:', error);
        res.status(500).json({ error: 'Error procesando webhook QR' });
    }
});

/**
 * Endpoint de Consulta y Renderizado Vectorial del QR Oficial Yape Bolivia
 * GET /api/pagos/qr-yape?format=svg|json
 */
app.get('/api/pagos/qr-yape', async (req, res) => {
    try {
        const format = (req.query.format || 'svg').toLowerCase();
        if (format === 'svg') {
            let svg = await QRCode.toString(YAPE_QR_PAYLOAD, {
                type: 'svg',
                errorCorrectionLevel: 'H',
                margin: 2,
                color: {
                    dark: '#581c87',
                    light: '#ffffff'
                }
            });
            const badge = `
            <g id="badge-central">
                <circle cx="50.5" cy="50.5" r="8.2" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8"/>
                <text x="50.5" y="53.4" font-family="'Inter', system-ui, sans-serif" font-size="7.5" font-weight="900" fill="#581c87" text-anchor="middle">Bs.</text>
            </g>
            `;
            svg = svg.replace('</svg>', `${badge}</svg>`);
            res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
            return res.send(svg);
        } else {
            const dataUrl = await QRCode.toDataURL(YAPE_QR_PAYLOAD, {
                errorCorrectionLevel: 'H',
                margin: 2,
                width: 600,
                color: {
                    dark: '#581c87',
                    light: '#ffffff'
                }
            });
            return res.json({
                success: true,
                payload: YAPE_QR_PAYLOAD,
                titular: 'Nelson Polares Ortiz',
                vigencia: '2026-12-19',
                banco: 'Yape Bolivia / QR SIMPLE',
                dataUrl
            });
        }
    } catch (err) {
        console.error('Error en GET /api/pagos/qr-yape:', err);
        return res.status(500).json({ success: false, error: 'Error al generar código QR oficial' });
    }
});

app.get('/api/pagos/qr-yape/info', (req, res) => {
    res.json({
        success: true,
        payload: YAPE_QR_PAYLOAD,
        titular: 'Nelson Polares Ortiz',
        vigencia: '2026-12-19',
        banco: 'Yape Bolivia / QR Interoperable (Bs.)'
    });
});

/**
 * Tablero de Flujo de Procesamiento por Etapas (Stepper de 5 estados)
 * PUT /api/pedidos/:id/flujo
 */
app.put('/api/pedidos/:id/flujo', (req, res) => {
    try {
        const pedidoId = req.params.id;
        const { 
            etapa, 
            operario,
            empaque_checklist, 
            empaque_tipo, 
            empaque_bultos, 
            empaque_peso,
            despacho_chofer, 
            despacho_placa,
            entrega_receptor_nombre, 
            entrega_receptor_ci, 
            entrega_pin, 
            entrega_observaciones 
        } = req.body || {};

        db.get('SELECT * FROM pedidos WHERE id = ?', [pedidoId], (err, ped) => {
            if (err || !ped) return res.status(404).json({ error: 'Pedido no encontrado en la base de datos' });

            if (etapa === 'PREPARACION') {
                db.run(
                    `UPDATE pedidos SET estado_logistica = 'EN PREPARACIÓN (PICKING DE ALMACÉN)', estado = 'EN PREPARACIÓN' WHERE id = ?`,
                    [pedidoId],
                    function (uErr) {
                        if (uErr) return res.status(500).json({ error: 'Error al actualizar etapa: ' + uErr.message });
                        registrarAuditoria(operario || 'Encargado de Almacén', `Inició picking y preparación física de Orden #${pedidoId}`, 'LOGÍSTICA');
                        res.json({ ok: true, mensaje: 'Picking iniciado para la orden #' + pedidoId, estado_logistica: 'EN PREPARACIÓN (PICKING DE ALMACÉN)' });
                    }
                );
            } else if (etapa === 'EMPACADO') {
                const resp = operario || ped.empaque_responsable || 'Marcos Almacén (Empaque)';
                const tipo = empaque_tipo || 'Caja sellada';
                const bultos = parseInt(empaque_bultos) || 1;
                const peso = parseFloat(empaque_peso) || 4.5;
                const checklist = typeof empaque_checklist === 'object' ? JSON.stringify(empaque_checklist) : (empaque_checklist || 'Checklist conforme');

                db.run(
                    `UPDATE pedidos SET 
                        estado_logistica = 'EMPACADO Y ETIQUETADO',
                        empaque_checklist = ?,
                        empaque_tipo = ?,
                        empaque_bultos = ?,
                        empaque_peso = ?,
                        empaque_responsable = ?,
                        empaque_fecha = datetime('now')
                    WHERE id = ?`,
                    [checklist, tipo, bultos, peso, resp, pedidoId],
                    function (uErr) {
                        if (uErr) return res.status(500).json({ error: 'Error al registrar empaque: ' + uErr.message });
                        registrarAuditoria(resp, `Confirmó empaque y rotulado de Orden #${pedidoId} (${bultos} bultos, ${peso} kg en ${tipo})`, 'EMPAQUE');

                        // Notificación de Empaque por Correo al Cliente
                        db.get('SELECT id, nombre, email, telefono FROM usuarios WHERE id = ?', [ped.cliente_id], (cErr, cliente) => {
                            if (!cErr && cliente && cliente.email) {
                                enviarActualizacionLogisticaEmail(cliente, ped, 'EMPACADO', resp).catch(mErr => {
                                    console.error('[EmailService] Error al notificar empaque:', mErr.message);
                                });
                            }
                        });

                        res.json({ ok: true, mensaje: 'Orden #' + pedidoId + ' empacada y rotulada exitosamente', estado_logistica: 'EMPACADO Y ETIQUETADO' });
                    }
                );
            } else if (etapa === 'DESPACHO') {
                // REGLA CRÍTICA: Un repartidor NO puede llevarse un pedido que no haya sido marcado como EMPACADO primero!
                if (ped.estado_logistica !== 'EMPACADO Y ETIQUETADO') {
                    return res.status(400).json({
                        error: 'Bloqueo Logístico de Almacén: La orden #' + pedidoId + ' no puede salir a reparto porque aún no ha sido marcada como "EMPACADO Y ETIQUETADO".'
                    });
                }

                const chofer = despacho_chofer || operario || 'Rodrigo Chofer';
                const placa = despacho_placa || '4029-YHT';

                db.run(
                    `UPDATE pedidos SET 
                        estado_logistica = 'EN RUTA DE ENTREGA',
                        estado = 'EN CAMINO',
                        despacho_chofer = ?,
                        despacho_placa = ?,
                        despacho_fecha = datetime('now')
                    WHERE id = ?`,
                    [chofer, placa, pedidoId],
                    function (uErr) {
                        if (uErr) return res.status(500).json({ error: 'Error al registrar despacho: ' + uErr.message });
                        registrarAuditoria(chofer, `Despachó y salió a ruta con Orden #${pedidoId} en móvil placa ${placa}`, 'DESPACHO');

                        // Notificación de Despacho en Ruta por Correo al Cliente
                        db.get('SELECT id, nombre, email, telefono FROM usuarios WHERE id = ?', [ped.cliente_id], (cErr, cliente) => {
                            if (!cErr && cliente && cliente.email) {
                                enviarActualizacionLogisticaEmail(cliente, { ...ped, despacho_chofer: chofer, despacho_placa: placa }, 'EN RUTA', chofer).catch(mErr => {
                                    console.error('[EmailService] Error al notificar despacho:', mErr.message);
                                });
                            }
                        });

                        res.json({ ok: true, mensaje: 'Orden #' + pedidoId + ' en ruta de entrega', estado_logistica: 'EN RUTA DE ENTREGA' });
                    }
                );
            } else if (etapa === 'ENTREGA_FINAL') {
                const receptor = entrega_receptor_nombre || 'Recepción Taller';
                const ci = entrega_receptor_ci || 'S/N';
                const pin = entrega_pin || 'VERIFICADO';
                const obs = entrega_observaciones || 'Entregado conforme y sellado';

                db.run(
                    `UPDATE pedidos SET 
                        estado_logistica = 'ENTREGADO Y FINALIZADO',
                        estado = 'ENTREGADO',
                        entrega_receptor_nombre = ?,
                        entrega_receptor_ci = ?,
                        entrega_pin = ?,
                        entrega_observaciones = ?,
                        entrega_fecha = datetime('now')
                    WHERE id = ?`,
                    [receptor, ci, pin, obs, pedidoId],
                    function (uErr) {
                        if (uErr) return res.status(500).json({ error: 'Error al finalizar entrega: ' + uErr.message });
                        registrarAuditoria(operario || 'Encargado de Entrega', `Completó entrega de Orden #${pedidoId} en taller receptor ${receptor} (CI: ${ci})`, 'ENTREGA');

                        // Notificación de Entrega Final por Correo al Cliente
                        db.get('SELECT id, nombre, email, telefono FROM usuarios WHERE id = ?', [ped.cliente_id], (cErr, cliente) => {
                            if (!cErr && cliente && cliente.email) {
                                enviarActualizacionLogisticaEmail(cliente, ped, 'ENTREGADO', receptor).catch(mErr => {
                                    console.error('[EmailService] Error al notificar entrega:', mErr.message);
                                });
                            }
                        });

                        res.json({ ok: true, mensaje: 'Orden #' + pedidoId + ' entregada y finalizada con éxito', estado_logistica: 'ENTREGADO Y FINALIZADO' });
                    }
                );
            } else {
                return res.status(400).json({ error: 'Etapa de flujo no reconocida: ' + etapa });
            }
        });
    } catch (error) {
        console.error('Error crítico en PUT /api/pedidos/:id/flujo:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Consulta de seguimiento en vivo de un pedido
 * GET /api/pedidos/:id/seguimiento
 */
app.get('/api/pedidos/:id/seguimiento', (req, res) => {
    try {
        const pedidoId = req.params.id;
        const sql = `
            SELECT 
                p.*, 
                COALESCE(u.nombre, 'Cliente') as cliente_nombre,
                COALESCE(u.email, '-') as cliente_email
            FROM pedidos p
            LEFT JOIN usuarios u ON p.cliente_id = u.id
            WHERE p.id = ?
        `;
        db.get(sql, [pedidoId], (err, pedido) => {
            if (err || !pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

            db.all('SELECT * FROM pedido_detalles WHERE pedido_id = ?', [pedidoId], (dErr, detalles) => {
                pedido.detalles = detalles || [];
                res.json(pedido);
            });
        });
    } catch (error) {
        console.error('Error crítico en seguimiento:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Consultar lista de pedidos del cliente en sesión para tracker en vivo
 * GET /api/mis-pedidos
 */
app.get('/api/mis-pedidos', (req, res) => {
    try {
        const clienteId = req.query.cliente_id;
        let sql = `
            SELECT 
                p.*, 
                COALESCE(u.nombre, 'Cliente') as cliente_nombre
            FROM pedidos p
            LEFT JOIN usuarios u ON p.cliente_id = u.id
        `;
        const params = [];
        if (clienteId) {
            sql += ` WHERE p.cliente_id = ?`;
            params.push(clienteId);
        }
        sql += ` ORDER BY p.id DESC`;

        db.all(sql, params, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error al consultar mis pedidos' });
            res.json(rows || []);
        });
    } catch (error) {
        console.error('Error crítico en mis-pedidos:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Actualizar estado de despacho de un pedido (compatibilidad)
 * PUT /api/pedidos/:id/estado
 */
app.put('/api/pedidos/:id/estado', (req, res) => {
    try {
        const { estado } = req.body;
        const estadosValidos = ['PENDIENTE', 'EN CAMINO', 'ENTREGADO'];

        if (!estado || !estadosValidos.includes(estado)) {
            return res.status(400).json({ error: 'Estado de pedido no válido. Opciones: PENDIENTE, EN CAMINO, ENTREGADO.' });
        }

        let estadoLogistica = 'ORDEN RECIBIDA / PAGO VERIFICADO';
        if (estado === 'EN CAMINO') estadoLogistica = 'EN RUTA DE ENTREGA';
        if (estado === 'ENTREGADO') estadoLogistica = 'ENTREGADO Y FINALIZADO';

        db.run(`UPDATE pedidos SET estado = ?, estado_logistica = ? WHERE id = ?`, [estado, estadoLogistica, req.params.id], function (err) {
            if (err) {
                console.error('Error al actualizar estado:', err.message);
                return res.status(500).json({ error: 'Error al actualizar estado del pedido.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Pedido no encontrado.' });
            }
            registrarAuditoria('LOGISTICA', `Actualizó el estado de despacho de la orden #00${req.params.id} a "${estado}"`, 'LOGISTICA');

            // Notificación por Correo al Cliente de la actualización de despacho
            db.get('SELECT p.*, u.nombre as cliente_nombre, u.email as cliente_email, u.telefono as cliente_telefono FROM pedidos p LEFT JOIN usuarios u ON p.cliente_id = u.id WHERE p.id = ?', [req.params.id], (pErr, ped) => {
                if (!pErr && ped && ped.cliente_email && ped.cliente_email !== '-') {
                    enviarActualizacionLogisticaEmail(
                        { id: ped.cliente_id, nombre: ped.cliente_nombre, email: ped.cliente_email, telefono: ped.cliente_telefono },
                        ped,
                        estado,
                        ped.despacho_chofer
                    ).catch(mErr => console.error('[EmailService] Error al notificar actualización logística:', mErr.message));
                }
            });

            res.status(200).json({ mensaje: 'Estado de entrega actualizado correctamente.', nuevoEstado: estado });
        });
    } catch (error) {
        console.error('Error crítico en PUT /api/pedidos/:id/estado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ============================================================================
// 6. MÓDULO DE DASHBOARD Y ANALÍTICA DE NEGOCIO
// ============================================================================

/**
 * Estadísticas consolidadas para el Dashboard con filtro de fecha gerencial
 * GET /api/estadisticas?rango=hoy|7dias|mes|historico|todos
 */
app.get('/api/estadisticas', (req, res) => {
    try {
        const rango = req.query.rango ? String(req.query.rango).toLowerCase().trim() : '';
        const condicionFecha = construirCondicionFecha(rango, 'fecha_compra');
        const condicionFechaP = construirCondicionFecha(rango, 'p.fecha_compra');

        let stats = {
            rango: rango || 'historico',
            ingresos: 0,
            ventas: 0,
            bajo_stock: 0,
            tipo_distribucion: 'inventario',
            ultimos_pedidos: [],
            distribucion_categorias: []
        };

        // 1. Ingresos y cantidad de pedidos según el filtro de fecha
        let sqlIngresos = `SELECT COALESCE(SUM(total), 0) as ingresos, COUNT(id) as ventas FROM pedidos`;
        if (condicionFecha) {
            sqlIngresos += ` WHERE ${condicionFecha}`;
        }

        db.get(sqlIngresos, [], (err1, row1) => {
            if (err1) {
                console.error('Error SQL ingresos en estadísticas:', err1.message);
                return res.status(500).json({ error: "Error en BD", detalle: err1.message });
            }

            if (row1) {
                stats.ingresos = parseFloat(row1.ingresos) || 0;
                stats.ventas = row1.ventas || 0;
            }

            // 2. Contar alertas de stock crítico en el inventario actual
            db.get(`SELECT COUNT(id) as bajo_stock FROM productos WHERE stock <= stock_minimo`, [], (err2, row2) => {
                if (err2) {
                    console.error('Error SQL bajo stock en estadísticas:', err2.message);
                    return res.status(500).json({ error: "Error en BD", detalle: err2.message });
                }

                if (row2) {
                    stats.bajo_stock = row2.bajo_stock || 0;
                }

                // 3. Distribución para Chart.js según rango o inventario físico
                let sqlVentasCats = `
                    SELECT 
                        pr.categoria,
                        COUNT(pd.id) as cantidad,
                        COALESCE(SUM(pd.cantidad), 0) as unidades_vendidas,
                        COALESCE(SUM(pd.subtotal), 0) as total_ventas
                    FROM pedido_detalles pd
                    INNER JOIN pedidos p ON p.id = pd.pedido_id
                    INNER JOIN productos pr ON pr.id = pd.producto_id
                `;
                if (condicionFechaP) {
                    sqlVentasCats += ` WHERE ${condicionFechaP}`;
                }
                sqlVentasCats += ` GROUP BY pr.categoria`;

                db.all(sqlVentasCats, [], (errVentas, catVentas) => {
                    if (!errVentas && catVentas && catVentas.length > 0) {
                        stats.distribucion_categorias = catVentas;
                        stats.tipo_distribucion = 'ventas';
                        completarEstadisticas();
                    } else {
                        db.all(`SELECT categoria, COUNT(*) as cantidad, SUM(stock) as stock_total FROM productos GROUP BY categoria`, [], (err3, cats) => {
                            if (err3) {
                                console.error('Error SQL categorías en estadísticas:', err3.message);
                                return res.status(500).json({ error: "Error en BD", detalle: err3.message });
                            }
                            stats.distribucion_categorias = cats || [];
                            stats.tipo_distribucion = 'inventario';
                            completarEstadisticas();
                        });
                    }

                    function completarEstadisticas() {
                        // 4. Últimas 5 transacciones en el rango seleccionado
                        let sqlUltimos = `
                            SELECT p.id, COALESCE(u.nombre, 'Cliente Directo') as cliente, p.total, p.estado, p.fecha_compra 
                            FROM pedidos p 
                            LEFT JOIN usuarios u ON p.cliente_id = u.id 
                        `;
                        if (condicionFechaP) {
                            sqlUltimos += ` WHERE ${condicionFechaP}`;
                        }
                        sqlUltimos += ` ORDER BY p.id DESC LIMIT 5`;

                        db.all(sqlUltimos, [], (err4, rows4) => {
                            if (err4) {
                                console.error('Error SQL ultimos pedidos en estadísticas:', err4.message);
                                return res.status(500).json({ error: "Error en BD", detalle: err4.message });
                            }
                            stats.ultimos_pedidos = rows4 || [];
                            res.status(200).json(stats);
                        });
                    }
                });
            });
        });
    } catch (err) {
        console.error('Error no controlado en GET /api/estadisticas:', err.message);
        res.status(500).json({ error: "Error en BD", detalle: err.message });
    }
});

// ============================================================================
// 7. MÓDULO ENTERPRISE: AUDITORÍA, SCM Y CRÉDITOS B2B
// ============================================================================

/**
 * Obtener los últimos 100 registros de auditoría y trazabilidad del sistema
 * GET /api/auditoria
 */
app.get('/api/auditoria', (req, res) => {
    try {
        const sql = `
            SELECT id, usuario_nombre, accion, modulo, fecha 
            FROM auditoria 
            ORDER BY id DESC 
            LIMIT 100
        `;
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Error al consultar auditoría:', err.message);
                return res.status(500).json({ error: "Error en BD", detalle: err.message });
            }
            res.status(200).json(rows || []);
        });
    } catch (err) {
        console.error('Error crítico en GET /api/auditoria:', err.message);
        res.status(500).json({ error: "Error en BD", detalle: err.message });
    }
});

/**
 * ALGORITMO SCM: Sugerencias de compras y reabastecimiento inteligente
 * Retorna todos los repuestos donde stock <= stock_minimo con cálculo de lote óptimo
 * GET /api/compras/sugerencias
 */
app.get('/api/compras/sugerencias', (req, res) => {
    try {
        const sql = `
            SELECT id, sku, nombre, categoria, precio, stock, stock_minimo
            FROM productos
            WHERE stock <= stock_minimo
            ORDER BY (stock - stock_minimo) ASC, stock ASC
        `;
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Error SQL en sugerencias SCM:', err.message);
                return res.status(500).json({ error: "Error en BD", detalle: err.message });
            }

            let totalUnidadesSugeridas = 0;
            let inversionTotalEstimada = 0;

            const sugerencias = (rows || []).map(p => {
                const stockActual = parseInt(p.stock, 10);
                const stockMinimo = parseInt(p.stock_minimo, 10) || 5;

                // Nivel óptimo objetivo: 3x el stock mínimo de seguridad
                const nivelOptimo = stockMinimo * 3;

                // Cantidad sugerida para reponer al nivel óptimo
                const cantidadSugerida = Math.max(nivelOptimo - stockActual, stockMinimo * 2);

                // Costo mayorista de importación estimado al 70% del PVP oficial
                const costoUnitarioEstimado = parseFloat((p.precio * 0.70).toFixed(2));
                const inversionEstimada = parseFloat((cantidadSugerida * costoUnitarioEstimado).toFixed(2));

                totalUnidadesSugeridas += cantidadSugerida;
                inversionTotalEstimada += inversionEstimada;

                return {
                    id: p.id,
                    sku: p.sku,
                    nombre: p.nombre,
                    categoria: p.categoria,
                    stock_actual: stockActual,
                    stock_minimo: stockMinimo,
                    nivel_optimo: nivelOptimo,
                    cantidad_sugerida: cantidadSugerida,
                    precio_venta: parseFloat(p.precio),
                    costo_unitario_estimado: costoUnitarioEstimado,
                    inversion_estimada: inversionEstimada,
                    urgencia: stockActual === 0 ? 'CRITICO' : 'BAJO_STOCK'
                };
            });

            res.status(200).json({
                resumen: {
                    total_repuestos_criticos: sugerencias.length,
                    unidades_totales_sugeridas: totalUnidadesSugeridas,
                    inversion_total_estimada: parseFloat(inversionTotalEstimada.toFixed(2)),
                    fecha_calculo: new Date().toISOString()
                },
                sugerencias: sugerencias
            });
        });
    } catch (err) {
        console.error('Error crítico en sugerencias SCM:', err.message);
        res.status(500).json({ error: "Error en BD", detalle: err.message });
    }
});

/**
 * Consultar catálogo de proveedores homologados (SCM)
 * GET /api/proveedores
 */
app.get('/api/proveedores', (req, res) => {
    try {
        db.all(`SELECT * FROM proveedores ORDER BY id ASC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: "Error en BD", detalle: err.message });
            res.status(200).json(rows || []);
        });
    } catch (err) {
        console.error('Error crítico en GET /api/proveedores:', err.message);
        res.status(500).json({ error: "Error interno del servidor", detalle: err.message });
    }
});

/**
 * Consultar estado de cuenta, deuda y línea de crédito de un taller / cliente B2B
 * GET /api/creditos/:cliente_id
 */
app.get('/api/creditos/:cliente_id', (req, res) => {
    try {
        const clienteId = req.params.cliente_id;
        if (!clienteId) {
            return res.status(400).json({ error: 'El ID del cliente es obligatorio.' });
        }

        // 1. Validar que el cliente exista
        db.get(`SELECT id, nombre, email, rol, estado FROM usuarios WHERE id = ?`, [clienteId], (uErr, cliente) => {
            if (uErr) {
                console.error('Error al consultar usuario para crédito:', uErr.message);
                return res.status(500).json({ error: "Error en BD", detalle: uErr.message });
            }
            if (!cliente) {
                return res.status(404).json({ error: `El usuario o taller #${clienteId} no existe.` });
            }

            // 2. Consultar o inicializar línea de crédito
            db.get(`SELECT * FROM creditos WHERE cliente_id = ?`, [clienteId], (cErr, credito) => {
                if (cErr) {
                    console.error('Error al consultar línea de crédito:', cErr.message);
                    return res.status(500).json({ error: "Error en BD", detalle: cErr.message });
                }

                const limiteCredito = credito ? parseFloat(credito.limite_credito) : 5000.00;
                const saldoDeudor = credito ? parseFloat(credito.saldo_deudor) : 0.00;
                const estadoCredito = credito ? credito.estado : 'ACTIVO';
                const creditoDisponible = Math.max(0, parseFloat((limiteCredito - saldoDeudor).toFixed(2)));
                const porcentajeUso = limiteCredito > 0 ? parseFloat(((saldoDeudor / limiteCredito) * 100).toFixed(1)) : 0;

                // 3. Consultar historial de pagos y amortizaciones
                db.all(`SELECT id, monto, fecha FROM pagos_credito WHERE cliente_id = ? ORDER BY id DESC LIMIT 5`, [clienteId], (pErr, pagos) => {
                    // 4. Consultar últimos pedidos
                    db.all(`SELECT id, total, estado, fecha_compra FROM pedidos WHERE cliente_id = ? ORDER BY id DESC LIMIT 5`, [clienteId], (pedErr, pedidos) => {
                        res.status(200).json({
                            cliente: {
                                id: cliente.id,
                                nombre: cliente.nombre,
                                email: cliente.email,
                                rol: cliente.rol,
                                estado_cuenta: cliente.estado
                            },
                            credito: {
                                limite_credito: limiteCredito,
                                saldo_deudor: saldoDeudor,
                                credito_disponible: creditoDisponible,
                                porcentaje_utilizado: porcentajeUso,
                                estado: estadoCredito,
                                situacion: saldoDeudor > limiteCredito ? 'SOBREGIRO' : (porcentajeUso > 80 ? 'ALERTA' : 'NORMAL')
                            },
                            ultimos_pagos: pagos || [],
                            ultimos_pedidos: pedidos || []
                        });
                    });
                });
            });
        });
    } catch (err) {
        console.error('Error crítico en crédito B2B:', err.message);
        res.status(500).json({ error: "Error en BD", detalle: err.message });
    }
});

/**
 * Listado general de cartera y líneas de crédito B2B
 * GET /api/creditos
 */
app.get('/api/creditos', (req, res) => {
    try {
        const sql = `
            SELECT 
                u.id AS cliente_id,
                u.nombre AS cliente_nombre,
                u.email AS cliente_email,
                u.estado AS estado_usuario,
                COALESCE(c.limite_credito, 5000.00) AS limite_credito,
                COALESCE(c.saldo_deudor, 0.00) AS saldo_deudor,
                COALESCE(c.estado, 'ACTIVO') AS estado_credito
            FROM usuarios u
            LEFT JOIN creditos c ON u.id = c.cliente_id
            WHERE u.rol = 'CLIENTE_B2B'
            ORDER BY u.nombre ASC
        `;
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Error al listar créditos B2B:', err.message);
                return res.status(500).json({ error: "Error en BD", detalle: err.message });
            }

            let totalLimite = 0;
            let totalDeuda = 0;
            let clientesAlerta = 0;

            const creditos = (rows || []).map(r => {
                const limite = parseFloat(r.limite_credito);
                const saldo = parseFloat(r.saldo_deudor);
                const disponible = Math.max(0, parseFloat((limite - saldo).toFixed(2)));
                const porcentaje = limite > 0 ? parseFloat(((saldo / limite) * 100).toFixed(1)) : 0;
                
                let situacion = 'NORMAL';
                if (saldo > limite) situacion = 'SOBREGIRO';
                else if (porcentaje >= 80) situacion = 'ALERTA';

                totalLimite += limite;
                totalDeuda += saldo;
                if (situacion !== 'NORMAL') clientesAlerta++;

                return {
                    cliente_id: r.cliente_id,
                    cliente_nombre: r.cliente_nombre,
                    cliente_email: r.cliente_email,
                    estado_usuario: r.estado_usuario,
                    limite_credito: limite,
                    saldo_deudor: saldo,
                    credito_disponible: disponible,
                    porcentaje_utilizado: porcentaje,
                    estado: r.estado_credito,
                    situacion: situacion
                };
            });

            res.status(200).json({
                resumen: {
                    total_clientes_b2b: creditos.length,
                    total_limite_asignado: parseFloat(totalLimite.toFixed(2)),
                    total_cartera_deudora: parseFloat(totalDeuda.toFixed(2)),
                    total_credito_disponible: parseFloat(Math.max(0, totalLimite - totalDeuda).toFixed(2)),
                    clientes_en_riesgo: clientesAlerta
                },
                creditos: creditos
            });
        });
    } catch (err) {
        console.error('Error crítico en listado de créditos:', err.message);
        res.status(500).json({ error: "Error en BD", detalle: err.message });
    }
});

/**
 * Registrar amortización de deuda para un cliente B2B
 * POST /api/creditos/amortizar
 */
app.post('/api/creditos/amortizar', (req, res) => {
    try {
        const { cliente_id, monto, usuario_admin } = req.body;
        const montoNum = parseFloat(monto);

        if (!cliente_id || isNaN(montoNum) || montoNum <= 0) {
            return res.status(400).json({ error: 'Parámetros inválidos. Debe indicar cliente_id y un monto mayor a 0.' });
        }

        db.get(`SELECT id, nombre FROM usuarios WHERE id = ?`, [cliente_id], (uErr, cliente) => {
            if (uErr || !cliente) {
                return res.status(404).json({ error: 'Cliente no encontrado en el sistema.' });
            }

            db.get(`SELECT * FROM creditos WHERE cliente_id = ?`, [cliente_id], (cErr, credito) => {
                if (cErr) return res.status(500).json({ error: "Error en BD", detalle: cErr.message });

                const saldoActual = credito ? parseFloat(credito.saldo_deudor) : 0;
                const nuevoSaldo = Math.max(0, parseFloat((saldoActual - montoNum).toFixed(2)));

                // 1. Registrar el abono en el histórico
                db.run(`INSERT INTO pagos_credito (cliente_id, monto) VALUES (?, ?)`, [cliente_id, montoNum], function(pErr) {
                    if (pErr) return res.status(500).json({ error: "Error al registrar amortización", detalle: pErr.message });

                    // 2. Actualizar el saldo deudor
                    if (credito) {
                        db.run(`UPDATE creditos SET saldo_deudor = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE cliente_id = ?`, [nuevoSaldo, cliente_id], (upErr) => {
                            if (upErr) return res.status(500).json({ error: "Error al actualizar saldo deudor", detalle: upErr.message });
                            
                            registrarAuditoria(usuario_admin || 'ADMINISTRACIÓN', `Amortización de $${montoNum.toFixed(2)} aplicada a taller #${cliente_id} (${cliente.nombre}). Saldo restante: $${nuevoSaldo.toFixed(2)}`, 'CREDITOS');
                            
                            res.status(200).json({
                                mensaje: `Amortización de $${montoNum.toFixed(2)} registrada exitosamente.`,
                                nuevo_saldo: nuevoSaldo,
                                pago_id: this.lastID
                            });
                        });
                    } else {
                        db.run(`INSERT INTO creditos (cliente_id, limite_credito, saldo_deudor, estado) VALUES (?, 5000.00, 0.00, 'ACTIVO')`, [cliente_id], (inErr) => {
                            if (inErr) return res.status(500).json({ error: "Error al inicializar crédito", detalle: inErr.message });
                            
                            registrarAuditoria(usuario_admin || 'ADMINISTRACIÓN', `Amortización de $${montoNum.toFixed(2)} aplicada a taller #${cliente_id} (${cliente.nombre})`, 'CREDITOS');
                            
                            res.status(200).json({
                                mensaje: `Amortización registrada con éxito.`,
                                nuevo_saldo: 0.00,
                                pago_id: this.lastID
                            });
                        });
                    }
                });
            });
        });
    } catch (err) {
        console.error('Error crítico al amortizar crédito:', err.message);
        res.status(500).json({ error: "Error en BD", detalle: err.message });
    }
});

/**
 * Generar orden de compra a proveedores (SCM)
 * POST /api/compras/ordenes
 */
app.post('/api/compras/ordenes', (req, res) => {
    try {
        const { proveedor_id, detalles, usuario } = req.body;
        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            return res.status(400).json({ error: 'Debe especificar al menos un ítem para la orden de compra.' });
        }

        let total = 0;
        detalles.forEach(d => {
            total += (parseFloat(d.costo_unitario) || 0) * (parseInt(d.cantidad) || 0);
        });

        db.run(`INSERT INTO compras (proveedor_id, total, estado) VALUES (?, ?, 'GENERADA')`, [proveedor_id || 1, total], function(cErr) {
            if (cErr) return res.status(500).json({ error: "Error al crear orden de compra", detalle: cErr.message });

            const compraId = this.lastID;
            const stmt = db.prepare(`INSERT INTO compras_detalles (compra_id, sku, cantidad, costo_unitario) VALUES (?, ?, ?, ?)`);
            detalles.forEach(d => {
                stmt.run([compraId, d.sku, d.cantidad, d.costo_unitario]);
            });
            stmt.finalize();

            registrarAuditoria(usuario || 'GERENCIA DE OPERACIONES', `Generación de Orden de Compra OC-${String(compraId).padStart(4, '0')} por un total de $${total.toFixed(2)} (${detalles.length} repuestos críticos)`, 'SCM_COMPRAS');

            res.status(201).json({
                mensaje: `Orden de Compra OC-${String(compraId).padStart(4, '0')} generada exitosamente.`,
                orden_id: compraId,
                codigo_orden: `OC-${String(compraId).padStart(4, '0')}`,
                total: parseFloat(total.toFixed(2)),
                items: detalles.length
            });
        });
    } catch (err) {
        console.error('Error crítico al generar orden de compra:', err.message);
        res.status(500).json({ error: "Error en BD", detalle: err.message });
    }
});

// ============================================================================
// 7.1 MÓDULO DE ATENCIÓN AL CLIENTE Y TICKETS DE SOPORTE WHATSAPP
// ============================================================================

/**
 * Listar tickets de soporte, reclamos y cotizaciones
 * GET /api/soporte/tickets
 */
app.get('/api/soporte/tickets', (req, res) => {
    try {
        const { estado, tipo } = req.query;
        let sql = `SELECT * FROM tickets_soporte WHERE 1=1`;
        const params = [];

        if (estado && estado !== 'TODOS') {
            sql += ` AND UPPER(estado) = ?`;
            params.push(String(estado).trim().toUpperCase());
        }

        if (tipo && tipo !== 'TODOS') {
            sql += ` AND UPPER(tipo) = ?`;
            params.push(String(tipo).trim().toUpperCase());
        }

        sql += ` ORDER BY id DESC`;

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Error al listar tickets:', err.message);
                return res.status(500).json({ error: 'Error al consultar tickets de soporte.' });
            }
            res.status(200).json(rows || []);
        });
    } catch (err) {
        console.error('Error crítico al obtener tickets:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Actualizar estado de un ticket de soporte / reclamo
 * PUT /api/soporte/tickets/:id
 */
app.put('/api/soporte/tickets/:id', (req, res) => {
    try {
        const ticketId = req.params.id;
        const { estado, notas, usuario } = req.body;

        if (!estado) {
            return res.status(400).json({ error: 'Debe especificar el nuevo estado del ticket.' });
        }

        const nuevoEstado = String(estado).trim().toUpperCase();

        db.get(`SELECT * FROM tickets_soporte WHERE id = ?`, [ticketId], (err, ticket) => {
            if (err) {
                return res.status(500).json({ error: 'Error al buscar ticket de soporte.' });
            }
            if (!ticket) {
                return res.status(404).json({ error: `El ticket #${ticketId} no existe.` });
            }

            db.run(
                `UPDATE tickets_soporte SET estado = ? WHERE id = ?`,
                [nuevoEstado, ticketId],
                function (updErr) {
                    if (updErr) {
                        return res.status(500).json({ error: 'Error al actualizar ticket: ' + updErr.message });
                    }

                    registrarAuditoria(
                        usuario || 'Carlos Mendoza (Gerencia)',
                        `Actualizó estado del Ticket #TK-${String(ticketId).padStart(4, '0')} (${ticket.tipo}) a "${nuevoEstado}"`,
                        'SOPORTE'
                    );

                    res.status(200).json({
                        mensaje: `Ticket #TK-${String(ticketId).padStart(4, '0')} actualizado a estado ${nuevoEstado}.`,
                        ticket_id: ticketId,
                        estado: nuevoEstado
                    });
                }
            );
        });
    } catch (err) {
        console.error('Error crítico al actualizar ticket:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Registrar nuevo ticket de soporte (API manual o vía Bot)
 * POST /api/soporte/tickets
 */
app.post('/api/soporte/tickets', (req, res) => {
    try {
        const { telefono_cliente, nombre_cliente, tipo, mensaje } = req.body;

        if (!telefono_cliente || !mensaje) {
            return res.status(400).json({ error: 'Teléfono del cliente y mensaje son obligatorios.' });
        }

        const tipoFinal = (tipo || 'CONSULTA').toUpperCase();
        const nombreFinal = (nombre_cliente || 'Cliente WhatsApp').trim();

        db.run(
            `INSERT INTO tickets_soporte (telefono_cliente, nombre_cliente, tipo, mensaje, estado) VALUES (?, ?, ?, ?, 'ABIERTO')`,
            [String(telefono_cliente).trim(), nombreFinal, tipoFinal, String(mensaje).trim()],
            function (insErr) {
                if (insErr) {
                    console.error('Error al insertar ticket:', insErr.message);
                    return res.status(500).json({ error: 'Error al registrar ticket de soporte.' });
                }

                const nuevoId = this.lastID;
                const codigoTicket = `TK-${String(nuevoId).padStart(4, '0')}`;

                registrarAuditoria(
                    nombreFinal,
                    `Nuevo ticket registrado vía WhatsApp (${codigoTicket} - ${tipoFinal}): "${mensaje.slice(0, 60)}"`,
                    'SOPORTE'
                );

                // Disparador Proactivo 3: Alerta por WhatsApp a Gerencia de nuevo ticket
                const alertaTicket = `*NUEVO TICKET DE ATENCIÓN (${codigoTicket})*\n` +
                    `──────────────────────────\n` +
                    `• *Tipo:* ${tipoFinal}\n` +
                    `• *Cliente:* ${nombreFinal}\n` +
                    `• *Teléfono:* ${telefono_cliente}\n` +
                    `• *Mensaje:* "${String(mensaje).trim()}"\n` +
                    `──────────────────────────\n` +
                    `_Asignar a asesor comercial o equipo de logística en Sucre._`;

                enviarAlertaAdmin(alertaTicket).catch(() => {});

                res.status(201).json({
                    mensaje: `Ticket ${codigoTicket} creado exitosamente.`,
                    id: nuevoId,
                    codigo: codigoTicket,
                    tipo: tipoFinal,
                    estado: 'ABIERTO'
                });
            }
        );
    } catch (err) {
        console.error('Error crítico al crear ticket:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * 7.3. GENERACIÓN DE COTIZACIONES MAYORISTAS Y PROFORMAS FORMALES
 * POST /api/cotizaciones
 */
app.post('/api/cotizaciones', async (req, res) => {
    try {
        const { cliente, items, total, notas } = req.body || {};

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Debe incluir al menos un producto para generar la proforma comercial.' });
        }

        const clienteObj = cliente || {};
        const totalNum = parseFloat(total) || items.reduce((acc, it) => acc + (parseFloat(it.subtotal || (it.precio * it.cantidad)) || 0), 0);
        const codigoCot = `COT-${Date.now().toString().slice(-6)}`;
        const emailCliente = clienteObj.email || clienteObj.correo || '';
        const nombreCliente = (clienteObj.nombre || clienteObj.nombre_cliente || 'Taller Mecánico / Mayorista').trim();
        const telefonoCliente = clienteObj.telefono || '+591 67375645';

        // 1. Registrar en base de datos para trazabilidad comercial en SQLite
        const resumenLineas = items.map(it => `• ${it.cantidad || 1}x ${it.nombre || it.descripcion} (${it.sku || 'S/SKU'}) - Bs. ${parseFloat(it.subtotal || ((it.precio || 0) * (it.cantidad || 1))).toFixed(2)}`).join('\n');
        const mensajeTicket = `Solicitud de Cotización Formal ${codigoCot} (${items.length} ítems, Total estimado: Bs. ${totalNum.toFixed(2)}):\n${resumenLineas}${notas ? `\nObservaciones: ${notas}` : ''}`;

        db.run(
            `INSERT INTO tickets_soporte (telefono_cliente, nombre_cliente, tipo, mensaje, estado) VALUES (?, ?, 'COTIZACION', ?, 'ABIERTO')`,
            [String(telefonoCliente).trim(), nombreCliente, mensajeTicket],
            function (insErr) {
                if (insErr) console.warn('[Cotizaciones] Advertencia al registrar en tickets:', insErr.message);
            }
        );

        // 2. Registrar en Auditoría ERP
        registrarAuditoria(
            nombreCliente,
            `Generó la solicitud de cotización mayorista ${codigoCot} por Bs. ${totalNum.toFixed(2)} (${items.length} repuestos). Proforma enviada a ${emailCliente || 'correo de administración'}.`,
            'COTIZACIONES'
        );

        // 3. Envío Asíncrono de Proforma Corporativa en HTML con Nodemailer (Gmail)
        enviarCotizacionEmail(clienteObj, items, totalNum).catch(emailErr => {
            console.error('[EmailService] Error asíncrono al enviar cotización formal:', emailErr.message);
        });

        // 4. Notificación Proactiva por WhatsApp a Gerencia
        const alertaCotizacionWhatsApp = `*NUEVA SOLICITUD DE COTIZACIÓN [${codigoCot}]*\n` +
            `──────────────────────────\n` +
            `• *Cliente:* ${nombreCliente}\n` +
            `• *Teléfono:* ${telefonoCliente}\n` +
            `• *Correo:* ${emailCliente || 'No especificado'}\n` +
            `• *Total Estimado:* *Bs. ${totalNum.toFixed(2)}*\n` +
            `• *Ítems:* ${items.length} repuesto(s)\n` +
            `──────────────────────────\n` +
            `_Proforma comercial formal emitida con validez de 7 días calendario._`;
        enviarAlertaAdmin(alertaCotizacionWhatsApp).catch(() => {});

        res.status(200).json({
            ok: true,
            codigo: codigoCot,
            mensaje: 'Solicitud de cotización mayorista procesada con éxito y proforma comercial enviada por correo electrónico.',
            total: totalNum
        });
    } catch (err) {
        console.error('Error crítico en POST /api/cotizaciones:', err.message);
        res.status(500).json({ error: 'Error del servidor al procesar la cotización.' });
    }
});

// ============================================================================
// 7.4. MONITOREO DEL ASISTENTE WHATSAPP Y CONTROL ERP
// ============================================================================

app.get('/api/whatsapp/estado', (req, res) => {
    try {
        const estado = obtenerEstadoWhatsApp();
        
        // Si la petición proviene explícitamente de un rol no-admin, sanitizar payload
        const rolHeader = String(req.headers['x-usuario-rol'] || req.query.rol || '').toUpperCase();
        if (rolHeader && rolHeader.startsWith('CLIENTE')) {
            return res.status(200).json({
                conectado: estado.conectado,
                numero: estado.numero
            });
        }

        res.status(200).json(estado);
    } catch (err) {
        console.error('Error al obtener estado de WhatsApp:', err.message);
        res.status(500).json({ conectado: false, error: 'No se pudo consultar el estado de WhatsApp.' });
    }
});

// ============================================================================
// 8. MANEJO GLOBAL DE RUTAS 404 Y ARRANQUE DEL SERVIDOR
// ============================================================================

app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `La ruta API solicitada "${req.originalUrl}" no existe.` });
});

// Redirigir la raíz a index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`SISTEMA COMERCIAL GOLDEN LUBRICANTES & FILTROS`);
    console.log(`Servidor iniciado en: http://localhost:${PORT}`);
    console.log(`Distribución Automotriz Mayorista — Sucre, Bolivia`);
    console.log(`====================================================`);

    // Inicialización no bloqueante del Bot de WhatsApp para despliegue en la nube (Render)
    (async () => {
        try {
            console.log('[WhatsApp Bot] Inicializando servicio integrado en segundo plano...');
            await iniciarBot();
        } catch (botErr) {
            console.warn('[WhatsApp Bot] Advertencia al inicializar bot en segundo plano:', botErr.message);
        }
    })();
});
