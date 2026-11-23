const http = require('http');

function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });
        req.on('error', reject);
        if (data) {
            req.write(typeof data === 'string' ? data : JSON.stringify(data));
        }
        req.end();
    });
}

async function run() {
    console.log('--- INICIANDO VERIFICACIÓN DE CHECKOUT Y DESPACHO AUTÓNOMO ---');

    // 1. Obtener usuario de prueba (cliente)
    console.log('\n[1/5] Obteniendo lista de usuarios...');
    const resUsers = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/usuarios',
        method: 'GET'
    });
    if (resUsers.status !== 200 || !resUsers.body || resUsers.body.length === 0) {
        throw new Error('No se pudieron obtener usuarios: ' + JSON.stringify(resUsers));
    }
    const cliente = resUsers.body.find(u => u.rol === 'CLIENTE') || resUsers.body[0];
    console.log(`Cliente seleccionado: #${cliente.id} (${cliente.nombre})`);

    // 2. Actualizar perfil de entrega y contacto
    console.log('\n[2/5] Actualizando perfil de entrega con PUT /api/usuarios/:id/perfil...');
    const resPerfil = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/usuarios/${cliente.id}/perfil`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
    }, {
        nombre: 'Taller Mecánico El Tuerca (Marcos)',
        telefono: '75789456',
        direccion: 'Av. Jaime Mendoza #1420, Zona Huayrapata',
        nit: '1029384756'
    });
    console.log('Respuesta perfil:', resPerfil.status, resPerfil.body ? resPerfil.body.mensaje : resPerfil.raw);
    if (resPerfil.status !== 200 || !resPerfil.body.ok) {
        throw new Error('Fallo al actualizar perfil de usuario');
    }

    // 3. Obtener un producto con stock para el carrito
    const resProds = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/productos',
        method: 'GET'
    });
    const prod = resProds.body.find(p => p.stock > 2) || resProds.body[0];
    const totalCompra = parseFloat(prod.precio).toFixed(2);
    console.log(`\n[3/5] Creando pedido con entrega en Sucre por Bs. ${totalCompra} (Producto: ${prod.nombre})...`);

    const ref = 'ORD-' + Date.now().toString().slice(-6);
    const resPedido = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/pedidos',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        cliente_id: cliente.id,
        total: totalCompra,
        metodo_pago: 'QR_DIRECTO',
        comprobante_ref: ref,
        numero_operacion: ref,
        banco_origen: 'Yape / BCP Bolivia',
        estado_pago: 'PENDIENTE',
        direccion_entrega: 'Av. Jaime Mendoza #1420, Zona Huayrapata',
        telefono_contacto: '75789456',
        referencia_entrega: 'Portón azul frente a la llantería',
        nombre_destinatario: 'Taller Mecánico El Tuerca (Marcos)',
        carrito: [{
            id: prod.id,
            nombre: prod.nombre,
            precio: prod.precio,
            cantidad: 1
        }]
    });

    console.log('Respuesta pedido:', resPedido.status, resPedido.body);
    if (resPedido.status !== 201 || !resPedido.body.pedidoId) {
        throw new Error('Fallo al crear pedido con datos de entrega');
    }
    const pedidoId = resPedido.body.pedidoId;

    // 4. Verificar que GET /api/pedidos y GET /api/pedidos/:id contienen los datos de entrega
    console.log(`\n[4/5] Verificando detalle de orden #${pedidoId} para despacho y logística...`);
    const resDetalle = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/pedidos/${pedidoId}`,
        method: 'GET'
    });
    const pDet = resDetalle.body;
    console.log(`- Destinatario: ${pDet.nombre_destinatario || pDet.cliente}`);
    console.log(`- Teléfono contacto: ${pDet.telefono_contacto || pDet.cliente_telefono}`);
    console.log(`- Dirección entrega: ${pDet.direccion_entrega || pDet.cliente_direccion}`);
    console.log(`- Referencia entrega: ${pDet.referencia_entrega}`);

    if (!pDet.direccion_entrega || !pDet.telefono_contacto || !pDet.referencia_entrega) {
        throw new Error('Los campos de entrega no se persistieron correctamente en pedidos');
    }

    // 5. Simular Webhook de Yape Bolivia para conciliar automáticamente
    console.log(`\n[5/5] Simulando notificación de Yape por Bs. ${totalCompra} vía Webhook...`);
    const notifTexto = `Yape: Recibiste Bs. ${totalCompra} de MARCOS CONDORI por concepto de lubricantes.`;
    const resWebhook = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/pagos/webhook-qr',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': 'GOLDEN_WEBHOOK_2026_SECURE'
        }
    }, {
        texto_notificacion: notifTexto,
        app_origen: 'com.bcp.innovacxion.yapeapp'
    });

    console.log('Respuesta Webhook:', resWebhook.status, resWebhook.body);
    if (resWebhook.status !== 200 || !resWebhook.body.ok) {
        throw new Error('Webhook Yape no reconoció la notificación');
    }

    // 6. Verificar que el polling detecta la verificación
    const resEstado = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/pedidos/${pedidoId}/estado-pago`,
        method: 'GET'
    });
    console.log('Respuesta Polling estado-pago:', resEstado.status, resEstado.body);
    if (!resEstado.body.es_verificado) {
        throw new Error('El estado de pago no pasó a VERIFICADO');
    }

    console.log('\n======================================================');
    console.log('✅ TODAS LAS PRUEBAS DE CHECKOUT AUTÓNOMO Y ENTREGA PASARON EXITOSAMENTE');
    console.log('======================================================');
}

run().catch(err => {
    console.error('❌ Error en prueba:', err);
    process.exit(1);
});
