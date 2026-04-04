let productMap = new Map();
let missingBarcodes = [];

// Fetch product data from local JSON
async function loadData() {
  try {
    const response = await fetch("egypt_supermarket_products_large.json");
    if (!response.ok) throw new Error("Failed to fetch data");
    const data = await response.json();

    // Create a fast-lookup map by barcode
    console.log("data.products", data.products);
    data.products.forEach((p) => {
      productMap.set(p.barcode, p);
    });

    console.log(`Database indexed: ${productMap.size} products.`);
  } catch (error) {
    console.error("Error loading product data:", error);
    alert(
      "Could not load product database. Please ensure you are running through a local web server.",
    );
  }
}

// Find product by barcode
async function findProduct(barcode) {
  const resultCard = document.getElementById("result-card");
  const notFound = document.getElementById("not-found");
  const loader = document.getElementById("loader");
  const sourceToggle = document.getElementById("source-toggle");

  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return;

  // Reset UI
  resultCard.classList.add("hidden");
  notFound.classList.add("hidden");
  
  if (sourceToggle.checked) {
    // API SEARCH
    loader.classList.remove("hidden");
    try {
      const response = await fetch(`http://localhost:3000/product/${cleanBarcode}`);
      const data = await response.json();
      
      loader.classList.add("hidden");
      if (data.found && data.product) {
        updateUIFromAPI(data.product);
        resultCard.classList.remove("hidden");
      } else {
        notFound.classList.remove("hidden");
        addToMissing(cleanBarcode);
      }
    } catch (error) {
      console.error("API Error:", error);
      loader.classList.add("hidden");
      alert("API server unreachable. Make sure it's running on port 3000.");
    }
  } else {
    // LOCAL SEARCH (Instant O(1))
    const product = productMap.get(cleanBarcode);

    if (product) {
      updateUI(product);
      resultCard.classList.remove("hidden");
    } else {
      notFound.classList.remove("hidden");
      addToMissing(cleanBarcode);
    }
  }
}

// Add to missing barcodes list
function addToMissing(barcode) {
  if (!missingBarcodes.includes(barcode)) {
    missingBarcodes.push(barcode);
    const missingSection = document.getElementById("missing-section");
    const missingList = document.getElementById("missing-list");

    missingSection.classList.remove("hidden");

    const item = document.createElement("div");
    item.className = "missing-item";
    item.textContent = barcode;
    missingList.appendChild(item);
  }
}


// Update UI with product details (Local JSON format)
function updateUI(product) {
  document.getElementById("prod-brand").textContent = product.brand;
  document.getElementById("prod-name-en").textContent = product.product_name.en;
  document.getElementById("prod-name-ar").textContent = product.product_name.ar;
  document.getElementById("prod-cat").textContent = product.category;
  document.getElementById("prod-size").textContent =
    `${product.size.value} ${product.size.unit}`;

  // Update price
  const priceEl = document.getElementById("prod-price");
  priceEl.textContent = product.price.toFixed(2);

  document.getElementById("prod-curr").textContent = product.currency;
  document.getElementById("prod-store").textContent =
    `${product.store.name} — ${product.store.city}`;
  
  // Ensure price section is visible
  document.querySelector('.price-section').classList.remove('hidden');
}

// Update UI from API structure (Open Food Facts)
function updateUIFromAPI(product) {
  document.getElementById("prod-brand").textContent = (product.brands && product.brands[0]) || "Unknown Brand";
  document.getElementById("prod-name-en").textContent = product.name || "Unknown Product";
  document.getElementById("prod-name-ar").textContent = ""; // Hide or clear Arabic for OFF results
  document.getElementById("prod-cat").textContent = (product.categories && product.categories[0]) || "General";
  document.getElementById("prod-size").textContent = product.quantity || "N/A";

  // Hide price section as OFF doesn't have local price data
  document.querySelector('.price-section').classList.add('hidden');
  document.getElementById("prod-store").textContent = "Open Food Facts (Live)";
}

// Scanner Success Callback
function onScanSuccess(decodedText, decodedResult) {
  console.log(`Barcode Detected: ${decodedText}`);
  document.getElementById("manual-input").value = decodedText;
  findProduct(decodedText);
}

// Initialize Scanner
const html5QrcodeScanner = new Html5QrcodeScanner(
  "reader",
  {
    fps: 10,
    qrbox: { width: 250, height: 150 },
    aspectRatio: 1.777778, // 16:9
  },
  /* verbose= */ false,
);

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  html5QrcodeScanner.render(onScanSuccess);

  const manualInput = document.getElementById("manual-input");
  const searchBtn = document.getElementById("search-btn");
  const copyBtn = document.getElementById("copy-missing-btn");

  const handleManualSearch = () => {
    findProduct(manualInput.value);
  };

  searchBtn.addEventListener("click", handleManualSearch);

  manualInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleManualSearch();
    }
  });

  copyBtn.addEventListener("click", () => {
    const textToCopy = missingBarcodes.join("\n");
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = originalText), 2000);
    });
  });
});
