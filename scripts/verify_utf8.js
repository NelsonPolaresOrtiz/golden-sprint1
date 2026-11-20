const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../public');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') || f.endsWith('.js'));

const mojibakeRegex = /(Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|Ã‘|Ã“|Ã‰|Ã|Â|â€|ï¿½)/;

let issues = 0;

for (const file of files) {
    const fullPath = path.join(dir, file);
    const buf = fs.readFileSync(fullPath);
    // Check BOM
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        console.warn(`[BOM DETECTED] ${file}`);
        // Strip BOM
        fs.writeFileSync(fullPath, buf.slice(3));
        console.log(`[BOM STRIPPED] ${file}`);
        issues++;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (mojibakeRegex.test(line)) {
            // Check if it's not a regex or benign character
            if (!line.includes('mojibakeRegex') && !line.includes('FALLBACK_IMG_OFFLINE')) {
                console.warn(`[MOJIBAKE] ${file}:${idx + 1} -> ${line.trim()}`);
                issues++;
            }
        }
    });
}

if (issues === 0) {
    console.log("All public HTML and JS files are 100% clean UTF-8 without BOM!");
} else {
    console.log(`Found and reported/fixed issues: ${issues}`);
}
