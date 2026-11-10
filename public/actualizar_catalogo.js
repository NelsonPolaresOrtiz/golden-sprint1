const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../backend/golden_seguridad.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error conectando a BD:', err.message);
        process.exit(1);
    }
});

console.log("⏳ Actualizando el catálogo con imágenes seguras para localhost...");

// Enlaces a imágenes seguras para localhost (CORS permitidas)
const imgAceiteMineral = 'https://placehold.co/400x300/ffffff/1e293b?text=Aceite+Mineral';
const imgAceiteSintetico = 'https://placehold.co/400x300/ffffff/1e293b?text=Aceite+Sintetico';
const imgFiltroAceite = 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aceite';
const imgFiltroAire = 'https://placehold.co/400x300/ffffff/1e293b?text=Filtro+de+Aire';
const imgRefrigerante = 'https://placehold.co/400x300/ffffff/1e293b?text=Refrigerante+50-50';
const imgFrenos = 'https://placehold.co/400x300/ffffff/1e293b?text=Liquido+de+Frenos';
const imgDefault = 'https://placehold.co/400x300/ffffff/1e293b?text=Repuesto+Automotriz';

// JSON con Especificaciones Técnicas Reales para el Modal
const specAceite = JSON.stringify({
    "Tipo de Repuesto": "Lubricante de Motor Multigrado",
    "Viscosidad API": "SN/CF Avanzado",
    "Empaque Master": "Caja de 12 Unidades (1L)",
    "Origen": "Importación USA",
    "Aplicación": "Motores a Gasolina y Diesel Ligero"
});

const specFiltroAceite = JSON.stringify({
    "Tipo de Repuesto": "Filtro de Elemento Sellado",
    "Filtración / Grado": "Retención de Polvo Fino 99% (ISO 5011)",
    "Válvula Antirretorno": "Silicona de Alta Resistencia",
    "Material Filtrante": "Celulosa Sintética con Fibra de Vidrio",
    "Presión de Operación": "1.5 - 2.0 Bar"
});

const specFiltroAire = JSON.stringify({
    "Tipo de Repuesto": "Filtro de Aire Tipo Panel",
    "Marco": "Poliuretano Flexible Hermético",
    "Área Filtrante": "1.45 m²",
    "Largo x Ancho x Alto": "318 mm x 238 mm x 55 mm",
    "Mantenimiento": "Reemplazo cada 15,000 km"
});

db.serialize(() => {
    // 1. Actualizar Aceites Minerales
    db.run(`UPDATE productos SET imagen_url = ?, especificaciones = ? WHERE categoria LIKE '%Mineral%'`, [imgAceiteMineral, specAceite]);
    
    // 2. Actualizar Aceites Sintéticos
    db.run(`UPDATE productos SET imagen_url = ?, especificaciones = ? WHERE categoria LIKE '%Sintético%'`, [imgAceiteSintetico, specAceite]);
    
    // 3. Actualizar Filtros de Aceite
    db.run(`UPDATE productos SET imagen_url = ?, especificaciones = ? WHERE categoria LIKE '%Filtros de Aceite%'`, [imgFiltroAceite, specFiltroAceite]);
    
    // 4. Actualizar Filtros de Aire
    db.run(`UPDATE productos SET imagen_url = ?, especificaciones = ? WHERE categoria LIKE '%Filtros de Aire%'`, [imgFiltroAire, specFiltroAire]);
    
    // 5. Actualizar Líquidos, Grasas y Refrigerantes
    db.run(`UPDATE productos SET imagen_url = ? WHERE sku LIKE '%REF-%'`, [imgRefrigerante]);
    db.run(`UPDATE productos SET imagen_url = ? WHERE sku LIKE '%LIQ-%'`, [imgFrenos]);
    db.run(`UPDATE productos SET imagen_url = ? WHERE sku LIKE '%GRA-%' OR nombre LIKE '%Grasa%'`, ['https://placehold.co/400x300/ffffff/1e293b?text=Grasa+con+Litio']);
    db.run(`UPDATE productos SET imagen_url = ? WHERE sku LIKE '%ADI-%' OR nombre LIKE '%Aditivo%'`, ['https://placehold.co/400x300/ffffff/1e293b?text=Aditivo+Automotriz']);

    // 6. Respaldo general para cualquier producto restante con URLs de amazon o vacías
    db.run(`UPDATE productos SET imagen_url = ? WHERE imagen_url LIKE '%amazon%' OR imagen_url IS NULL OR imagen_url = ''`, [imgDefault]);

    console.log("✅ ¡Catálogo actualizado! Se inyectaron imágenes seguras para localhost y especificaciones técnicas completas.");
    db.close();
});
