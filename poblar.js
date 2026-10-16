const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Nos conectamos a tu base de datos
const dbPath = path.resolve(__dirname, 'backend/golden_seguridad.db');
const db = new sqlite3.Database(dbPath);

console.log("⏳ Inyectando datos SQL a la base de datos...");

db.serialize(() => {
    // 1. INYECTAR USUARIOS (Contraseña para todos: 123456)
    const hash = bcrypt.hashSync('123456', 10);
    db.run(`
        INSERT INTO usuarios (nombre, email, password, rol, estado) VALUES 
        ('Taller Los Primos', 'primos@golden.bo', '${hash}', 'CLIENTE_B2B', 'ACTIVO'),
        ('Lubricentro Rayo', 'rayo@golden.bo', '${hash}', 'CLIENTE_B2B', 'ACTIVO'),
        ('Carlos Repartidor', 'carlos@golden.bo', '${hash}', 'REPARTIDOR', 'ACTIVO')
    `);

    // 2. INYECTAR PRODUCTOS (Con diferentes niveles de stock)
    db.run(`
        INSERT INTO productos (sku, nombre, categoria, precio, stock, stock_minimo) VALUES 
        ('ACE-MIN-001', 'Aceite Mineral 20W-50', 'Aceites Minerales', 120.50, 50, 10),
        ('ACE-SIN-002', 'Aceite Sintético 5W-30', 'Aceites Sintéticos', 250.00, 3, 5), 
        ('FIL-ACE-010', 'Filtro de Aceite Nissan', 'Filtros de Aceite', 45.00, 15, 5),
        ('FIL-AIR-005', 'Filtro de Aire Hilux', 'Filtros de Aire', 60.00, 2, 10), 
        ('ACE-MIN-003', 'Aceite Mineral 40W', 'Aceites Minerales', 110.00, 100, 20)
    `);

    // 3. INYECTAR VENTAS / PEDIDOS (Para que el Dashboard muestre ganancias)
    db.run(`
        INSERT INTO pedidos (cliente_id, total, estado, fecha_compra) VALUES 
        (2, 361.50, 'ENTREGADO', datetime('now', '-2 days')),
        (3, 250.00, 'EN CAMINO', datetime('now', '-1 days')),
        (2, 105.00, 'PENDIENTE', datetime('now'))
    `);

    console.log("✅ ¡Datos SQL insertados correctamente!");
    console.log("👉 Ve a tu navegador y abre el Dashboard.");
});