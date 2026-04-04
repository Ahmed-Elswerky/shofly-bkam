const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const OFF_BASE = "https://world.openfoodfacts.org";
const DB_PATH = path.join(__dirname, "egypt_supermarket_products_large.json");

let localDb = { products: [] };
if (fs.existsSync(DB_PATH)) {
  localDb = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function normalizeOffProduct(raw) {
  if (!raw) return null;
  return {
    source: "open_food_facts",
    barcode: raw.code || null,
    name: raw.product_name || raw.product_name_en || raw.generic_name || null,
    genericName: raw.generic_name || null,
    brands: raw.brands
      ? raw.brands
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    categories: raw.categories
      ? raw.categories
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    quantity: raw.quantity || null,
    image: raw.image_front_url || raw.image_url || null,
    ingredientsText: raw.ingredients_text || null,
    nutriments: raw.nutriments || {},
    countries: raw.countries || null,
    url: raw.url || `https://world.openfoodfacts.org/product/${raw.code}`,
  };
}

function normalizeLocalProduct(p) {
  return {
    source: "local_egypt_dataset",
    barcode: p.barcode || null,
    name: p.product_name?.en || null,
    name_ar: p.product_name?.ar || null,
    brand: p.brand || null,
    category: p.category || null,
    subcategory: p.subcategory || null,
    size: p.size || null,
    store: p.store || null,
    price: p.price || null,
    old_price: p.old_price ?? null,
    discount_percent: p.discount_percent ?? null,
    currency: p.currency || "EGP",
    availability: p.availability || null,
    tags: p.tags || [],
    last_updated: p.last_updated || null,
    source_url: p.source_url || null,
  };
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "egypt-kitchen-product-lookup/1.0 (contact: demo@example.com)",
    },
  });
  if (!res.ok) throw new Error(`Upstream error ${res.status}`);
  return res.json();
}

function localFindByBarcode(barcode) {
  const items = localDb.products || [];
  return items.find((p) => String(p.barcode || "") === String(barcode));
}

function localSearch(q) {
  const s = String(q || "")
    .trim()
    .toLowerCase();
  if (!s) return [];
  const items = localDb.products || [];
  return items
    .filter((p) => {
      const en = (p.product_name?.en || "").toLowerCase();
      const ar = (p.product_name?.ar || "").toLowerCase();
      const brand = (p.brand || "").toLowerCase();
      const tags = Array.isArray(p.tags) ? p.tags.join(" ").toLowerCase() : "";
      return (
        en.includes(s) ||
        ar.includes(s) ||
        brand.includes(s) ||
        tags.includes(s)
      );
    })
    .slice(0, 25);
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    localProducts: (localDb.products || []).length,
    sources: ["local_egypt_dataset", "open_food_facts"],
  });
});

app.get("/product/:barcode", async (req, res) => {
  try {
    const barcode = String(req.params.barcode || "").replace(/\D/g, "");
    if (!barcode || barcode.length < 6) {
      return res.status(400).json({ error: "Invalid barcode" });
    }

    const local = localFindByBarcode(barcode);
    if (local) {
      return res.json({
        found: true,
        source: "local_egypt_dataset",
        product: normalizeLocalProduct(local),
      });
    }

    try {
      const data = await getJson(`${OFF_BASE}/api/v0/product/${barcode}.json`);
      if (data && data.status === 1 && data.product) {
        return res.json({
          found: true,
          source: "open_food_facts",
          product: normalizeOffProduct(data.product),
        });
      }
    } catch (_) {}

    return res.status(404).json({
      found: false,
      barcode,
      error: "Product not found in local Egypt dataset or Open Food Facts",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Lookup failed" });
  }
});

app.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing q query parameter" });

    const localResults = localSearch(q).map(normalizeLocalProduct);
    if (localResults.length > 0) {
      return res.json({
        found: true,
        source: "local_egypt_dataset",
        count: localResults.length,
        products: localResults,
      });
    }

    const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page=1&page_size=20`;
    const data = await getJson(url);
    const products = Array.isArray(data.products)
      ? data.products.map(normalizeOffProduct)
      : [];
    return res.json({
      found: products.length > 0,
      source: "open_food_facts",
      count: products.length,
      products,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Search failed" });
  }
});

const serverless = require("serverless-http");

const PORT = process.env.PORT || 3000;

if (process.env.NETLIFY) {
  module.exports.handler = serverless(app);
} else {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
