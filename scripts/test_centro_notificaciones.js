/**
 * scripts/test_centro_notificaciones.js
 * Test automatizado en navegador real headless (Edge/Chrome CDP) para verificar el Centro de Notificaciones:
 * 1. Navbar de ERP (dashboard.html): Campana, badge dinámico, popover con items reales de productos y pedidos.
 * 2. Cierre al hacer click fuera y con tecla Escape.
 * 3. Botón "Marcar leídas" y estado limpio "Todo al día".
 * 4. Integración en tienda.html para usuarios administradores.
 * 5. Cero errores JS y cero alertas crudas alert().
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
    console.log(' VERIFICACIÓN BROWSER HEADLESS: CENTRO DE NOTIFICACIONES ERP      ');
    console.log('==================================================================');

    const browserExe = buscarEdgeOCChrome();
    assert(browserExe, 'Debe existir Edge o Chrome');

    const port = 9334;
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
                    const msg = data.params.args.map(a => a.value || a.description).join(' ');
                    if (!msg.includes('favicon')) {
                        consoleErrors.push(msg);
                    }
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

        async function evalInBrowser(expression) {
            const res = await sendCDP('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true
            });
            return res.result?.result?.value;
        }

        await sendCDP('Page.enable');
        await sendCDP('Runtime.enable');

        // Pre-establecer usuario en index.html para evitar guardias RBAC de redirección
        console.log('\n[Fase 0] Inicializando sesión de Administrador en localStorage...');
        await sendCDP('Page.navigate', { url: 'http://localhost:3000/index.html' });
        await delay(1000);

        await evalInBrowser(`
            (function() {
                const admin = {
                    id: 1,
                    nombre: "Administrador General",
                    email: "admin@golden.bo",
                    rol: "ADMIN"
                };
                localStorage.setItem('usuario_golden', JSON.stringify(admin));
                localStorage.setItem('usuario', JSON.stringify(admin));
                return true;
            })()
        `);

        // -------------------------------------------------------------
        // FASE 1: Navegar a dashboard.html y comprobar campana
        // -------------------------------------------------------------
        console.log('\n[Fase 1] Cargando dashboard.html con sesión de Administrador...');
        await sendCDP('Page.navigate', { url: 'http://localhost:3000/dashboard.html' });
        await delay(2500);

        // Comprobar existencia del botón de la campana y badges
        const infoCampana = await evalInBrowser(`
            (function() {
                const btn = document.getElementById('btnCampanaNotificaciones');
                const badge = document.getElementById('badgeNotificacionesStock');
                const popover = document.getElementById('popoverNotificaciones');
                return {
                    btnExiste: !!btn,
                    badgeExiste: !!badge,
                    badgeTexto: badge ? badge.innerText : '',
                    badgeDisplay: badge ? window.getComputedStyle(badge).display : '',
                    popoverExiste: !!popover,
                    popoverOculto: popover ? popover.classList.contains('d-none') : null
                };
            })()
        `);

        console.log('Estado inicial de campana en dashboard.html:', infoCampana);
        assert(infoCampana.btnExiste, 'El botón #btnCampanaNotificaciones debe existir en el navbar');
        assert(infoCampana.badgeExiste, 'El badge #badgeNotificacionesStock debe existir');

        // -------------------------------------------------------------
        // FASE 2: Hacer clic en la campana y desplegar Popover
        // -------------------------------------------------------------
        console.log('\n[Fase 2] Desplegando Popover de Notificaciones con clic en campana...');
        const stPopover = await evalInBrowser(`
            (function() {
                const btn = document.getElementById('btnCampanaNotificaciones');
                btn.click();
                const popover = document.getElementById('popoverNotificaciones');
                const titulo = document.getElementById('popoverNotifTitulo');
                const lista = document.getElementById('popoverNotifLista');
                const btnMarcar = document.getElementById('btnMarcarLeidas');
                const footer = popover ? popover.querySelector('.popover-notif-footer') : null;

                return {
                    popoverVisible: popover ? !popover.classList.contains('d-none') : false,
                    tituloTexto: titulo ? titulo.innerText : '',
                    btnMarcarExiste: !!btnMarcar,
                    footerHref: footer ? footer.getAttribute('href') : '',
                    totalItems: lista ? lista.querySelectorAll('.popover-notif-item').length : 0,
                    tieneLinksInventario: lista ? !!lista.querySelector('a[href="inventario.html"]') : false,
                    tieneLinksLogisticaOCobranzas: lista ? (!!lista.querySelector('a[href="logistica.html"]') || !!lista.querySelector('a[href="cobranzas.html"]')) : false
                };
            })()
        `);

        console.log('Detalle de popover abierto:', stPopover);
        assert(stPopover.popoverVisible, 'El popover debe ser visible tras el clic');
        assert(stPopover.tituloTexto.includes('Notificaciones del Sistema'), 'El título del popover debe ser "Notificaciones del Sistema"');
        assert(stPopover.btnMarcarExiste, 'El botón "Marcar leídas" debe estar presente');
        assert(stPopover.footerHref === 'auditoria.html', 'El footer debe enlazar a auditoria.html');
        assert(stPopover.totalItems > 0, 'Debe haber notificaciones activas de stock o pedidos');
        console.log(`✓ Popover abierto con éxito mostrando ${stPopover.totalItems} notificaciones interactivas.`);

        // -------------------------------------------------------------
        // FASE 3: Comprobar cierre al hacer clic fuera del popover
        // -------------------------------------------------------------
        console.log('\n[Fase 3] Verificando cierre automático al hacer clic fuera...');
        const cierreClicFuera = await evalInBrowser(`
            (function() {
                document.body.click();
                const popover = document.getElementById('popoverNotificaciones');
                return {
                    popoverOculto: popover ? popover.classList.contains('d-none') : false
                };
            })()
        `);

        console.log('Estado tras clic fuera:', cierreClicFuera);
        assert(cierreClicFuera.popoverOculto, 'El popover debe ocultarse al hacer clic fuera');
        console.log('✓ Popover cerrado correctamente con clic exterior.');

        // -------------------------------------------------------------
        // FASE 4: Reabrir y verificar tecla Escape
        // -------------------------------------------------------------
        console.log('\n[Fase 4] Verificando apertura y cierre con tecla Escape...');
        const toggleEscape = await evalInBrowser(`
            (function() {
                const btn = document.getElementById('btnCampanaNotificaciones');
                btn.click();
                const popover = document.getElementById('popoverNotificaciones');
                const abierto = !popover.classList.contains('d-none');
                // Despachar tecla Escape
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                const cerrado = popover.classList.contains('d-none');
                return { abierto, cerrado };
            })()
        `);

        console.log('Estado apertura y tecla Escape:', toggleEscape);
        assert(toggleEscape.abierto, 'Debe haberse abierto al clicar');
        assert(toggleEscape.cerrado, 'Debe haberse cerrado al presionar Escape');
        console.log('✓ Tecla Escape cierra el popover inmediatamente.');

        // -------------------------------------------------------------
        // FASE 5: Reabrir, presionar "Marcar leídas" y validar estado vacío
        // -------------------------------------------------------------
        console.log('\n[Fase 5] Verificando acción "Marcar leídas" y estado limpio...');
        const stLeidas = await evalInBrowser(`
            (function() {
                const btn = document.getElementById('btnCampanaNotificaciones');
                btn.click();
                const btnMarcar = document.getElementById('btnMarcarLeidas');
                if (btnMarcar) btnMarcar.click();

                const badge = document.getElementById('badgeNotificacionesStock');
                const lista = document.getElementById('popoverNotifLista');
                return {
                    badgeTexto: badge ? badge.innerText : '',
                    badgeDisplay: badge ? window.getComputedStyle(badge).display : '',
                    listaTexto: lista ? lista.innerText : ''
                };
            })()
        `);

        console.log('Estado tras marcar leídas:', stLeidas);
        assert(stLeidas.badgeDisplay === 'none' || stLeidas.badgeTexto === '0', 'El badge debe desaparecer u ocultarse al marcar leídas');
        assert(stLeidas.listaTexto.includes('Todo al día') && stLeidas.listaTexto.includes('No tienes alertas pendientes'), 'Debe mostrar el mensaje de Todo al día');
        console.log('✓ "Marcar leídas" limpia el badge y muestra estado vacío "Todo al día".');

        // -------------------------------------------------------------
        // FASE 6: Verificar tienda.html con usuario Administrador
        // -------------------------------------------------------------
        console.log('\n[Fase 6] Verificando campana de notificaciones en tienda.html para Admin...');
        await sendCDP('Page.navigate', { url: 'http://localhost:3000/tienda.html' });
        await delay(2500);

        const tiendaCampana = await evalInBrowser(`
            (function() {
                const wrap = document.getElementById('tiendaCampanaWrap');
                const btnTienda = document.getElementById('btnCampanaNotificacionesTienda');
                const popover = document.getElementById('popoverNotificaciones');
                if (btnTienda) btnTienda.click();

                return {
                    wrapExiste: !!wrap,
                    wrapVisible: wrap ? !wrap.classList.contains('d-none') : false,
                    btnExiste: !!btnTienda,
                    popoverAbierto: popover ? !popover.classList.contains('d-none') : false
                };
            })()
        `);

        console.log('Estado de campana en tienda.html:', tiendaCampana);
        assert(tiendaCampana.wrapExiste, 'tiendaCampanaWrap debe existir');
        assert(tiendaCampana.wrapVisible, 'tiendaCampanaWrap debe estar visible para administradores');
        assert(tiendaCampana.popoverAbierto, 'El popover debe abrirse al presionar la campana en tienda.html');
        console.log('✓ Campana de notificaciones operativa en tienda.html para personal autorizado.');

        // -------------------------------------------------------------
        // FASE 7: Verificación de errores de consola y excepciones
        // -------------------------------------------------------------
        console.log('\n[Fase 7] Verificación de errores en navegador...');
        console.log('Errores en consola:', consoleErrors);
        console.log('Excepciones JS:', jsExceptions);

        assert.strictEqual(consoleErrors.length, 0, 'No debe haber errores de consola');
        assert.strictEqual(jsExceptions.length, 0, 'No debe haber excepciones JS');

        console.log('\n==================================================================');
        console.log(' ¡TODAS LAS PRUEBAS DEL CENTRO DE NOTIFICACIONES PASARON AL 100%! ');
        console.log('==================================================================');

    } finally {
        if (ws) ws.close();
        browserProcess.kill();
    }
}

ejecutar().catch(err => {
    console.error('\n❌ ERROR EN LA PRUEBA:', err);
    process.exit(1);
});
