/**
 * ============================================================================
 * GOLDEN LUBRICANTES & FILTROS - SUCRE, BOLIVIA
 * BOT INTELIGENTE DE ATENCIÓN Y SOPORTE WHATSAPP (+591 67375645)
 * ============================================================================
 * Tecnologías: @whiskeysockets/baileys, qrcode-terminal, sqlite3, pino
 * Funcionalidades:
 *  1. Menú conversacional guiado e interactivo para talleres mecánicos y clientes.
 *  2. Consulta de stock y precios mayoristas en tiempo real (tabla 'productos').
 *  3. Rastreo en vivo de pedidos y despachos (tabla 'pedidos').
 *  4. Registro automatizado de cotizaciones mayoristas (tabla 'tickets_soporte').
 *  5. Asistencia técnica y registro de reclamos con correlativo #TK-000X.
 *  6. Información institucional y catálogo oficial en Sucre, Bolivia.
 * ============================================================================
 */

const path = require('path');
const fs = require('fs');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const db = require('./database');

// Importar Baileys de forma compatible
const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default || baileys.makeWASocket;
const { useMultiFileAuthState, DisconnectReason } = baileys;

// Directorio de autenticación persistente para WhatsApp
const AUTH_DIR = path.resolve(__dirname, 'auth_whatsapp');
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Configuración corporativa oficial
const CONFIG = {
    empresa: 'GOLDEN Lubricantes & Filtros',
    ciudad: 'Sucre, Bolivia',
    direccion: 'Av. Jaime Mendoza #1420, Sucre, Bolivia',
    telefonoFijo: '(4) 64-52890',
    whatsappOficial: '+591 67375645',
    catalogoWeb: 'https://golden-sprint1.onrender.com/tienda.html',
    portalClientesWeb: 'https://golden-sprint1.onrender.com/?modo=cliente',
    horario: 'Lunes a Sábado de 08:00 a 18:30 (Continuado)',
    pausaHumanaMs: 1200,
    tiempoExpiracionSesionMs: 15 * 60 * 1000 // 15 minutos
};

// Separador minimalista editorial para WhatsApp
const SEPARADOR = '──────────────────────────';

// Número oficial de Gerencia / Administración para Alertas Proactivas
const ADMIN_WHATSAPP = '59167375645@s.whatsapp.net';
const ADMIN_PHONE_RAW = '59167375645';

// Instancia global en memoria del socket de WhatsApp, estados y QR
let socketActivo = null;
let estaConectado = false;
let procesadorColaTimer = null;
let iniciandoBot = false;
let ultimoQR = null;
let qrDataUrl = null;
let fechaUltimoQR = null;

// Memoria de sesiones y estados conversacionales de usuarios
// remoteJid -> { estado: string, data: object, ultimoAcceso: number, nombre: string }
const sesionesUsuarios = new Map();

/**
 * Utilidad: Ejecutar consultas SQLite con Promesas
 */
const dbQuery = {
    all: (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    }),
    get: (sql, params = []) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    }),
    run: (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    })
};

/**
 * ============================================================================
 * ADAPTADOR DE PERSISTENCIA DE SESIÓN EN SQLITE (RENDER / CLOUD READY)
 * ============================================================================
 * Sincroniza los archivos de sesión de Baileys con la tabla 'whatsapp_sesion'
 * para mantener la vinculación activa tras reinicios del dyno/contenedor.
 */
async function restaurarSesionDesdeDB() {
    try {
        const filas = await dbQuery.all(`SELECT clave, valor FROM whatsapp_sesion`);
        if (filas && filas.length > 0) {
            if (!fs.existsSync(AUTH_DIR)) {
                fs.mkdirSync(AUTH_DIR, { recursive: true });
            }
            for (const item of filas) {
                const filePath = path.join(AUTH_DIR, item.clave);
                fs.writeFileSync(filePath, item.valor, 'utf-8');
            }
            console.log(`[WhatsApp Bot] Se restauraron ${filas.length} credenciales de sesión desde SQLite.`);
            return true;
        }
        return false;
    } catch (err) {
        console.warn('[WhatsApp Bot] Advertencia al restaurar sesión de SQLite:', err.message);
        return false;
    }
}

// Archivo de bloqueo para garantizar una única instancia activa del bot en segundo plano
const LOCK_FILE = path.join(__dirname, '.whatsapp_bot.lock');

function verificarInstanciaActiva() {
    try {
        if (!fs.existsSync(LOCK_FILE)) return false;
        const contenido = fs.readFileSync(LOCK_FILE, 'utf8').trim();
        const pid = parseInt(contenido, 10);
        if (isNaN(pid)) return false;
        if (pid === process.pid) return pid;
        try {
            process.kill(pid, 0); // Señal 0 comprueba existencia sin alterar el proceso
            return pid;
        } catch (e) {
            try { fs.unlinkSync(LOCK_FILE); } catch (err) {}
            return false;
        }
    } catch (e) {
        return false;
    }
}

function adquirirBloqueoInstancia() {
    const pidActivo = verificarInstanciaActiva();
    if (pidActivo && pidActivo !== process.pid) {
        return false;
    }
    try {
        fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
        return true;
    } catch (e) {
        return false;
    }
}

function liberarBloqueoInstancia() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            const contenido = fs.readFileSync(LOCK_FILE, 'utf8').trim();
            if (parseInt(contenido, 10) === process.pid) {
                fs.unlinkSync(LOCK_FILE);
            }
        }
    } catch (e) {}
}

process.on('exit', liberarBloqueoInstancia);
process.on('SIGINT', () => { liberarBloqueoInstancia(); process.exit(0); });
process.on('SIGTERM', () => { liberarBloqueoInstancia(); process.exit(0); });

let respaldoDebounceTimer = null;
let respaldandoSesionActivo = false;
const archivosMtimeCache = new Map();

function programarRespaldoSesion() {
    if (respaldoDebounceTimer) clearTimeout(respaldoDebounceTimer);
    respaldoDebounceTimer = setTimeout(() => {
        respaldarSesionEnDB().catch(e => console.warn('[WhatsApp Bot] Error en respaldo:', e.message));
    }, 2000);
}

async function respaldarSesionEnDB() {
    if (!fs.existsSync(AUTH_DIR) || respaldandoSesionActivo) return;
    respaldandoSesionActivo = true;

    try {
        const archivos = fs.readdirSync(AUTH_DIR);
        const aGuardar = [];

        for (const archivo of archivos) {
            const filePath = path.join(AUTH_DIR, archivo);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    const cacheMtime = archivosMtimeCache.get(archivo);
                    if (!cacheMtime || cacheMtime < stat.mtimeMs) {
                        const contenido = fs.readFileSync(filePath, 'utf-8');
                        aGuardar.push({ archivo, contenido, mtime: stat.mtimeMs });
                    }
                }
            } catch (readErr) {}
        }

        if (aGuardar.length === 0) {
            respaldandoSesionActivo = false;
            return;
        }

        // Ejecutar en una sola transacción atómica de SQLite con prepared statement
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
                    if (beginErr) return reject(beginErr);

                    const stmt = db.prepare(`
                        INSERT INTO whatsapp_sesion (clave, valor, fecha_actualizacion) 
                        VALUES (?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, fecha_actualizacion = CURRENT_TIMESTAMP
                    `);

                    for (const item of aGuardar) {
                        stmt.run(item.archivo, item.contenido);
                    }

                    stmt.finalize((finalErr) => {
                        if (finalErr) {
                            db.run('ROLLBACK', () => reject(finalErr));
                        } else {
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) reject(commitErr);
                                else resolve();
                            });
                        }
                    });
                });
            });
        });

        // Actualizar caché de timestamps
        for (const item of aGuardar) {
            archivosMtimeCache.set(item.archivo, item.mtime);
        }

        console.log(`[WhatsApp Bot] Sesión sincronizada en SQLite (${aGuardar.length} archivos actualizados).`);
    } catch (err) {
        console.warn('[WhatsApp Bot] Advertencia al respaldar sesión en SQLite:', err.message);
    } finally {
        respaldandoSesionActivo = false;
    }
}

