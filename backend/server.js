const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de encabezados y políticas de caché
app.set('etag', false);
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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
                console.warn('⚠️ [Auditoría] No se pudo guardar log silencioso:', err.message);
            }
        });
    } catch (err) {
        console.warn('⚠️ [Auditoría] Error al registrar evento:', err.message);
    }
}

// ============================================================================
// 1. MÓDULO DE AUTENTICACIÓN Y SEGURIDAD
// ============================================================================

/**
 * Iniciar sesión de usuario
 * POST /api/auth/login
 */
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Debe ingresar correo y contraseña.' });
        }

        db.get(`SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)`, [email.trim()], (err, user) => {
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

            registrarAuditoria(user.nombre, `Inicio de sesión exitoso (Rol: ${user.rol})`, 'SEGURIDAD');

            return res.status(200).json({
                mensaje: 'Autenticación exitosa',
                usuario: {
                    id: user.id,
                    nombre: user.nombre,
                    email: user.email,
                    rol: user.rol,
                    estado: user.estado
                }
            });
        });
    } catch (error) {
        console.error('Error crítico en login:', error);
        return res.status(500).json({ error: 'Error del servidor al procesar inicio de sesión.' });
    }
});

// ============================================================================
// 2. MÓDULO DE GESTIÓN DE USUARIOS (CRUD COMPLETO)
// ============================================================================

/**
 * Listar todos los usuarios (sin exponer hash de contraseñas)
 * GET /api/usuarios
 */
app.get('/api/usuarios', (req, res) => {
    db.all(`SELECT id, nombre, email, rol, estado, fecha_creacion FROM usuarios ORDER BY id DESC`, [], (err, rows) => {
        if (err) {
            console.error('Error al listar usuarios:', err.message);
            return res.status(500).json({ error: 'Error al obtener usuarios de la base de datos.' });
        }
        res.status(200).json(rows || []);
    });
});

/**
 * Registrar nuevo usuario
 * POST /api/usuarios
 */
