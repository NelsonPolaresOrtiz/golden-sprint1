const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'golden_seguridad.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error al conectar con SQLite:', err.message);
    } else {
        console.log('✅ Conectado exitosamente a la base de datos SQLite (golden_seguridad.db)');
    }
});

// Habilitar claves foráneas e inicializar esquema relacional
db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON;');

    // 1. Tabla de Usuarios y Roles
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rol TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'ACTIVO',
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Tabla de Catálogo e Inventario de Repuestos
    db.run(`CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        categoria TEXT NOT NULL,
        precio DECIMAL(10,2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        stock_minimo INTEGER NOT NULL DEFAULT 5,
        imagen_url TEXT,
        especificaciones TEXT,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migración automática de columnas adicionales si la tabla ya existía
    db.all("PRAGMA table_info(productos)", (err, cols) => {
        if (!err && cols) {
            const colNames = cols.map(c => c.name);
            if (!colNames.includes('imagen_url')) {
                db.run("ALTER TABLE productos ADD COLUMN imagen_url TEXT", (aErr) => {
                    if (!aErr) console.log("📸 Columna 'imagen_url' agregada a productos");
                });
            }
            if (!colNames.includes('especificaciones')) {
                db.run("ALTER TABLE productos ADD COLUMN especificaciones TEXT", (sErr) => {
                    if (!sErr) console.log("📑 Columna 'especificaciones' agregada a productos");
                });
            }
            if (!colNames.includes('linea')) {
                db.run("ALTER TABLE productos ADD COLUMN linea TEXT DEFAULT 'liviana'", (lErr) => {
                    if (!lErr) console.log("🏷️ Columna 'linea' agregada a productos");
                });
            }
            if (!colNames.includes('en_oferta')) {
                db.run("ALTER TABLE productos ADD COLUMN en_oferta INTEGER DEFAULT 0", (oErr) => {
                    if (!oErr) console.log("🔥 Columna 'en_oferta' agregada a productos");
                });
            }
            if (!colNames.includes('descuento_porcentaje')) {
                db.run("ALTER TABLE productos ADD COLUMN descuento_porcentaje INTEGER DEFAULT 15", (dErr) => {
                    if (!dErr) console.log("🏷️ Columna 'descuento_porcentaje' agregada a productos");
                });
            }
            if (!colNames.includes('compatibilidad')) {
                db.run("ALTER TABLE productos ADD COLUMN compatibilidad TEXT", (cErr) => {
                    if (!cErr) console.log("🚗 Columna 'compatibilidad' agregada a productos");
                });
            }
        }
    });

    // 2.1 Tabla de Configuración Dinámica del Catálogo (Hero Banner & Campañas)
    db.run(`CREATE TABLE IF NOT EXISTS config_catalogo (
        id INTEGER PRIMARY KEY,
        hero_titulo TEXT NOT NULL,
        hero_subtitulo TEXT NOT NULL,
        hero_destacado TEXT NOT NULL,
        hero_badge TEXT NOT NULL,
        banner_activo INTEGER DEFAULT 1,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.get('SELECT COUNT(*) as count FROM config_catalogo', (err, row) => {
        if (!err && row && row.count === 0) {
            db.run(`INSERT INTO config_catalogo (id, hero_titulo, hero_subtitulo, hero_destacado, hero_badge, banner_activo) VALUES (
                1,
                'EL FUTURO DE LA\nLUBRICACIÓN Y FILTROS\nDE PESADOS Y LIVIANOS\nLLEGÓ A SU TALLER',
                'Máxima potencia, más eficiencia y la mayor durabilidad para quien exige mucho del vehículo en ruta y ciudad.',
                'Lotes con -15% Mayorista',
                'Fabricación & Distribución Mayorista',
                1
            )`, (insErr) => {
                if (!insErr) console.log('📢 Configuración inicial del catálogo sembrada exitosamente.');
            });
        }
    });

    // 3. Tabla de Pedidos / Ventas Cabecera
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        estado TEXT NOT NULL DEFAULT 'PENDIENTE',
        fecha_compra DATETIME DEFAULT CURRENT_TIMESTAMP,
        metodo_pago TEXT DEFAULT 'QR_SIMPLE',
        comprobante_ref TEXT,
        banco_origen TEXT,
        comprobante_img TEXT,
        estado_pago TEXT DEFAULT 'PENDIENTE',
        estado_logistica TEXT DEFAULT 'ORDEN RECIBIDA / PAGO VERIFICADO',
        empaque_checklist TEXT,
        empaque_tipo TEXT,
        empaque_bultos INTEGER DEFAULT 1,
        empaque_peso DECIMAL(10,2) DEFAULT 0.00,
        empaque_responsable TEXT,
        empaque_fecha DATETIME,
        despacho_chofer TEXT,
        despacho_placa TEXT,
        despacho_fecha DATETIME,
        entrega_receptor_nombre TEXT,
        entrega_receptor_ci TEXT,
        entrega_pin TEXT,
        entrega_observaciones TEXT,
        entrega_fecha DATETIME,
        FOREIGN KEY (cliente_id) REFERENCES usuarios(id)
    )`);

    // Migraciones automáticas de columnas adicionales para pedidos si la tabla ya existía
    db.all("PRAGMA table_info(pedidos)", (err, cols) => {
        if (!err && cols) {
            const colNames = cols.map(c => c.name);
            const colsToAdd = [
                { name: 'metodo_pago', type: "TEXT DEFAULT 'QR_SIMPLE'" },
                { name: 'comprobante_ref', type: 'TEXT' },
                { name: 'banco_origen', type: 'TEXT' },
                { name: 'comprobante_img', type: 'TEXT' },
                { name: 'estado_pago', type: "TEXT DEFAULT 'PENDIENTE'" },
                { name: 'estado_logistica', type: "TEXT DEFAULT 'ORDEN RECIBIDA / PAGO VERIFICADO'" },
                { name: 'empaque_checklist', type: 'TEXT' },
                { name: 'empaque_tipo', type: 'TEXT' },
                { name: 'empaque_bultos', type: 'INTEGER DEFAULT 1' },
                { name: 'empaque_peso', type: 'DECIMAL(10,2) DEFAULT 0.00' },
                { name: 'empaque_responsable', type: 'TEXT' },
                { name: 'empaque_fecha', type: 'DATETIME' },
                { name: 'despacho_chofer', type: 'TEXT' },
                { name: 'despacho_placa', type: 'TEXT' },
                { name: 'despacho_fecha', type: 'DATETIME' },
                { name: 'entrega_receptor_nombre', type: 'TEXT' },
                { name: 'entrega_receptor_ci', type: 'TEXT' },
                { name: 'entrega_pin', type: 'TEXT' },
                { name: 'entrega_observaciones', type: 'TEXT' },
                { name: 'entrega_fecha', type: 'DATETIME' }
            ];

            colsToAdd.forEach(c => {
                if (!colNames.includes(c.name)) {
                    db.run(`ALTER TABLE pedidos ADD COLUMN ${c.name} ${c.type}`, (aErr) => {
                        if (!aErr) console.log(`📦 Columna '${c.name}' agregada a pedidos`);
                    });
                }
            });
        }
    });

    // 4. Tabla de Detalles de Pedido (Items comprados para consistencia histórica)
    db.run(`CREATE TABLE IF NOT EXISTS pedido_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        producto_nombre TEXT NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id)
    )`);

    // 4.1 Tabla de Kardex Físico y Movimientos de Inventario
    db.run(`CREATE TABLE IF NOT EXISTS kardex (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        cantidad INTEGER NOT NULL,
        stock_anterior INTEGER NOT NULL,
        stock_nuevo INTEGER NOT NULL,
        motivo TEXT,
        referencia_id INTEGER,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES productos(id)
    )`);

    // 5. Tabla de Proveedores (Módulo SCM)
    db.run(`CREATE TABLE IF NOT EXISTS proveedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        razon_social TEXT NOT NULL,
        telefono TEXT,
        email TEXT,
        direccion TEXT,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 6. Tabla de Compras / Órdenes de Suministro (SCM)
    db.run(`CREATE TABLE IF NOT EXISTS compras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proveedor_id INTEGER NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        estado TEXT NOT NULL DEFAULT 'COMPLETADO',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
    )`);

    // 7. Tabla de Detalles de Compras
    db.run(`CREATE TABLE IF NOT EXISTS compras_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        compra_id INTEGER NOT NULL,
        sku TEXT NOT NULL,
        cantidad INTEGER NOT NULL,
        costo_unitario DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE
    )`);

    // 8. Tabla de Líneas de Crédito B2B
    db.run(`CREATE TABLE IF NOT EXISTS creditos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL UNIQUE,
        limite_credito DECIMAL(10,2) NOT NULL DEFAULT 5000.00,
        saldo_deudor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        estado TEXT NOT NULL DEFAULT 'ACTIVO',
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES usuarios(id)
    )`);

    // 9. Tabla de Pagos y Amortizaciones de Crédito B2B
    db.run(`CREATE TABLE IF NOT EXISTS pagos_credito (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        monto DECIMAL(10,2) NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES usuarios(id)
    )`);

    // 10. Tabla de Auditoría y Trazabilidad del Sistema
    db.run(`CREATE TABLE IF NOT EXISTS auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_nombre TEXT NOT NULL,
        accion TEXT NOT NULL,
        modulo TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 11. Semillas iniciales Enterprise (Proveedores, Créditos y Auditoría)
    db.get('SELECT COUNT(*) as count FROM proveedores', (err, row) => {
        if (!err && row && row.count === 0) {
            db.run(`INSERT INTO proveedores (razon_social, telefono, email, direccion) VALUES
                ('Importadora Lubricantes del Sur S.R.L.', '+591 77012345', 'ventas@lubrisur.bo', 'Av. Cristo Redentor #450, Santa Cruz'),
                ('Filtros & Filtros Bolivia S.A.', '+591 71234567', 'contacto@filtrosbolivia.bo', 'Parque Industrial Mz. 12, Cochabamba'),
                ('Distribuidora Automotriz Tokio', '+591 78901234', 'pedidos@tokioauto.bo', 'Av. 6 de Agosto #890, La Paz')
            `);
        }
    });

    db.get('SELECT COUNT(*) as count FROM creditos', (err, row) => {
        if (!err && row && row.count === 0) {
            // Verificar si existen usuarios clientes
            db.all('SELECT id FROM usuarios WHERE rol IN (\'CLIENTE_B2B\', \'CLIENTE_B2C\')', (uErr, users) => {
                if (!uErr && users && users.length > 0) {
                    const u1 = users[0].id;
                    db.run(`INSERT OR IGNORE INTO creditos (cliente_id, limite_credito, saldo_deudor, estado) VALUES (?, 10000.00, 2450.00, 'ACTIVO')`, [u1]);
                    db.run(`INSERT INTO pagos_credito (cliente_id, monto) VALUES (?, 1000.00)`, [u1]);
                    if (users.length > 1) {
                        const u2 = users[1].id;
                        db.run(`INSERT OR IGNORE INTO creditos (cliente_id, limite_credito, saldo_deudor, estado) VALUES (?, 8000.00, 800.00, 'ACTIVO')`, [u2]);
                        db.run(`INSERT INTO pagos_credito (cliente_id, monto) VALUES (?, 500.00)`, [u2]);
                    }
                }
            });
        }
    });

    db.get('SELECT COUNT(*) as count FROM auditoria', (err, row) => {
        if (!err && row && row.count === 0) {
            db.run(`INSERT INTO auditoria (usuario_nombre, accion, modulo) VALUES
                ('SISTEMA ERP', 'Inicialización de módulos Enterprise (SCM, Créditos B2B y Auditoría)', 'SISTEMA')
            `);
        }
    });

    // 12. Semillas iniciales para los Roles del Sistema (ADMIN, EMPAQUE, DESPACHO, CLIENTE, TRABAJADOR)
    const usuariosRolesBase = [
        {
            email: 'admin@golden.bo',
            nombre: 'Administrador General (Gerencia)',
            password: 'admin123',
            rol: 'ADMIN'
        },
        {
            email: 'empaque@golden.bo',
            nombre: 'Marcos Almacén (Encargado de Empaque)',
            password: 'empaque123',
            rol: 'EMPAQUE'
        },
        {
            email: 'despacho@golden.bo',
            nombre: 'Rodrigo Chofer (Encargado de Entrega)',
            password: 'despacho123',
            rol: 'DESPACHO'
        },
        {
            email: 'cliente@golden.bo',
            nombre: 'Taller Mecánico Central',
            password: 'cliente123',
            rol: 'CLIENTE'
        },
        {
            email: 'trabajador@golden.bo',
            nombre: 'Encargado de Almacén & Ventas',
            password: 'trabajador123',
            rol: 'TRABAJADOR'
        }
    ];

    usuariosRolesBase.forEach(u => {
        db.get(`SELECT id, rol FROM usuarios WHERE LOWER(email) = LOWER(?)`, [u.email], (err, row) => {
            if (err) return;
            const hash = bcrypt.hashSync(u.password, 10);
            if (!row) {
                db.run(
                    `INSERT INTO usuarios (nombre, email, password, rol, estado) VALUES (?, ?, ?, ?, ?)`,
                    [u.nombre, u.email, hash, u.rol, 'ACTIVO'],
                    (insErr) => {
                        if (!insErr) console.log(`👤 Usuario inicial creado: ${u.email} (${u.rol})`);
                    }
                );
            } else {
                db.run(
                    `UPDATE usuarios SET password = ?, rol = ? WHERE id = ?`,
                    [hash, u.rol, row.id],
                    (updErr) => {
                        if (!updErr) console.log(`👤 Credenciales sincronizadas para rol base: ${u.email} (${u.rol})`);
                    }
                );
            }
        });
    });
});

module.exports = db;