async function limpiarSesionEnDB() {
    try {
        await dbQuery.run(`DELETE FROM whatsapp_sesion`);
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        ultimoQR = null;
        qrDataUrl = null;
        fechaUltimoQR = null;
        console.log('[WhatsApp Bot] Sesión eliminada de SQLite y disco local para reiniciar vinculación.');
    } catch (err) {
        console.warn('[WhatsApp Bot] Error al limpiar sesión:', err.message);
    }
}

/**
 * Consultar estado de conexión del Bot y QR actual para el panel web del ERP
 */
function obtenerEstadoWhatsApp() {
    const pidActivo = verificarInstanciaActiva();
    const activo = Boolean(estaConectado || (pidActivo && pidActivo !== process.pid));
    return {
        conectado: activo,
        numero: CONFIG.whatsappOficial,
        adminJid: ADMIN_WHATSAPP,
        qrDataUrl: !activo ? qrDataUrl : null,
        fechaQR: fechaUltimoQR,
        tiempoRestanteQR: fechaUltimoQR ? Math.max(0, 25 - Math.floor((Date.now() - new Date(fechaUltimoQR).getTime()) / 1000)) : 0
    };
}

/**
 * ============================================================================
 * NOTIFICACIONES PROACTIVAS WHATSAPP A GERENCIA (+591 67375645)
 * ============================================================================
 * Envía mensajes proactivos de alerta sin lanzar excepciones ni romper el servidor
 * si la sesión aún no está conectada.
 */
async function enviarAlertaAdmin(texto) {
    if (!texto || typeof texto !== 'string' || !texto.trim()) return false;
    const mensajeLimpio = texto.trim();

    try {
        // 1. Si el socket está en memoria y la conexión está abierta, enviar inmediatamente
        if (socketActivo && estaConectado) {
            await socketActivo.sendMessage(ADMIN_WHATSAPP, { text: mensajeLimpio });
            console.log('[WhatsApp Alerta] Notificación proactiva enviada a Gerencia (+591 67375645)');
            return true;
        }

        // 2. Si no hay conexión en vivo en este hilo o corre en proceso separado,
        // persistir en SQLite (tabla 'cola_alertas_whatsapp') para entrega garantizada
        db.run(
            `INSERT INTO cola_alertas_whatsapp (mensaje, estado) VALUES (?, 'PENDIENTE')`,
            [mensajeLimpio],
            (err) => {
                if (err) {
                    console.warn('[WhatsApp Alerta] Advertencia al encolar alerta en SQLite:', err.message);
                } else {
                    console.log('[WhatsApp Alerta] Alerta administrativa registrada en cola SQLite para despacho automático');
                }
            }
        );
        return true;
    } catch (err) {
        console.warn('[WhatsApp Alerta] No se pudo procesar la alerta proactiva:', err.message);
        return false;
    }
}

/**
 * Despachador periódico de la cola de alertas en SQLite
 */
async function procesarColaAlertas() {
    if (!socketActivo || !estaConectado) return;

    try {
        const pendientes = await dbQuery.all(
            `SELECT id, mensaje FROM cola_alertas_whatsapp WHERE estado = 'PENDIENTE' ORDER BY id ASC LIMIT 5`
        );

        if (!pendientes || pendientes.length === 0) return;

        for (const item of pendientes) {
            try {
                await socketActivo.sendMessage(ADMIN_WHATSAPP, { text: item.mensaje });
                await dbQuery.run(
                    `UPDATE cola_alertas_whatsapp SET estado = 'ENVIADO', fecha_envio = CURRENT_TIMESTAMP WHERE id = ?`,
                    [item.id]
                );
                console.log(`[WhatsApp Alerta] Alerta encolada #${item.id} entregada exitosamente a Gerencia`);
                await new Promise(r => setTimeout(r, 600));
            } catch (envErr) {
                console.warn(`[WhatsApp Alerta] Error al despachar alerta #${item.id}:`, envErr.message);
                break;
            }
        }
    } catch (err) {
        console.warn('[WhatsApp Alerta] Error en procesarColaAlertas:', err.message);
    }
}

/**
 * COMANDO EXCLUSIVO GERENCIAL: Generar Resumen del Día
 */
async function generarResumenGerencial() {
    try {
        // 1. Total ventas hoy y pedidos hoy
        const sqlVentas = `
            SELECT COALESCE(SUM(total), 0) as total_ventas, COUNT(id) as cant_ventas
            FROM pedidos
            WHERE (date(fecha_compra) = date('now') OR date(fecha_compra) = date('now', 'localtime'))
        `;
        const resumenVentas = await dbQuery.get(sqlVentas);
        const totalVentas = Number(resumenVentas?.total_ventas || 0);
        const cantVentas = Number(resumenVentas?.cant_ventas || 0);

        // 2. Pedidos pendientes de entrega
        const sqlPendientes = `
            SELECT COUNT(id) as pendientes
            FROM pedidos
            WHERE UPPER(estado) != 'ENTREGADO' 
              AND UPPER(COALESCE(estado_logistica, '')) NOT LIKE '%ENTREGADO%'
        `;
        const resumenPendientes = await dbQuery.get(sqlPendientes);
        const pendientesEntrega = Number(resumenPendientes?.pendientes || 0);

        // 3. Productos en alerta de stock bajo
        const sqlStockBajo = `
            SELECT id, sku, nombre, stock, COALESCE(stock_minimo, 5) as stock_minimo
            FROM productos
            WHERE stock <= COALESCE(stock_minimo, 5)
            ORDER BY stock ASC
        `;
        const productosBajoStock = await dbQuery.all(sqlStockBajo);
        const stockBajoCount = productosBajoStock.length;

        // 4. Tickets de soporte abiertos
        const sqlTickets = `
            SELECT COUNT(id) as abiertos
            FROM tickets_soporte
            WHERE estado = 'ABIERTO'
        `;
        const resumenTickets = await dbQuery.get(sqlTickets);
        const ticketsAbiertos = Number(resumenTickets?.abiertos || 0);

        let detalleStock = '';
        if (stockBajoCount > 0) {
            detalleStock = '\n  ↳ *Críticos:* ' + productosBajoStock.slice(0, 3).map(p => 
                `\`${p.sku}\` (${p.stock} unids)`
            ).join(', ');
            if (stockBajoCount > 3) {
                detalleStock += ` y ${stockBajoCount - 3} producto(s) más.`;
            }
        }

        const fechaHoy = new Date().toLocaleDateString('es-BO', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric' 
        });

        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `*RESUMEN GERENCIAL DEL DÍA*\n` +
            `Fecha: ${fechaHoy}\n\n` +
            `• *Ventas Hoy:* *Bs. ${totalVentas.toFixed(2)}* (${cantVentas} órdenes)\n` +
            `• *Despachos Pendientes:* ${pendientesEntrega} pedido(s) en curso\n` +
            `• *Stock Crítico:* ${stockBajoCount} repuesto(s)${detalleStock}\n` +
            `• *Tickets Abiertos:* ${ticketsAbiertos} caso(s)\n\n` +
            `${SEPARADOR}\n` +
            `_Escriba *MENU* para volver a la atención general._`;
    } catch (err) {
        console.error('[WhatsApp Bot] Error al generar resumen gerencial:', err);
        return `Ocurrió un error al consultar las métricas gerenciales: ${err.message}`;
    }
}

