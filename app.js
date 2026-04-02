let products = [];

// Fetch product data from local JSON
async function loadData() {
    try {
        const response = await fetch('egypt_supermarket_products_large.json');
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        products = data.products;
        console.log(`Database loaded: ${products.length} products.`);
    } catch (error) {
        console.error('Error loading product data:', error);
        alert('Could not load product database. Please ensure you are running through a local web server.');
    }
}

// Find product by barcode
function findProduct(barcode) {
    // Reset UI
    const resultCard = document.getElementById('result-card');
    const notFound = document.getElementById('not-found');
    
    resultCard.classList.add('hidden');
    notFound.classList.add('hidden');

    // Clean barcode input
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;

    const product = products.find(p => p.barcode === cleanBarcode);
    
    if (product) {
        updateUI(product);
        resultCard.classList.remove('hidden');
    } else {
        notFound.classList.remove('hidden');
    }
}

// Update UI with product details
function updateUI(product) {
    document.getElementById('prod-brand').textContent = product.brand;
    document.getElementById('prod-name-en').textContent = product.product_name.en;
    document.getElementById('prod-name-ar').textContent = product.product_name.ar;
    document.getElementById('prod-cat').textContent = product.category;
    document.getElementById('prod-size').textContent = `${product.size.value} ${product.size.unit}`;
    
    // Animate price change
    const priceEl = document.getElementById('prod-price');
    priceEl.textContent = product.price.toFixed(2);
    
    document.getElementById('prod-curr').textContent = product.currency;
    document.getElementById('prod-store').textContent = `${product.store.name} — ${product.store.city}`;
}

// Scanner Success Callback
function onScanSuccess(decodedText, decodedResult) {
    // Optional: Stop scanning if needed, but for "light website" we keep it active
    console.log(`Barcode Detected: ${decodedText}`);
    
    // Update manual input field for feedback
    document.getElementById('manual-input').value = decodedText;
    
    findProduct(decodedText);
}

// Initialize Scanner
const html5QrcodeScanner = new Html5QrcodeScanner(
    "reader", 
    { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777778 // 16:9
    },
    /* verbose= */ false
);

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    html5QrcodeScanner.render(onScanSuccess);

    const manualInput = document.getElementById('manual-input');
    const searchBtn = document.getElementById('search-btn');

    const handleManualSearch = () => {
        findProduct(manualInput.value);
    };

    searchBtn.addEventListener('click', handleManualSearch);
    
    manualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleManualSearch();
        }
    });
});
