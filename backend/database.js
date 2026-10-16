const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'golden_seguridad.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con SQLite:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite (golden_seguridad.db)');
    }
});

db.serialize(() => {
    // Crear tabla de usuarios
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            rol TEXT NOT NULL CHECK(rol IN ('ADMIN', 'ALMACENERO', 'REPARTIDOR', 'CLIENTE_B2B', 'CLIENTE_B2C')),
            estado TEXT DEFAULT 'ACTIVO' CHECK(estado IN ('ACTIVO', 'INACTIVO')),
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insertar usuario Administrador por defecto si no existe
    const emailAdmin = 'admin@golden.bo';
    db.get(`SELECT * FROM usuarios WHERE email = ?`, [emailAdmin], (err, row) => {
        if (!row) {
            const hash = bcrypt.hashSync('admin123', 10);
            db.run(
                `INSERT INTO usuarios (nombre, email, password, rol, estado) VALUES (?, ?, ?, ?, ?)`,
                ['Administrador GOLDEN', emailAdmin, hash, 'ADMIN', 'ACTIVO'],
                () => console.log('Usuario por defecto creado -> Email: admin@golden.bo | Pass: admin123')
            );
        }
    });
});

module.exports = db;