/**
 * Obtener o inicializar sesión de un usuario
 */
function obtenerSesion(remoteJid, nombreCliente) {
    const ahora = Date.now();
    let sesion = sesionesUsuarios.get(remoteJid);

    if (!sesion || (ahora - sesion.ultimoAcceso) > CONFIG.tiempoExpiracionSesionMs) {
        sesion = {
            estado: 'INICIO',
            data: {},
            ultimoAcceso: ahora,
            nombre: nombreCliente || 'Cliente'
        };
        sesionesUsuarios.set(remoteJid, sesion);
    } else {
        sesion.ultimoAcceso = ahora;
        if (nombreCliente && nombreCliente !== 'Cliente') {
            sesion.nombre = nombreCliente;
        }
    }
    return sesion;
}

/**
 * Limpiar estado conversacional
 */
function reiniciarSesion(remoteJid) {
    const sesion = sesionesUsuarios.get(remoteJid);
    if (sesion) {
        sesion.estado = 'INICIO';
        sesion.data = {};
        sesion.ultimoAcceso = Date.now();
    }
}

/**
 * Normalizar texto para reconocimiento de intenciones
 */
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/**
 * Texto del Menú Principal
 */
function obtenerTextoMenuPrincipal(nombre) {
    const saludo = nombre && nombre !== 'Cliente' ? `Hola *${nombre}*.` : 'Hola.';
    return `*${CONFIG.empresa}*\n` +
        `_Distribución Automotriz · Sucre, Bolivia_\n` +
        `${SEPARADOR}\n\n` +
        `${saludo} Seleccione una opción para atenderle:\n\n` +
        `*1* · Catálogo y precios (${CONFIG.catalogoWeb})\n` +
        `*2* · Consultar estado de pedido (ej: \`#0024\`)\n` +
        `*3* · Cotización mayorista para talleres\n` +
        `*4* · Métodos de pago y QR oficial\n` +
        `*5* · Horarios y ubicación en Sucre (${CONFIG.direccion.split(',')[0]})\n\n` +
        `${SEPARADOR}\n` +
        `_Responda con el número (1-5) o escriba directamente su consulta._`;
}

/**
 * Información de Métodos de Pago y QR Oficial (Opción 4)
 */
function obtenerTextoMetodosPago() {
    return `*${CONFIG.empresa}*\n` +
        `_Distribución Automotriz · Sucre, Bolivia_\n` +
        `${SEPARADOR}\n\n` +
        `*Métodos de Pago Oficiales*\n\n` +
        `• *QR Simple / Yape Bolivia:*\n` +
        `  Disponible en la tienda web o solicitando código directo.\n` +
        `  Titular: GOLDEN Lubricantes & Filtros\n\n` +
        `• *Transferencia Bancaria Nacional:*\n` +
        `  Banco Nacional de Bolivia (BNB)\n` +
        `  Cta. Corriente M/N: \`100-0897645-3\`\n` +
        `  NIT: \`1029384756\`\n\n` +
        `• *Efectivo contra entrega:*\n` +
        `  Habilitado para entregas en talleres dentro del radio urbano de Sucre.\n\n` +
        `${SEPARADOR}\n` +
        `_Al realizar su pago envíe su comprobante con el código de orden (ej: #0024)._`;
}

/**
 * Información de Horarios, Ubicación y Catálogo Web (Opción 5)
 */
function obtenerTextoUbicacionHorarios() {
    return `*${CONFIG.empresa}*\n` +
        `_Distribución Automotriz · Sucre, Bolivia_\n` +
        `${SEPARADOR}\n\n` +
        `*Almacén Central & Ubicación*\n\n` +
        `• *Dirección:* ${CONFIG.direccion}\n` +
        `• *Horario:* ${CONFIG.horario}\n` +
        `• *Teléfono Central:* ${CONFIG.telefonoFijo}\n` +
        `• *WhatsApp Oficial:* ${CONFIG.whatsappOficial}\n` +
        `• *Catálogo Web:* ${CONFIG.catalogoWeb}\n` +
        `• *Portal Clientes:* ${CONFIG.portalClientesWeb}\n\n` +
        `_Despachos diarios a talleres en Chuquisaca y envíos a Potosí y Cochabamba._\n\n` +
        `${SEPARADOR}\n` +
        `_Escriba *MENU* para volver a ver las opciones._`;
}

/**
 * LÓGICA DE ATENCIÓN: Procesar mensaje y retornar respuesta de texto
 */
