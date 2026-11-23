const { spawn } = require('child_process');
const http = require('http');

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
            });
        }).on('error', reject);
    });
}

async function main() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge_test_' + Date.now(),
        'about:blank'
    ], { stdio: 'ignore' });

    console.log('[Browser] Edge lanzado con PID', edge.pid);

    try {
        let targets = null;
        for (let i = 0; i < 20; i++) {
            await sleep(300);
            try {
                targets = await getJson('http://127.0.0.1:9222/json/list');
                if (targets && targets.length > 0) break;
            } catch (e) {}
        }

        if (!targets || targets.length === 0) {
            throw new Error('No se pudo conectar a Edge CDP en puerto 9222');
        }

        let pageTarget = targets.find(t => t.type === 'page');
        if (!pageTarget) {
            // Crear target de página si no hay uno
            pageTarget = targets[0];
        }
        console.log('[Browser] Conectando a target page:', pageTarget.title, pageTarget.webSocketDebuggerUrl);

        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let msgId = 1;
        const pendingCallbacks = new Map();

        function send(method, params = {}) {
            return new Promise((resolve) => {
                const id = msgId++;
                pendingCallbacks.set(id, resolve);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        const logs = [];
        const errors = [];

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pendingCallbacks.has(data.id)) {
                const cb = pendingCallbacks.get(data.id);
                pendingCallbacks.delete(data.id);
                cb(data.result);
            }

            if (data.method === 'Runtime.consoleAPICalled') {
                const type = data.params.type;
                const args = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
                logs.push(`[Console ${type}] ${args}`);
                if (type === 'error') {
                    errors.push(`[Console error] ${args}`);
                }
            } else if (data.method === 'Runtime.exceptionThrown') {
                const details = data.params.exceptionDetails;
                const text = details.exception ? (details.exception.description || details.exception.value) : details.text;
                errors.push(`[Uncaught Exception] ${text} (line ${details.lineNumber}:${details.columnNumber})`);
            }
        };

        await send('Runtime.enable');
        await send('Page.enable');
        await send('Log.enable');

        console.log('[Browser] Navegando a http://localhost:3000/tienda.html ...');
        await send('Page.navigate', { url: 'http://localhost:3000/tienda.html' });

        // Esperar 3 segundos para que carguen scripts y peticiones
        await sleep(3500);

        console.log('\n--- CASO 1: SIN SESIÓN (INVITADO) ---');
        console.log('\n--- CONSOLE LOGS CAPTURADOS ---');
        logs.forEach(l => console.log(l));

        console.log('\n--- ERRORES CAPTURADOS ---');
        if (errors.length === 0) {
            console.log('No hubo errores de consola.');
        } else {
            errors.forEach(e => console.error(e));
        }

        // Evaluar estado del DOM
        let evalRes = await send('Runtime.evaluate', {
            expression: `({
                carouselHtml: document.getElementById('tecfilCarouselContainer')?.innerHTML?.slice(0, 300),
                carouselChildren: document.getElementById('tecfilCarouselContainer')?.children?.length,
                catalogoChildren: document.getElementById('catalogoProductos')?.children?.length,
                productosTiendaCount: window.productosTienda?.length,
                userChipHtml: document.getElementById('userNavInfoContainer')?.innerHTML || document.getElementById('userHeaderControlContainer')?.innerHTML
            })`,
            returnByValue: true
        });

        console.log('\n--- ESTADO DEL DOM (INVITADO) ---');
        console.log(evalRes.result ? evalRes.result.value : evalRes);

        // AHORA SIMULAR CLIENTE EN LOCALSTORAGE
        console.log('\n--- CASO 2: CON SESIÓN DE CLIENTE (Taller Los ...) ---');
        await send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('usuario_golden', JSON.stringify({
                    id: 58,
                    nombre: 'Taller Los Pinos',
                    email: 'cliente@golden.bo',
                    rol: 'CLIENTE',
                    telefono: '75789123',
                    direccion: 'Av. Destacamento 111 #520'
                }));
                localStorage.setItem('usuario', localStorage.getItem('usuario_golden'));
                location.reload();
            `
        });

        await sleep(3500);

        console.log('\n--- CONSOLE LOGS TRAS RELOAD CON CLIENTE ---');
        logs.slice(logs.length - 10).forEach(l => console.log(l));

        evalRes = await send('Runtime.evaluate', {
            expression: `({
                carouselHtml: document.getElementById('tecfilCarouselContainer')?.innerHTML?.slice(0, 300),
                carouselChildren: document.getElementById('tecfilCarouselContainer')?.children?.length,
                catalogoChildren: document.getElementById('catalogoProductos')?.children?.length,
                productosTiendaCount: window.productosTienda?.length,
                userNavHtml: document.getElementById('userNavInfoContainer')?.outerHTML || document.getElementById('userHeaderControlContainer')?.outerHTML
            })`,
            returnByValue: true
        });

        console.log('\n--- ESTADO DEL DOM (CLIENTE LOGUEADO) ---');
        console.log(evalRes.result ? evalRes.result.value : evalRes);

        ws.close();
    } finally {
        edge.kill();
    }
}

main().catch(err => {
    console.error('Fallo en test browser:', err);
    process.exit(1);
});
