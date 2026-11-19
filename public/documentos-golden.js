/**
 * ============================================================================
 * ERP & E-COMMERCE GOLDEN - SISTEMA CENTRALIZADO DE DOCUMENTOS Y EXPORTABLES
 * Arquitectura Editorial Industrial para Facturas, Notas de Entrega,
 * Comprobantes de Pago (QR/PayPal), Reportes PDF, Excel (.xlsx) y CSV.
 * Conforme a estándares SIN Bolivia, Ley 843 y Microsoft Excel (UTF-8 BOM).
 * ============================================================================
 */

(function (window, document) {
    'use strict';

    // 1. DATOS FISCALES Y CORPORATIVOS OFICIALES (SUCRE, BOLIVIA)
    const EMPRESA = {
        razonSocial: 'DISTRIBUIDORA GOLDEN S.R.L.',
        denominacion: 'GOLDEN LUBRICANTES & FILTROS',
        subtitulo: 'Importación y Venta Mayorista de Lubricantes, Filtros y Fluidos Automotrices',
        nit: '1029384756',
        nroAutorizacion: '4901002341889',
        casaMatriz: 'Av. Jaime Mendoza #1420 (Almacén Central)',
        ciudad: 'Sucre, Bolivia',
        telefonos: '(+591) 4 64-52890 • (+591) 780-12345',
        correo: 'ventas@goldenlubricantes.bo',
        web: 'www.goldenlubricantes.bo',
        tipoCambioUsd: 6.96,
        leyendaFiscal: '“ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY”'
    };

    // Isotipo Oficial SVG en alta resolución
    const LOGO_SVG_GOLDEN = `
    <svg width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0; display: inline-block; vertical-align: middle;">
        <path d="M50 12c-3.1 0-5.8 2.1-6.6 5.1l-1.3 4.8c-2.3.6-4.5 1.6-6.6 2.9l-4.1-2.9c-2.5-1.8-5.9-1.3-7.8 1.1l-4.2 5.2c-1.9 2.4-1.6 5.8.7 7.7l3.8 3.1c-.5 2.3-.7 4.7-.6 7l-4.7 1.6c-2.9 1-4.9 3.7-4.9 6.8v6.7c0 3.1 2 5.8 4.9 6.8l4.7 1.6c.1 2.3.4 4.7.9 7l-3.8 3.1c-2.3 1.9-2.6 5.3-.7 7.7l4.2 5.2c1.9 2.4 5.3 2.9 7.8 1.1l4.1-2.9c2.1 1.3 4.3 2.3 6.6 2.9l1.3 4.8c.8 3 3.5 5.1 6.6 5.1h6.7c3.1 0 5.8-2.1 6.6-5.1l1.3-4.8c2.3-.6 4.5-1.6 6.6-2.9l4.1 2.9c2.5 1.8 5.9 1.3 7.8-1.1l4.2-5.2c1.9-2.4 1.6-5.8-.7-7.7l-3.8-3.1c.5-2.3.7-4.7.6-7l4.7-1.6c2.9-1 4.9-3.7 4.9-6.8v-6.7c0-3.1-2-5.8-4.9-6.8l-4.7-1.6c-.1-2.3-.4-4.7-.9-7l3.8-3.1c2.3-1.9 2.6-5.3.7-7.7l-4.2-5.2c-1.9-2.4-5.3-2.9-7.8-1.1l-4.1 2.9c-2.1-1.3-4.3-2.3-6.6-2.9l-1.3-4.8c-.8-3-3.5-5.1-6.6-5.1H50z" fill="#B91C1C"/>
        <circle cx="50" cy="55" r="28" fill="#D97706" stroke="#18181B" stroke-width="4"/>
        <path d="M50 33c0 0-14 14.5-14 21.5s6.3 11.5 14 11.5 14-4.5 14-11.5S50 33 50 33z" fill="#FFF" stroke="#18181B" stroke-width="4"/>
        <path d="M47 48c0-3 3-7 3-7" stroke="#B91C1C" stroke-width="3" stroke-linecap="round"/>
    </svg>`;

    // Conversor de montos numéricos a texto en Bolivianos
    function numeroALetras(monto) {
        monto = Math.max(0, parseFloat(monto) || 0);
        const enteros = Math.floor(monto);
        const centavos = Math.round((monto - enteros) * 100);
        const centavosStr = String(centavos).padStart(2, '0');

        if (enteros === 0) return `CERO ${centavosStr}/100 BOLIVIANOS`;

        const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        const especiales = {
            10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
            16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
            20: 'VEINTE', 21: 'VEINTIÚN', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
            25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
        };
        const decenas = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        function leerGrupo(n) {
            if (n === 0) return '';
            if (n === 100) return 'CIEN';
            let res = '';
            const c = Math.floor(n / 100);
            const d = Math.floor((n % 100) / 10);
            const u = n % 10;
            const du = n % 100;

            if (c > 0) res += centenas[c] + ' ';

            if (especiales[du]) {
                res += especiales[du];
            } else if (d > 0) {
                res += decenas[d];
                if (u > 0) res += ' Y ' + unidades[u];
            } else if (u > 0) {
                res += unidades[u];
            }
            return res.trim();
        }

        let literal = '';
        if (enteros >= 1000000) {
            const mill = Math.floor(enteros / 1000000);
            literal += (mill === 1 ? 'UN MILLÓN ' : leerGrupo(mill) + ' MILLONES ');
        }
        const miles = Math.floor((enteros % 1000000) / 1000);
        if (miles > 0) {
            literal += (miles === 1 ? 'MIL ' : leerGrupo(miles) + ' MIL ');
        }
        const resto = enteros % 1000;
        if (resto > 0) {
            literal += leerGrupo(resto);
        }

        return `SON: ${literal.trim()} ${centavosStr}/100 BOLIVIANOS`;
    }

    function escaparHTML(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // =========================================================================
    // 2. GENERADOR EDITORIAL INDUSTRIAL DE FACTURAS Y NOTAS DE ENTREGA (HTML/PDF)
    // =========================================================================
    function generarFacturaNotaEntregaHTML(pedido) {
        if (!pedido) return '<div class="alert alert-danger">Error: Datos de pedido no válidos.</div>';

        const idNum = String(pedido.id || '0').padStart(6, '0');
        const fechaHora = pedido.fecha_compra 
            ? new Date(pedido.fecha_compra).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
            : new Date().toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });

        const totalBs = parseFloat(pedido.total || 0);
        const subtotalNeto = Math.round((totalBs / 1.13) * 100) / 100;
        const iva13 = Math.round((totalBs - subtotalNeto) * 100) / 100;
        const totalUsd = pedido.monto_usd 
            ? parseFloat(pedido.monto_usd).toFixed(2)
            : (totalBs / EMPRESA.tipoCambioUsd).toFixed(2);

        const esPayPal = String(pedido.metodo_pago || '').toUpperCase().includes('PAYPAL') || Boolean(pedido.paypal_order_id);
        const metodoPagoLabel = esPayPal 
            ? `PAYPAL DIGITAL (USD $${totalUsd})` 
            : (pedido.metodo_pago || 'QR SIMPLE / BCP').toUpperCase();

        const refPago = pedido.comprobante_ref || pedido.paypal_order_id || `QR-BOL-${pedido.id}`;
        const estadoLogistica = (pedido.estado_logistica || pedido.estado || 'CONFIRMADO').toUpperCase();
        const choferResponsable = pedido.despacho_chofer 
            ? `${pedido.despacho_chofer} (Placa: ${pedido.despacho_placa || 'Interna'})`
            : (pedido.empaque_responsable || 'Almacén Central Sucre');

        const clienteNombre = pedido.cliente || pedido.cliente_nombre || 'Taller Mecánico Autorizado';
        const clienteNit = pedido.cliente_nit || pedido.nit || '1029384756';
        const clienteDir = pedido.cliente_direccion || pedido.direccion_envio || 'Av. Jaime Mendoza, Sucre';
        const clienteTel = pedido.cliente_telefono || pedido.telefono || '(+591) 4 64-52890';

        // Detalle de ítems con anchos fijos y word-wrap
        let filasItemsHTML = '';
        const detalles = Array.isArray(pedido.detalles) && pedido.detalles.length > 0 
            ? pedido.detalles 
            : [{
                sku: 'SYN-5W30-001',
                producto_nombre: 'Aceite Sintético 5W-30 Ultra Performance (Galón 4L)',
                cantidad: 1,
                precio_unitario: totalBs,
                subtotal: totalBs
            }];

        detalles.forEach((d, idx) => {
            const sku = d.sku || d.codigo || `GLD-${String(d.producto_id || idx + 1).padStart(3, '0')}`;
            const nombre = d.producto_nombre || d.nombre || 'Repuesto Automotriz Homologado';
            const cantidad = parseInt(d.cantidad || 1);
            const pUnit = parseFloat(d.precio_unitario || (d.subtotal / cantidad) || 0).toFixed(2);
            const sub = parseFloat(d.subtotal || (cantidad * d.precio_unitario) || 0).toFixed(2);
            const bgFila = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';

            // Deducir presentación
            let pres = 'Unidad';
            const nomLower = nombre.toLowerCase();
            if (nomLower.includes('galón') || nomLower.includes('galon') || nomLower.includes('4l')) pres = 'Galón 4L';
            else if (nomLower.includes('1l') || nomLower.includes('litro')) pres = 'Envase 1L';
            else if (nomLower.includes('kg') || nomLower.includes('pote')) pres = 'Pote 1 Kg';
            else if (nomLower.includes('balde') || nomLower.includes('20l')) pres = 'Balde 20L';
            else if (nomLower.includes('500ml')) pres = 'Botella 500ml';
            else if (nomLower.includes('filtro')) pres = 'Pieza Blindada';

            filasItemsHTML += `
                <tr style="background-color: ${bgFila}; border-bottom: 1px solid #E2E8F0;">
                    <td style="width: 14%; padding: 7px 8px; font-family: 'Chivo Mono', monospace; font-size: 11px; text-align: center; color: #334155; font-weight: 600;">${escaparHTML(sku)}</td>
                    <td style="width: 39%; padding: 7px 8px; font-size: 11px; color: #0F172A; font-weight: 600; word-wrap: break-word; overflow-wrap: break-word;">${escaparHTML(nombre)}</td>
                    <td style="width: 15%; padding: 7px 8px; font-size: 11px; text-align: center; color: #475569;">${escaparHTML(pres)}</td>
                    <td style="width: 8%; padding: 7px 8px; font-size: 11px; text-align: center; font-weight: 700; color: #0F172A;">${cantidad}</td>
                    <td style="width: 12%; padding: 7px 8px; font-family: 'Chivo Mono', monospace; font-size: 11px; text-align: right; color: #334155;">Bs. ${pUnit}</td>
                    <td style="width: 12%; padding: 7px 8px; font-family: 'Chivo Mono', monospace; font-size: 11px; text-align: right; font-weight: 700; color: #B91C1C;">Bs. ${sub}</td>
                </tr>
            `;
        });

        const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`GOLDEN-ERP|NIT:${EMPRESA.nit}|FAC:${idNum}|TOT:${totalBs.toFixed(2)}|FEC:${fechaHora}`)}`;

        return `
        <div class="golden-documento-contenedor" style="width: 100%; max-width: 790px; margin: 0 auto; background: #FFFFFF; color: #1C1917; font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box; padding: 24px 28px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            
            <!-- ESTILOS INTERNOS DE IMPRESIÓN Y ALINEACIÓN EXACTA -->
            <style>
                @media print {
                    @page { margin: 8mm; size: A4 portrait; }
                    body { background: #FFFFFF !important; margin: 0 !important; }
                    .golden-documento-contenedor { width: 100% !important; max-width: 100% !important; padding: 0 !important; }
                    .no-print { display: none !important; }
                }
                .golden-doc-table th, .golden-doc-table td { box-sizing: border-box; }
            </style>

            <!-- 1. MEMBRETE OFICIAL Y RECUADRO DE DOCUMENTO -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #B91C1C; padding-bottom: 14px; margin-bottom: 16px;">
                <!-- Datos Distribuidora (Izquierda) -->
                <div style="display: flex; align-items: flex-start; gap: 12px; max-width: 58%;">
                    ${LOGO_SVG_GOLDEN}
                    <div>
                        <h2 style="margin: 0; font-family: 'Archivo', sans-serif; font-size: 18px; font-weight: 900; color: #141619; letter-spacing: -0.01em; line-height: 1.15;">
                            ${EMPRESA.denominacion}
                        </h2>
                        <div style="font-size: 11px; font-weight: 700; color: #B91C1C; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${EMPRESA.razonSocial}
                        </div>
                        <div style="font-size: 10.5px; color: #475569; margin-top: 3px; line-height: 1.3;">
                            <div><strong>Casa Matriz:</strong> ${EMPRESA.casaMatriz} • ${EMPRESA.ciudad}</div>
                            <div><strong>Teléfonos:</strong> ${EMPRESA.telefonos}</div>
                            <div><strong>Email:</strong> ${EMPRESA.correo}</div>
                        </div>
                    </div>
                </div>

                <!-- Recuadro Oficial de Documento (Derecha) -->
                <div style="width: 38%; border: 2px solid #141619; border-radius: 6px; background: #FAF8F5; padding: 8px 12px; text-align: center; box-sizing: border-box;">
                    <div style="background: #141619; color: #F59E0B; font-family: 'Archivo', sans-serif; font-size: 11px; font-weight: 800; padding: 4px 6px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">
                        FACTURA / NOTA DE ENTREGA
                    </div>
                    <div style="font-family: 'Chivo Mono', monospace; font-size: 18px; font-weight: 900; color: #B91C1C; margin-top: 4px;">
                        N° #00${idNum}
                    </div>
                    <div style="font-size: 10px; color: #475569; margin-top: 3px; font-family: 'Chivo Mono', monospace;">
                        <div><strong>NIT:</strong> ${EMPRESA.nit}</div>
                        <div><strong>Autorización:</strong> ${EMPRESA.nroAutorizacion}</div>
                        <div><strong>Fecha:</strong> ${fechaHora}</div>
                    </div>
                </div>
            </div>

            <!-- 2. GRILLA DE DATOS DEL CLIENTE Y OPERACIÓN (2 COLUMNAS SIMÉTRICAS) -->
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                    <!-- Columna 1: Cliente / Taller -->
                    <div style="flex: 1; border-right: 1px solid #E2E8F0; padding-right: 14px;">
                        <div style="font-size: 10px; font-weight: 800; color: #B91C1C; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                            <i class="bi bi-person-badge-fill me-1"></i> DATOS DEL CLIENTE / TALLER
                        </div>
                        <div style="margin-bottom: 2px;">
                            <strong style="color: #0F172A;">Razón Social:</strong> <span>${escaparHTML(clienteNombre)}</span>
                        </div>
                        <div style="margin-bottom: 2px;">
                            <strong style="color: #0F172A;">NIT / CI:</strong> <span style="font-family: 'Chivo Mono', monospace;">${escaparHTML(clienteNit)}</span>
                        </div>
                        <div style="margin-bottom: 2px;">
                            <strong style="color: #0F172A;">Dirección:</strong> <span>${escaparHTML(clienteDir)}</span>
                        </div>
                        <div>
                            <strong style="color: #0F172A;">Teléfono:</strong> <span>${escaparHTML(clienteTel)}</span>
                        </div>
                    </div>

                    <!-- Columna 2: Operación y Logística -->
                    <div style="flex: 1; padding-left: 4px;">
                        <div style="font-size: 10px; font-weight: 800; color: #B91C1C; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                            <i class="bi bi-truck me-1"></i> DATOS DE ENTREGA Y PAGO
                        </div>
                        <div style="margin-bottom: 2px;">
                            <strong style="color: #0F172A;">Forma de Pago:</strong> <span style="font-weight: 600; color: #0F172A;">${escaparHTML(metodoPagoLabel)}</span>
                        </div>
                        <div style="margin-bottom: 2px;">
                            <strong style="color: #0F172A;">Referencia / Trx:</strong> <span style="font-family: 'Chivo Mono', monospace; font-size: 10.5px; color: #475569;">${escaparHTML(refPago)}</span>
                        </div>
                        <div style="margin-bottom: 2px;">
                            <strong style="color: #0F172A;">Estado Logístico:</strong> 
                            <span style="background: #DCFCE7; color: #166534; font-weight: 700; padding: 1px 6px; border-radius: 4px; font-size: 10px;">${escaparHTML(estadoLogistica)}</span>
                        </div>
                        <div>
                            <strong style="color: #0F172A;">Responsable:</strong> <span>${escaparHTML(choferResponsable)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. TABLA DE ÍTEMS ESTRUCTURADA CON ANCHOS PORCENTUALES FIJOS -->
            <table class="golden-doc-table" style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 16px;">
                <thead>
                    <tr style="background: #141619; color: #FFFFFF; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                        <th style="width: 14%; padding: 8px 6px; text-align: center; border: 1px solid #141619;">CÓDIGO</th>
                        <th style="width: 39%; padding: 8px 8px; text-align: left; border: 1px solid #141619;">DESCRIPCIÓN DEL REPUESTO</th>
                        <th style="width: 15%; padding: 8px 6px; text-align: center; border: 1px solid #141619;">PRESENTACIÓN</th>
                        <th style="width: 8%; padding: 8px 4px; text-align: center; border: 1px solid #141619;">CANT.</th>
                        <th style="width: 12%; padding: 8px 6px; text-align: right; border: 1px solid #141619;">P. UNIT</th>
                        <th style="width: 12%; padding: 8px 6px; text-align: right; border: 1px solid #141619;">SUBTOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasItemsHTML}
                </tbody>
            </table>

            <!-- 4. BLOQUE DE TOTALES, MONTO EN LETRAS Y QR FISCAL -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px;">
                <!-- Literal y Leyendas Fiscales (Izquierda) -->
                <div style="width: 58%; font-size: 10.5px;">
                    <div style="background: #FAF8F5; border: 1px solid #E2E8F0; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px;">
                        <strong style="color: #0F172A; display: block; font-size: 10.5px; margin-bottom: 2px;">IMPORTE EN PALABRAS:</strong>
                        <span style="font-weight: 700; color: #B91C1C; font-size: 11px;">${numeroALetras(totalBs)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${qrDataUrl}" alt="QR Fiscal" style="width: 68px; height: 68px; border: 1px solid #CBD5E1; padding: 2px; background: #FFFFFF; flex-shrink: 0;" onerror="this.style.display='none';">
                        <div style="font-size: 9.5px; color: #64748B; line-height: 1.35;">
                            <div>${EMPRESA.leyendaFiscal}</div>
                            <div style="margin-top: 3px; font-family: 'Chivo Mono', monospace;">Código de Control: <strong>4B-9F-22-AA</strong></div>
                        </div>
                    </div>
                </div>

                <!-- Resumen Numérico de Montos (Derecha) -->
                <div style="width: 38%; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px 14px; box-sizing: border-box; font-size: 11.5px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
                        <span>Subtotal Neto:</span>
                        <span style="font-family: 'Chivo Mono', monospace; font-weight: 600; color: #0F172A;">Bs. ${subtotalNeto.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
                        <span>IVA Efectivo (13%):</span>
                        <span style="font-family: 'Chivo Mono', monospace; font-weight: 600; color: #0F172A;">Bs. ${iva13.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #166534; font-size: 10.5px;">
                        <span>Descuento Mayorista:</span>
                        <span style="font-family: 'Chivo Mono', monospace; font-weight: 600;">Bs. 0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #141619; padding-top: 6px; margin-top: 4px;">
                        <span style="font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 13px; color: #141619;">TOTAL A PAGAR:</span>
                        <span style="font-family: 'Chivo Mono', monospace; font-size: 16px; font-weight: 900; color: #B91C1C;">Bs. ${totalBs.toFixed(2)}</span>
                    </div>
                    ${esPayPal ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #CBD5E1; padding-top: 4px; margin-top: 4px; color: #1E40AF; font-size: 11px;">
                        <span>Equivalente PayPal:</span>
                        <span style="font-family: 'Chivo Mono', monospace; font-weight: 800;">$${totalUsd} USD</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- 5. ESPACIOS DE FIRMA Y SELLO DE CONFORMIDAD -->
            <div style="border-top: 1px dashed #CBD5E1; padding-top: 18px; margin-top: 10px;">
                <div style="display: flex; justify-content: space-around; text-align: center; gap: 20px;">
                    <div style="flex: 1; padding: 0 10px;">
                        <div style="border-bottom: 1px solid #141619; height: 38px; margin-bottom: 6px;"></div>
                        <div style="font-size: 10.5px; font-weight: 700; color: #0F172A;">ENTREGADO CONFORME</div>
                        <div style="font-size: 9.5px; color: #64748B;">Distribuidora Golden S.R.L. (Almacén / Despacho)</div>
                    </div>
                    <div style="flex: 1; padding: 0 10px;">
                        <div style="border-bottom: 1px solid #141619; height: 38px; margin-bottom: 6px;"></div>
                        <div style="font-size: 10.5px; font-weight: 700; color: #0F172A;">RECIBIDO CONFORME</div>
                        <div style="font-size: 9.5px; color: #64748B;">Firma, Aclaración y C.I. (Taller / Cliente)</div>
                    </div>
                </div>
                <div style="text-align: center; font-size: 9px; color: #94A3B8; margin-top: 16px;">
                    Documento oficial generado por el Sistema ERP GOLDEN • Sucre, Bolivia • Válido para garantía de repuestos y control de inventario.
                </div>
            </div>

        </div>
        `;
    }

    // =========================================================================
    // 3. MOTOR CENTRALIZADO DE DESCARGA PDF E IMPRESIÓN DIRECTA
    // =========================================================================
    async function descargarDocumentoPDF(htmlContenido, nombreArchivo = 'Documento_GOLDEN.pdf') {
        // Asegurar que html2pdf esté disponible
        if (typeof window.html2pdf === 'undefined') {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        const contenedorTemp = document.createElement('div');
        contenedorTemp.innerHTML = htmlContenido;
        contenedorTemp.style.position = 'fixed';
        contenedorTemp.style.left = '-9999px';
        contenedorTemp.style.top = '0';
        contenedorTemp.style.width = '790px';
        contenedorTemp.style.background = '#FFFFFF';
        document.body.appendChild(contenedorTemp);

        const elemento = contenedorTemp.querySelector('.golden-documento-contenedor') || contenedorTemp;

        const opt = {
            margin: [8, 8, 8, 8],
            filename: nombreArchivo,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await window.html2pdf().set(opt).from(elemento).save();
            if (typeof window.Toast !== 'undefined') {
                window.Toast.fire({ icon: 'success', title: `PDF generado: ${nombreArchivo}` });
            }
        } catch (err) {
            console.error('Error generando PDF:', err);
            // Fallback: abrir en ventana imprimible
            imprimirDocumento(htmlContenido, nombreArchivo);
        } finally {
            if (contenedorTemp.parentNode) {
                document.body.removeChild(contenedorTemp);
            }
        }
    }

    function imprimirDocumento(htmlContenido, titulo = 'Documento Oficial GOLDEN') {
        const ventana = window.open('', '_blank', 'width=900,height=750');
        if (!ventana) {
            alert('Por favor autorice las ventanas emergentes para imprimir el comprobante.');
            return;
        }

        ventana.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>${escaparHTML(titulo)}</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=Work+Sans:wght@400;600;700&family=Chivo+Mono:wght@600;700;800&display=swap" rel="stylesheet">
            </head>
            <body style="margin: 0; padding: 20px; background: #FFFFFF;" onload="window.print(); setTimeout(() => window.close(), 1500);">
                ${htmlContenido}
            </body>
            </html>
        `);
        ventana.document.close();
    }

    // Función universal para invocar desde cualquier módulo del ERP
    async function generarRecibo(pedidoId, modo = 'descargar') {
        if (!pedidoId) {
            if (typeof window.Toast !== 'undefined') {
                window.Toast.fire({ icon: 'warning', title: 'Identificador de pedido no proporcionado' });
            }
            return;
        }

        try {
            if (typeof window.Toast !== 'undefined') {
                window.Toast.fire({ icon: 'info', title: 'Generando comprobante oficial...' });
            }

            const res = await fetch(`/api/pedidos/${pedidoId}`);
            if (!res.ok) throw new Error('Pedido no encontrado en el servidor');
            const pedido = await res.json();

            const htmlFactura = generarFacturaNotaEntregaHTML(pedido);
            const nombreArchivo = `Factura_GOLDEN_#00${String(pedido.id).padStart(4, '0')}.pdf`;

            if (modo === 'imprimir') {
                imprimirDocumento(htmlFactura, nombreArchivo);
            } else {
                await descargarDocumentoPDF(htmlFactura, nombreArchivo);
            }
        } catch (error) {
            console.error('Error al generar comprobante:', error);
            if (typeof window.Toast !== 'undefined') {
                window.Toast.fire({ icon: 'error', title: 'No se pudo generar la factura del pedido' });
            }
        }
    }

    // =========================================================================
    // 4. MOTOR ORGANIZADO PARA REPORTES EXCEL NATIVOS (.XLSX) Y CSV (UTF-8 BOM)
    // =========================================================================

    /**
     * Limpia saltos de línea internos, espacios redundantes e iniciales duplicadas de avatars
     * (ej: "A Administrador" -> "Administrador", "C Carlos" -> "Carlos")
     */
    function limpiarTextoCelda(valor) {
        if (valor === null || valor === undefined) return '';
        if (typeof valor === 'number') return valor;
        let str = String(valor).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        // Quitar inicial repetida de badges de avatar: "A Administrador", "E Empaque", "D Despacho"
        str = str.replace(/^([A-Za-zÁ-Úá-ú])\s+([A-Za-zÁ-Úá-ú][\wá-úÁ-Ú\s\.\-]*)$/, (match, p1, p2) => {
            const primerToken = p2.split(' ')[0];
            if (p1.toUpperCase() === primerToken.charAt(0).toUpperCase() && p1.length === 1) {
                return p2;
            }
            return match;
        });
        return str;
    }

    /**
     * Asegura la carga asíncrona de SheetJS (xlsx.full.min.js) desde CDN oficial
     */
    async function asegurarSheetJS() {
        if (typeof window.XLSX !== 'undefined') return true;
        try {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
            return true;
        } catch (e) {
            console.warn('SheetJS no disponible online, se usará exportador CSV con UTF-8 BOM:', e);
            return false;
        }
    }

    /**
     * Exportador Maestro de Datos a Excel (.xlsx) nativo real con anchos de columna explícitos
     * @param {Object} config { titulo, subtitulo, columnas, filas, anchos, nombreArchivo }
     */
    async function exportarReporteExcel(config) {
        const {
            titulo = 'REPORTE CORPORATIVO DE GESTIÓN',
            subtitulo = '',
            columnas = [],
            filas = [],
            anchos = [],
            nombreArchivo = 'Reporte_GOLDEN'
        } = config;

        if (!filas || filas.length === 0) {
            if (typeof window.Toast !== 'undefined') {
                window.Toast.fire({ icon: 'info', title: 'No existen registros para exportar' });
            }
            return;
        }

        const fechaEmision = new Date().toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
        
        // Limpiar todas las celdas de las filas (saltos de línea e iniciales duplicadas)
        const filasLimpias = filas.map(fila => fila.map(celda => limpiarTextoCelda(celda)));

        await asegurarSheetJS();

        if (typeof window.XLSX !== 'undefined' && window.XLSX.utils) {
            try {
                // Estructura requerida:
                // Fila 1: GOLDEN LUBRICANTES & FILTROS — SUCRE, BOLIVIA
                // Fila 2: Título del Reporte y Fecha de Emisión
                // Fila 3: Vacía
                // Fila 4: Encabezados reales en columnas separadas (A4, B4, C4, D4, E4...)
                // Filas 5 en adelante: Datos perfectamente separados en sus respectivas celdas
                const filaTitulo = subtitulo 
                    ? `${titulo.toUpperCase()} — ${subtitulo} (Emisión: ${fechaEmision})`
                    : `${titulo.toUpperCase()} (Emisión: ${fechaEmision})`;

                const hojaDatos = [
                    ['GOLDEN LUBRICANTES & FILTROS — SUCRE, BOLIVIA'],
                    [filaTitulo],
                    [],
                    columnas.map(c => String(c).toUpperCase()),
                    ...filasLimpias
                ];

                const wb = window.XLSX.utils.book_new();
                const ws = window.XLSX.utils.aoa_to_sheet(hojaDatos);

                // Configuración de anchos de columna explícitos para evitar "###" o textos cortados
                const colsCalculadas = columnas.map((col, idx) => {
                    let w = (anchos && anchos[idx]) ? anchos[idx] : 18;
                    // Asegurar ancho suficiente según el título
                    if (col.length + 4 > w) w = col.length + 4;
                    // Ajustar según el largo máximo de contenido en los datos
                    filasLimpias.forEach(f => {
                        const valLen = String(f[idx] || '').length;
                        if (valLen + 3 > w) w = Math.min(60, valLen + 3);
                    });
                    return { wch: w };
                });
                ws['!cols'] = colsCalculadas;

                // Formato numérico 2 decimales para celdas monetarias / no enteras
                for (let cellRef in ws) {
                    if (cellRef[0] === '!') continue;
                    const cell = ws[cellRef];
                    if (cell && typeof cell.v === 'number' && !Number.isInteger(cell.v)) {
                        cell.z = '#,##0.00';
                    }
                }

                window.XLSX.utils.book_append_sheet(wb, ws, 'Datos');

                const fechaStr = new Date().toISOString().slice(0, 10);
                const nombreLimpio = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}_${fechaStr}.xlsx`;
                window.XLSX.writeFile(wb, nombreLimpio);

                if (typeof window.Toast !== 'undefined') {
                    window.Toast.fire({ icon: 'success', title: `Excel descargado: ${nombreLimpio}` });
                }
                return;
            } catch (errXlsx) {
                console.error('Error al generar XLSX nativo con SheetJS, aplicando respaldo CSV:', errXlsx);
            }
        }

        // Respaldo de contingencia: CSV con UTF-8 BOM
        exportarReporteCSV({
            titulo,
            encabezados: columnas,
            filas: filasLimpias,
            nombreArchivo
        });
    }

    /**
     * Exportador a CSV universal con UTF-8 BOM (\uFEFF)
     */
    function exportarReporteCSV({ titulo = 'REPORTE_GOLDEN', encabezados = [], filas = [], nombreArchivo = 'Reporte_GOLDEN' }) {
        const fechaEmision = new Date().toLocaleString('es-BO');
        const lineas = [
            `"${EMPRESA.denominacion} - SUCRE, BOLIVIA"`,
            `"${titulo.toUpperCase()}"`,
            `"Fecha de Emision: ${fechaEmision} | NIT: ${EMPRESA.nit}"`,
            `""`,
            encabezados.map(h => `"${String(h).replace(/"/g, '""')}"`).join(';')
        ];

        filas.forEach(fila => {
            const celdas = fila.map(v => {
                if (v === null || v === undefined) return '""';
                if (typeof v === 'number') {
                    return Number.isInteger(v) ? `"${v}"` : `"${v.toFixed(2)}"`;
                }
                return `"${String(v).replace(/"/g, '""').replace(/(\r\n|\n|\r)/gm, ' ')}"`;
            });
            lineas.push(celdas.join(';'));
        });

        const contenidoCSV = '\uFEFF' + lineas.join('\r\n');
        const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fechaStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `${nombreArchivo}_${fechaStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (typeof window.Toast !== 'undefined') {
            window.Toast.fire({ icon: 'success', title: `Reporte descargado: ${nombreArchivo}.csv` });
        }
    }

    /**
     * Scraper inteligente de tablas HTML para exportación universal
     */
    function exportarTablaCSV(tablaId, nombreArchivo = 'Reporte_GOLDEN', tituloReporte = 'Reporte de Operaciones') {
        let tabla = document.getElementById(tablaId);
        if (!tabla) {
            const el = document.getElementById(tablaId);
            if (el && el.tagName === 'TBODY') tabla = el.closest('table');
        }

        if (!tabla) {
            if (typeof window.Toast !== 'undefined') {
                window.Toast.fire({ icon: 'warning', title: 'Tabla no encontrada para exportar' });
            }
            return;
        }

        const encabezados = [];
        const anchos = [];
        const ths = tabla.querySelectorAll('thead th');
        ths.forEach(th => {
            const txt = th.innerText.trim();
            if (txt.toLowerCase() === 'acciones' || th.classList.contains('col-acciones')) return;
            encabezados.push(txt.toUpperCase());
            anchos.push(Math.max(16, txt.length + 6));
        });

        const filas = [];
        const trs = tabla.querySelectorAll('tbody tr');
        trs.forEach(tr => {
            // Ignorar filas de carga o mensajes vacíos
            if (tr.querySelector('td[colspan]')) return;
            const celdas = [];
            const tds = tr.querySelectorAll('td');
            tds.forEach((td, i) => {
                if (ths[i] && (ths[i].innerText.trim().toLowerCase() === 'acciones' || ths[i].classList.contains('col-acciones'))) return;
                
                // Clonar la celda para limpiar elementos de icono/avatar badge antes de extraer texto
                let clon = td.cloneNode(true);
                const av = clon.querySelector('.rounded-circle, .avatar-badge, .btn');
                if (av && clon.innerText.trim().length > 3) {
                    av.remove();
                }
                let val = limpiarTextoCelda(clon.innerText);
                celdas.push(val);
            });
            if (celdas.length > 0) filas.push(celdas);
        });

        exportarReporteExcel({
            titulo: tituloReporte,
            columnas: encabezados,
            filas: filas,
            anchos: anchos,
            nombreArchivo: nombreArchivo
        });
    }

    /**
     * Generador de Reporte Oficial de Inventario en formato HTML/PDF
     */
    function generarReporteInventarioHTML(productos) {
        const lista = Array.isArray(productos) ? productos : [];
        const fechaHora = new Date().toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
        const totalItems = lista.length;
        let totalUnidades = 0;
        let valorTotal = 0;
        let bajoStock = 0;

        lista.forEach(p => {
            const stock = parseInt(p.stock) || 0;
            const precio = parseFloat(p.precio) || 0;
            const min = parseInt(p.stock_minimo) || 5;
            totalUnidades += stock;
            valorTotal += (stock * precio);
            if (stock <= min) bajoStock++;
        });

        let filasHTML = '';
        lista.forEach((p, idx) => {
            const stock = parseInt(p.stock) || 0;
            const precio = parseFloat(p.precio) || 0;
            const sub = stock * precio;
            const min = parseInt(p.stock_minimo) || 5;
            const esCritico = stock <= min;
            const bgFila = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
            const estadoBadge = esCritico
                ? '<span style="background: #FEE2E2; color: #991B1B; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;">CRÍTICO</span>'
                : '<span style="background: #DCFCE7; color: #166534; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px;">ÓPTIMO</span>';

            filasHTML += `
                <tr style="background-color: ${bgFila}; border-bottom: 1px solid #E2E8F0;">
                    <td style="padding: 7px 8px; font-family: 'Chivo Mono', monospace; font-size: 11px; text-align: center; color: #334155; font-weight: 600;">${escaparHTML(p.sku)}</td>
                    <td style="padding: 7px 8px; font-size: 11px; color: #0F172A; font-weight: 600; word-wrap: break-word;">${escaparHTML(p.nombre)}</td>
                    <td style="padding: 7px 8px; font-size: 10.5px; color: #475569; text-align: center;">${escaparHTML(p.categoria)}</td>
                    <td style="padding: 7px 8px; font-family: 'Chivo Mono', monospace; font-size: 11px; text-align: right; color: #334155;">Bs. ${precio.toFixed(2)}</td>
                    <td style="padding: 7px 8px; font-size: 11px; text-align: center; font-weight: 700; color: #0F172A;">${stock} unid.</td>
                    <td style="padding: 7px 8px; font-family: 'Chivo Mono', monospace; font-size: 11px; text-align: right; font-weight: 700; color: #B91C1C;">Bs. ${sub.toFixed(2)}</td>
                    <td style="padding: 7px 8px; font-size: 10px; text-align: center;">${estadoBadge}</td>
                </tr>
            `;
        });

        return `
        <div class="golden-documento-contenedor" style="width: 100%; max-width: 820px; margin: 0 auto; background: #FFFFFF; color: #1C1917; font-family: 'Work Sans', sans-serif; box-sizing: border-box; padding: 24px 28px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <style>
                @media print {
                    @page { margin: 8mm; size: A4 portrait; }
                    body { background: #FFFFFF !important; margin: 0 !important; }
                    .golden-documento-contenedor { width: 100% !important; max-width: 100% !important; padding: 0 !important; }
                }
            </style>
            <!-- 1. MEMBRETE OFICIAL -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #B91C1C; padding-bottom: 14px; margin-bottom: 16px;">
                <div style="display: flex; align-items: flex-start; gap: 12px; max-width: 60%;">
                    ${LOGO_SVG_GOLDEN}
                    <div>
                        <h2 style="margin: 0; font-family: 'Archivo', sans-serif; font-size: 18px; font-weight: 900; color: #141619; line-height: 1.15;">
                            ${EMPRESA.denominacion}
                        </h2>
                        <div style="font-size: 11px; font-weight: 700; color: #B91C1C; margin-top: 2px; text-transform: uppercase;">
                            ${EMPRESA.razonSocial}
                        </div>
                        <div style="font-size: 10.5px; color: #475569; margin-top: 3px;">
                            <div><strong>Almacén Central:</strong> ${EMPRESA.casaMatriz} • ${EMPRESA.ciudad}</div>
                            <div><strong>Teléfonos:</strong> ${EMPRESA.telefonos}</div>
                        </div>
                    </div>
                </div>
                <div style="width: 36%; border: 2px solid #141619; border-radius: 6px; background: #FAF8F5; padding: 8px 12px; text-align: center;">
                    <div style="background: #141619; color: #F59E0B; font-family: 'Archivo', sans-serif; font-size: 10.5px; font-weight: 800; padding: 3px 6px; border-radius: 4px; text-transform: uppercase;">
                        REPORTE DE INVENTARIO
                    </div>
                    <div style="font-family: 'Chivo Mono', monospace; font-size: 14px; font-weight: 900; color: #B91C1C; margin-top: 4px;">
                        CONTROL DE EXISTENCIAS
                    </div>
                    <div style="font-size: 10px; color: #475569; margin-top: 2px; font-family: 'Chivo Mono', monospace;">
                        <div><strong>NIT:</strong> ${EMPRESA.nit}</div>
                        <div><strong>Fecha:</strong> ${fechaHora}</div>
                    </div>
                </div>
            </div>

            <!-- 2. RESUMEN DE INDICADORES DE ALMACÉN -->
            <div style="display: flex; justify-content: space-between; gap: 12px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px;">
                <div><strong style="color: #475569;">Catálogo Activo:</strong> <span style="font-weight: 800; color: #0F172A;">${totalItems} ítems</span></div>
                <div><strong style="color: #475569;">Unidades Físicas:</strong> <span style="font-weight: 800; color: #D97706;">${totalUnidades} unid.</span></div>
                <div><strong style="color: #475569;">Alertas Stock:</strong> <span style="font-weight: 800; color: #B91C1C;">${bajoStock} críticas</span></div>
                <div><strong style="color: #475569;">Valorización Total:</strong> <span style="font-family: 'Chivo Mono', monospace; font-weight: 900; color: #166534;">Bs. ${valorTotal.toFixed(2)}</span></div>
            </div>

            <!-- 3. TABLA DE REPUESTOS -->
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 18px;">
                <thead>
                    <tr style="background: #141619; color: #FFFFFF; font-size: 10px; font-weight: 700; text-transform: uppercase;">
                        <th style="width: 15%; padding: 8px 6px; text-align: center;">SKU</th>
                        <th style="width: 36%; padding: 8px 6px; text-align: left;">DESCRIPCIÓN</th>
                        <th style="width: 15%; padding: 8px 6px; text-align: center;">CATEGORÍA</th>
                        <th style="width: 11%; padding: 8px 6px; text-align: right;">P. UNIT</th>
                        <th style="width: 10%; padding: 8px 6px; text-align: center;">STOCK</th>
                        <th style="width: 13%; padding: 8px 6px; text-align: right;">VALOR BS</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasHTML}
                </tbody>
            </table>

            <!-- 4. PIE DE REPORTE Y FIRMAS -->
            <div style="border-top: 1px dashed #CBD5E1; padding-top: 14px; margin-top: 10px;">
                <div style="display: flex; justify-content: space-around; text-align: center; gap: 20px;">
                    <div style="flex: 1;">
                        <div style="border-bottom: 1px solid #141619; height: 35px; margin-bottom: 4px;"></div>
                        <div style="font-size: 10px; font-weight: 700; color: #0F172A;">RESPONSABLE DE ALMACÉN CENTRAL</div>
                        <div style="font-size: 9px; color: #64748B;">Distribuidora Golden S.R.L. — Sucre, Bolivia</div>
                    </div>
                    <div style="flex: 1;">
                        <div style="border-bottom: 1px solid #141619; height: 35px; margin-bottom: 4px;"></div>
                        <div style="font-size: 10px; font-weight: 700; color: #0F172A;">AUDITORÍA / CONTROL INTERNO</div>
                        <div style="font-size: 9px; color: #64748B;">Verificación Física Conforme</div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    // =========================================================================
    // 5. EXPORTACIÓN GLOBAL AL OBJETO WINDOW
    // =========================================================================
    window.EMPRESA_GOLDEN = EMPRESA;
    window.numeroALetras = numeroALetras;
    window.limpiarTextoCelda = limpiarTextoCelda;
    window.generarFacturaNotaEntregaHTML = generarFacturaNotaEntregaHTML;
    window.generarReporteInventarioHTML = generarReporteInventarioHTML;
    window.descargarDocumentoPDF = descargarDocumentoPDF;
    window.imprimirDocumento = imprimirDocumento;
    window.generarRecibo = generarRecibo;
    window.generarFacturaPDF = generarRecibo;
    window.exportarReporteExcel = exportarReporteExcel;
    window.exportarReporteCSV = exportarReporteCSV;
    window.exportarTablaCSV = exportarTablaCSV;
    window.documentosGoldenLoaded = true;

})(window, document);