async function responderMensaje(remoteJid, textoOriginal, remitenteNombre, telefonoCliente) {
    const sesion = obtenerSesion(remoteJid, remitenteNombre);
    const textoLimpio = String(textoOriginal || '').trim();
    const textoNorm = normalizarTexto(textoLimpio);

    // =========================================================================
    // 0. DETECCIÓN PRIORITARIA: NOTIFICACIÓN DE PEDIDO CONFIRMADO O COMPROBANTE
    // =========================================================================
    const esConfirmacionOComprobante =
        textoNorm.startsWith('pedido confirmado') ||
        textoNorm.startsWith('comprobante') ||
        /^pedido\s+confirmado\b/i.test(textoLimpio) ||
        /^comprobante\b/i.test(textoLimpio);

    if (esConfirmacionOComprobante) {
        reiniciarSesion(remoteJid);
        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `Hemos recibido el respaldo de su orden. Nuestro equipo de Cobranzas y Despacho validará el movimiento en breve.\n\n` +
            `${SEPARADOR}\n` +
            `_Escriba *MENU* para realizar otra consulta._`;
    }

    // =========================================================================
    // COMANDO EXCLUSIVO DE ADMINISTRACIÓN / GERENCIA (+591 67375645)
    // =========================================================================
    const numeroRemitente = String(remoteJid || '').split('@')[0].split(':')[0];
    const telRemitente = String(telefonoCliente || '');
    const esAdmin = numeroRemitente.includes(ADMIN_PHONE_RAW) ||
        telRemitente.includes('67375645') ||
        remoteJid === ADMIN_WHATSAPP;

    if (esAdmin && (textoNorm === 'resumen' || textoNorm === '/resumen' || textoNorm.includes('resumen gerencial'))) {
        reiniciarSesion(remoteJid);
        return await generarResumenGerencial();
    }

    // Comandos de reinicio inmediato y saludos
    const esSaludoOMenu = /^(hola|buen\s*dia|buenos\s*dias|buenas|buenas\s*tardes|buenas\s*noches|saludos|menu|inicio|empezar|ayuda|opciones)\b/i.test(textoNorm) ||
        ['menu', 'inicio', 'hola', 'ayuda', 'opciones'].includes(textoNorm);

    if (esSaludoOMenu) {
        reiniciarSesion(remoteJid);
        return obtenerTextoMenuPrincipal(sesion.nombre);
    }

    if (textoNorm === 'cancelar' || textoNorm === 'salir') {
        reiniciarSesion(remoteJid);
        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `Operación cancelada.\n\n` +
            `${SEPARADOR}\n` +
            `_Escriba *MENU* cuando desee realizar una nueva consulta._`;
    }

    // =========================================================================
    // ESTADOS ACTIVOS DE CONVERSACIÓN
    // =========================================================================
    if (sesion.estado === 'ESPERANDO_PRODUCTO') {
        reiniciarSesion(remoteJid);
        return await buscarProductos(textoOriginal);
    }

    if (sesion.estado === 'ESPERANDO_PEDIDO') {
        reiniciarSesion(remoteJid);
        return await rastrearPedido(textoOriginal);
    }

    if (sesion.estado === 'ESPERANDO_COTIZACION') {
        reiniciarSesion(remoteJid);
        return await registrarTicketSoporte({
            telefono: telefonoCliente,
            nombre: sesion.nombre,
            tipo: 'COTIZACION',
            mensaje: textoOriginal
        });
    }

    if (sesion.estado === 'ESPERANDO_RECLAMO') {
        reiniciarSesion(remoteJid);
        return await registrarTicketSoporte({
            telefono: telefonoCliente,
            nombre: sesion.nombre,
            tipo: 'RECLAMO',
            mensaje: textoOriginal
        });
    }

    // =========================================================================
    // CONSULTA DIRECTA DE PEDIDO POR FORMATO #ID O PED-XXXX
    // =========================================================================
    if (/^#\s*\d+\b/i.test(textoLimpio) || /^#?\s*ped-\d+\b/i.test(textoLimpio)) {
        return await rastrearPedido(textoLimpio);
    }

    // =========================================================================
    // RECONOCIMIENTO NATURAL DE PALABRAS CLAVE Y OPCIONES DEL MENÚ
    // =========================================================================

    // OPCIÓN 1: CATÁLOGO Y PRECIOS
    if (
        textoNorm.startsWith('1 ') ||
        textoNorm.startsWith('precio ') ||
        textoNorm.startsWith('precios ') ||
        textoNorm.startsWith('stock ') ||
        textoNorm.startsWith('buscar ') ||
        textoNorm.startsWith('aceite ') ||
        textoNorm.startsWith('aceites ') ||
        textoNorm.startsWith('filtro ') ||
        textoNorm.startsWith('filtros ')
    ) {
        const termino = textoOriginal.replace(/^(1|precio|precios|stock|buscar|aceite|aceites|filtro|filtros)\s+/i, '').trim();
        return await buscarProductos(termino);
    }

    if (
        textoNorm === '1' ||
        textoNorm === 'catalogo' ||
        textoNorm === 'precios' ||
        textoNorm === 'precio' ||
        textoNorm === 'stock' ||
        textoNorm === 'aceites' ||
        textoNorm === 'aceite' ||
        textoNorm === 'filtros' ||
        textoNorm === 'filtro' ||
        textoNorm === 'lubricante' ||
        textoNorm === 'lubricantes'
    ) {
        sesion.estado = 'ESPERANDO_PRODUCTO';
        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `*Catálogo y Precios Mayoristas*\n\n` +
            `Indique el código o descripción del repuesto que busca:\n` +
            `_(Ej: \`15W-40\`, \`W712\`, \`Castrol\`, \`Mobil\`, \`Tecfil\`, \`20W50\`)_\n\n` +
            `• Catálogo en línea: ${CONFIG.catalogoWeb}\n\n` +
            `${SEPARADOR}\n` +
            `_Escriba el producto o envíe *CANCELAR* para regresar._`;
    }

    // OPCIÓN 2: RASTREO DE PEDIDOS
    if (
        textoNorm.startsWith('2 ') ||
        textoNorm.startsWith('pedido ') ||
        textoNorm.startsWith('rastrear ') ||
        textoNorm.startsWith('rastreo ') ||
        textoNorm.startsWith('orden ') ||
        textoNorm.startsWith('estado ')
    ) {
        const idPedido = textoOriginal.replace(/^(2|pedido|rastrear|rastreo|orden|estado)\s+/i, '').trim();
        return await rastrearPedido(idPedido);
    }

    if (
        textoNorm === '2' ||
        textoNorm === 'rastreo' ||
        textoNorm === 'pedido' ||
        textoNorm === 'pedidos' ||
        textoNorm === 'orden' ||
        textoNorm === 'estado'
    ) {
        sesion.estado = 'ESPERANDO_PEDIDO';
        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `*Consulta de Estado de Pedido*\n\n` +
            `Por favor indique el código o número de su orden:\n` +
            `_(Ejemplo: \`#0024\` o simplemente \`24\`)_\n\n` +
            `${SEPARADOR}\n` +
            `_O escriba *CANCELAR* para volver al menú._`;
    }

    // OPCIÓN 3: COTIZACIÓN MAYORISTA PARA TALLERES
    if (
        textoNorm.startsWith('3 ') ||
        textoNorm.startsWith('cotizar ') ||
        textoNorm.startsWith('cotizacion ')
    ) {
        const detalle = textoOriginal.replace(/^(3|cotizar|cotizacion)\s+/i, '').trim();
        return await registrarTicketSoporte({
            telefono: telefonoCliente,
            nombre: sesion.nombre,
            tipo: 'COTIZACION',
            mensaje: detalle
        });
    }

    if (
        textoNorm === '3' ||
        textoNorm === 'cotizar' ||
        textoNorm === 'cotizacion' ||
        textoNorm === 'taller' ||
        textoNorm === 'talleres' ||
        textoNorm === 'mayorista'
    ) {
        sesion.estado = 'ESPERANDO_COTIZACION';
        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `*Cotización Mayorista para Talleres*\n\n` +
            `Indíquenos los productos, marcas y cantidades estimadas que requiere su taller o negocio:\n` +
            `_(Ejemplo: 5 cajas de 15W40 Castrol, 10 filtros W712 Tecfil, 2 baldes 85W140)_\n\n` +
            `${SEPARADOR}\n` +
            `_Escriba los detalles a continuación o envíe *CANCELAR* para volver al menú._`;
    }

    // OPCIÓN 4: MÉTODOS DE PAGO Y QR OFICIAL
    if (
        textoNorm === '4' ||
        textoNorm === 'qr' ||
        textoNorm === 'pago' ||
        textoNorm === 'pagos' ||
        textoNorm === 'transferencia' ||
        textoNorm === 'cuenta' ||
        textoNorm === 'banco' ||
        textoNorm === 'yape'
    ) {
        return obtenerTextoMetodosPago();
    }

    // OPCIÓN 5: HORARIOS Y UBICACIÓN EN SUCRE
    if (
        textoNorm === '5' ||
        textoNorm === 'horario' ||
        textoNorm === 'horarios' ||
        textoNorm === 'ubicacion' ||
        textoNorm === 'direccion' ||
        textoNorm === 'contacto' ||
        textoNorm === 'donde' ||
        textoNorm === 'sucre' ||
        textoNorm === 'info'
    ) {
        return obtenerTextoUbicacionHorarios();
    }

    // SOPORTE TÉCNICO Y RECLAMOS (COMPATIBILIDAD DIRECTA)
    if (
        textoNorm.startsWith('reclamo ') ||
        textoNorm.startsWith('soporte ') ||
        textoNorm.startsWith('queja ')
    ) {
        const detalle = textoOriginal.replace(/^(reclamo|soporte|queja)\s+/i, '').trim();
        return await registrarTicketSoporte({
            telefono: telefonoCliente,
            nombre: sesion.nombre,
            tipo: 'RECLAMO',
            mensaje: detalle
        });
    }

    if (
        textoNorm === 'reclamo' ||
        textoNorm === 'soporte' ||
        textoNorm === 'queja' ||
        textoNorm === 'ayuda tecnica'
    ) {
        sesion.estado = 'ESPERANDO_RECLAMO';
        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `*Atención de Soporte Técnico y Despacho*\n\n` +
            `Por favor describa el inconveniente presentado con su pedido, despacho o repuesto:\n` +
            `_(Ejemplo: Faltó 1 filtro en el pedido #0024 o daño de transporte)_\n\n` +
            `${SEPARADOR}\n` +
            `_Escriba su mensaje a continuación o envíe *CANCELAR* para regresar._`;
    }

    // RESPUESTA POR DEFECTO / INTENCIÓN NO RECONOCIDA
    const saludo = sesion.nombre && sesion.nombre !== 'Cliente' ? `Hola *${sesion.nombre}*.` : 'Hola.';
    return `*${CONFIG.empresa}*\n` +
        `_Distribución Automotriz · Sucre, Bolivia_\n` +
        `${SEPARADOR}\n\n` +
        `${saludo} Para atenderle rápidamente, seleccione una opción:\n\n` +
        `*1* · Catálogo y precios (${CONFIG.catalogoWeb})\n` +
        `*2* · Consultar estado de pedido (ej: \`#0024\`)\n` +
        `*3* · Cotización mayorista para talleres\n` +
        `*4* · Métodos de pago y QR oficial\n` +
        `*5* · Horarios y ubicación en Sucre (${CONFIG.direccion.split(',')[0]})\n\n` +
        `${SEPARADOR}\n` +
        `_Responda con el número (1-5) o escriba directamente su consulta._`;
}

