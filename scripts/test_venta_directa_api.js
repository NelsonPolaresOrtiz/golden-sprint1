const assert = require('assert');

async function testVentaDirectaAPI() {
    console.log("1. Probando bloqueo de acceso sin credenciales...");
    const resNoAuth = await fetch('http://localhost:3000/api/ventas/directa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ producto_id: 1, cantidad: 1, precio: 100 }] })
    });
    assert.strictEqual(resNoAuth.status, 403, `Esperaba 403 sin credenciales, obtuve ${resNoAuth.status}`);
    console.log("   -> OK: 403 Forbidden recibido sin credenciales.");

    console.log("2. Probando bloqueo con rol CLIENTE...");
    const resCliente = await fetch('http://localhost:3000/api/ventas/directa', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-usuario-rol': 'CLIENTE',
            'x-usuario-email': 'cliente@golden.bo'
        },
        body: JSON.stringify({ items: [{ producto_id: 1, cantidad: 1, precio: 100 }] })
    });
    assert.strictEqual(resCliente.status, 403, `Esperaba 403 para CLIENTE, obtuve ${resCliente.status}`);
    console.log("   -> OK: 403 Forbidden recibido para rol CLIENTE.");

    console.log("3. Obteniendo productos para probar venta con ADMIN...");
    const resProds = await fetch('http://localhost:3000/api/productos');
    const prods = await resProds.json();
    const prodDisponible = prods.find(p => p.stock > 2);
    assert(prodDisponible, "No se encontró producto con stock > 2");

    const stockInicial = prodDisponible.stock;
    console.log(`   -> Producto seleccionado: ${prodDisponible.nombre} (ID: ${prodDisponible.id}), Stock inicial: ${stockInicial}`);

    console.log("4. Registrando Venta Directa en efectivo...");
    const ventaPayload = {
        cliente_nombre: "Mecánica El Chispas",
        nit_ci: "409281014",
        cliente_email: "test.venta.directa@golden.bo",
        items: [
            {
                producto_id: prodDisponible.id,
                cantidad: 2,
                precio: prodDisponible.precio
            }
        ],
        metodo_pago: "EFECTIVO",
        monto_recibido: prodDisponible.precio * 2 + 50,
        cambio: 50
    };

    const resVenta = await fetch('http://localhost:3000/api/ventas/directa', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-usuario-rol': 'ADMIN',
            'x-usuario-email': 'admin@golden.bo'
        },
        body: JSON.stringify(ventaPayload)
    });

    const dataVenta = await resVenta.json();
    assert.strictEqual(resVenta.status, 201, `Error en venta: ${JSON.stringify(dataVenta)}`);
    assert(dataVenta.ok, "dataVenta.ok no es true");
    assert(dataVenta.pedido_id, "No devolvió pedido_id");
    console.log(`   -> OK: Venta #${dataVenta.pedido_id} registrada con éxito. Total: Bs. ${dataVenta.total}, Cambio: Bs. ${dataVenta.cambio}`);

    console.log("5. Verificando descuento inmediato de stock...");
    const resProdsDespues = await fetch('http://localhost:3000/api/productos');
    const prodsDespues = await resProdsDespues.json();
    const prodDespues = prodsDespues.find(p => p.id === prodDisponible.id);
    assert.strictEqual(prodDespues.stock, stockInicial - 2, `El stock no se descontó correctamente: era ${stockInicial}, ahora es ${prodDespues.stock}`);
    console.log(`   -> OK: Stock descontado correctamente de ${stockInicial} a ${prodDespues.stock}.`);

    console.log("6. Verificando datos del pedido en GET /api/pedidos/:id...");
    const resPed = await fetch(`http://localhost:3000/api/pedidos/${dataVenta.pedido_id}`);
    const pedido = await resPed.json();
    assert.strictEqual(pedido.canal, 'VENTA_DIRECTA', 'Canal no es VENTA_DIRECTA');
    assert.strictEqual(pedido.estado_pago, 'VERIFICADO', 'Estado pago no es VERIFICADO');
    assert.strictEqual(pedido.estado_logistica, 'ENTREGADO_TIENDA', 'Estado logística no es ENTREGADO_TIENDA');
    assert.strictEqual(pedido.cliente, 'Mecánica El Chispas', 'Nombre de cliente no coincide');
    console.log("   -> OK: Pedido verificado con canal VENTA_DIRECTA, VERIFICADO y ENTREGADO_TIENDA.");

    console.log("\n=======================================================");
    console.log(" TODAS LAS PRUEBAS DE VENTA DIRECTA PASARON CON ÉXITO! ");
    console.log("=======================================================");
}

testVentaDirectaAPI().catch(err => {
    console.error("Error en prueba de venta directa:", err);
    process.exit(1);
});
