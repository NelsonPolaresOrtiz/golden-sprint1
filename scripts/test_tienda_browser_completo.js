const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');

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

async function run() {
    console.log('================================================================');
    console.log('  VERIFICACIÓN BROWSER HEADLESS (EDGE/CHROME CDP) - TIENDA.HTML ');
    console.log('================================================================');

    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + require('os').tmpdir() + '\\edge_full_test_' + Date.now(),
        'about:blank'
    ], { stdio: 'ignore' });

    console.log('[Browser] Navegador iniciado (PID ' + edge.pid + ')');

    try {
        let targets = null;
        for (let i = 0; i < 25; i++) {
            await sleep(250);
            try {
                targets = await getJson('http://127.0.0.1:9222/json/list');
                if (targets && targets.length > 0) break;
            } catch (e) {}
        }

        const pageTarget = (targets || []).find(t => t.type === 'page') || targets[0];
        if (!pageTarget) throw new Error('No se pudo encontrar pestaña de navegador en puerto 9222');

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

        const consoleErrors = [];
        const uncaughtExceptions = [];

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pendingCallbacks.has(data.id)) {
                const cb = pendingCallbacks.get(data.id);
                pendingCallbacks.delete(data.id);
                cb(data.result);
            }

            if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
                const msg = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
                consoleErrors.push(msg);
            } else if (data.method === 'Runtime.exceptionThrown') {
                const details = data.params.exceptionDetails;
                const text = details.exception ? (details.exception.description || details.exception.value) : details.text;
                uncaughtExceptions.push(text);
            }
        };

        await send('Runtime.enable');
        await send('Page.enable');
        await send('Log.enable');

        // -------------------------------------------------------------
        // CASO 1: VISITANTE SIN SESIÓN (INVITADO)
        // -------------------------------------------------------------
        console.log('\n--- 1. EVALUACIÓN VISITANTE INVITADO (CATÁLOGO LIBRE) ---');
        await send('Page.navigate', { url: 'http://localhost:3000/tienda.html' });
        await sleep(3000);

        let resCheck = await send('Runtime.evaluate', {
            expression: `({
                carouselCards: document.querySelectorAll('#tecfilCarouselContainer .tecfil-tech-card').length,
                catalogoCards: document.querySelectorAll('#catalogoProductos .card-producto-wix, #catalogoProductos .col-12').length,
                hasSpinner: document.getElementById('tecfilCarouselContainer')?.innerText?.includes('Cargando lanzamientos')
            })`,
            returnByValue: true
        });

        let val = resCheck.result.value;
        console.log(`- Tarjetas en carrusel de lanzamientos: ${val.carouselCards}`);
        console.log(`- Tarjetas en grilla de catálogo: ${val.catalogoCards}`);
        console.log(`- ¿Spinner de carga presente?: ${val.hasSpinner}`);

        assert.strictEqual(val.hasSpinner, false, 'El spinner de carga NO debe permanecer activo');
        assert.ok(val.carouselCards >= 4, 'Deben renderizarse al menos 4 productos en el carrusel de lanzamientos');
        assert.ok(val.catalogoCards >= 8, 'Deben renderizarse productos en la grilla del catálogo');
        console.log('✅ Caso 1 pasado exitosamente.');

        // -------------------------------------------------------------
        // CASO 2: CLIENTE AUTENTICADO (TALLER LOS PINOS)
        // -------------------------------------------------------------
        console.log('\n--- 2. EVALUACIÓN CON SESIÓN CLIENTE (Taller Los Pinos) ---');
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
        await sleep(3000);

        resCheck = await send('Runtime.evaluate', {
            expression: `({
                carouselCards: document.querySelectorAll('#tecfilCarouselContainer .tecfil-tech-card').length,
                catalogoCards: document.querySelectorAll('#catalogoProductos .card-producto-wix, #catalogoProductos .col-12').length,
                hasSpinner: document.getElementById('tecfilCarouselContainer')?.innerText?.includes('Cargando lanzamientos'),
                userName: document.getElementById('tiendaUserName')?.innerText,
                userRol: document.getElementById('tiendaUserRol')?.innerText,
                nameColor: window.getComputedStyle(document.getElementById('tiendaUserName')).color,
                badgeBg: window.getComputedStyle(document.getElementById('tiendaUserRol')).backgroundColor,
                badgeColor: window.getComputedStyle(document.getElementById('tiendaUserRol')).color
            })`,
            returnByValue: true
        });

        val = resCheck.result.value;
        console.log(`- Tarjetas en carrusel de lanzamientos: ${val.carouselCards}`);
        console.log(`- Tarjetas en grilla de catálogo: ${val.catalogoCards}`);
        console.log(`- ¿Spinner de carga presente?: ${val.hasSpinner}`);
        console.log(`- Nombre de usuario en chip: "${val.userName}"`);
        console.log(`- Rol en chip: "${val.userRol}"`);
        console.log(`- Color calculado del nombre: ${val.nameColor}`);
        console.log(`- Color calculado del badge rol: ${val.badgeColor}`);

        assert.strictEqual(val.hasSpinner, false, 'El spinner de carga NO debe permanecer activo con cliente logueado');
        assert.ok(val.carouselCards >= 4, 'Deben renderizarse al menos 4 productos en el carrusel de lanzamientos');
        assert.ok(val.catalogoCards >= 8, 'Deben renderizarse productos en la grilla del catálogo');
        assert.ok(val.userName.includes('Taller'), 'El chip debe mostrar el nombre del cliente');
        assert.strictEqual(val.userRol, 'CLIENTE', 'El chip debe tener el rol CLIENTE');

        // Verificar contraste oscuro (no blanco): rgb(15, 23, 42)
        assert.strictEqual(val.nameColor, 'rgb(15, 23, 42)', 'El nombre del cliente debe tener color oscuro de alto contraste #0F172A');
        console.log('✅ Caso 2 (Carga y Contraste de Chip) pasado exitosamente.');

        // -------------------------------------------------------------
        // CASO 3: INTERACCIÓN CON PESTAÑAS DE LÍNEAS DEL CARRUSEL
        // -------------------------------------------------------------
        console.log('\n--- 3. EVALUACIÓN DE PESTAÑAS DE LÍNEA (Lanzamientos y Ofertas) ---');
        
        // Pestaña Pesada
        let tabRes = await send('Runtime.evaluate', {
            expression: `
                cambiarLineaOfertas('pesada');
                document.querySelectorAll('#tecfilCarouselContainer .tecfil-tech-card').length;
            `,
            returnByValue: true
        });
        console.log(`- Filtro 'pesada': ${tabRes.result.value} repuestos renderizados`);
        assert.ok(tabRes.result.value >= 4, 'Línea pesada debe renderizar repuestos');

        // Pestaña Agrícola
        tabRes = await send('Runtime.evaluate', {
            expression: `
                cambiarLineaOfertas('agricola');
                document.querySelectorAll('#tecfilCarouselContainer .tecfil-tech-card').length;
            `,
            returnByValue: true
        });
        console.log(`- Filtro 'agricola': ${tabRes.result.value} repuestos renderizados`);
        assert.ok(tabRes.result.value >= 4, 'Línea agrícola debe renderizar repuestos');

        // Pestaña Motos
        tabRes = await send('Runtime.evaluate', {
            expression: `
                cambiarLineaOfertas('motos');
                document.querySelectorAll('#tecfilCarouselContainer .tecfil-tech-card').length;
            `,
            returnByValue: true
        });
        console.log(`- Filtro 'motos': ${tabRes.result.value} repuestos renderizados`);
        assert.ok(tabRes.result.value >= 4, 'Línea motos debe renderizar repuestos');

        // Pestaña Liviana
        tabRes = await send('Runtime.evaluate', {
            expression: `
                cambiarLineaOfertas('liviana');
                document.querySelectorAll('#tecfilCarouselContainer .tecfil-tech-card').length;
            `,
            returnByValue: true
        });
        console.log(`- Filtro 'liviana': ${tabRes.result.value} repuestos renderizados`);
        assert.ok(tabRes.result.value >= 4, 'Línea liviana debe renderizar repuestos');
        console.log('✅ Caso 3 (Filtro por pestaña) pasado exitosamente.');

        // -------------------------------------------------------------
        // CONTROL FINAL DE ERRORES DE CONSOLA
        // -------------------------------------------------------------
        console.log('\n--- 4. CONTROL DE ERRORES DE CONSOLA Y EXCEPCIONES ---');
        console.log(`Total console.error capturados: ${consoleErrors.length}`);
        console.log(`Total excepciones JS capturadas: ${uncaughtExceptions.length}`);

        if (consoleErrors.length > 0) {
            console.error('Errores:', consoleErrors);
        }
        if (uncaughtExceptions.length > 0) {
            console.error('Excepciones:', uncaughtExceptions);
        }

        assert.strictEqual(uncaughtExceptions.length, 0, 'No deben existir excepciones JS no capturadas');
        assert.strictEqual(consoleErrors.length, 0, 'No deben existir errores de consola');

        console.log('\n================================================================');
        console.log('  ✅ VERIFICACIÓN DE NAVEGADOR COMPLETADA CON CERO ERRORES ');
        console.log('================================================================');

        ws.close();
    } finally {
        edge.kill();
    }
}

run().catch(err => {
    console.error('❌ Fallo en la verificación:', err);
    process.exit(1);
});
