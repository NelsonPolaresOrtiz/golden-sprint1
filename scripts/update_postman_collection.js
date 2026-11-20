const fs = require('fs');
const path = require('path');

const colPath = path.join(__dirname, '../postman/GOLDEN_API_Collection.postman_collection.json');
const col = JSON.parse(fs.readFileSync(colPath, 'utf8'));

const folder = col.item.find(i => i.name.startsWith('03.'));
if (folder) {
    const exists = folder.item.some(r => r.name.includes('/api/ventas/directa'));
    if (!exists) {
        folder.item.push({
            name: "Registrar Venta Directa en Tienda (POST /api/ventas/directa)",
            event: [
                {
                    listen: "test",
                    script: {
                        exec: [
                            "pm.test(\"Status code es 201 Created\", function () {",
                            "    pm.response.to.have.status(201);",
                            "});",
                            "const jsonData = pm.response.json();",
                            "pm.test(\"Respuesta exitosa de venta directa\", function () {",
                            "    pm.expect(jsonData.ok).to.eql(true);",
                            "    pm.expect(jsonData.pedido_id).to.be.a('number');",
                            "});"
                        ],
                        type: "text/javascript"
                    }
                }
            ],
            request: {
                method: "POST",
                header: [
                    { "key": "Content-Type", "value": "application/json" },
                    { "key": "Authorization", "value": "Bearer {{token_admin}}" },
                    { "key": "x-usuario-rol", "value": "ADMIN" },
                    { "key": "x-usuario-email", "value": "{{admin_email}}" }
                ],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        cliente_nombre: "Consumidor Final",
                        nit_ci: "0",
                        cliente_email: "consumidor.final@golden.bo",
                        items: [
                            {
                                producto_id: 101,
                                cantidad: 1,
                                precio: 250.00
                            }
                        ],
                        metodo_pago: "EFECTIVO",
                        monto_recibido: 300.00,
                        cambio: 50.00
                    }, null, 2)
                },
                url: {
                    raw: "{{base_url}}/api/ventas/directa",
                    host: ["{{base_url}}"],
                    path: ["api", "ventas", "directa"]
                },
                description: "Registra una venta presencial directa en mostrador con descuento de stock inmediato y emisión de comprobante."
            }
        });

        fs.writeFileSync(colPath, JSON.stringify(col, null, 2), 'utf8');
        console.log("Postman collection updated with Venta Directa endpoint!");
    } else {
        console.log("Endpoint already present in Postman collection.");
    }
}
