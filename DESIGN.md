# GOLDEN ERP - Stitch B2B Industrial Design Specification
> **Stitch Project Specification (`DESIGN.md`) for [stitch.withgoogle.com](https://stitch.withgoogle.com/)**  
> System: B2B Enterprise ERP & Automotive Spare Parts Supply Suite

---

## 1. Project Overview
- **Project Name:** GOLDEN ERP - Enterprise Suite
- **Application Type:** Web Application (Desktop & Mobile Responsive)
- **Industry / Domain:** B2B Automotive Distribution (Lubricants, Filters, Fleet Maintenance)
- **Target Audience:** Mechanical Workshops, Fleet Managers, Lubricenters, Regional Warehouses
- **Design Philosophy:** Stitch High-Contrast Industrial (Anti-AI appearance, zero glowing neons, straight borders, readable data-dense UI)

---

## 2. Design Tokens & Color Palette

| Token Name | Hex Code | Tailwind / Role | Usage |
| :--- | :--- | :--- | :--- |
| `--stitch-bg-body` | `#F1F5F9` | `slate-100` | Main canvas background. No diffuse or dark gradient effects. |
| `--stitch-surface` | `#FFFFFF` | `white` | Cards, modals, offcanvas panels, tables, and dropdowns. |
| `--stitch-surface-subtle`| `#F8FAFC` | `slate-50` | Table headers, secondary buttons, item cards, neutral badges. |
| `--stitch-border` | `#CBD5E1` | `slate-300` | Standard 1px solid structural border. |
| `--stitch-border-dark` | `#94A3B8` | `slate-400` | Secondary button borders, active dividers. |
| `--stitch-navbar-bg` | `#0F172A` | `slate-900` | Sticky top navbar header, dark table theads. |
| `--stitch-navbar-border`| `#D97706` | `amber-600` | 2px solid bottom accent on top navbar. |
| `--stitch-primary` | `#D97706` | `amber-600` | Primary action buttons, badges, key accents. |
| `--stitch-primary-hover`| `#B45309` | `amber-700` | Hover state for primary buttons. |
| `--stitch-emerald` | `#059669` | `emerald-600` | Price indicators (Bs.), success confirmations, optimal stock. |
| `--stitch-ruby` | `#DC2626` | `red-600` | Wholesale discount badge (-15% DTO), out-of-stock, logout. |
| `--stitch-text-main` | `#0F172A` | `slate-900` | Main headings, primary table cell text, strong titles. |
| `--stitch-text-muted` | `#64748B` | `slate-500` | Subtitles, helper text, table column hints. |

---

## 3. Typography Architecture

### Primary UI Font: `Plus Jakarta Sans`
- **Weights:** Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800).
- **Application:** General user interface, navigation items, modal titles, button labels, and descriptions.

### Technical Data Font: `JetBrains Mono`
- **Weights:** Regular (400), Medium (500), Bold (700).
- **Application:**
  - SKU Codes (`REF-VER-023-4L`, `ACE-SIN-006-20L`, `FIL-ACE-011-PK6`)
  - Monetary values in Bolivianos (`Bs. 280.00`)
  - Stock levels and inventory numbers
  - Barcode UPC / EAN-13 numbers
  - Tax NIT and telephone numbers

---

## 4. Geometric & Anti-AI Rules
1. **Straight Borders:** Strict `border-radius: 6px` for cards, modals, inputs, and buttons. Small badges use `border-radius: 4px`.
2. **No Pills:** Strict prohibition of full-pill `border-radius: 999px`.
3. **No Neon Glow:** No fuzzy radial box-shadows or neon gradients. Standard shadow: `0 1px 3px rgba(15, 23, 42, 0.08)`.
4. **No Decorative Emojis:** Replace all emoji embellishments with official monochrome or duotone Bootstrap Icons (`bi-tag`, `bi-shield-check`, `bi-search`, `bi-box-seam`, `bi-car-front`).
5. **Compact Toasts:** Flat white card with `#CBD5E1` border and 2.5s duration.

---

## 5. Core Screen Components

### Component 1: Sticky Industrial Header (`#menu-contenedor`)
- **Structure:** Sticky top (`position: sticky; top: 0; z-index: 1000`), height ~60px.
- **Background:** `#0F172A` with `border-bottom: 2px solid #D97706`.
- **Elements:**
  - Brand Logo: Industrial shield icon in amber, "GOLDEN ERP - ENTERPRISE SUITE" in white.
  - Navigation Links (RBAC-aware): Catálogo B2B, Dashboard, Inventario, Logística, Cobranzas, Auditoría.
  - Role-based Actions: Stock alert bell (Admin/Almacén only), User status badge, Order Cart button with counter badge, Logout button.