/**
 * 1. BÚSQUEDA DE PRODUCTOS EN TIEMPO REAL
 */
async function buscarProductos(terminoBusqueda) {
    const terminoLimpio = String(terminoBusqueda || '').trim();
    if (!terminoLimpio) {
        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `Por favor indique el nombre o código del producto que busca.\n\n` +
            `${SEPARADOR}\n` +
            `_Escriba *MENU* para volver al inicio._`;
    }

    try {
        const query = `%${terminoLimpio}%`;
        const querySinGuion = `%${terminoLimpio.replace(/[-\s]/g, '')}%`;
        const queryConGuion = `%${terminoLimpio.replace(/(\d+w)(\d+)/i, '$1-$2')}%`;
        const sql = `
            SELECT id, sku, nombre, categoria, precio, stock, especificaciones, linea
            FROM productos
            WHERE (
                sku LIKE ? OR nombre LIKE ? OR categoria LIKE ? OR especificaciones LIKE ? OR linea LIKE ?
                OR REPLACE(REPLACE(nombre, '-', ''), ' ', '') LIKE ?
                OR nombre LIKE ?
            )
            ORDER BY stock DESC, nombre ASC
            LIMIT 5
        `;
        const productos = await dbQuery.all(sql, [query, query, query, query, query, querySinGuion, queryConGuion]);

        if (!productos || productos.length === 0) {
            return `*${CONFIG.empresa}*\n` +
                `_Distribución Automotriz · Sucre, Bolivia_\n` +
                `${SEPARADOR}\n\n` +
                `No encontramos productos para "*${terminoLimpio}*" en Almacén Sucre.\n\n` +
                `• Verifique la ortografía o busque por viscosidad (ej: \`15W40\`, \`Castrol\`).\n` +
                `• Catálogo completo: ${CONFIG.catalogoWeb}\n` +
                `• Central: ${CONFIG.telefonoFijo}\n\n` +
                `${SEPARADOR}\n` +
                `_Escriba *MENU* para volver al inicio._`;
        }

        let respuesta = `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `*Resultados en Almacén Sucre para "${terminoLimpio}":*\n\n`;

        productos.forEach((p) => {
            const precioFmt = Number(p.precio || 0).toFixed(2);
            const stockEstado = p.stock > 0 ? `${p.stock} unids.` : `Agotado temporal`;
            respuesta += `• *${p.nombre}*\n` +
                `  SKU: \`${p.sku}\` | *Bs. ${precioFmt}* | Stock: ${stockEstado}\n\n`;
        });

        respuesta += `${SEPARADOR}\n` +
            `_Para cotizar formalmente responda *3* o ingrese a:_\n${CONFIG.catalogoWeb}`;

        return respuesta;
    } catch (err) {
        console.error('[WhatsApp Bot] Error al buscar productos en base de datos:', err);
        return `Ocurrió un inconveniente al consultar el inventario. Comuníquese al ${CONFIG.telefonoFijo} o escriba *MENU*.`;
    }
}

/**
 * Consulta de pedido en API de producción en Render con fallback a SQLite local
 */
