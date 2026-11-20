const QRCode = require('qrcode');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

const YAPE_QR_PAYLOAD = 'H7GXJFTPPG6jGWbWg6p3PS9e4VEdikOpCEKTIbP8s4Nc+LR4a97Gz83PS+VZaeiX0xz5p2zrv95w6TmyajXzBSD9cFEHv/xuXv8+x+CWApnguV30yJJZP85Gy2e/S/WRbFKhcL28FAGUEJSDRT/TFSolXlsQhcL1ZeEbP5ogKATxGUJqbXlVSua4D+gQgBb/mnOA9XOtRO1esQLJLDzXOYStC/dp4fPPMJ6wGZjFyMB/NDJ/nfX6vm204FPeQe65Aaz32yskfmsPEJYyeXHNqp/InN+5w0+ccweopGRHsf5oyUZqOFnLJQn5jkqHTU1t1N8/XkQjuCD+d0jr+Xd1SQ==|09916E9C26A9918634083E03359A7443';

async function testCanvasSimulation() {
    // We can generate a 600x600 high-res QR DataURL with errorCorrectionLevel: 'H'
    const dataUrl = await QRCode.toDataURL(YAPE_QR_PAYLOAD, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 600,
        color: {
            dark: '#581c87', // Rich Yape purple
            light: '#ffffff'
        }
    });

    // Load into Jimp to simulate drawing the central badge and verify scan
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const img = await Jimp.read(Buffer.from(base64Data, 'base64'));

    const width = img.bitmap.width;
    const height = img.bitmap.height;
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const radius = Math.floor(width * 0.08); // 48px radius

    // Draw white circle with border
    for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            if (dist <= radius) {
                const idx = (y * width + x) * 4;
                if (dist >= radius - 2) {
                    // Border #E2E8F0 (226, 232, 240)
                    img.bitmap.data[idx] = 200;
                    img.bitmap.data[idx + 1] = 200;
                    img.bitmap.data[idx + 2] = 200;
                } else {
                    // White fill
                    img.bitmap.data[idx] = 255;
                    img.bitmap.data[idx + 1] = 255;
                    img.bitmap.data[idx + 2] = 255;
                }
                img.bitmap.data[idx + 3] = 255;
            }
        }
    }

    const code = jsQR(new Uint8ClampedArray(img.bitmap.data), width, height);
    console.log("Decoded successfully?", !!code);
    if (code) {
        console.log("Decoded text matches:", code.data === YAPE_QR_PAYLOAD);
        console.log("Length:", code.data.length);
    }
}

testCanvasSimulation();
