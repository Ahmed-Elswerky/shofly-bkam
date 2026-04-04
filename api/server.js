const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const OFF_BASE = 'https://world.openfoodfacts.org';

function normalizeProduct(raw) {
  if (!raw) return null;
  return {
    barcode: raw.code || null,
    name: raw.product_name || raw.product_name_en || raw.generic_name || null,
    genericName: raw.generic_name || null,
    brands: raw.brands ? raw.brands.split(',').map(s => s.trim()).filter(Boolean) : [],
    categories: raw.categories ? raw.categories.split(',').map(s => s.trim()).filter(Boolean) : [],
    quantity: raw.quantity || null,
    image: raw.image_front_url || raw.image_url || null,
    ingredientsText: raw.ingredients_text || null,
    nutriments: raw.nutriments || {},
    countries: raw.countries || null,
    url: raw.url || `https://world.openfoodfacts.org/product/${raw.code}`
  };
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'egypt-product-lookup-demo/1.0 (contact: demo@example.com)'
    }
  });
  if (!res.ok) {
    throw new Error(`Upstream error ${res.status}`);
  }
  return res.json();
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'product-lookup', source: 'Open Food Facts' });
});

app.get('/product/:barcode', async (req, res) => {
  try {
    const barcode = String(req.params.barcode || '').replace(/\D/g, '');
    if (!barcode || barcode.length < 8) {
      return res.status(400).json({ error: 'Invalid barcode. Expected 8-14 digits.' });
    }

    const data = await getJson(`${OFF_BASE}/api/v0/product/${barcode}.json`);
    if (!data || data.status !== 1 || !data.product) {
      return res.status(404).json({ error: 'Product not found', barcode, source: 'Open Food Facts' });
    }

    return res.json({
      source: 'Open Food Facts',
      found: true,
      product: normalizeProduct(data.product)
    });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Lookup failed' });
  }
});

app.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(Number(req.query.pageSize || 10), 50);

    if (!q) {
      return res.status(400).json({ error: 'Missing q query parameter' });
    }

    const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page=${page}&page_size=${pageSize}`;
    const data = await getJson(url);
    const products = Array.isArray(data.products) ? data.products.map(normalizeProduct) : [];

    return res.json({
      source: 'Open Food Facts',
      found: products.length > 0,
      count: data.count || products.length,
      page,
      pageSize,
      products
    });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Search failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
