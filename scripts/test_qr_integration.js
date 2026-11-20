const fs = require('fs');
const assert = require('assert');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

async function testIntegration() {
    console.log("1. Verificando tienda.html...");
    const html = fs.readFileSync('public/tienda.html', 'utf8');
    assert(html.includes('id="checkoutQRMontoDestacado"'), 'Falta checkoutQRMontoDestacado');
    assert(html.includes('id="checkoutCodigoQR"'), 'Falta checkoutCodigoQR');
    assert(html.includes('id="canvasQROficial"'), 'Falta canvasQROficial');
    assert(html.includes('id="imgQROficial"'), 'Falta imgQROficial');
    assert(html.includes('Nelson Polares Ortiz'), 'Falta titular');
    assert(html.includes('19 dic. 2026'), 'Falta vigencia');
    assert(html.includes('download="QR_Pago_GOLDEN_Lubricantes.png"'), 'Falta download filename');
    assert(html.includes('Pago con QR Simple / Yape Bolivia (Bs.)'), 'Falta encabezado de pago');
    console.log("   -> HTML verificado con éxito.");

    console.log("2. Verificando tienda.js...");
    const js = fs.readFileSync('public/tienda.js', 'utf8');
    assert(js.includes('YAPE_QR_PAYLOAD'), 'Falta YAPE_QR_PAYLOAD');
    assert(js.includes('renderizarQROficialYape'), 'Falta renderizarQROficialYape');
    assert(js.includes('descargarQROficial'), 'Falta descargarQROficial');
    assert(js.includes('QR_Pago_GOLDEN_Lubricantes.png'), 'Falta nombre archivo descarga');
    console.log("   -> JS verificado con éxito.");

    console.log("3. Verificando Endpoints API Backend...");
    const resInfo = await fetch('http://localhost:3000/api/pagos/qr-yape/info');
    assert(resInfo.ok, 'Error en /api/pagos/qr-yape/info');
    const dataInfo = await resInfo.json();
    assert(dataInfo.titular === 'Nelson Polares Ortiz', 'Titular incorrecto en API');
    assert(dataInfo.vigencia === '2026-12-19', 'Vigencia incorrecta en API');
    console.log("   -> API Info verificada con éxito.");

    console.log("4. Verificando decodificación del QR generado en alta resolución...");
    const imgPath = 'public/img/qr-yape-hd.png';
    const image = await Jimp.read(imgPath);
    const code = jsQR(new Uint8ClampedArray(image.bitmap.data), image.bitmap.width, image.bitmap.height);
    assert(code, 'No se pudo decodificar el código QR de qr-yape-hd.png');
    assert(code.data === dataInfo.payload, 'El payload decodificado no coincide con el oficial de Yape');
    console.log("   -> Decodificación exitosa con payload EMVCo 100% verificado.");

    console.log("\n=======================================================");
    console.log(" TODAS LAS INTEGRACIONES DEL QR VECTORIAL SON EXITOSAS ");
    console.log("=======================================================");
}

testIntegration().catch(err => {
    console.error("Fallo en la prueba de integración:", err);
    process.exit(1);
});
