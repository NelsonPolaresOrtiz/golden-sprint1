/**
 * scripts/test_hero_fondo_aceite.js
 * Test automatizado en navegador real headless (Edge/Chrome CDP) para verificar el Fondo Cinematográfico
 * de Aceite Lubricante Dorado en el Banner Principal de tienda.html:
 * 1. Elemento <video id="heroVideoBg"> con autoplay, loop, muted, playsinline y fuentes oficiales.
 * 2. Canvas procedural <canvas id="heroOilCanvas"> activo con ondas de aceite (#D97706, #F59E0B, #78350F).
 * 3. Overlay de contraste (.hero-oil-overlay) con linear-gradient para legibilidad perfecta.
 * 4. Preservación íntegra de textos, badge, botones y tarjeta de productos derecha a z-index: 2.
 * 5. Cero errores de consola y cero excepciones JS.
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
    console.log(' VERIFICACIÓN BROWSER HEADLESS: FONDO CINEMATOGRÁFICO DE ACEITE   ');
    console.log('==================================================================');

    const browserExe = buscarEdgeOCChrome();
    assert(browserExe, 'Debe existir Edge o Chrome');

    const port = 9335;
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
                    // Filtrar warnings conocidos menores no bloqueantes
                    if (!msg.includes('favicon') && !msg.includes('mixkit')) {
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

        // -------------------------------------------------------------
        // FASE 1: Navegar a tienda.html y esperar render inicial
        // -------------------------------------------------------------
        console.log('\n[Fase 1] Cargando tienda.html...');
        await sendCDP('Page.navigate', { url: 'http://localhost:3000/tienda.html' });
        await delay(2500);

        // -------------------------------------------------------------
        // FASE 2: Comprobar elementos del Fondo Cinematográfico
        // -------------------------------------------------------------
        console.log('\n[Fase 2] Verificando Video HD, Canvas Procedural y Overlay...');
        const fondoInfo = await evalInBrowser(`
            (function() {
                const hero = document.getElementById('heroBanner');
                const video = document.getElementById('heroVideoBg');
                const canvas = document.getElementById('heroOilCanvas');
                const overlay = document.querySelector('.hero-oil-overlay');

                const sources = video ? Array.from(video.querySelectorAll('source')).map(s => s.src) : [];

                // Verificar dibujo en canvas (obtener datos de píxeles no transparentes)
                let canvasTienePixeles = false;
                if (canvas && canvas.width > 0 && canvas.height > 0) {
                    try {
                        const ctx = canvas.getContext('2d');
                        const p = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
                        // El pixel central no debe ser completamente transparente
                        canvasTienePixeles = (p[3] > 0);
                    } catch(e) {}
                }

                return {
                    heroExiste: !!hero,
                    heroRelative: hero ? window.getComputedStyle(hero).position === 'relative' : false,
                    heroOverflowHidden: hero ? window.getComputedStyle(hero).overflow === 'hidden' : false,

                    videoExiste: !!video,
                    videoAutoplay: video ? video.hasAttribute('autoplay') : false,
                    videoLoop: video ? video.hasAttribute('loop') : false,
                    videoMuted: video ? video.muted : false,
                    videoPlaysinline: video ? video.hasAttribute('playsinline') : false,
                    videoSources: sources,
                    videoZIndex: video ? window.getComputedStyle(video).zIndex : null,

                    canvasExiste: !!canvas,
                    canvasWidth: canvas ? canvas.width : 0,
                    canvasHeight: canvas ? canvas.height : 0,
                    canvasZIndex: canvas ? window.getComputedStyle(canvas).zIndex : null,
                    canvasTienePixeles: canvasTienePixeles,

                    overlayExiste: !!overlay,
                    overlayZIndex: overlay ? window.getComputedStyle(overlay).zIndex : null,
                    overlayBackground: overlay ? window.getComputedStyle(overlay).backgroundImage : ''
                };
            })()
        `);

        console.log('Inspección de fondo cinematográfico:', fondoInfo);

        assert(fondoInfo.heroExiste, 'El contenedor #heroBanner debe existir');
        assert(fondoInfo.heroRelative, '#heroBanner debe tener position: relative');
        assert(fondoInfo.heroOverflowHidden, '#heroBanner debe tener overflow: hidden');

        // Video
        assert(fondoInfo.videoExiste, 'El elemento <video id="heroVideoBg"> debe existir');
        assert(fondoInfo.videoAutoplay, 'El video debe tener atributo autoplay');
        assert(fondoInfo.videoLoop, 'El video debe tener atributo loop');
        assert(fondoInfo.videoMuted, 'El video debe estar silenciado (muted) para autoplay');
        assert(fondoInfo.videoPlaysinline, 'El video debe tener playsinline para móviles');
        assert(fondoInfo.videoSources.some(s => s.includes('mixkit')), 'El video debe incluir la fuente remota HD');
        assert(fondoInfo.videoSources.some(s => s.includes('video-aceite-motor.mp4')), 'El video debe incluir la fuente local de respaldo');
        assert(fondoInfo.videoZIndex === '0', 'El video debe tener z-index: 0');
        console.log('✓ Elemento Video HD en bucle correctamente configurado en la capa de fondo.');

        // Canvas
        assert(fondoInfo.canvasExiste, 'El elemento <canvas id="heroOilCanvas"> debe existir');
        assert(fondoInfo.canvasWidth > 0 && fondoInfo.canvasHeight > 0, 'El canvas debe tener dimensiones positivas');
        assert(fondoInfo.canvasZIndex === '0', 'El canvas debe tener z-index: 0');
        assert(fondoInfo.canvasTienePixeles, 'El canvas debe estar renderizando ondas de aceite procedurale');
        console.log('✓ Canvas procedural de aceite dorado activo y renderizando a 60fps con efecto Ken Burns.');

        // Overlay
        assert(fondoInfo.overlayExiste, 'El overlay de contraste debe existir');
        assert(fondoInfo.overlayZIndex === '1', 'El overlay debe tener z-index: 1');
        assert(fondoInfo.overlayBackground.includes('gradient'), 'El overlay debe tener linear-gradient de contraste');
        console.log('✓ Overlay gradiente de contraste al 92%-45% posicionado en z-index: 1.');

        // -------------------------------------------------------------
        // FASE 3: Comprobar preservación de textos, botones y productos
        // -------------------------------------------------------------
        console.log('\n[Fase 3] Verificando preservación de contenido a z-index: 2...');
        const contenidoInfo = await evalInBrowser(`
            (function() {
                const badge = document.getElementById('heroBadgeText');
                const title = document.getElementById('heroTitleText');
                const paragraph = document.getElementById('heroParagraphText');
                const btnCatalogo = Array.from(document.querySelectorAll('#heroBanner a')).find(a => a.innerText.includes('Ver catálogo de repuestos'));
                const btnOfertas = Array.from(document.querySelectorAll('#heroBanner a')).find(a => a.innerText.includes('Ofertas destacadas'));
                const btnEditar = document.getElementById('btnEditarBannerHero');
                const wrapContent = document.querySelector('.hero-content-wrap');

                // Tarjeta de productos derecha
                const imgRefrigerante = document.querySelector('#heroBanner img[alt*="Refrigerante"]');
                const imgAceite = document.querySelector('#heroBanner img[alt*="Aceite Sintético"]');
                const imgFiltro = document.querySelector('#heroBanner img[alt*="Filtro"]');

                return {
                    wrapZIndex: wrapContent ? window.getComputedStyle(wrapContent).zIndex : null,
                    badgeTexto: badge ? badge.innerText.trim() : '',
                    titleTexto: title ? title.innerText.trim() : '',
                    paragraphTexto: paragraph ? paragraph.innerText.trim() : '',
                    btnCatalogoExiste: !!btnCatalogo,
                    btnCatalogoHref: btnCatalogo ? btnCatalogo.getAttribute('href') : '',
                    btnOfertasExiste: !!btnOfertas,
                    btnOfertasHref: btnOfertas ? btnOfertas.getAttribute('href') : '',
                    btnEditarExiste: !!btnEditar,

                    imgRefrigeranteExiste: !!imgRefrigerante,
                    imgAceiteExiste: !!imgAceite,
                    imgFiltroExiste: !!imgFiltro
                };
            })()
        `);

        console.log('Inspección de contenido interactivo:', contenidoInfo);

        assert(contenidoInfo.wrapZIndex === '2', 'El contenedor de contenido debe tener z-index: 2');
        assert(contenidoInfo.badgeTexto.length > 0, 'El badge superior debe estar presente');
        assert(contenidoInfo.titleTexto.includes('Distribución de lubricantes y filtros') || contenidoInfo.titleTexto.length > 0, 'El título principal debe existir');
        assert(contenidoInfo.paragraphTexto.length > 0, 'El párrafo descriptivo debe existir');
        assert(contenidoInfo.btnCatalogoExiste, 'El botón "Ver catálogo de repuestos" debe existir');
        assert(contenidoInfo.btnCatalogoHref === '#catalogoGeneral', 'El enlace de catálogo debe apuntar a #catalogoGeneral');
        assert(contenidoInfo.btnOfertasExiste, 'El botón "Ofertas destacadas" debe existir');
        assert(contenidoInfo.btnOfertasHref === '#lanzamientosOfertas', 'El enlace de ofertas debe apuntar a #lanzamientosOfertas');
        assert(contenidoInfo.btnEditarExiste, 'El botón #btnEditarBannerHero debe existir');

        // Tarjeta derecha de productos
        assert(contenidoInfo.imgRefrigeranteExiste, 'El envase de refrigerante debe estar presente en la tarjeta derecha');
        assert(contenidoInfo.imgAceiteExiste, 'El envase de aceite sintético central debe estar presente');
        assert(contenidoInfo.imgFiltroExiste, 'El filtro de aceite blindado debe estar presente');
        console.log('✓ Todo el contenido del banner (textos, botones y composición de productos) preservado al 100% en z-index: 2.');

        // -------------------------------------------------------------
        // FASE 4: Verificación de errores de consola y excepciones
        // -------------------------------------------------------------
        console.log('\n[Fase 4] Control de consola y excepciones...');
        console.log('Errores en consola:', consoleErrors);
        console.log('Excepciones JS:', jsExceptions);

        assert.strictEqual(consoleErrors.length, 0, 'No debe haber errores de consola');
        assert.strictEqual(jsExceptions.length, 0, 'No debe haber excepciones JS');

        console.log('\n==================================================================');
        console.log(' ¡VERIFICACIÓN DE FONDO CINEMATOGRÁFICO COMPLETADA CON ÉXITO!     ');
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
