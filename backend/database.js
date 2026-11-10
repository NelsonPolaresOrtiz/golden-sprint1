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
            const hasImg = cols.some(c => c.name === 'imagen_url');
            const hasSpecs = cols.some(c => c.name === 'especificaciones');
            if (!hasImg) {
                db.run("ALTER TABLE productos ADD COLUMN imagen_url TEXT", (aErr) => {
                    if (!aErr) console.log("📸 Columna 'imagen_url' agregada a productos");
                });
            }
            if (!hasSpecs) {
                db.run("ALTER TABLE productos ADD COLUMN especificaciones TEXT", (sErr) => {
                    if (!sErr) console.log("📑 Columna 'especificaciones' agregada a productos");
                });
            }
        }
    });

    // 3. Tabla de Pedidos / Ventas Cabecera
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        estado TEXT NOT NULL DEFAULT 'PENDIENTE',
        fecha_compra DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES usuarios(id)
    )`);

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

    // 12. Semilla inicial de Administrador si la BD es nueva
    const emailAdmin = 'admin@golden.bo';
    db.get(`SELECT id FROM usuarios WHERE email = ?`, [emailAdmin], (err, row) => {
        if (err) {
            console.error('Error al verificar admin inicial:', err.message);
            return;
        }
        if (!row) {
            const hash = bcrypt.hashSync('admin123', 10);
            db.run(
                `INSERT INTO usuarios (nombre, email, password, rol, estado) VALUES (?, ?, ?, ?, ?)`,
                ['Administrador GOLDEN', emailAdmin, hash, 'ADMIN', 'ACTIVO'],
                (insertErr) => {
                    if (insertErr) console.error('Error al crear usuario admin:', insertErr.message);
                    else console.log('👤 Administrador inicial creado (admin@golden.bo / admin123)');
                }
            );
        }
    });
});

module.exports = db;
