const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend/golden_seguridad.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error conectando a BD:', err.message);
        process.exit(1);
    }
});

console.log("⏳ Poblando la base de datos de GOLDEN con catálogo High-End estilo WIX Filters...");

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON;');

    // 1. Garantizar columnas imagen_url y especificaciones
    db.all("PRAGMA table_info(productos)", (err, cols) => {
        if (!err && cols) {
            const hasImg = cols.some(c => c.name === 'imagen_url');
            const hasSpecs = cols.some(c => c.name === 'especificaciones');
            if (!hasImg) db.run("ALTER TABLE productos ADD COLUMN imagen_url TEXT");
            if (!hasSpecs) db.run("ALTER TABLE productos ADD COLUMN especificaciones TEXT");
        }
    });

    // 2. Usuarios demo con sus respectivos roles
    const hash = bcrypt.hashSync('123456', 10);
    const stmtUser = db.prepare(`INSERT OR IGNORE INTO usuarios (nombre, email, password, rol, estado) VALUES (?, ?, ?, ?, ?)`);
    stmtUser.run('Taller Los Primos', 'primos@golden.bo', hash, 'CLIENTE_B2B', 'ACTIVO');
    stmtUser.run('Lubricentro Rayo', 'rayo@golden.bo', hash, 'CLIENTE_B2B', 'ACTIVO');
    stmtUser.run('Automekano Sucre', 'automekano@golden.bo', hash, 'CLIENTE_B2B', 'ACTIVO');
    stmtUser.run('Carlos Repartidor', 'carlos@golden.bo', hash, 'REPARTIDOR', 'ACTIVO');
    stmtUser.run('Almacén Central', 'almacen@golden.bo', hash, 'ALMACENERO', 'ACTIVO');
    stmtUser.finalize();

    // 3. Catálogo Masivo de Productos con Fichas Técnicas WIX Style
    const productosData = [
        // ==================== FILTROS DE ACEITE (WIX STYLE) ====================
        {
            sku: 'FIL-ACE-011',
            nombre: 'Filtro de Aceite Blindado Spin-On Hilux/Corolla',
            categoria: 'Filtros de Aceite',
            precio: 45.00,
            stock: 14,
            stock_minimo: 5,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aceite',
            especificaciones: {
                tipo: 'Filtro de Aceite Blindado (Spin-on)',
                filtracion: '21 Micrones (Eficiencia Beta 99.2%)',
                empaque: '12 Unidades / Caja Master',
                dimensiones: {
                    alto: '85 mm',
                    diametro_exterior: '68 mm',
                    rosca: '3/4-16 UNF-2B',
                    valvula_alivio: '14 - 17 PSI',
                    valvula_antidrenaje: 'Silicona Roja Premium (-40°C a 200°C)'
                },
                codigo_barras: '7751234005111',
                aplicaciones: [
                    { marca: 'Toyota', modelo: 'Hilux 2.4 / 2.8 D-4D', motor: '1GD-FTV / 2GD', anios: '2016 - 2025' },
                    { marca: 'Toyota', modelo: 'Corolla 1.8 / 2.0 Dual VVT-i', motor: '2ZR-FE', anios: '2014 - 2024' },
                    { marca: 'Toyota', modelo: 'RAV4 2.0 / 2.5 AWD', motor: '2AR-FE', anios: '2013 - 2023' }
                ],
                equivalencias: [
                    { marca: 'WIX Filters', codigo: '51394' },
                    { marca: 'MANN-FILTER', codigo: 'W 68/3' },
                    { marca: 'BOSCH', codigo: '0 986 452 058' },
                    { marca: 'OEM TOYOTA', codigo: '90915-YZZD2' },
                    { marca: 'FRAM', codigo: 'PH4967' }
                ]
            }
        },
        {
            sku: 'FIL-ACE-012',
            nombre: 'Filtro de Aceite Heavy Duty Sentra/Frontier',
            categoria: 'Filtros de Aceite',
            precio: 48.00,
            stock: 2,
            stock_minimo: 5,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aceite',
            especificaciones: {
                tipo: 'Filtro de Flujo Total de Alta Capacidad',
                filtracion: '20 Micrones (Celulosa Sintética Reforzada)',
                empaque: '12 Unidades / Caja Master',
                dimensiones: {
                    alto: '70 mm',
                    diametro_exterior: '65 mm',
                    rosca: 'M20 x 1.5 - 6H',
                    valvula_alivio: '11 - 14 PSI',
                    valvula_antidrenaje: 'Nitrilo Vulcanizado de Alta Duración'
                },
                codigo_barras: '7751234005128',
                aplicaciones: [
                    { marca: 'Nissan', modelo: 'Frontier NP300 2.5 Diésel', motor: 'YD25DDTi', anios: '2015 - 2024' },
                    { marca: 'Nissan', modelo: 'Sentra 1.8 / 2.0 B17/B18', motor: 'MR20DE', anios: '2013 - 2023' },
                    { marca: 'Nissan', modelo: 'X-Trail 2.5 4WD', motor: 'QR25DE', anios: '2014 - 2022' }
                ],
                equivalencias: [
                    { marca: 'WIX Filters', codigo: '51358' },
                    { marca: 'MANN-FILTER', codigo: 'W 67/1' },
                    { marca: 'BOSCH', codigo: '0 986 452 061' },
                    { marca: 'OEM NISSAN', codigo: '15208-65F0A' }
                ]
            }
        },
        {
            sku: 'FIL-ACE-013',
            nombre: 'Filtro de Aceite Blindado Suzuki Vitara/Swift',
            categoria: 'Filtros de Aceite',
            precio: 42.00,
            stock: 22,
            stock_minimo: 6,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aceite',
            especificaciones: {
                tipo: 'Filtro Spin-On Compacto Ultra-Flow',
                filtracion: '18 Micrones (Media Microglass)',
                empaque: '24 Unidades / Caja',
                dimensiones: {
                    alto: '65 mm',
                    diametro_exterior: '68 mm',
                    rosca: '3/4-16 UNF',
                    valvula_alivio: '14 PSI',
                    valvula_antidrenaje: 'Silicona Resistente'
                },
                codigo_barras: '7751234005135',
                aplicaciones: [
                    { marca: 'Suzuki', modelo: 'Grand Vitara 2.0 / 2.4', motor: 'J20A / J24B', anios: '2008 - 2022' },
                    { marca: 'Suzuki', modelo: 'Swift 1.2 / 1.4 Boosterjet', motor: 'K12M / K14C', anios: '2012 - 2024' }
                ],
                equivalencias: [
                    { marca: 'WIX Filters', codigo: '51396' },
                    { marca: 'MANN-FILTER', codigo: 'W 610/82' },
                    { marca: 'OEM SUZUKI', codigo: '16510-61A31' }
                ]
            }
        },
        {
            sku: 'FIL-ACE-014',
            nombre: 'Filtro de Aceite Cartucho Chevrolet Cruze/Tracker',
            categoria: 'Filtros de Aceite',
            precio: 50.00,
            stock: 15,
            stock_minimo: 5,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aceite',
            especificaciones: {
                tipo: 'Elemento Ecológico sin Partes Metálicas (Eco-Filter)',
                filtracion: '15 Micrones (Fibras Celulósicas Plegadas)',
                empaque: '10 Unidades / Caja + O-Rings de sellado',
                dimensiones: {
                    alto: '105 mm',
                    diametro_exterior: '57 mm',
                    diametro_interior: '24 mm',
                    valvula_alivio: 'Integrada en Housing',
                    valvula_antidrenaje: 'En Tapa Motor'
                },
                codigo_barras: '7751234005142',
                aplicaciones: [
                    { marca: 'Chevrolet', modelo: 'Cruze 1.4 Turbo / 1.8 Ecotec', motor: 'LUJ / 2H0', anios: '2012 - 2022' },
                    { marca: 'Chevrolet', modelo: 'Tracker 1.2 Turbo', motor: 'CSS Prime', anios: '2020 - 2025' }
                ],
                equivalencias: [
                    { marca: 'WIX Filters', codigo: 'WL10023' },
                    { marca: 'MANN-FILTER', codigo: 'HU 612/2 x' },
                    { marca: 'OEM GM', codigo: '55594651' }
                ]
            }
        },
        {
            sku: 'FIL-ACE-015',
            nombre: 'Filtro de Aceite Hyundai Tucson / Kia Sportage',
            categoria: 'Filtros de Aceite',
            precio: 46.00,
            stock: 30,
            stock_minimo: 8,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aceite',
            especificaciones: {
                tipo: 'Filtro Blindado para Motores Nu / Theta II',
                filtracion: '20 Micrones (Media Mixta Celulosa-Sintético)',
                empaque: '12 Unidades / Caja',
                dimensiones: {
                    alto: '75 mm',
                    diametro_exterior: '80 mm',
                    rosca: 'M20 x 1.5',
                    valvula_alivio: '14 - 17 PSI',
                    valvula_antidrenaje: 'Silicona Grado Médico'
                },
                codigo_barras: '7751234005159',
                aplicaciones: [
                    { marca: 'Hyundai', modelo: 'Tucson 2.0 MPi / GDi', motor: 'G4NA / G4NC', anios: '2011 - 2024' },
                    { marca: 'Kia', modelo: 'Sportage 2.0 / 2.4', motor: 'G4KD / G4KE', anios: '2010 - 2023' }
                ],
                equivalencias: [
                    { marca: 'WIX Filters', codigo: '51334' },
                    { marca: 'MANN-FILTER', codigo: 'W 811/80' },
                    { marca: 'OEM HYUNDAI/KIA', codigo: '26300-35505' }
                ]
            }
        },

        // ==================== FILTROS DE AIRE Y CABINA ====================
        {
            sku: 'FIL-AIR-016',
            nombre: 'Filtro de Aire Panel Seco Hilux 2.8 GD',
            categoria: 'Filtros de Aire',
            precio: 90.00,
            stock: 2,
            stock_minimo: 10,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aire',
            especificaciones: {
                tipo: 'Filtro de Aire Tipo Panel con Sello de Poliuretano',
                filtracion: 'Retención de Polvo Fino 99.8% (Norma ISO 5011)',
                empaque: '1 Unidad en Bolsa Termosellada / Caja Individual',
                dimensiones: {
                    largo: '318 mm',
                    ancho: '238 mm',
                    alto: '55 mm',
                    area_filtrante: '1.45 m²',
                    marco: 'Poliuretano Flexible Hermético'
                },
                codigo_barras: '7751234005166',
                aplicaciones: [
                    { marca: 'Toyota', modelo: 'Hilux Revo / GR-S 2.8', motor: '1GD-FTV', anios: '2016 - 2025' },
                    { marca: 'Toyota', modelo: 'Fortuner / SW4 2.8 Diésel', motor: '1GD-FTV', anios: '2016 - 2025' }
                ],
                equivalencias: [
                    { marca: 'WIX Filters', codigo: 'WA10410' },
                    { marca: 'MANN-FILTER', codigo: 'C 33 013' },
                    { marca: 'OEM TOYOTA', codigo: '17801-11130' }
                ]
            }
        },
        {
            sku: 'FIL-AIR-017',
            nombre: 'Filtro de Aire Panel Corolla 1.8 Dual VVT-i',
            categoria: 'Filtros de Aire',
            precio: 85.00,
            stock: 16,
            stock_minimo: 5,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aire',
            especificaciones: {
                tipo: 'Panel de Aire con Pliegues Profundos Estabilizados',
                filtracion: '99.5% Partículas > 5 Micrones',
                empaque: 'Caja Individual con Guía de Instalación',
                dimensiones: {
                    largo: '242 mm',
                    ancho: '176 mm',
                    alto: '50 mm',
                    resistencia_flujo: '< 1.2 kPa a 250 m³/h',
                    marco: 'Sellado EPDM Alta Resistencia'
                },
                codigo_barras: '7751234005173',
                aplicaciones: [
                    { marca: 'Toyota', modelo: 'Corolla Sedan 1.8 / 2.0', motor: '2ZR-FE / M20A', anios: '2014 - 2024' },
                    { marca: 'Toyota', modelo: 'Auris / Prius 1.8 Hybrid', motor: '2ZR-FXE', anios: '2015 - 2023' }
                ],
                equivalencias: [
                    { marca: 'WIX Filters', codigo: 'WA9654' },
                    { marca: 'MANN-FILTER', codigo: 'C 24 005' },
                    { marca: 'OEM TOYOTA', codigo: '17801-0T020' }
                ]
            }
        },
        {
            sku: 'FIL-CAB-020',
            nombre: 'Filtro de Cabina / A/C con Carbón Activado Antipolen',
            categoria: 'Filtros de Aire',
            precio: 70.00,
            stock: 14,
            stock_minimo: 5,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aire',
            especificaciones: {
                tipo: 'Filtro Antipolen + Carbón Activado Neutralizador de Olores',
                filtracion: 'Elimina 99% de Polen, Esporas, PM2.5 y Gases Nocivos (NOx)',
                empaque: 'Envoltorio Sellado al Vacío / Caja Individual',
                dimensiones: {
                    largo: '215 mm',
                    ancho: '194 mm',
                    alto: '29 mm',
                    capas: '3 Capas (Prefiltro, Carbón de Coco, Microfibra)',
                    flujo_aire: 'Optimizado para Climatizador Automático'
                },
                codigo_barras: '7751234005203',
                aplicaciones: [
                    { marca: 'Toyota', modelo: 'Hilux / Prado / RAV4 / Corolla', motor: 'Todos', anios: '2010 - 2025' },
                    { marca: 'Subaru', modelo: 'Forester / Outback 2.0/2.5', motor: 'FB20 / FB25', anios: '2012 - 2022' }
                ],
                equivalencias: [
                    { marca: 'WIX Filters', codigo: 'WP9290' },
                    { marca: 'MANN-FILTER', codigo: 'CUK 1919' },
                    { marca: 'OEM TOYOTA', codigo: '87139-50100' }
                ]
            }
        },

        // ==================== ACEITES SINTÉTICOS ====================
        {
            sku: 'ACE-SIN-006',
            nombre: 'Aceite 100% Sintético Golden Ultra 5W-30 (1L)',
            categoria: 'Aceites Sintéticos',
            precio: 75.00,
            stock: 40,
            stock_minimo: 10,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Aceite+Sintetico',
            especificaciones: {
                tipo: 'Lubricante 100% Sintético PAO + Éster de Última Generación',
                filtracion: 'Viscosidad Cinemática @ 100°C: 10.8 cSt | Índice: 168',
                empaque: 'Botella de 1 Litro con Precinto Antiderrames (Caja x 12)',
                dimensiones: {
                    densidad_15c: '0.849 g/cm³',
                    punto_inflamacion: '232 °C',
                    punto_fluidez: '-45 °C',
                    tbn_alcalinidad: '8.5 mg KOH/g',
                    cenizas_sulfatadas: '0.8% (Mid-SAPS / Apto DPF/Catalizador)'
                },
                codigo_barras: '7751234001062',
                aplicaciones: [
                    { marca: 'Universal Gasolina/Diésel', modelo: 'Vehículos con Inyección Directa GDI/TSI', motor: 'Turbo & Aspirados', anios: '2015 - 2025' },
                    { marca: 'Normas Cumplidas', modelo: 'API SP-RC, ILSAC GF-6A, ACEA C2/C3', motor: 'GM dexos2, BMW LL-04', anios: 'Vigente' }
                ],
                equivalencias: [
                    { marca: 'Mobil 1', codigo: 'ESP 5W-30' },
                    { marca: 'Castrol', codigo: 'EDGE 5W-30 LL' },
                    { marca: 'Motul', codigo: '8100 X-clean EFE' }
                ]
            }
        },
        {
            sku: 'ACE-SIN-007',
            nombre: 'Aceite Sintético Golden Ultra 5W-30 (Galón 4L)',
            categoria: 'Aceites Sintéticos',
            precio: 280.00,
            stock: 3,
            stock_minimo: 5,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Aceite+Sintetico',
            especificaciones: {
                tipo: 'Lubricante 100% Sintético Formato Taller (4 Litros)',
                filtracion: 'Película Fluida Molecular con Tecnología Titanium Shield',
                empaque: 'Galonera de 4 Litros con Medidor Graduado (Caja x 4)',
                dimensiones: {
                    densidad_15c: '0.850 g/cm³',
                    punto_inflamacion: '234 °C',
                    punto_fluidez: '-42 °C',
                    hths_viscosidad: '3.5 mPa.s @ 150°C',
                    certificacion: 'API SP / ILSAC GF-6A'
                },
                codigo_barras: '7751234001079',
                aplicaciones: [
                    { marca: 'Talleres Mecánicos', modelo: 'Cambio de Aceite Completo para 4 y 6 Cilindros', motor: 'Toyota, Nissan, Hyundai, Ford', anios: '2010 - 2025' }
                ],
                equivalencias: [
                    { marca: 'Shell Helix', codigo: 'Ultra 5W-30 Galón' },
                    { marca: 'Valvoline', codigo: 'Advanced Full Synth 5W30' }
                ]
            }
        },
        {
            sku: 'ACE-SIN-008',
            nombre: 'Aceite Sintético Ecológico 0W-20 Hybrid Ready (1L)',
            categoria: 'Aceites Sintéticos',
            precio: 95.00,
            stock: 18,
            stock_minimo: 5,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Aceite+Sintetico',
            especificaciones: {
                tipo: 'Lubricante Ultrabajo en Fricción para Vehículos Híbridos y Nuevos',
                filtracion: 'Viscosidad @ 100°C: 8.2 cSt | HTHS: 2.6 mPa.s',
                empaque: 'Botella de 1 Litro (Caja x 12)',
                dimensiones: {
                    densidad_15c: '0.842 g/cm³',
                    punto_inflamacion: '228 °C',
                    punto_fluidez: '-50 °C',
                    tbn_alcalinidad: '8.2 mg KOH/g',
                    ahorro_combustible: '+2.8% vs aceites convencionales'
                },
                codigo_barras: '7751234001086',
                aplicaciones: [
                    { marca: 'Toyota Hybrid', modelo: 'Prius, Corolla Hybrid, RAV4 Hybrid', motor: '1.8 / 2.5 HSD', anios: '2018 - 2025' },
                    { marca: 'Honda', modelo: 'Civic, CR-V Turbo / Hybrid', motor: '1.5T / 2.0 e:HEV', anios: '2017 - 2025' }
                ],
                equivalencias: [
                    { marca: 'Toyota Genuine', codigo: 'Motor Oil 0W-20' },
                    { marca: 'Liqui Moly', codigo: 'Special Tec AA 0W-20' }
                ]
            }
        },

        // ==================== ACEITES MINERALES ====================
        {
            sku: 'ACE-MIN-001',
            nombre: 'Aceite Mineral Multigrado Golden 20W-50 (1L)',
            categoria: 'Aceites Minerales',
            precio: 45.00,
            stock: 50,
            stock_minimo: 10,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Aceite+Mineral',
            especificaciones: {
                tipo: 'Aceite Mineral Formulado con Bases Grupo II Altamente Refinadas',
                filtracion: 'Viscosidad Cinemática @ 100°C: 18.5 cSt | Índice: 125',
                empaque: 'Botella de 1 Litro (Caja x 12)',
                dimensiones: {
                    densidad_15c: '0.885 g/cm³',
                    punto_inflamacion: '240 °C',
                    punto_fluidez: '-27 °C',
                    tbn_alcalinidad: '7.8 mg KOH/g',
                    control_sellos: 'Agentes Acondicionadores de Retenes'
                },
                codigo_barras: '7751234002014',
                aplicaciones: [
                    { marca: 'Flotas & Transporte', modelo: 'Vehículos con más de 100,000 km y Alto Recorrido', motor: 'Gasolina y GLP/GNV', anios: '1995 - 2020' }
                ],
                equivalencias: [
                    { marca: 'Mobil Super', codigo: '1000 20W-50' },
                    { marca: 'Castrol', codigo: 'GTX 20W-50' },
                    { marca: 'Shell', codigo: 'Helix HX5 20W-50' }
                ]
            }
        },
        {
            sku: 'ACE-MIN-004',
            nombre: 'Aceite Mineral Heavy Duty Alto Kilometraje 25W-60',
            categoria: 'Aceites Minerales',
            precio: 140.00,
            stock: 4,
            stock_minimo: 10,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Aceite+Sintetico',
            especificaciones: {
                tipo: 'Lubricante Mineral de Alta Viscosidad para Reducción de Humo y Fugas',
                filtracion: 'Viscosidad @ 100°C: 24.0 cSt | Máxima Película de Amortiguación',
                empaque: 'Galonera de 4 Litros (Caja x 4)',
                dimensiones: {
                    densidad_15c: '0.892 g/cm³',
                    punto_inflamacion: '250 °C',
                    punto_fluidez: '-21 °C',
                    sellado_compresion: 'Restaura Presión de Aceite en Motores con Desgaste'
                },
                codigo_barras: '7751234002045',
                aplicaciones: [
                    { marca: 'Vehículos de Carga', modelo: 'Minibuses, Taxis y Camiones Livianos', motor: 'Motores con > 200,000 km', anios: 'Todos' }
                ],
                equivalencias: [
                    { marca: 'Bardahl', codigo: 'B-2 25W-60' },
                    { marca: 'Quaker State', codigo: 'Defurance 25W-60' }
                ]
            }
        },

        // ==================== LÍQUIDOS Y ADITIVOS ====================
        {
            sku: 'REF-ORG-022',
            nombre: 'Refrigerante Orgánico Larga Vida OAT 50/50 Rojo (Galón)',
            categoria: 'Aceites Sintéticos',
            precio: 65.00,
            stock: 20,
            stock_minimo: 6,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Refrigerante',
            especificaciones: {
                tipo: 'Coolant / Anticongelante Orgánico 50% Monoetilenglicol Premoldeado',
                filtracion: 'Punto de Ebullición: +129 °C (con tapa 15 PSI) | Congelación: -37 °C',
                empaque: 'Galón de 3.785 Litros (Caja x 4)',
                dimensiones: {
                    tecnologia: 'Ácidos Orgánicos (OAT) Libre de Nitritos, Aminas y Boratos',
                    color: 'Rojo Carmesí Fluorescente',
                    proteccion_aluminio: 'Aprobado ASTM D3306 / JIS K2234',
                    vida_util: '5 Años o 250,000 km de Protección Anticorrosiva'
                },
                codigo_barras: '7751234003226',
                aplicaciones: [
                    { marca: 'Sistemas de Enfriamiento Modernos', modelo: 'Radiadores de Aluminio y Cobre-Latón', motor: 'Gasolina y Turbodiésel', anios: '2005 - 2025' }
                ],
                equivalencias: [
                    { marca: 'Prestone', codigo: 'Command Heavy Duty Red' },
                    { marca: 'Peak', codigo: 'Global OAT 50/50' }
                ]
            }
        },
        {
            sku: 'LIQ-FRE-024',
            nombre: 'Líquido de Frenos Sintético Premium DOT-4 (500ml)',
            categoria: 'Filtros de Aceite',
            precio: 35.00,
            stock: 40,
            stock_minimo: 10,
            imagen_url: 'https://placehold.co/400x300/ffffff/1e293b?text=Liquido+de+Frenos',
            especificaciones: {
                tipo: 'Fluido Hidráulico de Frenos a Base de Éteres de Polietilenglicol',
                filtracion: 'Punto de Ebullición Seco: > 260 °C | Húmedo: > 165 °C',
                empaque: 'Botella Metálica / Plástica Sellada de 500 ml (Caja x 24)',
                dimensiones: {
                    viscosidad_40c: '< 1500 cSt (Respuesta Ultra Rápida en Frenado ABS/ESP)',
                    compatibilidad: 'Apto Sistemas con ABS, TCS, ESP y EBD',
                    norma_internacional: 'FMVSS 116 DOT 4, ISO 4925 Clase 4, SAE J1704'
                },
                codigo_barras: '7751234004247',
                aplicaciones: [
                    { marca: 'Todos los Fabricantes', modelo: 'Frenos de Disco Delanteros/Traseros y Embrague Hidráulico', motor: 'Autos, SUVs y Camionetas', anios: 'Universal' }
                ],
                equivalencias: [
                    { marca: 'Brembo', codigo: 'DOT 4 Premium' },
                    { marca: 'ATE', codigo: 'SL.6 DOT 4' },
                    { marca: 'Bosch', codigo: 'DOT 4 HP' }
                ]
            }
        }
    ];

    const stmtProd = db.prepare(`
        INSERT INTO productos (sku, nombre, categoria, precio, stock, stock_minimo, imagen_url, especificaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sku) DO UPDATE SET
            nombre = excluded.nombre,
            categoria = excluded.categoria,
            precio = excluded.precio,
            stock = excluded.stock,
            stock_minimo = excluded.stock_minimo,
            imagen_url = excluded.imagen_url,
            especificaciones = excluded.especificaciones
    `);

    productosData.forEach(p => {
        const specsStr = typeof p.especificaciones === 'object' ? JSON.stringify(p.especificaciones) : p.especificaciones;
        stmtProd.run(p.sku, p.nombre, p.categoria, p.precio, p.stock, p.stock_minimo, p.imagen_url, specsStr);
    });

    stmtProd.finalize();

    // 4. Historial de compras y detalles
    db.get('SELECT COUNT(*) as count FROM pedidos', [], (err, row) => {
        if (!err && row && row.count === 0) {
            db.run(`INSERT INTO pedidos (cliente_id, total, estado, fecha_compra) VALUES 
                (2, 361.50, 'ENTREGADO', datetime('now', '-3 days')),
                (3, 450.00, 'ENTREGADO', datetime('now', '-2 days')),
                (4, 280.00, 'EN CAMINO', datetime('now', '-1 days')),
                (2, 165.50, 'PENDIENTE', datetime('now'))
            `, function(pedErr) {
                if (!pedErr) {
                    console.log('📦 Pedidos masivos iniciales inyectados.');
                    db.run(`INSERT OR IGNORE INTO pedido_detalles (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal) VALUES
                        (1, 1, 'Aceite Mineral 20W-50', 3, 120.50, 361.50),
                        (2, 2, 'Aceite Sintético 5W-30', 2, 225.00, 450.00),
                        (3, 4, 'Filtro de Aire Hilux', 4, 70.00, 280.00),
                        (4, 3, 'Filtro de Aceite Nissan', 1, 45.00, 45.00),
                        (4, 1, 'Aceite Mineral 20W-50', 1, 120.50, 120.50)
                    `);
                }
            });
        }
        console.log("✅ Catálogo WIX Filters poblado exitosamente con imágenes HD y Fichas Técnicas JSON.");
    });
});
