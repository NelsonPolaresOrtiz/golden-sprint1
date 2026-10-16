const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.set('etag', false);
app.use((req, res, next) => { res.set('Cache-Control', 'no-store, no-cache'); next(); });
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// CRUD INVENTARIO
app.get('/api/productos', (req, res) => db.all(`SELECT * FROM productos ORDER BY id DESC`, [], (err, rows) => res.json(rows)));
app.post('/api/productos', (req, res) => {
    db.run(`INSERT INTO productos (sku, nombre, categoria, precio, stock, stock_minimo) VALUES (?, ?, ?, ?, ?, ?)`, 
    [req.body.sku, req.body.nombre, req.body.categoria, req.body.precio, req.body.stock, 5], function(err) {
        if(err) return res.status(400).json({error: err.message}); res.status(201).json({id: this.lastID});
    });
});
app.put('/api/productos/:id', (req, res) => {
    db.run(`UPDATE productos SET sku=?, nombre=?, categoria=?, precio=?, stock=? WHERE id=?`, 
    [req.body.sku, req.body.nombre, req.body.categoria, req.body.precio, req.body.stock, req.params.id], () => res.json({mensaje: 'OK'}));
});
app.delete('/api/productos/:id', (req, res) => db.run(`DELETE FROM productos WHERE id=?`, [req.params.id], () => res.json({mensaje: 'OK'})));

// SEGURIDAD Y USUARIOS
app.post('/api/auth/login', (req, res) => {
    db.get(`SELECT * FROM usuarios WHERE email = ?`, [req.body.email], (err, user) => {
        if (!user || user.estado === 'INACTIVO' || !bcrypt.compareSync(req.body.password, user.password)) return res.status(401).json({ error: 'Error' });
        res.json({ usuario: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
    });
});
app.get('/api/usuarios', (req, res) => db.all(`SELECT id, nombre, email, rol, estado FROM usuarios ORDER BY id DESC`, [], (err, rows) => res.json(rows)));
app.post('/api/usuarios', (req, res) => {
    db.run(`INSERT INTO usuarios (nombre, email, password, rol, estado) VALUES (?, ?, ?, ?, ?)`, 
    [req.body.nombre, req.body.email, bcrypt.hashSync(req.body.password, 10), req.body.rol, req.body.estado], function(err) {
        if(err) return res.status(400).json({error: 'Error'}); res.status(201).json({id: this.lastID});
    });
});
app.delete('/api/usuarios/:id', (req, res) => db.run(`DELETE FROM usuarios WHERE id=?`, [req.params.id], () => res.json({mensaje: 'OK'})));

// ==========================================
// VENTAS Y LOGÍSTICA (Cajero y Repartidor)
// ==========================================
app.post('/api/ventas', (req, res) => {
    db.run(`INSERT INTO pedidos (cliente_id, total, estado) VALUES (?, ?, 'PENDIENTE')`, [req.body.cliente_id, req.body.total], function(err) {
        if(err) return res.status(500).json({error: 'Error al registrar pedido: ' + err.message});
        
        const pedidoId = this.lastID;
        // Descontar inventario
        req.body.carrito.forEach(item => {
            db.run(`UPDATE productos SET stock = stock - ? WHERE id = ?`, [item.cantidad, item.id]);
        });
        res.status(201).json({ pedidoId });
    });
});

app.get('/api/pedidos', (req, res) => {
    const sql = `SELECT p.id, p.total, p.estado, p.fecha_compra, u.nombre as cliente FROM pedidos p JOIN usuarios u ON p.cliente_id = u.id ORDER BY p.id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error SQL en Pedidos:", err.message);
            return res.status(500).json({ error: 'Error en la base de datos' });
        }
        res.json(rows || []);
    });
});

app.put('/api/pedidos/:id/estado', (req, res) => {
    db.run(`UPDATE pedidos SET estado = ? WHERE id = ?`, [req.body.estado, req.params.id], function(err) {
        if (err) return res.status(500).json({error: err.message});
        res.json({mensaje: 'Estado actualizado'});
    });
});

// ==========================================
// 5. ENDPOINT DE DASHBOARD (ANALÍTICA)
// ==========================================
app.get('/api/estadisticas', (req, res) => {
    db.serialize(() => {
        let stats = {};
        
        // 1. Sumar ingresos y contar ventas
        db.get(`SELECT SUM(total) as ingresos, COUNT(id) as ventas FROM pedidos`, [], (err, row) => {
            stats.ingresos = row.ingresos || 0;
            stats.ventas = row.ventas || 0;
            
            // 2. Contar productos con stock crítico
            db.get(`SELECT COUNT(id) as bajo_stock FROM productos WHERE stock <= stock_minimo`, [], (err, row2) => {
                stats.bajo_stock = row2.bajo_stock || 0;
                
                // 3. Traer las últimas 5 transacciones
                db.all(`SELECT p.id, u.nombre as cliente, p.total, p.estado, p.fecha_compra FROM pedidos p JOIN usuarios u ON p.cliente_id = u.id ORDER BY p.id DESC LIMIT 5`, [], (err, rows) => {
                    stats.ultimos_pedidos = rows || [];
                    res.json(stats);
                });
            });
        });
    });
});

// ¡ESTO SIEMPRE VA AL FINAL!
app.listen(PORT, () => console.log(`🚀 Servidor ERP GOLDEN en http://localhost:${PORT}`));