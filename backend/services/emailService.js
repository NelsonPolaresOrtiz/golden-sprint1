/**
 * ============================================================================
 * SERVICIO CORPORATIVO DE AUTOMATIZACIÓN DE CORREOS ELECTRÓNICOS (GMAIL / NODEMAILER)
 * "GOLDEN Lubricantes & Filtros" - Sucre, Bolivia
 * ============================================================================
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuración de Identidad y Servidor SMTP
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const GMAIL_FROM_NAME = process.env.GMAIL_FROM_NAME || 'GOLDEN Lubricantes & Filtros';
const BASE_APP_URL = process.env.BASE_APP_URL || 'https://golden-sprint1.onrender.com';

// Membrete Oficial de la Distribuidora
const DATOS_EMPRESA = {
    nombre: 'GOLDEN Lubricantes & Filtros',
    razonSocial: 'GOLDEN Lubricantes & Filtros Bolivia S.R.L.',
    nit: '1029384756',
    direccion: 'Av. Jaime Mendoza #1420, Sucre - Bolivia',
    telefono: '(+591) 4 64-52890',
    whatsapp: '+591 67375645',
    emailContacto: GMAIL_USER || 'contacto@golden-bolivia.com',
    colorOscuro: '#141619',
    colorRojo: '#B91C1C',
    colorAmbar: '#D97706',
    colorFondo: '#F8FAFC',
    colorBorde: '#E2E8F0',
    colorTexto: '#1C1917'
};

// Directorio de almacenamiento permanente para comprobantes físicos
const DIR_UPLOADS_COMPROBANTES = path.join(__dirname, '..', 'uploads', 'comprobantes');
if (!fs.existsSync(DIR_UPLOADS_COMPROBANTES)) {
    try {
        fs.mkdirSync(DIR_UPLOADS_COMPROBANTES, { recursive: true });
    } catch (e) {
        console.error('[EmailService] No se pudo crear directorio de comprobantes:', e.message);
    }
}

/**
 * Inicializa y devuelve una instancia del transportador SMTP de Nodemailer.
 * Si las credenciales no están presentes, retorna null y registra el aviso.
 */
function obtenerTransporter() {
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
        console.warn('[EmailService] AVISO: Credenciales de Gmail (GMAIL_USER / GMAIL_APP_PASSWORD) no configuradas en el entorno. Los correos se registrarán en modo simulación.');
        return null;
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        }
    });
}

/**
 * Resuelve y valida la existencia de un comprobante en disco.
 * Si recibe una cadena en Base64 (DataURL), la guarda físicamente en disco y retorna la ruta absoluta.
 */
function resolverRutaComprobante(rutaOBase64, pedidoId = 'S_N') {
    if (!rutaOBase64) return null;

    // 1. Ruta absoluta o directa ya existente
    if (typeof rutaOBase64 === 'string' && fs.existsSync(rutaOBase64)) {
        return rutaOBase64;
    }

    // 2. Ruta relativa almacenada en BD (ej. /uploads/comprobantes/...)
    if (typeof rutaOBase64 === 'string' && rutaOBase64.startsWith('/uploads')) {
        const fullPath = path.join(__dirname, '..', rutaOBase64);
        if (fs.existsSync(fullPath)) return fullPath;
    }

    // 3. Cadena DataURL en Base64 subida por el cliente
    if (typeof rutaOBase64 === 'string' && rutaOBase64.startsWith('data:')) {
        try {
            const matches = rutaOBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                let ext = 'jpg';
                if (mimeType.includes('png')) ext = 'png';
                else if (mimeType.includes('pdf')) ext = 'pdf';
                else if (mimeType.includes('webp')) ext = 'webp';

                if (!fs.existsSync(DIR_UPLOADS_COMPROBANTES)) {
                    fs.mkdirSync(DIR_UPLOADS_COMPROBANTES, { recursive: true });
                }

                const nombreArchivo = `comprobante_PED_${pedidoId}_${Date.now()}.${ext}`;
                const destinoPath = path.join(DIR_UPLOADS_COMPROBANTES, nombreArchivo);
                fs.writeFileSync(destinoPath, Buffer.from(base64Data, 'base64'));

                if (fs.existsSync(destinoPath)) {
                    return destinoPath;
                }
            }
        } catch (err) {
            console.error('[EmailService] Error al convertir comprobante DataURL a archivo físico:', err.message);
        }
    }

    return null;
}

