/**
 * scripts/test_webhook_yape.js
 * Verificación integral del Webhook Yape Bolivia (MacroDroid) y Polling Frontend
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("==================================================================");
console.log(" VERIFICACIÓN FINTECH: WEBHOOK YAPE (MACRODROID) & POLLING MODAL  ");
console.log("==================================================================");

const BASE_URL = 'http://localhost:3000';
const WEBHOOK_SECRET = 'GOLDEN_WEBHOOK_2026_SECURE';

function request(options, bodyData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, data: parsed });
            });
        });
        req.on('error', reject);
        if (bodyData) {
            req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
        }
        req.end();
    });
}

let passed = 0;
function pass(msg) {
    console.log(`  [PASS] ${msg}`);
    passed++;
}

async function runTests() {
    try {
        // -------------------------------------------------------------
        // 1. VERIFICACIÓN DE SEGURIDAD (WEBHOOK SECRET)
        // -------------------------------------------------------------
        console.log("\n--- 1. SEGURIDAD Y AUTENTICACIÓN DEL WEBHOOK ---");
        
        // Petición sin secreto
        const resSinSecret = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pagos/webhook-qr',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { texto_notificacion: 'Yape: Recibiste Bs 10.00' });
        assert.strictEqual(resSinSecret.status, 401, 'Debe responder 401 sin secreto');
        pass("Rechaza peticiones sin clave secreta (401 Unauthorized)");

        // Petición con secreto erróneo
        const resBadSecret = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pagos/webhook-qr',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': 'CLAVE_INCORRECTA_999'
            }
        }, { texto_notificacion: 'Yape: Recibiste Bs 10.00' });
        assert.strictEqual(resBadSecret.status, 401, 'Debe responder 401 con secreto incorrecto');
        pass("Rechaza clave secreta inválida (401 Unauthorized)");

        // Petición con secreto válido en header pero sin monto en texto
        const resSinMonto = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pagos/webhook-qr',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': WEBHOOK_SECRET
            }
        }, { texto_notificacion: 'Notificación de Yape sin especificar dinero' });
        assert.strictEqual(resSinMonto.status, 400, 'Debe responder 400 si no puede extraer monto');
        pass("Rechaza notificación sin monto monetario válido (400 Bad Request)");

        // -------------------------------------------------------------
        // 2. CREACIÓN DE PEDIDO DE PRUEBA EN ESTADO PENDIENTE
        // -------------------------------------------------------------
        console.log("\n--- 2. CREACIÓN DE PEDIDO PENDIENTE PARA CONCILIACIÓN ---");
        
        // Creamos un pedido con total específico: 161.50
        const totalPrueba = 161.50;
        const resCrearPedido = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pedidos',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            cliente_id: 1, // Admin o Cliente existente
            total: totalPrueba,
            metodo_pago: 'QR_DIRECTO',
            estado_pago: 'PENDIENTE',
            carrito: [
                { id: 1, nombre: 'Aceite Sintético 5W-30', precio: 161.50, cantidad: 1 }
            ]
        });

        assert.strictEqual(resCrearPedido.status, 201, 'El pedido debe crearse con código 201');
        const pedidoId = resCrearPedido.data.pedidoId;
        assert.ok(pedidoId, 'Debe devolver pedidoId');
        pass(`Pedido #${pedidoId} creado en SQLite con total Bs. ${totalPrueba} y estado_pago = 'PENDIENTE'`);

        // -------------------------------------------------------------
        // 3. CONSULTA DE ESTADO DE PAGO PRE-WEBHOOK
        // -------------------------------------------------------------
        console.log("\n--- 3. POLLING PREVIO: GET /api/pedidos/:id/estado-pago ---");
        const resEstadoPre = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/pedidos/${pedidoId}/estado-pago`,
            method: 'GET'
        });
        assert.strictEqual(resEstadoPre.status, 200, 'Debe responder 200');
        assert.strictEqual(resEstadoPre.data.estado_pago, 'PENDIENTE');
        assert.strictEqual(resEstadoPre.data.es_verificado, false);
        pass(`Endpoint de polling responde 200: estado_pago='PENDIENTE', es_verificado=false`);

        // -------------------------------------------------------------
        // 4. ENVÍO DE NOTIFICACIÓN REAL YAPE (SIMULANDO MACRODROID)
        // -------------------------------------------------------------
        console.log("\n--- 4. RECEPCIÓN Y CONCILIACIÓN DE WEBHOOK YAPE (MACRODROID) ---");
        const notifRealYape = `Yape: Recibiste Bs. 161.50 de Juan Carlos Pérez`;
        
        const resWebhook = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pagos/webhook-qr',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': WEBHOOK_SECRET
            }
        }, {
            texto_notificacion: notifRealYape,
            app_origen: 'Yape Bolivia'
        });

        assert.strictEqual(resWebhook.status, 200, 'El webhook debe responder 200 OK');
        assert.strictEqual(resWebhook.data.ok, true);
        assert.strictEqual(resWebhook.data.pedido_id, pedidoId);
        assert.strictEqual(resWebhook.data.monto_conciliado, totalPrueba);
        pass(`Webhook concilió automáticamente Pedido #${resWebhook.data.pedido_id} con monto Bs. ${resWebhook.data.monto_conciliado}`);

        // -------------------------------------------------------------
        // 5. VERIFICACIÓN POST-WEBHOOK: ESTADO VERIFICADO EN BASE DE DATOS
        // -------------------------------------------------------------
        console.log("\n--- 5. POLLING POST-WEBHOOK: VERIFICACIÓN INMEDIATA ---");
        const resEstadoPost = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/pedidos/${pedidoId}/estado-pago`,
            method: 'GET'
        });
        assert.strictEqual(resEstadoPost.status, 200, 'Debe responder 200');
        assert.strictEqual(resEstadoPost.data.estado_pago, 'VERIFICADO');
        assert.strictEqual(resEstadoPost.data.estado, 'VERIFICADO');
        assert.strictEqual(resEstadoPost.data.verificado_por, 'YAPE_REAL_AUTO');
        assert.strictEqual(resEstadoPost.data.es_verificado, true);
        assert.ok(resEstadoPost.data.transaccion_bancaria_id.includes('161.50'), 'Debe guardar el texto de la notificación en transaccion_bancaria_id');
        pass(`Polling detecta estado_pago='VERIFICADO', verificado_por='YAPE_REAL_AUTO', es_verificado=true`);

        // -------------------------------------------------------------
        // 6. VALIDACIÓN CON MONTO NO EXISTENTE (404)
        // -------------------------------------------------------------
        console.log("\n--- 6. CONTROL DE DISCREPANCIA (MONTO SIN PEDIDO ASOCIADO) ---");
        const resNoMatch = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/pagos/webhook-qr',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': WEBHOOK_SECRET
            }
        }, {
            texto_notificacion: 'Yape: Recibiste Bs 9999.99 de Persona Fantasma'
        });
        assert.strictEqual(resNoMatch.status, 404, 'Debe responder 404 si no hay pedido coincidente');
        pass("Webhook devuelve 404 si no existe pedido con ese monto exacto pendiente");

        // -------------------------------------------------------------
        // 7. VERIFICACIÓN DE ELEMENTOS UI EN FRONTEND (tienda.html & tienda.js)
        // -------------------------------------------------------------
        console.log("\n--- 7. VERIFICACIÓN DE FRONTEND (tienda.html & tienda.js) ---");
        const html = fs.readFileSync(path.join(__dirname, '../public/tienda.html'), 'utf8');
        const js = fs.readFileSync(path.join(__dirname, '../public/tienda.js'), 'utf8');

        assert.ok(html.includes('id="checkoutQRMontoDestacado"'), 'tienda.html debe tener #checkoutQRMontoDestacado');
        assert.ok(html.includes('id="qrPollingLiveBadge"'), 'tienda.html debe tener #qrPollingLiveBadge');
        assert.ok(html.includes('id="qrPagoVerificadoSuccess"'), 'tienda.html debe tener #qrPagoVerificadoSuccess');
        assert.ok(html.includes('id="btnDescargarReciboYape"'), 'tienda.html debe tener botón para descargar recibo');
        assert.ok(html.includes('Pago Verificado Automáticamente por Yape'), 'tienda.html debe tener título de verificación');
        pass("tienda.html cuenta con todos los contenedores y badges de auto-verificación Yape");

        assert.ok(js.includes('2500'), 'tienda.js debe tener polling cada 2500 ms (2.5s)');
        assert.ok(js.includes('/estado-pago'), 'tienda.js debe consultar endpoint /estado-pago');
        assert.ok(js.includes('mostrarPagoVerificadoExitoso'), 'tienda.js debe tener función para actualizar vista');
        assert.ok(js.includes('asegurarOrdenPendienteQR'), 'tienda.js debe pre-crear o asegurar orden pendiente');
        pass("tienda.js contiene lógica de polling a 2.5s y transición visual automática");

        console.log("\n==================================================================");
        console.log(` RESULTADO FINAL: ${passed} pruebas exitosas. CERO ERRORES.`);
        console.log("==================================================================");

    } catch (e) {
        console.error("ERROR EN PRUEBAS:", e);
        process.exit(1);
    }
}

runTests();
