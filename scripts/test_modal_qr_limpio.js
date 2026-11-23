/**
 * scripts/test_modal_qr_limpio.js
 * Verificación en navegador real headless del modal de pago QR limpio y de la cadena original de Yape Bolivia.
 */

const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const assert = require('assert');

function buscarEdgeOCChrome() {
    const fs = require('fs');
    const rutas = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const r of rutas) {
        if (fs.existsSync(r)) return r;
    }
    return null;
}

function httpGetJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function ejecutar() {
    console.log('==================================================================');
    console.log(' VERIFICACIÓN BROWSER HEADLESS: MODAL QR LIMPIO (YAPE BOLIVIA)    ');
    console.log('==================================================================');

    const browserExe = buscarEdgeOCChrome();
    assert(browserExe, 'Debe existir Edge o Chrome');

    const port = 9333;
    const browserProcess = spawn(browserExe, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ]);

    await delay(1500);

    let ws = null;
    try {
        const versionData = await httpGetJson(`http://127.0.0.1:${port}/json/version`);
        const targets = await httpGetJson(`http://127.0.0.1:${port}/json/list`);
        const targetPage = targets.find(t => t.type === 'page') || targets[0];
        assert(targetPage, 'Debe haber página abierta');

        ws = new WebSocket(targetPage.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
            ws.on('open', res);
            ws.on('error', rej);
        });

        let msgId = 1;
        const pendingCallbacks = new Map();
        const consoleErrors = [];
        const jsExceptions = [];

        ws.on('message', (raw) => {
            const data = JSON.parse(raw);
            if (data.id && pendingCallbacks.has(data.id)) {
                const cb = pendingCallbacks.get(data.id);
                pendingCallbacks.delete(data.id);
                cb(data);
            }
            if (data.method === 'Runtime.consoleAPICalled') {
                if (data.params.type === 'error') {
                    consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
                }
            }
            if (data.method === 'Runtime.exceptionThrown') {
                jsExceptions.push(data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description || ''));
            }
        });

        function sendCDP(method, params = {}) {
            return new Promise((resolve) => {
                const id = msgId++;
                pendingCallbacks.set(id, resolve);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await sendCDP('Page.enable');
        await sendCDP('Runtime.enable');

        // Configurar cliente autenticado con repuestos en el carrito
        await sendCDP('Page.navigate', { url: 'http://localhost:3000/tienda.html' });
        await delay(2000);

        // Inyectar usuario y carrito, luego abrir modal de checkout
        const evalSetup = await sendCDP('Runtime.evaluate', {
            expression: `
                (function() {
                    const usuario = {
                        id: 58,
                        nombre: "Taller Mecánico El Tuerca",
                        email: "tuerca@golden.com",
                        rol: "CLIENTE",
                        direccion: "Av. Jaime Mendoza #1420",
                        telefono: "75789456"
                    };
                    localStorage.setItem('usuario_golden', JSON.stringify(usuario));
                    
                    // Llenar carrito con 1 item
                    if (typeof window.inyectarItemCarrito === 'function') {
                        window.inyectarItemCarrito({
                            id: 1,
                            nombre: "Aceite Sintético Postman 5W-40 Pro",
                            precio: 161.50,
                            cantidad: 1,
                            linea: "liviana"
                        });
                    }

                    // Abrir modal de checkout
                    if (typeof window.abrirModalCheckout === 'function') {
                        window.abrirModalCheckout();
                    }
                    return true;
                })();
            `,
            returnByValue: true
        });

        await delay(1200);

        // Inspeccionar el estado visual y elementos del modal
        const checkModal = await sendCDP('Runtime.evaluate', {
            expression: `
                (function() {
                    const canvas = document.getElementById('canvasQROficial');
                    const montoDestacado = document.getElementById('checkoutQRMontoDestacado')?.innerText;
                    const montoPagar = document.getElementById('checkoutMontoTotalBs')?.innerText;
                    const esperaTitulo = document.querySelector('#qrEstadoEsperaAutonoma h5')?.innerText?.trim();
                    const esperaTimer = document.getElementById('lblQRWaitTimer')?.innerText?.trim();
                    const titular = Array.from(document.querySelectorAll('#tab-qr-pane .fw-bold')).find(el => el.innerText.includes('Nelson'))?.innerText?.trim();
                    const btnDescargar = document.getElementById('btnDescargarQROficial');

                    // Verificar ausencia de elementos eliminados
                    const htmlTab = document.getElementById('tab-qr-pane')?.innerHTML || '';
                    const tienePildoraDinamico = !!document.getElementById('qrBadgeTipo');
                    const tieneBadgeCRC = !!document.getElementById('lblQRChecksumCRC');
                    const tieneSimulador = (htmlTab.includes('Simulador Dinámico') || htmlTab.includes('simularMontoQRDinamico'));
                    const tieneAutoSyncPill = htmlTab.includes('Auto-Sync 2.5s');
                    const mencionaListaBancos = htmlTab.includes('Banco Unión, BCP, BNB, Bisa, Mercantil');

                    // Verificar que canvas tiene contenido
                    const canvasWidth = canvas?.width || 0;
                    const canvasHeight = canvas?.height || 0;

                    return {
                        montoDestacado,
                        montoPagar,
                        esperaTitulo,
                        esperaTimer,
                        titular,
                        btnDescargarExiste: !!btnDescargar,
                        btnDescargarHref: btnDescargar?.getAttribute('href'),
                        canvasWidth,
                        canvasHeight,
                        tienePildoraDinamico,
                        tieneBadgeCRC,
                        tieneSimulador,
                        tieneAutoSyncPill,
                        mencionaListaBancos,
                        payloadQREsOficial: (typeof window.ultimoPayloadQRDinamico === 'object' && window.ultimoPayloadQRDinamico !== null && typeof window.ultimoPayloadQRDinamico.payload === 'string' && window.ultimoPayloadQRDinamico.payload.startsWith('H7GX'))
                    };
                })();
            `,
            returnByValue: true
        });

        const r = checkModal.result.result.value;
        console.log('\n--- 1. ELEMENTOS OBLIGATORIOS DE LA NUEVA INTERFAZ ---');
        console.log('- Monto Destacado Izquierdo:', r.montoDestacado);
        console.log('- Monto a Pagar Derecho:    ', r.montoPagar);
        console.log('- Titular de Cuenta:        ', r.titular);
        console.log('- Título de Espera en Vivo: ', r.esperaTitulo);
        console.log('- Temporizador de Espera:   ', r.esperaTimer);
        console.log('- Canvas QR Dimensiones:    ', `${r.canvasWidth}x${r.canvasHeight}`);
        console.log('- Botón Descargar QR:       ', r.btnDescargarExiste ? `OK (${r.btnDescargarHref})` : 'FAIL');
        console.log('- Payload QR Original Yape: ', r.payloadQREsOficial ? 'OK (H7GX... intacto)' : 'FAIL');

        assert.strictEqual(r.montoDestacado, 'Bs. 161.50', 'Monto destacado debe ser Bs. 161.50');
        assert.strictEqual(r.montoPagar, 'Bs. 161.50', 'Monto a pagar debe ser Bs. 161.50');
        assert.strictEqual(r.esperaTitulo, 'Esperando confirmación de pago...', 'Título debe ser exacto');
        assert(r.canvasWidth >= 480, 'Canvas QR debe tener alta densidad');
        assert(r.payloadQREsOficial, 'Payload debe iniciar con H7GX de la imagen oficial');

        console.log('\n--- 2. VERIFICACIÓN DE ELEMENTOS ELIMINADOS (CERO RUIDO TÉCNICO) ---');
        console.log('- ¿Existe píldora verde Dinámico EMVCo?:', r.tienePildoraDinamico ? 'FAIL' : 'NO (Eliminada)');
        console.log('- ¿Existe badge CRC-16?:                ', r.tieneBadgeCRC ? 'FAIL' : 'NO (Eliminado)');
        console.log('- ¿Existe bloque Simulador Docente?:    ', r.tieneSimulador ? 'FAIL' : 'NO (Eliminado)');
        console.log('- ¿Existe píldora verde Auto-Sync?:     ', r.tieneAutoSyncPill ? 'FAIL' : 'NO (Eliminada)');
        console.log('- ¿Existe párrafo largo de bancos?:     ', r.mencionaListaBancos ? 'FAIL' : 'NO (Eliminado)');

        assert(!r.tienePildoraDinamico, 'Píldora Dinámico EMVCo debe estar eliminada');
        assert(!r.tieneBadgeCRC, 'Badge CRC debe estar eliminado');
        assert(!r.tieneSimulador, 'Simulador de montos debe estar eliminado');
        assert(!r.tieneAutoSyncPill, 'Píldora Auto-Sync debe estar eliminada');
        assert(!r.mencionaListaBancos, 'Párrafo largo de bancos debe estar eliminado');

        console.log('\n--- 3. CONTROL DE EXCEPCIONES Y ERRORES DE CONSOLA ---');
        console.log('- Total console.error:', consoleErrors.length);
        console.log('- Total excepciones JS:', jsExceptions.length);
        assert.strictEqual(consoleErrors.length, 0, 'No debe haber console.error');
        assert.strictEqual(jsExceptions.length, 0, 'No debe haber excepciones JS');

        console.log('\n==================================================================');
        console.log(' ✅ VERIFICACIÓN EN NAVEGADOR HEADLESS COMPLETADA EXITOSAMENTE    ');
        console.log('==================================================================');

    } finally {
        if (ws) ws.close();
        browserProcess.kill();
    }
}

ejecutar().catch(err => {
    console.error('ERROR EN VERIFICACIÓN HEADLESS:', err);
    process.exit(1);
});
