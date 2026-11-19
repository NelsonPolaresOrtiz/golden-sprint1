const http = require('http');

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
            });
        });
        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

let failures = 0;
let successes = 0;

function assert(condition, name, details) {
    if (condition) {
        successes++;
        console.log(`  [OK] ${name}`);
    } else {
        failures++;
        console.error(`  [FAIL] ${name} -> ${details || 'Assertion failed'}`);
    }
}

async function runRegressionSuite() {
    console.log('================================================================');
    console.log('  EJECUTANDO VERIFICACIÓN DE REGRESIÓN COMPLETA - GOLDEN ERP    ');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // PRUEBA 1: VERIFICAR QUE LOS ENDPOINTS GET CORE NO DEVUELVAN 500
    // -------------------------------------------------------------
    console.log('--- 1. VERIFICACIÓN DE ENDPOINTS GET CORE (NO 500) ---');
    const endpointsGet = [
        { path: '/api/productos', name: 'GET /api/productos' },
        { path: '/api/pedidos', name: 'GET /api/pedidos' },
        { path: '/api/usuarios', name: 'GET /api/usuarios' },
        { path: '/api/auditoria', name: 'GET /api/auditoria' },
        { path: '/api/whatsapp/estado', name: 'GET /api/whatsapp/estado' },
        { path: '/api/config-catalogo', name: 'GET /api/config-catalogo' },
        { path: '/api/config/banner', name: 'GET /api/config/banner' },
        { path: '/api/proveedores', name: 'GET /api/proveedores' },
        { path: '/api/compras/sugerencias', name: 'GET /api/compras/sugerencias' },
        { path: '/api/creditos', name: 'GET /api/creditos' }
    ];

    for (const ep of endpointsGet) {
        try {
            const res = await request({ hostname: 'localhost', port: 3000, path: ep.path, method: 'GET' });
            assert(res.status >= 200 && res.status < 500, `${ep.name} respondió con código ${res.status}`, `Esperado código < 500, recibido: ${res.status}`);
        } catch (err) {
            assert(false, ep.name, `Error de conexión: ${err.message}`);
        }
    }

    // -------------------------------------------------------------
    // PRUEBA 2: PERMISOS GRANULARES DE ESCRITURA EN PRODUCTOS
    // -------------------------------------------------------------
    console.log('\n--- 2. PERMISOS GRANULARES EN PRODUCTOS (ADMIN/EMPAQUE vs CLIENTE/DESPACHO) ---');

    // 2.1 POST con CLIENTE -> Esperado 403
    const postCliente = await request({
        hostname: 'localhost', port: 3000, path: '/api/productos', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-usuario-rol': 'CLIENTE', 'x-usuario-email': 'cliente@golden.bo' }
    }, { sku: 'TEST-SKU-CLIENTE', nombre: 'Test Cliente', categoria: 'Aceites', precio: 100, stock: 10 });
    assert(postCliente.status === 403, 'POST /api/productos con rol CLIENTE debe ser 403 Forbidden', `Recibido: ${postCliente.status}`);

    // 2.2 POST con DESPACHO -> Esperado 403
    const postDespacho = await request({
        hostname: 'localhost', port: 3000, path: '/api/productos', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-usuario-rol': 'DESPACHO', 'x-usuario-email': 'despacho@golden.bo' }
    }, { sku: 'TEST-SKU-DESPACHO', nombre: 'Test Despacho', categoria: 'Aceites', precio: 100, stock: 10 });
    assert(postDespacho.status === 403, 'POST /api/productos con rol DESPACHO debe ser 403 Forbidden', `Recibido: ${postDespacho.status}`);

    // 2.3 POST sin rol (Anónimo) -> Esperado 403
    const postAnon = await request({
        hostname: 'localhost', port: 3000, path: '/api/productos', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { sku: 'TEST-SKU-ANON', nombre: 'Test Anon', categoria: 'Aceites', precio: 100, stock: 10 });
    assert(postAnon.status === 403, 'POST /api/productos sin credenciales debe ser 403 Forbidden', `Recibido: ${postAnon.status}`);

    // 2.4 POST con EMPAQUE -> Esperado 201
    const testSkuEmpaque = 'REG-EMP-' + Date.now();
    const postEmpaque = await request({
        hostname: 'localhost', port: 3000, path: '/api/productos', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-usuario-rol': 'EMPAQUE', 'x-usuario-email': 'empaque@golden.bo' }
    }, { sku: testSkuEmpaque, nombre: 'Producto Creado por Almacén', categoria: 'Filtros de Aire', precio: 85, stock: 25 });
    assert(postEmpaque.status === 201, 'POST /api/productos con rol EMPAQUE debe ser 201 Created', `Recibido: ${postEmpaque.status}`);

    const idEmpaque = postEmpaque.data?.id;

    // 2.5 POST con ADMIN -> Esperado 201
    const testSkuAdmin = 'REG-ADM-' + Date.now();
    const postAdmin = await request({
        hostname: 'localhost', port: 3000, path: '/api/productos', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-usuario-rol': 'ADMIN', 'x-usuario-email': 'admin@golden.bo' }
    }, { sku: testSkuAdmin, nombre: 'Producto Creado por Gerencia', categoria: 'Lubricantes de Motor', precio: 120, stock: 50 });
    assert(postAdmin.status === 201, 'POST /api/productos con rol ADMIN debe ser 201 Created', `Recibido: ${postAdmin.status}`);

    const idAdmin = postAdmin.data?.id;

    // 2.6 PUT con CLIENTE sobre producto -> Esperado 403
    if (idEmpaque) {
        const putCliente = await request({
            hostname: 'localhost', port: 3000, path: '/api/productos/' + idEmpaque, method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-usuario-rol': 'CLIENTE', 'x-usuario-email': 'cliente@golden.bo' }
        }, { precio: 50 });
        assert(putCliente.status === 403, 'PUT /api/productos/:id con rol CLIENTE debe ser 403 Forbidden', `Recibido: ${putCliente.status}`);

        // 2.7 PUT con DESPACHO sobre producto -> Esperado 403
        const putDespacho = await request({
            hostname: 'localhost', port: 3000, path: '/api/productos/' + idEmpaque, method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-usuario-rol': 'DESPACHO', 'x-usuario-email': 'despacho@golden.bo' }
        }, { precio: 50 });
        assert(putDespacho.status === 403, 'PUT /api/productos/:id con rol DESPACHO debe ser 403 Forbidden', `Recibido: ${putDespacho.status}`);

        // 2.8 PUT con EMPAQUE sobre producto -> Esperado 200
        const putEmpaque = await request({
            hostname: 'localhost', port: 3000, path: '/api/productos/' + idEmpaque, method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-usuario-rol': 'EMPAQUE', 'x-usuario-email': 'empaque@golden.bo' }
        }, { precio: 95 });
        assert(putEmpaque.status === 200, 'PUT /api/productos/:id con rol EMPAQUE debe ser 200 OK', `Recibido: ${putEmpaque.status}`);

        // 2.9 DELETE con CLIENTE sobre producto -> Esperado 403
        const delCliente = await request({
            hostname: 'localhost', port: 3000, path: '/api/productos/' + idEmpaque, method: 'DELETE',
            headers: { 'x-usuario-rol': 'CLIENTE', 'x-usuario-email': 'cliente@golden.bo' }
        });
        assert(delCliente.status === 403, 'DELETE /api/productos/:id con rol CLIENTE debe ser 403 Forbidden', `Recibido: ${delCliente.status}`);

        // 2.10 DELETE con ADMIN sobre producto -> Esperado 200
        const delAdmin = await request({
            hostname: 'localhost', port: 3000, path: '/api/productos/' + idEmpaque, method: 'DELETE',
            headers: { 'x-usuario-rol': 'ADMIN', 'x-usuario-email': 'admin@golden.bo' }
        });
        assert(delAdmin.status === 200, 'DELETE /api/productos/:id con rol ADMIN debe ser 200 OK', `Recibido: ${delAdmin.status}`);
    }

    if (idAdmin) {
        // Limpiar producto de prueba creado por ADMIN
        await request({
            hostname: 'localhost', port: 3000, path: '/api/productos/' + idAdmin, method: 'DELETE',
            headers: { 'x-usuario-rol': 'ADMIN', 'x-usuario-email': 'admin@golden.bo' }
        });
    }

    // -------------------------------------------------------------
    // PRUEBA 3: BLOQUEO ESTRICTO DE CRUCES DE PORTAL EN LOGIN
    // -------------------------------------------------------------
    console.log('\n--- 3. VALIDACIÓN ESTRICTA DE PORTAL EN POST /api/login ---');

    // 3.1 Portal INTERNO con cuenta CLIENTE -> Esperado 403
    const loginInternoCliente = await request({
        hostname: 'localhost', port: 3000, path: '/api/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'cliente@golden.bo', password: 'cliente123', tipo_portal: 'INTERNO' });
    assert(loginInternoCliente.status === 403, 'Login en Portal INTERNO con cuenta CLIENTE debe ser 403 Forbidden', `Recibido: ${loginInternoCliente.status}`);

    // 3.2 Portal INTERNO con cuenta ADMIN -> Esperado 200
    const loginInternoAdmin = await request({
        hostname: 'localhost', port: 3000, path: '/api/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@golden.bo', password: 'admin123', tipo_portal: 'INTERNO' });
    assert(loginInternoAdmin.status === 200, 'Login en Portal INTERNO con cuenta ADMIN debe ser 200 OK', `Recibido: ${loginInternoAdmin.status}`);

    // 3.3 Portal INTERNO con cuenta EMPAQUE -> Esperado 200
    const loginInternoEmpaque = await request({
        hostname: 'localhost', port: 3000, path: '/api/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'empaque@golden.bo', password: 'empaque123', tipo_portal: 'INTERNO' });
    assert(loginInternoEmpaque.status === 200, 'Login en Portal INTERNO con cuenta EMPAQUE debe ser 200 OK', `Recibido: ${loginInternoEmpaque.status}`);

    // 3.4 Portal CLIENTE con cuenta ADMIN -> Esperado 403
    const loginClienteAdmin = await request({
        hostname: 'localhost', port: 3000, path: '/api/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@golden.bo', password: 'admin123', tipo_portal: 'CLIENTE' });
    assert(loginClienteAdmin.status === 403, 'Login en Portal CLIENTE con cuenta ADMIN debe ser 403 Forbidden', `Recibido: ${loginClienteAdmin.status}`);

    // 3.5 Portal CLIENTE con cuenta EMPAQUE -> Esperado 403
    const loginClienteEmpaque = await request({
        hostname: 'localhost', port: 3000, path: '/api/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'empaque@golden.bo', password: 'empaque123', tipo_portal: 'CLIENTE' });
    assert(loginClienteEmpaque.status === 403, 'Login en Portal CLIENTE con cuenta EMPAQUE debe ser 403 Forbidden', `Recibido: ${loginClienteEmpaque.status}`);

    // 3.6 Portal CLIENTE con cuenta CLIENTE -> Esperado 200
    const loginClienteCliente = await request({
        hostname: 'localhost', port: 3000, path: '/api/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'cliente@golden.bo', password: 'cliente123', tipo_portal: 'CLIENTE' });
    assert(loginClienteCliente.status === 200, 'Login en Portal CLIENTE con cuenta CLIENTE debe ser 200 OK', `Recibido: ${loginClienteCliente.status}`);

    // 3.7 Contraseña incorrecta -> Esperado 401
    const loginPassErr = await request({
        hostname: 'localhost', port: 3000, path: '/api/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@golden.bo', password: 'claveIncorrecta999', tipo_portal: 'INTERNO' });
    assert(loginPassErr.status === 401, 'Login con contraseña errónea debe ser 401 Unauthorized', `Recibido: ${loginPassErr.status}`);

    // -------------------------------------------------------------
    // PRUEBA 4: PROTECCIÓN DE RUTAS DE HERO BANNER
    // -------------------------------------------------------------
    console.log('\n--- 4. PERMISOS EN HERO BANNER (PUT /api/config-catalogo & PUT /api/config/banner) ---');

    const putBannerCliente = await request({
        hostname: 'localhost', port: 3000, path: '/api/config/banner', method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-usuario-rol': 'CLIENTE', 'x-usuario-email': 'cliente@golden.bo' }
    }, { hero_titulo: 'Hack Banner' });
    assert(putBannerCliente.status === 403, 'PUT /api/config/banner con CLIENTE debe ser 403 Forbidden', `Recibido: ${putBannerCliente.status}`);

    const putBannerAdmin = await request({
        hostname: 'localhost', port: 3000, path: '/api/config/banner', method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-usuario-rol': 'ADMIN', 'x-usuario-email': 'admin@golden.bo' }
    }, { hero_badge: 'Distribuidor Mayorista Certificado' });
    assert(putBannerAdmin.status === 200, 'PUT /api/config/banner con ADMIN debe ser 200 OK', `Recibido: ${putBannerAdmin.status}`);

    // -------------------------------------------------------------
    // PRUEBA 5: SERVICIO DE COTIZACIONES Y PROFORMAS (POST /api/cotizaciones)
    // -------------------------------------------------------------
    console.log('\n--- 5. SOLICITUD DE COTIZACIONES MAYORISTAS (POST /api/cotizaciones) ---');

    const cotVacia = await request({
        hostname: 'localhost', port: 3000, path: '/api/cotizaciones', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { cliente: { nombre: 'Taller Sucre' }, items: [] });
    assert(cotVacia.status === 400, 'POST /api/cotizaciones con items vacíos debe ser 400 Bad Request', `Recibido: ${cotVacia.status}`);

    const cotValida = await request({
        hostname: 'localhost', port: 3000, path: '/api/cotizaciones', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        cliente: {
            nombre: 'Taller San Cristóbal',
            email: 'polaresn7@gmail.com',
            telefono: '+591 67375645',
            ciudad: 'Sucre, Bolivia'
        },
        items: [
            { sku: 'LUB-SYN-5W30', nombre: 'Aceite Sintético 5W-30', cantidad: 3, precio: 250, subtotal: 750 }
        ],
        total: 750
    });
    assert(cotValida.status === 200 && cotValida.data && cotValida.data.ok === true && typeof cotValida.data.codigo === 'string', 'POST /api/cotizaciones válido debe responder 200 con código COT-XXXX', `Recibido: ${cotValida.status}`);

    // -------------------------------------------------------------
    // RESUMEN FINAL
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`  RESUMEN FINAL: ${successes} pruebas exitosas, ${failures} fallos.`);
    console.log('================================================================\n');

    if (failures > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runRegressionSuite().catch(err => {
    console.error('Error no controlado en suite de pruebas:', err);
    process.exit(1);
});
