const QRCode = require('qrcode');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

const YAPE_QR_PAYLOAD = 'H7GXJFTPPG6jGWbWg6p3PS9e4VEdikOpCEKTIbP8s4Nc+LR4a97Gz83PS+VZaeiX0xz5p2zrv95w6TmyajXzBSD9cFEHv/xuXv8+x+CWApnguV30yJJZP85Gy2e/S/WRbFKhcL28FAGUEJSDRT/TFSolXlsQhcL1ZeEbP5ogKATxGUJqbXlVSua4D+gQgBb/mnOA9XOtRO1esQLJLDzXOYStC/dp4fPPMJ6wGZjFyMB/NDJ/nfX6vm204FPeQe65Aaz32yskfmsPEJYyeXHNqp/InN+5w0+ccweopGRHsf5oyUZqOFnLJQn5jkqHTU1t1N8/XkQjuCD+d0jr+Xd1SQ==|09916E9C26A9918634083E03359A7443';

async function testSVGWithBadge() {
    let svg = await QRCode.toString(YAPE_QR_PAYLOAD, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 2,
        color: {
            dark: '#581c87',
            light: '#ffffff'
        }
    });

    // Inject central badge before </svg>
    const badge = `
    <circle cx="50.5" cy="50.5" r="9.5" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.7"/>
    <text x="50.5" y="53.5" font-family="Arial, sans-serif" font-size="6" font-weight="bold" fill="#581c87" text-anchor="middle">Bs.</text>
    `;
    svg = svg.replace('</svg>', `${badge}</svg>`);

    // Let's also test canvas drawing via QRCode.toCanvas or drawing on client side
    console.log('Badge injected successfully, SVG length:', svg.length);
}

testSVGWithBadge();