app.post('/api/usuarios', (req, res) => {
    try {
        const { nombre, email, password, rol, estado } = req.body;

        if (!nombre || !email || !password || !rol) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben ser proporcionados.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const emailLimpio = email.trim().toLowerCase();
        const estadoFinal = estado || 'ACTIVO';
        const hashedPassword = bcrypt.hashSync(password, 10);

        db.run(
            `INSERT INTO usuarios (nombre, email, password, rol, estado) VALUES (?, ?, ?, ?, ?)`,
            [nombre.trim(), emailLimpio, hashedPassword, rol, estadoFinal],
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
        const { nombre, email, password, rol, estado } = req.body;

        if (!nombre || !email || !rol || !estado) {
            return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar el usuario.' });
        }

        const emailLimpio = email.trim().toLowerCase();

        // Verificar primero si el correo ya pertenece a otro usuario
        db.get(`SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?`, [emailLimpio, userId], (err, existeOtro) => {
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
                    `UPDATE usuarios SET nombre = ?, email = ?, password = ?, rol = ?, estado = ? WHERE id = ?`,
                    [nombre.trim(), emailLimpio, hashedPassword, rol, estado, userId],
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
                    `UPDATE usuarios SET nombre = ?, email = ?, rol = ?, estado = ? WHERE id = ?`,
                    [nombre.trim(), emailLimpio, rol, estado, userId],
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
});

// ============================================================================
// 3. MÓDULO DE INVENTARIO Y CATÁLOGO DE PRODUCTOS (CRUD COMPLETO)
// ============================================================================

/**
 * Obtener todos los productos
 * GET /api/productos
 */
app.get('/api/productos', (req, res) => {
    db.all(`SELECT * FROM productos ORDER BY id DESC`, [], (err, rows) => {
        if (err) {
            console.error('Error al consultar inventario:', err.message);
            return res.status(500).json({ error: 'Error al cargar productos del inventario.' });
        }
        res.status(200).json(rows || []);
    });
});

/**
 * Obtener detalle de un producto por ID
 * GET /api/productos/:id
 */
app.get('/api/productos/:id', (req, res) => {
    const prodId = req.params.id;
    db.get('SELECT * FROM productos WHERE id = ?', [prodId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error al consultar producto.' });
        if (!row) return res.status(404).json({ error: 'Producto no encontrado.' });
        res.status(200).json(row);
    });
});

/**
 * Registrar nuevo producto en inventario
 * POST /api/productos
 */
app.post('/api/productos', (req, res) => {
    try {
        const { sku, nombre, categoria, precio, stock, stock_minimo, imagen_url, especificaciones } = req.body;

        if (!sku || !nombre || !categoria || precio === undefined || stock === undefined) {
            return res.status(400).json({ error: 'Todos los campos del producto son obligatorios.' });
        }

        const precioNum = parseFloat(precio);
        const stockNum = parseInt(stock, 10);
        const minStockNum = stock_minimo !== undefined ? parseInt(stock_minimo, 10) : 5;

        if (isNaN(precioNum) || precioNum < 0) {
            return res.status(400).json({ error: 'El precio debe ser un número positivo.' });
        }
        if (isNaN(stockNum) || stockNum < 0) {
            return res.status(400).json({ error: 'El stock debe ser un número entero no negativo.' });
        }

        const specsStr = typeof especificaciones === 'object' ? JSON.stringify(especificaciones) : (especificaciones || null);
        const sql = `INSERT INTO productos (sku, nombre, categoria, precio, stock, stock_minimo, imagen_url, especificaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [sku.trim().toUpperCase(), nombre.trim(), categoria, precioNum, stockNum, minStockNum, imagen_url || null, specsStr], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: `El código SKU "${sku}" ya está registrado.` });
                }
                console.error('Error al insertar producto:', err.message);
                return res.status(500).json({ error: 'Error al guardar el producto en la base de datos.' });
            }
            registrarAuditoria('ALMACEN', `Registró nuevo repuesto SKU: ${sku.trim().toUpperCase()} - "${nombre.trim()}"`, 'INVENTARIO');
            res.status(201).json({ id: this.lastID, mensaje: 'Repuesto registrado exitosamente en inventario.' });
        });
    } catch (error) {
        console.error('Error crítico al crear producto:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

/**
 * Actualizar producto existente
 * PUT /api/productos/:id
 */
app.put('/api/productos/:id', (req, res) => {
    try {
        const prodId = req.params.id;
        const { sku, nombre, categoria, precio, stock, stock_minimo, imagen_url, especificaciones } = req.body;

        if (!sku || !nombre || !categoria || precio === undefined || stock === undefined) {
            return res.status(400).json({ error: 'Todos los datos del repuesto son obligatorios.' });
        }

        const precioNum = parseFloat(precio);
        const stockNum = parseInt(stock, 10);
        const minStockNum = stock_minimo !== undefined ? parseInt(stock_minimo, 10) : 5;

        if (isNaN(precioNum) || precioNum < 0 || isNaN(stockNum) || stockNum < 0) {
            return res.status(400).json({ error: 'Precio o stock inválidos.' });
        }

        const specsStr = typeof especificaciones === 'object' ? JSON.stringify(especificaciones) : (especificaciones || null);
        const sql = `UPDATE productos SET sku = ?, nombre = ?, categoria = ?, precio = ?, stock = ?, stock_minimo = ?, imagen_url = COALESCE(?, imagen_url), especificaciones = COALESCE(?, especificaciones) WHERE id = ?`;
        db.run(sql, [sku.trim().toUpperCase(), nombre.trim(), categoria, precioNum, stockNum, minStockNum, imagen_url || null, specsStr, prodId], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: `El SKU "${sku}" ya está asignado a otro producto.` });
                }
                console.error('Error al actualizar producto:', err.message);
                return res.status(500).json({ error: 'Error al actualizar el repuesto.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Producto no encontrado.' });
            }
            registrarAuditoria('ALMACEN', `Modificó repuesto #${prodId} (SKU: ${sku.trim().toUpperCase()} - "${nombre.trim()}")`, 'INVENTARIO');
            res.status(200).json({ mensaje: 'Repuesto actualizado correctamente en inventario.' });
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
app.delete('/api/productos/:id', (req, res) => {
    const prodId = req.params.id;
    db.run(`DELETE FROM productos WHERE id = ?`, [prodId], function (err) {
        if (err) {
            if (err.message.includes('FOREIGN KEY constraint failed')) {
                return res.status(409).json({ error: 'No se puede eliminar el producto porque está vinculado a pedidos existentes.' });
            }
            console.error('Error al eliminar producto:', err.message);
            return res.status(500).json({ error: 'Error al eliminar el producto.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        registrarAuditoria('ALMACEN', `Eliminó repuesto #${prodId} del catálogo`, 'INVENTARIO');
        res.status(200).json({ mensaje: 'Repuesto eliminado exitosamente.' });
    });
});

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
                        return res.status(500).json({ error: 'Error al consultar historial de movimientos en SQLite.' });
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
 * Registrar venta con control atómico de concurrencia y descuento de stock
 * POST /api/ventas
 */
app.post('/api/ventas', (req, res) => {
    const { cliente_id, total, carrito } = req.body;

    if (!cliente_id || !carrito || !Array.isArray(carrito) || carrito.length === 0) {
        return res.status(400).json({ error: 'Datos de compra incompletos o carrito vacío.' });
    }

    const totalNum = parseFloat(total);
    if (isNaN(totalNum) || totalNum <= 0) {
        return res.status(400).json({ error: 'El total de la venta debe ser mayor a 0.' });
    }

    // Iniciar Transacción Atómica en SQLite
    db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION;', (beginErr) => {
            if (beginErr) {
                console.error('Error al iniciar transacción de venta:', beginErr.message);
                return res.status(500).json({ error: 'No se pudo iniciar la transacción de compra.' });
            }

            // 1. Validar existencia del cliente
            db.get(`SELECT id, nombre FROM usuarios WHERE id = ?`, [cliente_id], (userErr, user) => {
                if (userErr || !user) {
                    db.run('ROLLBACK;');
                    return res.status(404).json({ error: 'El cliente especificado no existe o no es válido.' });
                }

                // 2. Validar existencias de stock de CADA producto en el carrito
                const ids = carrito.map(item => item.id);
                const placeholders = ids.map(() => '?').join(',');

                db.all(`SELECT id, nombre, stock, precio FROM productos WHERE id IN (${placeholders})`, ids, (stockErr, rows) => {
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
                            return res.status(400).json({
                                error: `Stock insuficiente para "${prod.nombre}". Solicitado: ${item.cantidad}, Disponible: ${prod.stock}.`
                            });
                        }
                    }

                    // 3. Crear cabecera de pedido
                    db.run(
                        `INSERT INTO pedidos (cliente_id, total, estado, fecha_compra) VALUES (?, ?, 'PENDIENTE', datetime('now'))`,
                        [cliente_id, totalNum],
                        function (orderErr) {
                            if (orderErr) {
                                db.run('ROLLBACK;');
                                console.error('Error al insertar pedido:', orderErr.message);
                                return res.status(500).json({ error: 'Error al registrar el pedido.' });
                            }

                            const pedidoId = this.lastID;

                            // 4. Descontar stock y registrar detalles del pedido
                            const stmtDetalle = db.prepare(
                                `INSERT INTO pedido_detalles (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)`
                            );
                            const stmtStock = db.prepare(
                                `UPDATE productos SET stock = stock - ? WHERE id = ?`
                            );

                            let hasError = false;

                            for (const item of carrito) {
                                const subtotal = parseFloat((item.precio * item.cantidad).toFixed(2));
                                stmtDetalle.run(pedidoId, item.id, item.nombre, item.cantidad, item.precio, subtotal, (dErr) => {
                                    if (dErr) hasError = true;
                                });
                                stmtStock.run(item.cantidad, item.id, (sErr) => {
                                    if (sErr) hasError = true;
                                });
                            }

                            stmtDetalle.finalize();
                            stmtStock.finalize((finalizeErr) => {
                                if (hasError || finalizeErr) {
                                    db.run('ROLLBACK;');
                                    console.error('Error al actualizar inventario o detalles');
                                    return res.status(500).json({ error: 'Error al procesar el descuento de inventario.' });
                                }

                                // 5. Confirmar transacción
                                db.run('COMMIT;', (commitErr) => {
                                    if (commitErr) {
                                        db.run('ROLLBACK;');
                                        return res.status(500).json({ error: 'Error al confirmar la transacción.' });
                                    }

                                    registrarAuditoria(`Cliente #${cliente_id}`, `Registró la orden de compra #${pedidoId} por Bs. ${totalNum.toFixed(2)} (${carrito.length} ítems)`, 'VENTAS');

                                    res.status(201).json({
                                        mensaje: '¡Compra registrada con éxito y stock actualizado!',
                                        pedidoId: pedidoId,
                                        total: totalNum
                                    });
                                });
                            });
                        }
                    );
                });
            });
        });
    });
});

// ============================================================================
// 5. MÓDULO DE LOGÍSTICA Y PEDIDOS
// ============================================================================

/**
 * Listar pedidos con datos del cliente y filtro de fecha gerencial dinámico
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
                COALESCE(u.nombre, 'Cliente Desconocido') as cliente,
                COALESCE(u.email, '-') as cliente_email
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
 * Obtener detalle de un pedido específico
 * GET /api/pedidos/:id
 */
app.get('/api/pedidos/:id', (req, res) => {
    const pedidoId = req.params.id;
    const sqlPedido = `
        SELECT p.id, p.total, p.estado, p.fecha_compra, u.nombre as cliente, u.email as cliente_email
        FROM pedidos p
        LEFT JOIN usuarios u ON p.cliente_id = u.id
        WHERE p.id = ?
    `;
    db.get(sqlPedido, [pedidoId], (err, pedido) => {
        if (err) return res.status(500).json({ error: 'Error al obtener pedido.' });
        if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

        db.all(`SELECT * FROM pedido_detalles WHERE pedido_id = ?`, [pedidoId], (dErr, detalles) => {
            if (dErr) return res.status(500).json({ error: 'Error al obtener detalles del pedido.' });
            pedido.detalles = detalles || [];
            res.status(200).json(pedido);
        });
    });
});

/**
 * Actualizar estado de despacho de un pedido
 * PUT /api/pedidos/:id/estado
 */
app.put('/api/pedidos/:id/estado', (req, res) => {
    const { estado } = req.body;
    const estadosValidos = ['PENDIENTE', 'EN CAMINO', 'ENTREGADO'];

    if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({ error: 'Estado de pedido no válido. Opciones: PENDIENTE, EN CAMINO, ENTREGADO.' });
    }

    db.run(`UPDATE pedidos SET estado = ? WHERE id = ?`, [estado, req.params.id], function (err) {
        if (err) {
            console.error('Error al actualizar estado:', err.message);
            return res.status(500).json({ error: 'Error al actualizar estado del pedido.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }
        registrarAuditoria('LOGISTICA', `Actualizó el estado de despacho de la orden #00${req.params.id} a "${estado}"`, 'LOGISTICA');
        res.status(200).json({ mensaje: 'Estado de entrega actualizado correctamente.', nuevoEstado: estado });
    });
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
    db.all(`SELECT * FROM proveedores ORDER BY id ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Error en BD", detalle: err.message });
        res.status(200).json(rows || []);
    });
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
    console.log(`🚀 ERP & E-COMMERCE GOLDEN INICIADO CORRECTAMENTE`);
    console.log(`📍 Servidor Web: http://localhost:${PORT}`);
    console.log(`🛡️  Arquitectura: Node.js + Express + SQLite3 (ACID)`);
    console.log(`====================================================`);
});
