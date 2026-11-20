const QRCode = require('qrcode');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

const YAPE_QR_PAYLOAD = 'H7GXJFTPPG6jGWbWg6p3PS9e4VEdikOpCEKTIbP8s4Nc+LR4a97Gz83PS+VZaeiX0xz5p2zrv95w6TmyajXzBSD9cFEHv/xuXv8+x+CWApnguV30yJJZP85Gy2e/S/WRbFKhcL28FAGUEJSDRT/TFSolXlsQhcL1ZeEbP5ogKATxGUJqbXlVSua4D+gQgBb/mnOA9XOtRO1esQLJLDzXOYStC/dp4fPPMJ6wGZjFyMB/NDJ/nfX6vm204FPeQe65Aaz32yskfmsPEJYyeXHNqp/InN+5w0+ccweopGRHsf5oyUZqOFnLJQn5jkqHTU1t1N8/XkQjuCD+d0jr+Xd1SQ==|09916E9C26A9918634083E03359A7443';

async function testGeneration() {
    // Generate high-res DataURL
    const dataUrl = await QRCode.toDataURL(YAPE_QR_PAYLOAD, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 500,
        color: {
            dark: '#6b21a8', // Rich violet Yape color or #141619
            light: '#ffffff'
        }
    });

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const image = await Jimp.read(buffer);

    // Let's decode without badge
    const code1 = jsQR(new Uint8ClampedArray(image.bitmap.data), image.bitmap.width, image.bitmap.height);
    console.log('Test without badge:', !!code1);

    // Now let's draw a white circle badge in the center with radius 40 (approx 16% of width)
    const centerX = Math.floor(image.bitmap.width / 2);
    const centerY = Math.floor(image.bitmap.height / 2);
    const radius = 40;

    for (let y = centerY - radius; y <= centerY + radius; y++) {
        for (let x = centerX - radius; x <= centerX + radius; x++) {
            const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            if (dist <= radius) {
                const idx = (y * image.bitmap.width + x) * 4;
                image.bitmap.data[idx] = 255;     // R
                image.bitmap.data[idx + 1] = 255; // G
                image.bitmap.data[idx + 2] = 255; // B
                image.bitmap.data[idx + 3] = 255; // A
            }
        }
    }

    const code2 = jsQR(new Uint8ClampedArray(image.bitmap.data), image.bitmap.width, image.bitmap.height);
    console.log('Test with badge:', !!code2, code2 ? 'Payload matches: ' + (code2.data === YAPE_QR_PAYLOAD) : 'failed');
}

testGeneration();
