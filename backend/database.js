const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'golden_seguridad.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error al conectar:', err.message);
    else console.log('Conectado a la BD SQLite');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL, rol TEXT NOT NULL, estado TEXT DEFAULT 'ACTIVO',
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL,
        categoria TEXT NOT NULL, precio DECIMAL(10,2) NOT NULL, stock INTEGER NOT NULL DEFAULT 0,
        stock_minimo INTEGER NOT NULL DEFAULT 5, fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // TABLA DE PEDIDOS ACTUALIZADA
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        estado TEXT DEFAULT 'PENDIENTE',
        fecha_compra DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES usuarios(id)
    )`);

    const emailAdmin = 'admin@golden.bo';
    db.get(`SELECT * FROM usuarios WHERE email = ?`, [emailAdmin], (err, row) => {
        if (!row) {
            const hash = bcrypt.hashSync('admin123', 10);
            db.run(`INSERT INTO usuarios (nombre, email, password, rol, estado) VALUES (?, ?, ?, ?, ?)`,
                ['Administrador GOLDEN', emailAdmin, hash, 'ADMIN', 'ACTIVO']);
        }
    });
});
module.exports = db;