const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

const YAPE_QR_PAYLOAD = 'H7GXJFTPPG6jGWbWg6p3PS9e4VEdikOpCEKTIbP8s4Nc+LR4a97Gz83PS+VZaeiX0xz5p2zrv95w6TmyajXzBSD9cFEHv/xuXv8+x+CWApnguV30yJJZP85Gy2e/S/WRbFKhcL28FAGUEJSDRT/TFSolXlsQhcL1ZeEbP5ogKATxGUJqbXlVSua4D+gQgBb/mnOA9XOtRO1esQLJLDzXOYStC/dp4fPPMJ6wGZjFyMB/NDJ/nfX6vm204FPeQe65Aaz32yskfmsPEJYyeXHNqp/InN+5w0+ccweopGRHsf5oyUZqOFnLJQn5jkqHTU1t1N8/XkQjuCD+d0jr+Xd1SQ==|09916E9C26A9918634083E03359A7443';

async function generateVectorAndHD() {
    console.log("Generating SVG...");
    let svg = await QRCode.toString(YAPE_QR_PAYLOAD, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 2,
        color: {
            dark: '#581c87', // Brand Purple Yape
            light: '#ffffff'
        }
    });

    // Extract viewBox to calculate center and scale
    // e.g. viewBox="0 0 101 101"
    const match = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const boxSize = match ? parseInt(match[1], 10) : 101;
    const center = boxSize / 2;
    const badgeR = boxSize * 0.082; // ~8.3 units

    const centralBadge = `
    <!-- Central Badge Oficial Yape Bolivia -->
    <g id="badge-central" transform="translate(0, 0)">
        <circle cx="${center}" cy="${center}" r="${badgeR}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.8" />
        <circle cx="${center}" cy="${center}" r="${badgeR * 0.88}" fill="#ffffff" />
        <text x="${center}" y="${center + badgeR * 0.35}" font-family="system-ui, -apple-system, 'Inter', sans-serif" font-size="${badgeR * 0.95}" font-weight="900" fill="#581c87" text-anchor="middle">Bs.</text>
    </g>
    `;
    svg = svg.replace('</svg>', `${centralBadge}</svg>`);

    const svgPath = path.join(__dirname, '../public/img/qr-yape-vectorial.svg');
    fs.writeFileSync(svgPath, svg, 'utf8');
    console.log(`Saved SVG to ${svgPath}`);

    // Generate high-resolution PNG (800x800)
    console.log("Generating 800x800 HD PNG...");
    const dataUrl = await QRCode.toDataURL(YAPE_QR_PAYLOAD, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 800,
        color: {
            dark: '#581c87',
            light: '#ffffff'
        }
    });

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const img = await Jimp.read(Buffer.from(base64Data, 'base64'));
    const width = img.bitmap.width;
    const height = img.bitmap.height;
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const radius = Math.floor(width * 0.082); // 65px radius

    for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            if (dist <= radius) {
                const idx = (y * width + x) * 4;
                if (dist >= radius - 3) {
                    img.bitmap.data[idx] = 226;     // #E2E8F0
                    img.bitmap.data[idx + 1] = 232;
                    img.bitmap.data[idx + 2] = 240;
                } else {
                    img.bitmap.data[idx] = 255;     // White
                    img.bitmap.data[idx + 1] = 255;
                    img.bitmap.data[idx + 2] = 255;
                }
                img.bitmap.data[idx + 3] = 255;
            }
        }
    }

    // Verify scan
    const code = jsQR(new Uint8ClampedArray(img.bitmap.data), width, height);
    console.log("HD PNG Scans correctly:", !!code, code ? code.data === YAPE_QR_PAYLOAD : false);

    const hdPngPath = path.join(__dirname, '../public/img/qr-yape-hd.png');
    const buffer = await img.getBuffer('image/png');
    fs.writeFileSync(hdPngPath, buffer);
    console.log(`Saved HD PNG to ${hdPngPath}`);
}

generateVectorAndHD();
