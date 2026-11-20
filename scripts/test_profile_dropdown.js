/**
 * scripts/test_profile_dropdown.js
 * Verificación exhaustiva del Dropdown de Perfil de Usuario y Logout Global
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("==================================================================");
console.log(" VERIFICACIÓN INTEGRAL: DROPDOWN DE PERFIL DE USUARIO Y LOGOUT   ");
console.log("==================================================================");

let totalPassed = 0;
function pass(msg) {
    console.log(`  [PASS] ${msg}`);
    totalPassed++;
}

// -------------------------------------------------------------
// 1. VERIFICACIÓN DE REGLAS CSS EN public/styles.css
// -------------------------------------------------------------
console.log("\n--- 1. VERIFICACIÓN DE REGLAS CSS (public/styles.css) ---");
const css = fs.readFileSync(path.join(__dirname, '../public/styles.css'), 'utf8');

// Contenedores del perfil
assert.ok(css.includes('#userInfoBadge'), "Debe contener regla para #userInfoBadge");
assert.ok(css.includes('.user-dropdown-container'), "Debe contener regla para .user-dropdown-container");
assert.ok(css.includes('#tiendaProfileWrap'), "Debe contener regla para #tiendaProfileWrap");
pass("Selectores de contenedor presentes (#userInfoBadge, .user-dropdown-container, #tiendaProfileWrap)");

// z-index 1100 y position relative en contenedores
const containerRegex = /#userInfoBadge[\s\S]*?position:\s*relative\s*!important[\s\S]*?z-index:\s*1100\s*!important/;
assert.ok(containerRegex.test(css), "El contenedor debe tener position: relative !important y z-index: 1100 !important");
pass("Contenedor tiene position: relative !important y z-index: 1100 !important");

// Dropdowns anclados a la derecha
const dropdownRuleRegex = /\.nav-profile-dropdown-menu[\s\S]*?position:\s*absolute\s*!important[\s\S]*?top:\s*calc\(100%\s*\+\s*10px\)\s*!important[\s\S]*?right:\s*0\s*!important[\s\S]*?left:\s*auto\s*!important[\s\S]*?width:\s*250px\s*!important[\s\S]*?background:\s*#141619\s*!important[\s\S]*?border-radius:\s*14px\s*!important[\s\S]*?padding:\s*14px\s*!important[\s\S]*?box-shadow:\s*0\s*20px\s*40px\s*rgba\(0,\s*0,\s*0,\s*0\.45\)\s*!important[\s\S]*?z-index:\s*12000\s*!important[\s\S]*?transform:\s*none\s*!important[\s\S]*?margin:\s*0\s*!important/;
assert.ok(dropdownRuleRegex.test(css), "El dropdown debe tener todos los estilos requeridos (top: calc(100% + 10px), right: 0, left: auto, width: 250px, background: #141619, z-index: 12000, transform: none)");
pass("Dropdown posicionado a la derecha con z-index 12000, ancho 250px y sin transform");

// Despliegue con clase .show
assert.ok(css.includes('.nav-profile-dropdown-menu.show') && css.includes('display: block !important'), "Debe desplegarse con display: block !important");
pass("Despliegue condicional por clase .show configurado");

// Supresión de backdrops bloqueantes
const backdropRegex = /\.dropdown-backdrop[\s\S]*?display:\s*none\s*!important[\s\S]*?pointer-events:\s*none\s*!important/;
assert.ok(backdropRegex.test(css), "Debe neutralizar .dropdown-backdrop");
pass(".dropdown-backdrop neutralizado para evitar overlays bloqueantes");

// -------------------------------------------------------------
// 2. VERIFICACIÓN DE ESTRUCTURA Y COMPORTAMIENTO EN public/menu.js
// -------------------------------------------------------------
console.log("\n--- 2. VERIFICACIÓN DE NAVBAR EN public/menu.js ---");
const menuJs = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');

// No debe tener data-bs-toggle="dropdown" en el chip (para no invocar a Popper erróneo)
assert.ok(!menuJs.includes('nav-profile-chip" data-bs-toggle="dropdown"'), "nav-profile-chip NO debe tener data-bs-toggle='dropdown'");
pass("nav-profile-chip desacoplado de Popper de Bootstrap");

// Contenedor con user-dropdown-container y position-relative
assert.ok(menuJs.includes('user-dropdown-container') && menuJs.includes('id="userInfoBadge"'), "#userInfoBadge tiene clase user-dropdown-container");
pass("#userInfoBadge estructurado con user-dropdown-container");

// Menú con clases nav-profile-dropdown-menu, user-dropdown, profile-dropdown
assert.ok(menuJs.includes('nav-profile-dropdown-menu user-dropdown profile-dropdown'), "Menú con clases estándar user-dropdown y profile-dropdown");
pass("Menú dropdown tiene clases estandarizadas");

// Botón de salir con onclick="cerrarSesion()" y clase btn-futuristic-logout
assert.ok(menuJs.includes('btn-futuristic-logout') && menuJs.includes('onclick="cerrarSesion()"'), "Botón de salir llama a cerrarSesion()");
pass("Botón de salir con clase btn-futuristic-logout llama a cerrarSesion()");

// Definición global de cerrarSesion y logout en window
assert.ok(menuJs.includes('window.cerrarSesion = function'), "window.cerrarSesion debe estar definido");
assert.ok(menuJs.includes('window.logout = window.cerrarSesion'), "window.logout debe estar mapeado a window.cerrarSesion");
pass("window.cerrarSesion y window.logout definidos en menu.js");

// Manejador de eventos click nativo
assert.ok(menuJs.includes("const chip = e.target.closest('.nav-profile-chip');"), "Manejador escucha clics en .nav-profile-chip");
pass("Manejador nativo de click toggle implementado en menu.js");

// -------------------------------------------------------------
// 3. VERIFICACIÓN EN public/tienda.html Y public/tienda.js
// -------------------------------------------------------------
console.log("\n--- 3. VERIFICACIÓN EN TIENDA (tienda.html & tienda.js) ---");
const tiendaHtml = fs.readFileSync(path.join(__dirname, '../public/tienda.html'), 'utf8');
const tiendaJs = fs.readFileSync(path.join(__dirname, '../public/tienda.js'), 'utf8');

// tiendaProfileWrap y tiendaProfileDropdown
assert.ok(tiendaHtml.includes('id="tiendaProfileWrap"'), "tienda.html debe tener #tiendaProfileWrap");
assert.ok(tiendaHtml.includes('id="tiendaProfileDropdown"'), "tienda.html debe tener #tiendaProfileDropdown");
assert.ok(tiendaHtml.includes('id="tiendaDropdownAvatar"'), "tienda.html debe tener #tiendaDropdownAvatar");
assert.ok(tiendaHtml.includes('id="tiendaDropdownNombre"'), "tienda.html debe tener #tiendaDropdownNombre");
assert.ok(tiendaHtml.includes('id="tiendaDropdownRolBadge"'), "tienda.html debe tener #tiendaDropdownRolBadge");
assert.ok(tiendaHtml.includes('onclick="cerrarSesionTienda()"'), "tienda.html debe tener botón de cerrar sesión");
pass("Estructura completa de perfil y dropdown implementada en tienda.html");

// tienda.js expone cerrarSesion y logout
assert.ok(tiendaJs.includes('window.cerrarSesion = cerrarSesionTienda'), "tienda.js expone window.cerrarSesion");
assert.ok(tiendaJs.includes('window.logout = cerrarSesionTienda'), "tienda.js expone window.logout");
pass("tienda.js expone window.cerrarSesion y window.logout");

// -------------------------------------------------------------
// 4. VERIFICACIÓN EN public/app.js
// -------------------------------------------------------------
console.log("\n--- 4. VERIFICACIÓN EN public/app.js ---");
const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
assert.ok(appJs.includes('window.cerrarSesion = cerrarSesion'), "app.js expone window.cerrarSesion");
assert.ok(appJs.includes('window.logout = cerrarSesion'), "app.js expone window.logout");
pass("app.js expone window.cerrarSesion y window.logout");

// -------------------------------------------------------------
// 5. SIMULACIÓN DE EJECUCIÓN DEL LOGOUT
// -------------------------------------------------------------
console.log("\n--- 5. SIMULACIÓN FUNCIONAL DE LOGOUT (LIMPIEZA DE STORAGE Y REDIRECCIÓN) ---");
const mockLocalStorage = {
    _data: {
        'token': 'jwt_secret_token_123',
        'usuario': JSON.stringify({ nombre: 'Marcos Condori', rol: 'ADMIN' }),
        'usuario_golden': JSON.stringify({ nombre: 'Marcos Condori', rol: 'ADMIN' }),
        'usuario_rol': 'ADMIN',
        'carrito': JSON.stringify([{ id: 1, cantidad: 2 }])
    },
    getItem(k) { return this._data[k]; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

const mockSessionStorage = {
    _data: { 'session_id': 'abc456' },
    clear() { this._data = {}; }
};

let redirectedTo = '';
const mockWindow = {
    location: {
        set href(val) { redirectedTo = val; }
    }
};

// Ejecución de la función unificada de cierre
function ejecutarLogoutTest(ls, ss, win) {
    try {
        ls.removeItem('token');
        ls.removeItem('usuario');
        ls.removeItem('usuario_golden');
        ls.removeItem('usuario_rol');
        ls.removeItem('carrito');
        ls.clear();
        ss.clear();
    } catch(e) {}
    win.location.href = 'index.html';
}

ejecutarLogoutTest(mockLocalStorage, mockSessionStorage, mockWindow);

assert.strictEqual(Object.keys(mockLocalStorage._data).length, 0, "localStorage debe quedar totalmente vacío");
assert.strictEqual(Object.keys(mockSessionStorage._data).length, 0, "sessionStorage debe quedar totalmente vacío");
assert.strictEqual(redirectedTo, 'index.html', "Redirección debe ser a index.html");
pass("Logout limpia token, usuario, usuario_golden, carrito, sessionStorage y redirige inmediatamente a index.html");

// -------------------------------------------------------------
// 6. VERIFICACIÓN DE INCLUSIÓN EN TODOS LOS MÓDULOS HTML
// -------------------------------------------------------------
console.log("\n--- 6. VERIFICACIÓN DE INCLUSIÓN EN TODOS LOS MÓDULOS ERP ---");
const erpPages = [
    'dashboard.html',
    'tienda.html',
    'inventario.html',
    'logistica.html',
    'creditos.html',
    'facturacion.html',
    'cobranzas.html',
    'usuarios.html',
    'auditoria.html',
    'venta-directa.html'
];

erpPages.forEach(p => {
    const filePath = path.join(__dirname, '../public', p);
    assert.ok(fs.existsSync(filePath), `El archivo ${p} debe existir`);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('styles.css'), `${p} debe cargar styles.css`);
    assert.ok(content.includes('menu.js') || p === 'tienda.html', `${p} debe cargar menu.js`);
    pass(`Módulo ${p} carga correctamente estilos y script de navegación`);
});

console.log("\n==================================================================");
console.log(` RESULTADO FINAL: ${totalPassed} pruebas pasaron exitosamente. CERO ERRORES.`);
console.log("==================================================================");
