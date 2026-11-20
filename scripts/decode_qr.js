const { Jimp } = require('jimp');
const jsQR = require('jsqr');
const path = require('path');

async function decodeQR(filePath) {
    try {
        console.log(`Reading: ${filePath}`);
        const image = await Jimp.read(filePath);
        const { width, height, data } = image.bitmap;
        // data is a Uint8Array / Buffer of RGBA values
        const code = jsQR(new Uint8ClampedArray(data), width, height);
        if (code) {
            console.log("=== DECODED QR PAYLOAD ===");
            console.log(code.data);
            console.log("==========================");
            return code.data;
        } else {
            console.log("jsQR could not find QR code directly, trying resize/contrast...");
            // Let's try greyscale/contrast if needed
            return null;
        }
    } catch (err) {
        console.error("Error reading QR:", err);
        return null;
    }
}

decodeQR(path.join(__dirname, '../public/img/qr-yape-golden.png'));