### Component 2: Product Card with Interactive Presentations (`.card-producto-wix`)
- **Surface:** `#FFFFFF` with `1px solid #CBD5E1`, `border-radius: 6px`.
- **Image Showcase:** High-contrast pure white wrapper, height 170px, containing centered product bottle or filter pack.
- **Volume / Sub-Class Presentation Selector:**
  - *Oils & Coolants:* `1L` (Base), `4L` (Galón, 3.75x factor), `20L` (Balde, 17.5x factor).
  - *Brake Fluids & Greases:* `500ml / 1Kg` (Base), `Caja x12` (10.8x factor).
  - *Filters & Additives:* `Unidad` (Base), `Pack x6` (5.4x factor).
- **Vehicle Compatibility Summary Box (`.compatibilidad-box`):**
  - Background `#F8FAFC`, border `1px solid #E2E8F0`.
  - Common Bolivian vehicle fleet matches: Toyota (Hilux, Corolla, Hiace, Probox), Nissan (Frontier, Versa), Suzuki (Vitara, Swift), VW (Gol).
  - Recommended mileage badge: `5.000 km` (Mineral) / `10.000 km` (Synthetic).
- **Price Block:**
  - Strikethrough original price in `#64748B`.
  - Final price in large font `#059669` (Emerald).
  - Primary button: `#D97706` "Añadir a la Orden".

### Component 3: Real-Time Search Bar (`.search-bar-catalogo`)
- **Structure:** Input group with white surface, border `#CBD5E1`, `border-radius: 6px`.
- **Search Scope:** Instant real-time filtering across SKU, product title, category, presentation volume (1L, 4L, 20L), and vehicle fleet models.

### Component 4: Floating B2B Receipt Offcanvas (`#carritoLateral`)
- **Surface:** White body with `#0F172A` header and `2px solid #D97706` border.
- **Items:** Item cards displaying presentation name, quantity adjusters (+/-), unit price, subtotal.
- **Checkout:** Atomic transaction button confirming SQLite inventory decrement and opening QR payment gateway.

### Component 5: Technical Specification Modal (`#modalFichaTecnica`)
- **Header:** `#0F172A` with white typography and certification badges.
- **Two-Column Layout:**
  - *Col 1:* High-resolution product image, presentation selector, unit price, quantity picker, order button.
  - *Col 2:* Technical specs table (SAE viscosity, API classification, fuel compatibility, packaging dimensions) and barcode visualizer.
- **Bottom Tabs:**
  - *Tab 1:* Bolivian vehicle fleet compatibility matrix.
  - *Tab 2:* OEM cross-reference equivalencies (WIX, MANN-FILTER, Toyota OEM).

---

## 6. Project Routes & Templates

| Route / File | Title | Module Description |
| :--- | :--- | :--- |
| `tienda.html` | Catálogo Oficial & Ventas B2B | Multi-presentation catalog with vehicle compatibility & order cart. |
| `dashboard.html` | Analítica y Monetización | Executive KPIs, revenue stats, top-selling parts charts. |
| `inventario.html` | Control Físico de Inventario | Physical warehouse catalog, stock alert levels, Kardex audit modal. |
| `logistica.html` | Distribución y Despachos | Delivery routes, order status transitions (Por Preparar, En Camino, Entregado). |
| `facturacion.html` | Cobranza y Facturación | Commercial invoices, collection tracking, PDF Carta/A4 generation. |
| `creditos.html` | Créditos B2B y Cartera | Client credit lines, outstanding debt balances, debt amortization ledger. |
| `auditoria.html` | Seguridad y Trazabilidad | Immutable transactional audit logs, user actions, system security. |

---

## 7. How to Import into Stitch (stitch.withgoogle.com)
1. Go to [stitch.withgoogle.com](https://stitch.withgoogle.com/) and sign in with your Google account.
2. Create a **New Project** and choose **Website Layout**.
3. Import or supply this `DESIGN.md` file as the system design specification.
4. Reference the main template `public/tienda.html` and stylesheet `public/styles.css` to render interactive prototype canvases.