/**
 * Wrapper seguro para el envío asíncrono de correos electrónicos.
 * Nunca detiene el servidor ni lanza excepciones no capturadas.
 */
async function enviarCorreoSeguro({ to, bcc, subject, html, text, attachments = [] }) {
    const transporter = obtenerTransporter();
    if (!transporter) {
        console.log(`[EmailService - SIMULACIÓN] Para: ${to} | Asunto: "${subject}" | Adjuntos: ${attachments.length}`);
        return { ok: false, simulado: true, error: 'Credenciales no configuradas' };
    }

    try {
        // Filtrar y validar adjuntos que existan físicamente en disco
        const adjuntosValidos = attachments.filter(att => {
            if (att.path && !fs.existsSync(att.path)) {
                console.warn(`[EmailService] Adjunto omitido por no existir en disco: ${att.path}`);
                return false;
            }
            return true;
        });

        const mailOptions = {
            from: `"${GMAIL_FROM_NAME}" <${GMAIL_USER}>`,
            to: to,
            bcc: bcc,
            subject: subject,
            text: text || 'GOLDEN Lubricantes & Filtros - Notificación oficial del sistema.',
            html: html,
            attachments: adjuntosValidos
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Correo enviado exitosamente a "${to}". ID: ${info.messageId}`);
        return { ok: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[EmailService] Error al enviar correo a "${to}":`, error.message);
        return { ok: false, error: error.message };
    }
}

/**
 * Genera el contenedor HTML corporativo estándar con membrete y pie oficial.
 */
function construirPlantillaBase({ tituloPre, subtitulo, cuerpoHtml }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${tituloPre}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${DATOS_EMPRESA.colorFondo}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${DATOS_EMPRESA.colorTexto}; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${DATOS_EMPRESA.colorFondo}; padding: 24px 12px;">
        <tr>
            <td align="center">
                <!-- Contenedor Principal (Máximo 640px) -->
                <table role="presentation" width="100%" style="max-width: 640px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid ${DATOS_EMPRESA.colorBorde};" cellspacing="0" cellpadding="0" border="0">
                    
                    <!-- Membrete Carbón Grafito con Línea Roja Competición -->
                    <tr>
                        <td style="background-color: ${DATOS_EMPRESA.colorOscuro}; padding: 28px 32px 24px 32px; border-bottom: 4px solid ${DATOS_EMPRESA.colorRojo}; text-align: left;">
                            <table width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td>
                                        <div style="font-size: 22px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.5px; text-transform: uppercase;">
                                            GOLDEN
                                        </div>
                                        <div style="font-size: 12px; font-weight: 600; color: ${DATOS_EMPRESA.colorAmbar}; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px;">
                                            Lubricantes &amp; Filtros Automotrices
                                        </div>
                                    </td>
                                    <td align="right" style="vertical-align: middle;">
                                        <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); padding: 6px 12px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #D6D0C7;">
                                            NIT ${DATOS_EMPRESA.nit}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            ${subtitulo ? `<div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.12); font-size: 13px; color: #E5E7EB;">${subtitulo}</div>` : ''}
                        </td>
                    </tr>

                    <!-- Cuerpo del Mensaje -->
                    <tr>
                        <td style="padding: 32px;">
                            ${cuerpoHtml}
                        </td>
                    </tr>

                    <!-- Pie de Página Corporativo Oficial -->
                    <tr>
                        <td style="background-color: #F1F5F9; padding: 24px 32px; border-top: 1px solid ${DATOS_EMPRESA.colorBorde}; font-size: 12px; color: #64748B; text-align: center; line-height: 1.6;">
                            <div style="font-weight: 700; color: ${DATOS_EMPRESA.colorOscuro}; margin-bottom: 4px;">
                                ${DATOS_EMPRESA.razonSocial}
                            </div>
                            <div>
                                ${DATOS_EMPRESA.direccion}
                            </div>
                            <div>
                                Central Telefónica: ${DATOS_EMPRESA.telefono} | WhatsApp Comercial: ${DATOS_EMPRESA.whatsapp}
                            </div>
                            <div style="margin-top: 12px; font-size: 11px; color: #94A3B8;">
                                Este mensaje ha sido emitido de manera automatizada por el sistema comercial de GOLDEN Lubricantes &amp; Filtros. Precios y operaciones válidos exclusivamente en moneda nacional (Bolivianos - Bs.).
                            </div>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ============================================================================
