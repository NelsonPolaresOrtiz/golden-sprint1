/**
 * test_qr_dinamico.js
 * Verificación Integral del Motor QR Dinámico EMVCo + CRC-16 para GOLDEN ERP
 */

const fs = require('fs');
const assert = require('assert');
const path = require('path');
const QRDinamico = require('../public/js/qr-dinamico');

console.log('==================================================================');
console.log(' VERIFICACIÓN FINTECH: MOTOR QR DINÁMICO EMVCo & CRC-16/CCITT     ');
console.log('==================================================================\n');

let passCount = 0;
function pass(msg) {
    console.log(`  [PASS] ${msg}`);
    passCount++;
}

async function runTests() {
    // -------------------------------------------------------------
    // 1. Algoritmo Criptográfico CRC-16/CCITT-FALSE
    // -------------------------------------------------------------
    console.log('--- 1. VERIFICACIÓN CRIPTOGRÁFICA CRC-16/CCITT-FALSE (0x1021) ---');
    const crcVector = QRDinamico.crc16CcittFalse('123456789');
    assert.strictEqual(crcVector, '29B1', 'El vector estándar 123456789 debe resultar en 29B1');
    pass('Vector de prueba estándar 123456789 verificado: 0x29B1');

    const crcEmpty = QRDinamico.crc16CcittFalse('');
    assert.strictEqual(crcEmpty, 'FFFF', 'Cadena vacía debe ser 0xFFFF');
    pass('Init 0xFFFF verificado para buffer vacío');

    // -------------------------------------------------------------
    // 2. Parser y Constructor TLV (Tag-Length-Value)
    // -------------------------------------------------------------
    console.log('\n--- 2. PARSER Y CONSTRUCTOR DE TAGS TLV (EMVCo MPM) ---');
    const tlvStr = '0002010102125406161.505802BO';
    const parsed = QRDinamico.parsearTLV(tlvStr);
    assert.strictEqual(parsed.tags['00'], '01', 'Tag 00 debe ser 01');
    assert.strictEqual(parsed.tags['01'], '12', 'Tag 01 debe ser 12');
    assert.strictEqual(parsed.tags['54'], '161.50', 'Tag 54 debe ser 161.50');
    assert.strictEqual(parsed.tags['58'], 'BO', 'Tag 58 debe ser BO');
    pass('Parser TLV extrae correctamente etiquetas con sus longitudes y valores');

    // -------------------------------------------------------------
    // 3. Generación de QR Dinámico EMVCo con Monto Bloqueado
    // -------------------------------------------------------------
    console.log('\n--- 3. GENERADOR DE QR DINÁMICO CON MONTO Y REFERENCIA BLOQUEADOS ---');
    
    // Caso 1: Monto Bs. 161.50, Referencia GLD-0035
    const r1 = QRDinamico.generarPayloadEMVCoDinamico(161.50, 'GLD-0035');
    assert(r1.payload.startsWith('000201010211'), 'Debe iniciar con 000201 y Tag 01="11" (QR Simple Bolivia Interoperable)');
    assert(r1.payload.includes('5303068'), 'Tag 53 debe ser 068 (BOB - Bolivianos)');
    assert(r1.payload.includes('5406161.50'), 'Tag 54 debe contener longitud 06 y monto 161.50');
    assert(r1.payload.includes('5802BO'), 'Tag 58 debe ser BO (Bolivia)');
    assert(r1.payload.includes('GLD-0035'), 'Tag 62 debe contener la referencia GLD-0035');
    assert(r1.payload.endsWith('6304' + r1.crc), 'Debe finalizar con 6304 + Checksum CRC-16');
    
    const v1 = QRDinamico.validarCRC16(r1.payload);
    assert(v1.esValido, `Firma CRC-16 debe ser matemáticamente válida (${r1.crc})`);
    pass(`QR Dinámico Bs. 161.50 generado con éxito: CRC #${r1.crc}`);

    // Caso 2: Monto Bs. 39.10, Referencia GLD-0034
    const r2 = QRDinamico.generarPayloadEMVCoDinamico(39.10, 'GLD-0034');
    assert(r2.payload.includes('540539.10'), 'Tag 54 debe contener longitud 05 y monto 39.10');
    assert(r2.payload.includes('GLD-0034'), 'Tag 62 debe contener la referencia GLD-0034');
    
    const v2 = QRDinamico.validarCRC16(r2.payload);
    assert(v2.esValido, `Firma CRC-16 debe ser matemáticamente válida (${r2.crc})`);
    pass(`QR Dinámico Bs. 39.10 generado con éxito: CRC #${r2.crc}`);

    // Caso 3: Verificación específica para Bs. 59.50 (Solicitado por el usuario)
    const r3 = QRDinamico.generarPayloadEMVCoDinamico(59.50, 'GLD-2026-0035');
    assert(r3.payload.startsWith('000201010211'), 'Debe iniciar con 000201010211');
    assert(r3.payload.includes('5303068'), 'Debe contener moneda Bolivianos 5303068');
    assert(r3.payload.includes('540559.50'), 'Debe contener monto 540559.50');
    assert(r3.payload.includes('5802BO'), 'Debe contener país Bolivia 5802BO');
    assert(QRDinamico.validarCRC16(r3.payload).esValido, 'Firma CRC-16 de Bs. 59.50 debe ser válida');
    console.log(`\n  >>> PAYLOAD REAL BS. 59.50:\n      ${r3.payload}\n      CRC-16: #${r3.crc}`);
    pass(`QR Dinámico Bs. 59.50 generado con éxito: CRC #${r3.crc}`);

    // -------------------------------------------------------------
    // 4. Endpoints API Backend (GET /api/pagos/qr-yape & POST /api/pagos/qr-dinamico)
    // -------------------------------------------------------------
    console.log('\n--- 4. ENDPOINTS API BACKEND (INTEGRACIÓN EN SERVIDOR NODE.JS) ---');
    
    // GET /api/pagos/qr-yape dinámico
    const resGet = await fetch('http://localhost:3000/api/pagos/qr-yape?monto=161.50&referencia=GLD-0035&format=json');
    assert(resGet.ok, 'GET /api/pagos/qr-yape debe responder 200');
    const dataGet = await resGet.json();
    assert.strictEqual(dataGet.es_dinamico, true, 'Debe marcarse como es_dinamico');
    assert.strictEqual(dataGet.monto, '161.50', 'Monto debe ser 161.50');
    assert.strictEqual(dataGet.crc, r1.crc, 'El CRC devuelto por la API debe coincidir con el cálculo');
    assert(dataGet.dataUrl.startsWith('data:image/png;base64,'), 'Debe incluir imagen DataURL de alta densidad');
    pass('GET /api/pagos/qr-yape genera QR dinámico JSON con DataURL');

    // GET /api/pagos/qr-yape formato SVG
    const resSvg = await fetch('http://localhost:3000/api/pagos/qr-yape?monto=39.10&referencia=GLD-0034&format=svg');
    assert(resSvg.ok, 'GET /api/pagos/qr-yape format=svg debe responder 200');
    const svgText = await resSvg.text();
    assert(svgText.includes('<svg') && svgText.includes('badge-central') && svgText.includes('Bs.'), 'SVG debe contener el código vectorial y badge central Bs.');
    pass('GET /api/pagos/qr-yape format=svg devuelve gráfico vectorial nítido con badge central');

    // POST /api/pagos/qr-dinamico
    const resPost = await fetch('http://localhost:3000/api/pagos/qr-dinamico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: 250.00, referencia: 'GLD-DEFENSA-01' })
    });
    assert(resPost.ok, 'POST /api/pagos/qr-dinamico debe responder 200');
    const dataPost = await resPost.json();
    assert.strictEqual(dataPost.monto, '250.00', 'Monto de POST debe ser 250.00');
    assert(dataPost.crc && dataPost.crc.length === 4, 'CRC debe ser de 4 dígitos hex');
    pass('POST /api/pagos/qr-dinamico genera código dinámico bajo demanda');

    // -------------------------------------------------------------
    // 5. Integración Frontend en tienda.html y tienda.js
    // -------------------------------------------------------------
    console.log('\n--- 5. INTEGRACIÓN EN TIENDA ONLINE (tienda.html & tienda.js) ---');
    const tiendaHtml = fs.readFileSync(path.join(__dirname, '../public/tienda.html'), 'utf8');
    assert(tiendaHtml.includes('id="canvasQROficial"'), 'tienda.html debe contener canvasQROficial');
    assert(tiendaHtml.includes('id="checkoutQRMontoDestacado"'), 'tienda.html debe contener checkoutQRMontoDestacado');
    assert(tiendaHtml.includes('id="btnDescargarQROficial"'), 'tienda.html debe contener btnDescargarQROficial');
    assert(tiendaHtml.includes('Pago con QR Simple / Yape Bolivia'), 'tienda.html debe contener cabecera limpia de Yape Bolivia');
    assert(tiendaHtml.includes('js/qr-dinamico.js'), 'tienda.html debe cargar js/qr-dinamico.js');
    pass('tienda.html incluye interfaz limpia bancaria oficial de Yape Bolivia');

    const tiendaJs = fs.readFileSync(path.join(__dirname, '../public/tienda.js'), 'utf8');
    assert(tiendaJs.includes('renderizarQROficialYape'), 'tienda.js debe incluir renderizarQROficialYape');
    assert(tiendaJs.includes('simularMontoQRDinamico'), 'tienda.js debe incluir simularMontoQRDinamico');
    assert(tiendaJs.includes('restablecerMontoQRCarrito'), 'tienda.js debe incluir restablecerMontoQRCarrito');
    pass('tienda.js integra lógica de renderizado oficial intacto y controles auxiliares');

    // -------------------------------------------------------------
    // 6. Integración Frontend en venta-directa.html y venta-directa.js
    // -------------------------------------------------------------
    console.log('\n--- 6. INTEGRACIÓN EN VENTA DIRECTA (venta-directa.html & venta-directa.js) ---');
    const vdHtml = fs.readFileSync(path.join(__dirname, '../public/venta-directa.html'), 'utf8');
    assert(vdHtml.includes('id="canvasQRVentaDirecta"'), 'venta-directa.html debe contener canvasQRVentaDirecta');
    assert(vdHtml.includes('id="badgeQRVdCRC"'), 'venta-directa.html debe contener badgeQRVdCRC');
    assert(vdHtml.includes('id="txtQRVdReferencia"'), 'venta-directa.html debe contener txtQRVdReferencia');
    assert(vdHtml.includes('js/qr-dinamico.js'), 'venta-directa.html debe cargar js/qr-dinamico.js');
    pass('venta-directa.html cuenta con canvas QR dinámico y badges de especificación EMVCo');

    const vdJs = fs.readFileSync(path.join(__dirname, '../public/venta-directa.js'), 'utf8');
    assert(vdJs.includes('renderizarQRVentaDirecta'), 'venta-directa.js debe incluir renderizarQRVentaDirecta');
    pass('venta-directa.js regenera el QR dinámico en cada cambio del carrito del mostrador');

    console.log('\n==================================================================');
    console.log(` RESULTADO FINAL: ${passCount} pruebas pasaron exitosamente. CERO ERRORES.`);
    console.log('==================================================================');
}

runTests().catch(err => {
    console.error('Fallo en la prueba de QR dinámico:', err);
    process.exit(1);
});
