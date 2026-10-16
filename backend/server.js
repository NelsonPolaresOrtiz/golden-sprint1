const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// 1. ENDPOINT DE AUTENTICACIÓN (LOGIN)
// ==========================================
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Ingrese correo y contraseña' });
    }

    db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Error en el servidor' });
        if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

        if (user.estado === 'INACTIVO') {
            return res.status(403).json({ error: 'Esta cuenta de usuario está inactiva' });
        }

        const passwordValido = bcrypt.compareSync(password, user.password);
        if (!passwordValido) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        res.json({
            mensaje: 'Inicio de sesión exitoso',
            usuario: {
                id: user.id,
                nombre: user.nombre,
                email: user.email,
                rol: user.rol,
                estado: user.estado
            }
        });
    });
});

// ==========================================
// 2. ENDPOINTS CRUD DE USUARIOS
// ==========================================

// LEER TODOS LOS USUARIOS (READ)
app.get('/api/usuarios', (req, res) => {
    const sql = `SELECT id, nombre, email, rol, estado, fecha_creacion FROM usuarios ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// CREAR USUARIO (CREATE)
app.post('/api/usuarios', (req, res) => {
    const { nombre, email, password, rol, estado } = req.body;

    if (!nombre || !email || !password || !rol) {
        return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const estadoFinal = estado || 'ACTIVO';

    const sql = `INSERT INTO usuarios (nombre, email, password, rol, estado) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [nombre, email, hash, rol, estadoFinal], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            mensaje: 'Usuario creado exitosamente',
            id: this.lastID
        });
    });
});

// ACTUALIZAR USUARIO (UPDATE)
app.put('/api/usuarios/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, email, password, rol, estado } = req.body;

    if (!nombre || !email || !rol || !estado) {
        return res.status(400).json({ error: 'Nombre, email, rol y estado son requeridos' });
    }

    // Si se envía una nueva contraseña, se actualiza también el hash
    if (password && password.trim() !== '') {
        const hash = bcrypt.hashSync(password, 10);
        const sql = `UPDATE usuarios SET nombre = ?, email = ?, password = ?, rol = ?, estado = ? WHERE id = ?`;
        db.run(sql, [nombre, email, hash, rol, estado, id], function (err) {
            if (err) return res.status(400).json({ error: 'Error al actualizar: verifique que el correo no esté duplicado' });
            res.json({ mensaje: 'Usuario y contraseña actualizados correctamente' });
        });
    } else {
        const sql = `UPDATE usuarios SET nombre = ?, email = ?, rol = ?, estado = ? WHERE id = ?`;
        db.run(sql, [nombre, email, rol, estado, id], function (err) {
            if (err) return res.status(400).json({ error: 'Error al actualizar: verifique que el correo no esté duplicado' });
            res.json({ mensaje: 'Usuario actualizado correctamente' });
        });
    }
});

// ELIMINAR USUARIO (DELETE)
app.delete('/api/usuarios/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM usuarios WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Usuario eliminado correctamente' });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});