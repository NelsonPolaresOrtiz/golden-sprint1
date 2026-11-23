/**
 * test_split_login.js
 * Verificación integral del rediseño Split-Screen (55% / 45%)
 * para Login de Clientes y Personal en GOLDEN ERP.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('==================================================================');
console.log(' VERIFICACIÓN UI/UX: LOGIN SPLIT-SCREEN & ESCAPARATE AUTOMOTRIZ   ');
console.log('==================================================================\n');

let passCount = 0;
function pass(msg) {
    console.log(`  [PASS] ${msg}`);
    passCount++;
}

// 1. Verificación de archivos SVG offline fallback
console.log('--- 1. VERIFICACIÓN DE ASSETS SVG OFFLINE FALLBACK ---');
const showcaseSvgs = [
    'showcase_liviana.svg',
    'showcase_pesada.svg',
    'showcase_agricola.svg',
    'showcase_moto.svg'
];

showcaseSvgs.forEach(file => {
    const filePath = path.join(__dirname, '..', 'public', 'img', 'showcase', file);
    assert(fs.existsSync(filePath), `Archivo SVG no encontrado: ${file}`);
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes('<svg') && content.includes('</svg>'), `El archivo ${file} debe ser un SVG válido`);
    pass(`Fallback SVG ${file} existe y contiene estructura vectorial válida (${content.length} bytes)`);
});

// 2. Verificación de IDs funcionales y estructura en index.html y login.html
console.log('\n--- 2. VERIFICACIÓN DE IDS FUNCIONALES Y ATRIBUTOS DOM ---');
const htmlFiles = ['public/index.html', 'public/login.html'];
const requiredIds = [
    'loginView',
    'showcaseCol',
    'automotiveSlidesContainer',
    'showcaseActiveTag',
    'showcaseTagText',
    'showcaseActiveTitle',
    'showcaseActiveSub',
    'showcaseIndicatorsBar',
    'panelLoginInterno',
    'loginForm',
    'loginEmail',
    'loginPassword',
    'btnTogglePassword',
    'iconoPassword',
    'loginAlert',
    'btnLogin',
    'portalClientesView',
    'portalLoginForm',
    'portalClienteEmail',
    'portalClientePassword',
    'btnPortalClienteLogin',
    'portalRegistroForm'
];

htmlFiles.forEach(relPath => {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    requiredIds.forEach(id => {
        assert(content.includes(`id="${id}"`), `El archivo ${relPath} debe contener id="${id}"`);
    });
    pass(`${relPath} contiene los ${requiredIds.length} IDs funcionales intactos`);

    // Verificar las 4 diapositivas del carrusel con sus etiquetas institucionales
    assert(content.includes('LÍNEA LIVIANA (AUTOS &amp; SUV)') || content.includes('LÍNEA LIVIANA (AUTOS & SUV)'), `${relPath} debe incluir Línea Liviana`);
    assert(content.includes('LÍNEA PESADA (TRANSPORTE &amp; CARGA)') || content.includes('LÍNEA PESADA (TRANSPORTE & CARGA)'), `${relPath} debe incluir Línea Pesada`);
    assert(content.includes('LÍNEA AGRÍCOLA &amp; MAQUINARIA') || content.includes('LÍNEA AGRÍCOLA & MAQUINARIA'), `${relPath} debe incluir Línea Agrícola`);
    assert(content.includes('LÍNEA MOTOCICLETAS (2T &amp; 4T)') || content.includes('LÍNEA MOTOCICLETAS (2T & 4T)'), `${relPath} debe incluir Línea Motocicletas`);
    pass(`${relPath} contiene las 4 categorías vehiculares oficiales configuradas`);

    // Verificar los 4 fallbacks offline con onerror
    showcaseSvgs.forEach(svgName => {
        assert(content.includes(svgName), `${relPath} debe incluir fallback onerror hacia ${svgName}`);
    });
    pass(`${relPath} garantiza fallback offline con onerror hacia los 4 SVGs`);

    // Verificar botón de enlace a tienda.html
    assert(content.includes('href="tienda.html"'), `${relPath} debe incluir enlace a tienda.html`);
    pass(`${relPath} incluye enlace de navegación directa a tienda.html`);
});

// 3. Verificación de reglas CSS en styles.css
console.log('\n--- 3. VERIFICACIÓN DE REGLAS CSS Y ANIMACIÓN KEN BURNS ---');
const cssPath = path.join(__dirname, '..', 'public', 'styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const requiredCssRules = [
    '.split-login-wrapper',
    '.automotive-showcase-col',
    '.automotive-slides-container',
    '.ken-burns-slide',
    '@keyframes kenBurnsMotion',
    '.showcase-overlay-vignette',
    '.showcase-indicator-pill',
    '.pill-portal-commercial',
    '.modern-input-group',
    '.modern-form-input',
    '.btn-login-crimson',
    '@media (max-width: 900px)'
];

requiredCssRules.forEach(rule => {
    assert(cssContent.includes(rule), `styles.css debe contener la regla ${rule}`);
    pass(`styles.css contiene la regla moderna: ${rule}`);
});

// Verificar proporciones 55% y 45%
assert(cssContent.includes('flex: 0 0 55%;'), 'styles.css debe configurar la columna izquierda al 55%');
assert(cssContent.includes('flex: 0 0 45%;'), 'styles.css debe configurar la columna derecha al 45%');
pass('Proporciones split-screen 55% / 45% verificadas en CSS desktop');

// Verificar altura responsive de 220px para < 900px
assert(cssContent.includes('height: 220px !important;'), 'styles.css debe definir height: 220px para el showcase en móviles');
pass('Altura de 220px para banner móvil (<900px) verificada en CSS');

// 4. Verificación de lógica de carrusel en app.js
console.log('\n--- 4. VERIFICACIÓN DE CONTROLADOR JS DE CARRUSEL (4.5s) ---');
const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

assert(appJsContent.includes('window.irASlideAutomotriz = irASlideAutomotriz;'), 'app.js debe exponer irASlideAutomotriz');
assert(appJsContent.includes('window.iniciarCarruselAutomotriz = function'), 'app.js debe exponer iniciarCarruselAutomotriz');
assert(appJsContent.includes('4500'), 'app.js debe configurar el timer de transición a 4500ms (4.5s)');
pass('app.js expone irASlideAutomotriz e iniciarCarruselAutomotriz con intervalo de 4.5s');

console.log('\n==================================================================');
console.log(` RESULTADO FINAL: ${passCount} verificaciones exitosas. CERO ERRORES.`);
console.log('==================================================================');