// 1. PROFORMA Y COTIZACIÓN MAYORISTA
// ============================================================================
/**
 * Envía la proforma mayorista en HTML con tabla de códigos SKU, descripción,
 * cantidad, precio unitario, descuento aplicado, total en Bs., vigencia de 7 días
 * y botón directo hacia el catálogo de clientes.
 */
async function enviarCotizacionEmail(cliente, items = [], total = 0) {
    const totalNum = parseFloat(total) || 0;
    const codigoCot = `COT-${Date.now().toString().slice(-6)}`;
    const fechaEmision = new Date().toLocaleDateString('es-BO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const emailDestino = cliente.email || cliente.correo || GMAIL_USER;
    const nombreCliente = cliente.nombre || cliente.nombre_cliente || 'Taller Mecánico / Cliente Mayorista';

    let filasTabla = '';
    let subtotalBruto = 0;

    items.forEach((it, idx) => {
        const sku = it.sku || `SKU-${idx + 1}`;
        const desc = it.nombre || it.descripcion || 'Producto Automotriz';
        const cant = parseInt(it.cantidad) || 1;
        const precioUnit = parseFloat(it.precio || it.precio_unitario) || 0;
        const descAplicado = parseFloat(it.descuento || 0);
        const subtotalItem = parseFloat(it.subtotal) || (cant * precioUnit * (1 - descAplicado / 100));
        subtotalBruto += (cant * precioUnit);

        filasTabla += `
            <tr style="border-bottom: 1px solid #E2E8F0; font-size: 13px;">
                <td style="padding: 10px 8px; font-family: monospace; font-weight: 600; color: #334155;">${sku}</td>
                <td style="padding: 10px 8px; color: #1E293B;">${desc}</td>
                <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${cant}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace;">Bs. ${precioUnit.toFixed(2)}</td>
                <td style="padding: 10px 8px; text-align: center; color: ${DATOS_EMPRESA.colorRojo}; font-weight: 600;">${descAplicado > 0 ? `${descAplicado}%` : '0%'}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A;">Bs. ${subtotalItem.toFixed(2)}</td>
            </tr>
        `;
    });

    const cuerpoHtml = `
        <div style="margin-bottom: 24px;">
            <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: ${DATOS_EMPRESA.colorRojo}; font-weight: 700;">
                Documento Comercial Formal
            </div>
            <h1 style="margin: 6px 0 0 0; font-size: 22px; font-weight: 800; color: ${DATOS_EMPRESA.colorOscuro};">
                Proforma Mayorista ${codigoCot}
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #64748B;">
                Fecha de Emisión: <strong>${fechaEmision}</strong> | Vigencia: <strong>7 días calendario</strong>
            </p>
        </div>

        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 16px; margin-bottom: 24px; font-size: 13px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td style="padding: 4px 0; color: #64748B; width: 140px;">Cliente / Razón Social:</td>
                    <td style="padding: 4px 0; font-weight: 700; color: #0F172A;">${nombreCliente}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #64748B;">Teléfono de Contacto:</td>
                    <td style="padding: 4px 0; color: #0F172A;">${cliente.telefono || 'Sin registrar'}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #64748B;">Correo Electrónico:</td>
                    <td style="padding: 4px 0; color: #0F172A;">${emailDestino}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #64748B;">Ciudad y Destino:</td>
                    <td style="padding: 4px 0; color: #0F172A;">${cliente.ciudad || 'Sucre, Bolivia'}</td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom: 24px; overflow-x: auto;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #0F172A; color: #FFFFFF; font-size: 12px; text-transform: uppercase;">
                        <th style="padding: 10px 8px; text-align: left;">SKU</th>
                        <th style="padding: 10px 8px; text-align: left;">Descripción</th>
                        <th style="padding: 10px 8px; text-align: center;">Cant.</th>
                        <th style="padding: 10px 8px; text-align: right;">P. Unit</th>
                        <th style="padding: 10px 8px; text-align: center;">Desc.</th>
                        <th style="padding: 10px 8px; text-align: right;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasTabla}
                </tbody>
            </table>
        </div>

        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
            <tr>
                <td style="vertical-align: top; font-size: 12px; color: #64748B; padding-right: 20px; line-height: 1.5;">
                    <strong>Condiciones Generales:</strong><br>
                    • Precios netos expresados en Bolivianos (Bs.).<br>
                    • Válida durante 7 días a partir de su emisión.<br>
                    • Sujeto a disponibilidad de inventario físico en Almacén Central.<br>
                    • Métodos aceptados: Pago QR Interoperable (SIMPLE / Yape) o Transferencia Bancaria Directa.
                </td>
                <td width="220" style="vertical-align: top;">
                    <div style="background-color: #F8FAFC; border: 2px solid ${DATOS_EMPRESA.colorOscuro}; border-radius: 6px; padding: 14px; text-align: right;">
                        <div style="font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 700;">Total Proforma</div>
                        <div style="font-size: 22px; font-weight: 800; color: ${DATOS_EMPRESA.colorRojo}; font-family: monospace; margin-top: 4px;">
                            Bs. ${totalNum.toFixed(2)}
                        </div>
                    </div>
                </td>
            </tr>
        </table>

        <div style="text-align: center; margin-top: 24px;">
            <a href="${BASE_APP_URL}/tienda.html?vista=cliente" style="display: inline-block; background-color: ${DATOS_EMPRESA.colorRojo}; color: #FFFFFF; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 6px; letter-spacing: 0.3px;">
                Ver Catálogo y Confirmar Pedido en Línea
            </a>
        </div>
    `;

    const htmlCompleto = construirPlantillaBase({
        tituloPre: `Proforma Mayorista ${codigoCot} - GOLDEN`,
        subtitulo: `Proforma Comercial Mayorista | Código de Seguimiento: ${codigoCot}`,
        cuerpoHtml: cuerpoHtml
    });

    return await enviarCorreoSeguro({
        to: emailDestino,
        bcc: GMAIL_USER,
        subject: `Proforma Comercial Mayorista - GOLDEN Lubricantes & Filtros [${codigoCot}]`,
        html: htmlCompleto
    });
}

// ============================================================================
// 2. RESPALDO DE COMPROBANTE AL ADMINISTRADOR (QR DIRECTO / DEPÓSITO BANCARIO)
// ============================================================================
/**
 * Envía un correo al administrador con el resumen de la orden y adjunta la imagen/foto
 * real del comprobante subida por el cliente, validando previamente con fs.existsSync.
 */
async function enviarRespaldoComprobanteAdmin(pedido, cliente, rutaImagenComprobante) {
    const pedidoIdFmt = `PED-${String(pedido.id || pedido.pedidoId || '0000').padStart(4, '0')}`;
    const totalNum = parseFloat(pedido.total) || 0;
    const metodoPago = pedido.metodo_pago === 'DEPOSITO_BANCARIO'
        ? 'Depósito Bancario / Transferencia'
        : (pedido.metodo_pago === 'QR_DIRECTO' ? 'Pago QR Directo (SIMPLE / Yape)' : (pedido.metodo_pago || 'Pago Electrónico'));
    const refOperacion = pedido.numero_operacion || pedido.comprobante_ref || 'S/N';
    const banco = pedido.banco_origen || 'Banco Unión S.A. / Red Interbancaria';

    const rutaFisica = resolverRutaComprobante(rutaImagenComprobante || pedido.comprobante_img, pedido.id);
    const tieneAdjunto = Boolean(rutaFisica && fs.existsSync(rutaFisica));

    const cuerpoHtml = `
        <div style="margin-bottom: 24px;">
            <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: ${DATOS_EMPRESA.colorRojo}; font-weight: 700;">
                Recepción de Pago y Nueva Orden
            </div>
            <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800; color: ${DATOS_EMPRESA.colorOscuro};">
                Nuevo Pedido Registrado #${pedidoIdFmt}
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748B;">
                Comprobante de respaldo recibido para validación en Cobranzas.
            </p>
        </div>

        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.6;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td style="color: #64748B; width: 160px; padding: 4px 0;">Cliente / Taller:</td>
                    <td style="font-weight: 700; color: #0F172A; padding: 4px 0;">${cliente.nombre || 'Cliente General'}</td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">Teléfono de Contacto:</td>
                    <td style="color: #0F172A; padding: 4px 0;">${cliente.telefono || 'Sin teléfono'}</td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">Correo Electrónico:</td>
                    <td style="color: #0F172A; padding: 4px 0;">${cliente.email || cliente.correo || 'Sin correo'}</td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">Método de Pago:</td>
                    <td style="font-weight: 600; color: ${DATOS_EMPRESA.colorRojo}; padding: 4px 0;">${metodoPago}</td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">N° de Operación / Boleta:</td>
                    <td style="font-family: monospace; font-weight: 700; color: #0F172A; padding: 4px 0;">${refOperacion}</td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">Entidad Financiera:</td>
                    <td style="color: #0F172A; padding: 4px 0;">${banco}</td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">Monto Liquidado:</td>
                    <td style="font-size: 16px; font-weight: 800; color: ${DATOS_EMPRESA.colorRojo}; font-family: monospace; padding: 4px 0;">
                        Bs. ${totalNum.toFixed(2)}
                    </td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">Estado de Cobro:</td>
                    <td style="padding: 4px 0;">
                        <span style="display: inline-block; background-color: #FEF3C7; color: #92400E; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">
                            PENDIENTE DE VERIFICACIÓN
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <div style="background-color: ${tieneAdjunto ? '#ECFDF5' : '#FFFBEB'}; border: 1px solid ${tieneAdjunto ? '#A7F3D0' : '#FDE68A'}; border-radius: 6px; padding: 14px; margin-bottom: 24px; font-size: 13px; color: ${tieneAdjunto ? '#065F46' : '#92400E'};">
            <strong>Respaldo Físico:</strong> ${tieneAdjunto 
                ? 'La captura o fotografía del comprobante de pago subida por el cliente ha sido adjuntada a este correo electrónico.' 
                : 'El cliente confirmó la transferencia en el checkout (archivo pendiente de adjuntar o subida directa en trámite).'}
        </div>

        <div style="text-align: center; margin-top: 24px;">
            <a href="${BASE_APP_URL}/cobranzas.html" style="display: inline-block; background-color: ${DATOS_EMPRESA.colorOscuro}; color: #FFFFFF; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 6px;">
                Ingresar al Módulo de Cobranzas para Validar
            </a>
        </div>
    `;

    const htmlCompleto = construirPlantillaBase({
        tituloPre: `Respaldo de Comprobante #${pedidoIdFmt} - GOLDEN`,
        subtitulo: `Notificación de Cobranzas | Orden Comercial #${pedidoIdFmt}`,
        cuerpoHtml: cuerpoHtml
    });

    const attachments = [];
    if (tieneAdjunto) {
        attachments.push({
            filename: `comprobante_${pedidoIdFmt}${path.extname(rutaFisica) || '.jpg'}`,
            path: rutaFisica
        });
    }

    return await enviarCorreoSeguro({
        to: GMAIL_USER,
        subject: `Nuevo Pedido Registrado - Respaldo de Comprobante [#${pedidoIdFmt}] - ${cliente.nombre || 'Cliente'}`,
        html: htmlCompleto,
        attachments: attachments
    });
}

// ============================================================================
// 3. CONFIRMACIÓN OFICIAL DE PEDIDO Y COBRO APROBADO AL CLIENTE
// ============================================================================
/**
 * Al aprobar el pago en Cobranzas, envía al correo del cliente la confirmación oficial
 * de su pedido en Bs., adjuntando también la copia de su comprobante verificado.
 */
async function enviarComprobantePedidoEmail(cliente, pedido, items = [], rutaImagenComprobante = null) {
    const pedidoIdFmt = `PED-${String(pedido.id || '0000').padStart(4, '0')}`;
    const totalNum = parseFloat(pedido.total) || 0;
    const emailDestino = cliente.email || cliente.correo;

    if (!emailDestino) {
        console.warn(`[EmailService] Cliente #${cliente.id || ''} no tiene correo electrónico registrado para el envío de confirmación de pedido.`);
        return { ok: false, error: 'Cliente sin correo' };
    }

    const rutaFisica = resolverRutaComprobante(rutaImagenComprobante || pedido.comprobante_img, pedido.id);
    const tieneAdjunto = Boolean(rutaFisica && fs.existsSync(rutaFisica));

    let filasItems = '';
    items.forEach((it, idx) => {
        const sku = it.sku || `SKU-${idx + 1}`;
        const desc = it.producto_nombre || it.nombre || 'Repuesto Automotriz';
        const cant = parseInt(it.cantidad) || 1;
        const precioUnit = parseFloat(it.precio_unitario || it.precio) || 0;
        const subtotal = parseFloat(it.subtotal) || (cant * precioUnit);

        filasItems += `
            <tr style="border-bottom: 1px solid #E2E8F0; font-size: 13px;">
                <td style="padding: 10px 8px; font-family: monospace; color: #475569;">${sku}</td>
                <td style="padding: 10px 8px; color: #0F172A;">${desc}</td>
                <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${cant}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace;">Bs. ${precioUnit.toFixed(2)}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0F172A;">Bs. ${subtotal.toFixed(2)}</td>
            </tr>
        `;
    });

    const cuerpoHtml = `
        <div style="margin-bottom: 24px;">
            <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; font-weight: 700;">
                Pago Verificado y Aprobado
            </div>
            <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800; color: ${DATOS_EMPRESA.colorOscuro};">
                Confirmación de Orden #${pedidoIdFmt}
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #64748B;">
                Estimado(a) <strong>${cliente.nombre || 'Cliente'}</strong>: Su pago ha sido validado satisfactoriamente por nuestro departamento de Cobranzas.
            </p>
        </div>

        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.6;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td style="color: #64748B; width: 160px; padding: 4px 0;">Estado de Orden:</td>
                    <td style="font-weight: 700; color: #059669; padding: 4px 0;">PAGADO / EN PREPARACIÓN DE ALMACÉN</td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">Método de Pago:</td>
                    <td style="color: #0F172A; padding: 4px 0;">${pedido.metodo_pago || 'Pago Interbancario'}</td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">Referencia Bancaria:</td>
                    <td style="font-family: monospace; font-weight: 600; color: #0F172A; padding: 4px 0;">${pedido.numero_operacion || pedido.comprobante_ref || 'S/N'}</td>
                </tr>
                <tr>
                    <td style="color: #64748B; padding: 4px 0;">Total Liquidado:</td>
                    <td style="font-size: 16px; font-weight: 800; color: ${DATOS_EMPRESA.colorRojo}; font-family: monospace; padding: 4px 0;">
                        Bs. ${totalNum.toFixed(2)}
                    </td>
                </tr>
            </table>
        </div>

        ${filasItems ? `
        <div style="margin-bottom: 24px; overflow-x: auto;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #0F172A; color: #FFFFFF; font-size: 12px; text-transform: uppercase;">
                        <th style="padding: 10px 8px; text-align: left;">SKU</th>
                        <th style="padding: 10px 8px; text-align: left;">Repuesto / Detalle</th>
                        <th style="padding: 10px 8px; text-align: center;">Cant.</th>
                        <th style="padding: 10px 8px; text-align: right;">P. Unit</th>
                        <th style="padding: 10px 8px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasItems}
                </tbody>
            </table>
        </div>` : ''}

        <div style="background-color: #F1F5F9; border-radius: 6px; padding: 14px; margin-bottom: 24px; font-size: 13px; color: #475569; line-height: 1.5;">
            <strong>Próximos Pasos:</strong> Su pedido está siendo preparado, embalado y rotulado por nuestro equipo de Almacén Central. Recibirá una notificación por correo tan pronto como sea asignado al móvil de distribución.
        </div>

        <div style="text-align: center; margin-top: 24px;">
            <a href="${BASE_APP_URL}/tienda.html?vista=cliente" style="display: inline-block; background-color: ${DATOS_EMPRESA.colorRojo}; color: #FFFFFF; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 6px;">
                Consultar Estado de Mi Pedido
            </a>
        </div>
    `;

    const htmlCompleto = construirPlantillaBase({
        tituloPre: `Confirmación de Pedido #${pedidoIdFmt} - GOLDEN`,
        subtitulo: `Confirmación de Cobro y Facturación | Orden #${pedidoIdFmt}`,
        cuerpoHtml: cuerpoHtml
    });

    const attachments = [];
    if (tieneAdjunto) {
        attachments.push({
            filename: `comprobante_verificado_${pedidoIdFmt}${path.extname(rutaFisica) || '.jpg'}`,
            path: rutaFisica
        });
    }

    return await enviarCorreoSeguro({
        to: emailDestino,
        bcc: GMAIL_USER,
        subject: `Confirmación de Pago y Orden Aprobada [#${pedidoIdFmt}] - GOLDEN Lubricantes & Filtros`,
        html: htmlCompleto,
        attachments: attachments
    });
}

// ============================================================================
// 4. ACTUALIZACIÓN DE ESTADO LOGÍSTICO Y DESPACHO
// ============================================================================
/**
 * Notifica automáticamente al cliente cuando su pedido pasa a "Empacado",
 * "En ruta" (indicando chofer asignado) o "Entregado".
 */
async function enviarActualizacionLogisticaEmail(cliente, pedido, nuevoEstado, chofer = null) {
    const pedidoIdFmt = `PED-${String(pedido.id || '0000').padStart(4, '0')}`;
    const emailDestino = cliente.email || cliente.correo;

    if (!emailDestino) {
        console.warn(`[EmailService] Cliente #${cliente.id || ''} no tiene correo para actualización logística.`);
        return { ok: false, error: 'Cliente sin correo' };
    }

    const estadoNorm = (nuevoEstado || '').toUpperCase();
    let tituloEstado = 'Actualización de Pedido';
    let descripcionEtapa = '';
    let detalleAdicional = '';

    if (estadoNorm.includes('EMPACAD')) {
        tituloEstado = 'Pedido Empacado y Rotulado';
        descripcionEtapa = 'Su orden ha concluido el proceso de control de calidad, empaque seguro y rotulado en nuestro Almacén Central de Sucre. Se encuentra lista en el andén de despacho para ser cargada al vehículo de reparto.';
    } else if (estadoNorm.includes('CAMINO') || estadoNorm.includes('RUTA') || estadoNorm.includes('DESPACH')) {
        tituloEstado = 'Pedido en Ruta de Entrega';
        const choferNombre = chofer || pedido.despacho_chofer || 'Personal de Logística GOLDEN';
        const placa = pedido.despacho_placa ? ` (Móvil placa ${pedido.despacho_placa})` : '';
        descripcionEtapa = `Su pedido ha salido de nuestro almacén y se encuentra a bordo del móvil de distribución en trayecto hacia su taller o dirección de entrega acordada.`;
        detalleAdicional = `
            <div style="background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 6px; padding: 12px 16px; margin-top: 14px; font-size: 13px; color: #92400E;">
                <strong>Conductor Responsable:</strong> ${choferNombre}${placa}<br>
                <span>Por favor tenga a mano su documento de identidad para la recepción formal del paquete.</span>
            </div>
        `;
    } else if (estadoNorm.includes('ENTREGAD')) {
        tituloEstado = 'Pedido Entregado con Éxito';
        descripcionEtapa = 'Confirmamos que su pedido ha sido entregado a entera conformidad en su destino. Agradecemos su preferencia y confianza en la calidad y garantía de nuestros lubricantes y repuestos automotrices.';
    } else {
        tituloEstado = `Estado Actualizado: ${nuevoEstado}`;
        descripcionEtapa = `Le informamos que su pedido ha sido actualizado al estado "${nuevoEstado}" en nuestro sistema logístico.`;
    }

    const cuerpoHtml = `
        <div style="margin-bottom: 24px;">
            <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: ${DATOS_EMPRESA.colorRojo}; font-weight: 700;">
                Logística y Distribución
            </div>
            <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800; color: ${DATOS_EMPRESA.colorOscuro};">
                ${tituloEstado}
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #64748B;">
                Orden de Despacho <strong>#${pedidoIdFmt}</strong>
            </p>
        </div>

        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 18px; margin-bottom: 20px; font-size: 14px; color: #334155; line-height: 1.6;">
            Estimado(a) <strong>${cliente.nombre || 'Cliente'}</strong>:<br><br>
            ${descripcionEtapa}
            ${detalleAdicional}
        </div>

        <div style="background-color: #F1F5F9; border-radius: 6px; padding: 14px; margin-bottom: 24px; font-size: 12px; color: #64748B;">
            Central de Atención al Cliente y Coordinación Logística: ${DATOS_EMPRESA.telefono} | WhatsApp: ${DATOS_EMPRESA.whatsapp}
        </div>

        <div style="text-align: center; margin-top: 24px;">
            <a href="${BASE_APP_URL}/tienda.html?vista=cliente" style="display: inline-block; background-color: ${DATOS_EMPRESA.colorOscuro}; color: #FFFFFF; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 6px;">
                Ver Historial de Pedidos
            </a>
        </div>
    `;

    const htmlCompleto = construirPlantillaBase({
        tituloPre: `${tituloEstado} #${pedidoIdFmt} - GOLDEN`,
        subtitulo: `Control de Entregas y Distribución | Orden #${pedidoIdFmt}`,
        cuerpoHtml: cuerpoHtml
    });

    return await enviarCorreoSeguro({
        to: emailDestino,
        bcc: GMAIL_USER,
        subject: `Actualización de Despacho: Pedido [#${pedidoIdFmt}] - ${tituloEstado} - GOLDEN Lubricantes & Filtros`,
        html: htmlCompleto
    });
}

module.exports = {
    enviarCotizacionEmail,
    enviarRespaldoComprobanteAdmin,
    enviarComprobantePedidoEmail,
    enviarActualizacionLogisticaEmail,
    resolverRutaComprobante,
    enviarCorreoSeguro,
    obtenerTransporter
};