async function obtenerPedidoProduccion(idPedido) {
    const urlDirecta = `https://golden-sprint1.onrender.com/api/pedidos/${idPedido}`;
    const urlLista = `https://golden-sprint1.onrender.com/api/pedidos`;
    
    // Timeout defensivo de 3.5 segundos con AbortController nativo
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
        // 1. Intento por endpoint directo GET /api/pedidos/:id
        const res = await fetch(urlDirecta, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            if (data && (data.id === idPedido || parseInt(data.id, 10) === idPedido)) {
                console.log(`[WhatsApp Bot] Pedido #${idPedido} recuperado exitosamente desde API de Producción (Render)`);
                return data;
            }
        }

        // 2. Fallback a búsqueda en lista general GET /api/pedidos
        const resLista = await fetch(urlLista, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        if (resLista.ok) {
            const lista = await resLista.json();
            if (Array.isArray(lista)) {
                const match = lista.find(p => p.id === idPedido || parseInt(p.id, 10) === idPedido);
                if (match) {
                    console.log(`[WhatsApp Bot] Pedido #${idPedido} localizado en listado general de Producción (Render)`);
                    return match;
                }
            }
        }
        return null;
    } catch (err) {
        console.warn(`[WhatsApp Bot] Conexión con Render no disponible (${err.message}). Utilizando base SQLite local.`);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * 2. RASTREO DE PEDIDOS EN TIEMPO REAL
 * Soporta consulta híbrida: Consulta primero a Render en local y hace fallback a SQLite local
 */
async function rastrearPedido(identificador) {
    const raw = String(identificador || '').trim();
    // Extraer números (ej: #0024 -> 24)
    const matches = raw.match(/\d+/);
    if (!matches) {
        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `Indique un número o código de pedido válido (ej: \`#0024\` o \`24\`).\n\n` +
            `${SEPARADOR}\n` +
            `_Escriba *MENU* para volver._`;
    }

    const idPedido = parseInt(matches[0], 10);
    const codigoFmt = `#${String(idPedido).padStart(4, '0')}`;

    try {
        let pedido = null;
        const esEntornoLocal = !process.env.RENDER && !process.env.IS_RENDER;

        // Si se ejecuta en local, consultar primero la API de producción en Render
        if (esEntornoLocal) {
            try {
                pedido = await obtenerPedidoProduccion(idPedido);
            } catch (prodErr) {
                console.warn('[WhatsApp Bot] Error al consultar API de producción:', prodErr.message);
                pedido = null;
            }
        }

        // Si no se encontró en producción o no hay conexión (o si estamos en producción), consultar SQLite local
        if (!pedido) {
            const sql = `
                SELECT p.*,
                       COALESCE(p.cliente_nombre, u.nombre, 'Cliente Mostrador') as cliente_nombre,
                       COALESCE(u.direccion, 'Sucre, Bolivia') as cliente_direccion,
                       COALESCE(u.telefono, '') as cliente_telefono
                FROM pedidos p
                LEFT JOIN usuarios u ON p.cliente_id = u.id
                WHERE p.id = ?
            `;
            pedido = await dbQuery.get(sql, [idPedido]);
            if (pedido) {
                const detalles = await dbQuery.all(`
                    SELECT pd.*, COALESCE(pr.sku, 'GLD-' || pd.producto_id) as sku
                    FROM pedido_detalles pd
                    LEFT JOIN productos pr ON pd.producto_id = pr.id
                    WHERE pd.pedido_id = ?
                `, [idPedido]);
                pedido.detalles = detalles || [];
            }
        }

        if (!pedido) {
            return `*${CONFIG.empresa}*\n` +
                `_Distribución Automotriz · Sucre, Bolivia_\n` +
                `${SEPARADOR}\n\n` +
                `No se encontró ningún pedido con el número \`${codigoFmt}\`.\n\n` +
                `• Verifique el código en su nota de entrega o factura.\n` +
                `• Almacén Central: ${CONFIG.telefonoFijo}\n\n` +
                `${SEPARADOR}\n` +
                `_Escriba *MENU* para volver al inicio._`;
        }

        const clienteNombre = pedido.cliente_nombre || pedido.cliente || 'Cliente Mostrador';
        const clienteDireccion = pedido.cliente_direccion || 'Sucre, Bolivia';

        // Formatear estado logístico
        const estadoLogRaw = (pedido.estado_logistica || pedido.estado || 'REGISTRADO').toUpperCase();
        let estadoLogistica = '● Registrado';
        if (estadoLogRaw.includes('ENTREG')) {
            estadoLogistica = '● Entregado';
        } else if (estadoLogRaw.includes('DESPACHO') || estadoLogRaw.includes('CAMINO') || estadoLogRaw.includes('RUTA')) {
            estadoLogistica = '● En ruta';
        } else if (estadoLogRaw.includes('EMPAQUE') || estadoLogRaw.includes('PREPAR')) {
            estadoLogistica = '● En preparación';
        }

        // Formatear estado de pago
        const estadoPagoRaw = (pedido.estado_pago || 'PENDIENTE').toUpperCase();
        let estadoPago = '● Pendiente';
        if (estadoPagoRaw.includes('VERIF') || estadoPagoRaw.includes('PAG') || estadoPagoRaw.includes('COB') || estadoPagoRaw.includes('APROB')) {
            estadoPago = '● Verificado';
        } else if (estadoPagoRaw.includes('RECHAZ')) {
            estadoPago = '● Rechazado';
        }

        const metodoPago = (pedido.metodo_pago || 'TRANSFERENCIA_QR').toUpperCase().replace(/_/g, ' ');
        const totalFmt = Number(pedido.total || 0).toFixed(2);

        // Desglose compacto de repuestos
        let desgloseRepuestos = '';
        if (Array.isArray(pedido.detalles) && pedido.detalles.length > 0) {
            desgloseRepuestos = `\n*Repuestos:*\n` + pedido.detalles.slice(0, 4).map(it => {
                const nombreItem = it.producto_nombre || it.nombre || it.sku || 'Repuesto';
                return `• ${it.cantidad || 1}x ${nombreItem}`;
            }).join('\n');
            if (pedido.detalles.length > 4) {
                desgloseRepuestos += `\n• ...y ${pedido.detalles.length - 4} repuesto(s) más.`;
            }
        }

        let infoDespacho = '';
        if (pedido.despacho_chofer) {
            infoDespacho = `\n• *Chofer:* ${pedido.despacho_chofer}${pedido.despacho_placa ? ` (${pedido.despacho_placa})` : ''}`;
        }

        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `*Estado de Pedido* \`${codigoFmt}\`\n\n` +
            `• *Cliente:* ${clienteNombre}\n` +
            `• *Pago:* ${estadoPago} (${metodoPago})\n` +
            `• *Logística:* ${estadoLogistica}\n` +
            `• *Destino:* ${clienteDireccion}${infoDespacho}` +
            `${desgloseRepuestos ? `\n${desgloseRepuestos}` : ''}\n\n` +
            `*Total:* *Bs. ${totalFmt}*\n\n` +
            `${SEPARADOR}\n` +
            `_Seguimiento en línea: ${CONFIG.portalClientesWeb}_`;
    } catch (err) {
        console.error('[WhatsApp Bot] Error al rastrear pedido:', err);
        return `Ocurrió un error al consultar el pedido. Intente nuevamente o escriba *MENU*.`;
    }
}

/**
 * 3 & 4. REGISTRO DE TICKETS DE SOPORTE, COTIZACIONES O RECLAMOS
 */
async function registrarTicketSoporte({ telefono, nombre, tipo, mensaje }) {
    const tel = String(telefono || '').trim() || 'No especificado';
    const nom = String(nombre || 'Cliente WhatsApp').trim();
    const tip = ['COTIZACION', 'RECLAMO', 'SOPORTE', 'CONSULTA'].includes(tipo) ? tipo : 'CONSULTA';
    const msg = String(mensaje || '').trim();

    if (!msg) {
        return `*${CONFIG.empresa}*\n` +
            `_Distribución Automotriz · Sucre, Bolivia_\n` +
            `${SEPARADOR}\n\n` +
            `El mensaje está vacío. Por favor describa su solicitud o escriba *MENU* para regresar.`;
    }

    try {
        const sql = `
            INSERT INTO tickets_soporte (telefono_cliente, nombre_cliente, tipo, mensaje, estado)
            VALUES (?, ?, ?, ?, 'ABIERTO')
        `;
        const res = await dbQuery.run(sql, [tel, nom, tip, msg]);
        const ticketIdFmt = `#TK-${String(res.lastID).padStart(4, '0')}`;

        // Alerta proactiva interna a Gerencia (+591 67375645)
        const alertaGerencia = `*NUEVO TICKET DE ATENCIÓN (${ticketIdFmt})*\n` +
            `${SEPARADOR}\n` +
            `• *Tipo:* ${tip}\n` +
            `• *Cliente:* ${nom}\n` +
            `• *Teléfono:* ${tel}\n` +
            `• *Mensaje:* "${msg}"\n` +
            `${SEPARADOR}\n` +
            `_Registrado vía Bot WhatsApp oficial._`;
        enviarAlertaAdmin(alertaGerencia).catch(() => {});

        if (tip === 'COTIZACION') {
            return `*${CONFIG.empresa}*\n` +
                `_Distribución Automotriz · Sucre, Bolivia_\n` +
                `${SEPARADOR}\n\n` +
                `*Cotización Registrada* \`${ticketIdFmt}\`\n\n` +
                `Estimado(a) *${nom}*, hemos recibido su requerimiento:\n` +
                `"${msg}"\n\n` +
                `Un asesor comercial de *${CONFIG.empresa}* preparará la proforma formal con descuentos por volumen y se comunicará a este número.\n\n` +
                `${SEPARADOR}\n` +
                `_Escriba *MENU* para volver al inicio._`;
        } else {
            return `*${CONFIG.empresa}*\n` +
                `_Distribución Automotriz · Sucre, Bolivia_\n` +
                `${SEPARADOR}\n\n` +
                `*Atención de Soporte Registrada* \`${ticketIdFmt}\`\n\n` +
                `Estimado(a) *${nom}*, su caso ha sido derivado a Control y Logística en Sucre:\n` +
                `"${msg}"\n\n` +
                `Nos comunicaremos al número *${tel}* a la brevedad para brindarle una solución prioritaria.\n\n` +
                `${SEPARADOR}\n` +
                `_Escriba *MENU* para volver al inicio._`;
        }
    } catch (err) {
        console.error('[WhatsApp Bot] Error al registrar ticket en SQLite:', err);
        return `No se pudo registrar su ticket en este momento. Por favor llame directamente al ${CONFIG.telefonoFijo} o intente de nuevo escribiendo *MENU*.`;
    }
}

/**
 * ENVIAR RESPUESTA CON PAUSA HUMANA SIMULADA (~1.2s)
 */
async function enviarRespuestaConPausa(sock, remoteJid, textoRespuesta) {
    try {
        // Enviar estado de escribiendo (composing)
        await sock.sendPresenceUpdate('composing', remoteJid);
    } catch (e) {
        // Ignorar si el protocolo de presencia falla
    }

    // Pausa humana
    await new Promise(resolve => setTimeout(resolve, CONFIG.pausaHumanaMs));

    // Enviar mensaje de texto
    await sock.sendMessage(remoteJid, { text: textoRespuesta });

    try {
        await sock.sendPresenceUpdate('paused', remoteJid);
    } catch (e) {
        // Ignorar
    }
}

/**
 * INICIALIZAR SOCKET DE BAILEYS CON PERSISTENCIA EN SQLITE
 */
async function iniciarBot() {
    if (iniciandoBot) {
        console.log('[WhatsApp Bot] Ya hay una inicialización en curso.');
        return socketActivo;
    }
    if (estaConectado && socketActivo) {
        console.log('[WhatsApp Bot] El bot ya se encuentra activo y conectado.');
        return socketActivo;
    }

    // Verificar si otra instancia del bot ya está corriendo en otro proceso
    const otroPID = verificarInstanciaActiva();
    if (otroPID && otroPID !== process.pid) {
        console.log(`[WhatsApp Bot] Otra instancia del bot ya está activa en segundo plano (PID: ${otroPID}).`);
        console.log(`[WhatsApp Bot] Omitiendo arranque duplicado para evitar conflictos de socket.`);
        estaConectado = true;
        iniciandoBot = false;
        return null;
    }

    if (!adquirirBloqueoInstancia()) {
        console.log('[WhatsApp Bot] No se pudo adquirir el bloqueo de instancia única. Omitiendo arranque.');
        iniciandoBot = false;
        return null;
    }

    iniciandoBot = true;

    if (socketActivo) {
        try {
            socketActivo.ev.removeAllListeners('connection.update');
            socketActivo.ev.removeAllListeners('creds.update');
            socketActivo.ev.removeAllListeners('messages.upsert');
            socketActivo.end();
        } catch (e) {}
        socketActivo = null;
    }

    try {
        // 1. Restaurar sesión desde SQLite si existe (Cloud / Render persistence)
        await restaurarSesionDesdeDB();

        console.log('[WhatsApp Bot] Cargando credenciales multi-archivo desde:', AUTH_DIR);
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        const logger = pino({ level: 'silent' });

        const sock = makeWASocket({
            auth: state,
            logger,
            printQRInTerminal: false, // Generamos manualmente con qrcodeTerminal y QRCode DataURL
            browser: ['GOLDEN Lubricantes', 'Chrome', '1.0.0']
        });

        // Guardar credenciales en disco y respaldar en SQLite (debounced y atómico)
        sock.ev.on('creds.update', async () => {
            await saveCreds();
            programarRespaldoSesion();
        });

        // Monitorear estado de conexión y renderizar QR
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                ultimoQR = qr;
                fechaUltimoQR = new Date().toISOString();
                try {
                    qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
                } catch (qrErr) {
                    console.warn('[WhatsApp Bot] Error al generar DataURL del QR:', qrErr.message);
                }

                console.log('\n============================================================');
                console.log(`[WhatsApp Bot] CÓDIGO QR GENERADO PARA ${CONFIG.whatsappOficial}`);
                console.log('Escanea el QR en consola o desde el Dashboard web del Administrador');
                console.log('============================================================\n');
                qrcodeTerminal.generate(qr, { small: true });
            }

            if (connection === 'close') {
                socketActivo = null;
                estaConectado = false;
                if (procesadorColaTimer) {
                    clearInterval(procesadorColaTimer);
                    procesadorColaTimer = null;
                }

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const debeReconectar = statusCode !== DisconnectReason.loggedOut;
                console.log(`[WhatsApp Bot] Conexión cerrada (Código: ${statusCode}). ¿Reconectar?: ${debeReconectar}`);

                if (statusCode === DisconnectReason.loggedOut) {
                    console.warn('[WhatsApp Bot] Sesión cerrada permanentemente en el celular. Limpiando credenciales en SQLite y disco...');
                    liberarBloqueoInstancia();
                    await limpiarSesionEnDB();
                    return;
                }

                if (statusCode === 440) {
                    console.warn('[WhatsApp Bot] Sesión reemplazada por otra conexión activa (Código: 440). Pausando reintento para evitar colisiones.');
                    liberarBloqueoInstancia();
                    setTimeout(iniciarBot, 60000);
                    return;
                }

                if (debeReconectar) {
                    const esperaMs = 8000;
                    console.log(`[WhatsApp Bot] Reintentando conexión en ${esperaMs / 1000} segundos...`);
                    setTimeout(iniciarBot, esperaMs);
                }
            } else if (connection === 'open') {
                adquirirBloqueoInstancia();
                socketActivo = sock;
                estaConectado = true;
                ultimoQR = null;
                qrDataUrl = null;
                console.log('\n============================================================');
                console.log(`[WhatsApp Bot] ¡CONEXIÓN ACTIVA Y EN LÍNEA! (${CONFIG.whatsappOficial})`);
                console.log(`[WhatsApp Bot] Atendiendo clientes de ${CONFIG.empresa} en ${CONFIG.ciudad}`);
                console.log(`[WhatsApp Bot] Canal de Alertas Proactivas activo para: ${ADMIN_WHATSAPP}`);
                console.log('============================================================\n');

                // Respaldar sesión en SQLite
                programarRespaldoSesion();

                // Iniciar despacho de alertas encoladas pendientes
                procesarColaAlertas();
                if (!procesadorColaTimer) {
                    procesadorColaTimer = setInterval(procesarColaAlertas, 3500);
                }
            }
        });

        // Escuchar mensajes entrantes
        sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                // 1. Ignorar mensajes enviados por el propio bot
                if (msg.key.fromMe) continue;

                const remoteJid = msg.key.remoteJid;
                if (!remoteJid) continue;

                // 2. Filtro estricto: Ignorar grupos (@g.us) y estados/broadcasts (status@broadcast)
                if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
                    continue;
                }

                // Extraer texto del mensaje
                const textoMensaje = msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    '';

                if (!textoMensaje || !textoMensaje.trim()) continue;

                const remitenteNombre = msg.pushName || 'Cliente';
                // Formatear número de teléfono limpio (+591...)
                const numeroLimpio = remoteJid.split('@')[0].split(':')[0];
                const telefonoCliente = `+${numeroLimpio}`;

                console.log(`[WhatsApp Bot] Mensaje recibido de ${remitenteNombre} (${telefonoCliente}): "${textoMensaje.trim()}"`);

                // Procesar con máquina de estados y base de datos
                const respuesta = await responderMensaje(remoteJid, textoMensaje, remitenteNombre, telefonoCliente);

                // Enviar con pausa humana
                await enviarRespuestaConPausa(sock, remoteJid, respuesta);
                console.log(`[WhatsApp Bot] Respuesta enviada a ${telefonoCliente}`);
            }
        } catch (err) {
            console.error('[WhatsApp Bot] Error al procesar mensaje entrante:', err);
        }
    });

    return sock;
    } catch (iniciarErr) {
        console.error('[WhatsApp Bot] Error al inicializar socket:', iniciarErr);
        throw iniciarErr;
    } finally {
        iniciandoBot = false;
    }
}

// ============================================================================
// SUITE DE PRUEBAS UNITARIAS INTEGRADA (--test)
// Permite verificar la lógica conversacional y base de datos sin teléfono físico
// ============================================================================
async function ejecutarPruebaUnitaria() {
    console.log('\n🧪 [TEST] Iniciando verificación del motor conversacional del Bot...');
    const testJid = '59167375645@s.whatsapp.net';
    const testNombre = 'Taller San Cristóbal';
    const testTel = '+591 67375645';

    // 1. Prueba Saludo / Menú
    console.log('\n1. Test Saludo / Menú');
    const r1 = await responderMensaje(testJid, 'Hola buenos días', testNombre, testTel);
    console.log('Respuesta recibida:\n' + r1);
    if (!r1.includes('GOLDEN Lubricantes & Filtros')) throw new Error('Falló test de menú');

    // 2. Prueba Búsqueda de Productos (Opción 1)
    console.log('\n2. Test Búsqueda de Productos');
    const r2 = await responderMensaje(testJid, '1', testNombre, testTel);
    console.log('Prompt:\n' + r2);
    const r2b = await responderMensaje(testJid, '15W40', testNombre, testTel);
    console.log('Resultados:\n' + r2b);
    if (!r2b.includes('Resultados en Almacén Sucre')) throw new Error('Falló test de productos');

    // 3. Prueba Rastreo de Pedido (Opción 2)
    console.log('\n3. Test Rastreo de Pedidos');
    const r3 = await responderMensaje(testJid, 'pedido 1', testNombre, testTel);
    console.log('Rastreo:\n' + r3);
    if (!r3.includes('Estado de Pedido')) throw new Error('Falló test de pedidos');

    // 4. Prueba Solicitud de Cotización (Opción 3)
    console.log('\n4. Test Cotización Mayorista');
    const r4 = await responderMensaje(testJid, '3', testNombre, testTel);
    const r4b = await responderMensaje(testJid, 'Necesito 10 cajas de 15W40 y 20 filtros para taller', testNombre, testTel);
    console.log('Cotización registrada:\n' + r4b);
    if (!r4b.includes('#TK-')) throw new Error('Falló test de cotización');

    // 5. Prueba Reclamo / Soporte
    console.log('\n5. Test Reclamo / Soporte');
    const r5 = await responderMensaje(testJid, 'reclamo', testNombre, testTel);
    const r5b = await responderMensaje(testJid, 'Faltó 1 caja de aceite en la entrega de ayer', testNombre, testTel);
    console.log('Reclamo registrado:\n' + r5b);
    if (!r5b.includes('#TK-')) throw new Error('Falló test de reclamo');

    // 6. Prueba Métodos de Pago y QR Oficial (Opción 4)
    console.log('\n6. Test Métodos de Pago y QR Oficial');
    const r6a = await responderMensaje(testJid, '4', testNombre, testTel);
    console.log('Pagos y QR:\n' + r6a);
    if (!r6a.includes('Métodos de Pago Oficiales') || !r6a.includes('Yape Bolivia')) throw new Error('Falló test métodos de pago');

    // 7. Prueba Información Corporativa y Horarios (Opción 5)
    console.log('\n7. Test Información Corporativa y Horarios');
    const r6 = await responderMensaje(testJid, '5', testNombre, testTel);
    console.log('Info:\n' + r6);
    if (!r6.includes('Av. Jaime Mendoza #1420')) throw new Error('Falló test corporativo');

    // 8. Prueba Protección de Comprobante / Pedido Confirmado
    console.log('\n8. Test Protección Comprobante / Pedido Confirmado');
    const r8 = await responderMensaje(testJid, 'PEDIDO CONFIRMADO #0001 con transferencia QR', testNombre, testTel);
    console.log('Respuesta recibida:\n' + r8);
    if (!r8.includes('Hemos recibido el respaldo de su orden')) throw new Error('Falló test de comprobante');

    // 9. Prueba Comando Exclusivo Admin (Resumen Gerencial)
    console.log('\n9. Test Comando Exclusivo Admin ("resumen")');
    const r7 = await responderMensaje(ADMIN_WHATSAPP, 'resumen', 'Gerencia General', '+591 67375645');
    console.log('Resumen Gerencial:\n' + r7);
    if (!r7.includes('RESUMEN GERENCIAL DEL DÍA')) throw new Error('Falló test de resumen gerencial');

    // 10. Prueba Función Proactiva enviarAlertaAdmin
    console.log('\n10. Test Función Proactiva enviarAlertaAdmin');
    const exitoAlerta = await enviarAlertaAdmin('Test de Alerta Proactiva para Gerencia (+591 67375645)');
    console.log('Resultado encolar/enviar alerta proactiva:', exitoAlerta);
    if (!exitoAlerta) throw new Error('Falló envío de alerta proactiva');

    // 11. Prueba Consulta de Estado para Panel Web
    console.log('\n11. Test Consulta de Estado Web');
    const estadoWA = obtenerEstadoWhatsApp();
    console.log('Estado reportado:', estadoWA);
    if (estadoWA.numero !== '+591 67375645') throw new Error('Falló test de estado');

    console.log('\n✅ [TEST] ¡Todas las pruebas del bot de WhatsApp pasaron exitosamente!\n');
    process.exit(0);
}

// Ejecución si se llama directamente
if (require.main === module) {
    if (process.argv.includes('--test')) {
        setTimeout(ejecutarPruebaUnitaria, 500);
    } else {
        iniciarBot().catch(err => {
            console.error('[WhatsApp Bot] Error crítico al arrancar:', err);
        });
    }
}

module.exports = {
    iniciarBot,
    responderMensaje,
    buscarProductos,
    rastrearPedido,
    obtenerPedidoProduccion,
    registrarTicketSoporte,
    obtenerTextoMenuPrincipal,
    enviarAlertaAdmin,
    generarResumenGerencial,
    procesarColaAlertas,
    obtenerEstadoWhatsApp,
    restaurarSesionDesdeDB,
    respaldarSesionEnDB,
    limpiarSesionEnDB,
    ADMIN_WHATSAPP,
    ADMIN_PHONE_RAW
};
