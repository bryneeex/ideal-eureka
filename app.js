// Product Data from Backend
let products = [];

// Fetch products from API
const fetchProducts = async () => {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (data.success) {
            products = data.products;
            renderProducts();
        }
    } catch (err) {
        console.error("Failed to fetch products:", err);
    }
};

let cart = [];
let currentCategory = 'all';
let searchQuery = '';
const TAX_RATE = 0.11; // 11% PPN

// DOM Elements
const productGrid = document.getElementById('product-grid');
const cartItemsContainer = document.getElementById('cart-items');
const subtotalEl = document.getElementById('subtotal');
const taxEl = document.getElementById('tax');
const totalEl = document.getElementById('total');
const categoryBtns = document.querySelectorAll('.category-btn');
const searchInput = document.getElementById('search-product');

// Utility: Format Currency to Rupiah
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(number);
};

// Render Products Grid
const renderProducts = () => {
    productGrid.innerHTML = '';
    
    const filteredProducts = products.filter(p => {
        const matchCategory = currentCategory === 'all' || p.category === currentCategory;
        const searchLower = searchQuery.toLowerCase();
        const matchSearch = p.name.toLowerCase().includes(searchLower) || p.sku.toLowerCase().includes(searchLower);
        return matchCategory && matchSearch;
    });

    if (filteredProducts.length === 0) {
        productGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 60px 20px; color: var(--text-secondary);">
                <i class="fa-solid fa-box-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>Tidak ada produk yang sesuai dengan pencarian Anda.</p>
            </div>
        `;
        return;
    }

    filteredProducts.forEach(product => {
        const isLowStock = product.stock <= 10;
        const stockText = product.stock === 0 ? 'Habis' : `Sisa ${product.stock}`;
        const stockClass = isLowStock ? 'stock-low' : '';
        const opacityClass = product.stock === 0 ? 'style="opacity: 0.5; pointer-events: none;"' : '';
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image_url}" alt="${product.name}" class="product-image">
            <span class="product-stock ${stockClass}">${stockText}</span>
            <div class="product-info">
                <h3>${product.name}</h3>
                <span style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; display: block;">SKU: ${product.sku}</span>
                <span class="product-price">${formatRupiah(product.price)}</span>
            </div>
        `;
        
        if (product.stock > 0) {
            card.onclick = () => addToCart(product.id);
        } else {
            card.style.opacity = '0.6';
            card.style.cursor = 'not-allowed';
        }
        
        productGrid.appendChild(card);
    });
};

// Cart Functions
const addToCart = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (product.stock <= 0) {
        alert('Maaf, stok produk ini telah habis!');
        return;
    }

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        if(existingItem.qty >= product.stock) {
            alert('Tidak bisa menambah lebih dari stok yang tersedia!');
            return;
        }
        existingItem.qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    
    renderCart();
};

const updateQty = (productId, delta) => {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    const product = products.find(p => p.id === productId);
    
    if (delta > 0 && item.qty >= product.stock) {
        alert('Tidak bisa melebihi stok yang tersedia!');
        return;
    }

    item.qty += delta;
    if (item.qty <= 0) {
        cart = cart.filter(i => i.id !== productId);
    }
    
    renderCart();
};

const removeFromCart = (productId) => {
    cart = cart.filter(i => i.id !== productId);
    renderCart();
};

const renderCart = () => {
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>Keranjang masih kosong</p>
                <span style="font-size: 13px; color: var(--text-secondary);">Silakan pilih produk dari menu</span>
            </div>
        `;
        updateSummary();
        return;
    }

    cartItemsContainer.innerHTML = '';
    cart.forEach(item => {
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <img src="${item.image_url}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <div class="cart-item-price">${formatRupiah(item.price)}</div>
            </div>
            <div class="cart-item-controls">
                <button class="btn-remove" onclick="removeFromCart(${item.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty(${item.id}, -1)"><i class="fa-solid fa-minus"></i></button>
                    <span class="qty-val">${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty(${item.id}, 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(el);
    });

    // Auto scroll to bottom of cart when new item added
    cartItemsContainer.scrollTop = cartItemsContainer.scrollHeight;
    
    updateSummary();
};

const updateSummary = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    subtotalEl.textContent = formatRupiah(subtotal);
    taxEl.textContent = formatRupiah(tax);
    totalEl.textContent = formatRupiah(total);
};

// Event Listeners for Filters
categoryBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.dataset.category;
        renderProducts();
    });
});

searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderProducts();
});

// ---------------- Payment Modal Logic ----------------

// Inject Payment Modal HTML into Body
document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay" id="payment-modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2>Selesaikan Pembayaran</h2>
            <button class="close-modal" id="close-modal"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <p style="margin-bottom: 12px; font-weight: 500; color: var(--text-secondary);">Metode Pembayaran</p>
        <div class="payment-methods">
            <div class="method-btn active" data-method="tunai">
                <i class="fa-solid fa-money-bill-wave"></i>
                <span>Tunai</span>
            </div>
            <div class="method-btn" data-method="kartu">
                <i class="fa-regular fa-credit-card"></i>
                <span>Debit/Kredit</span>
            </div>
            <div class="method-btn" data-method="qris">
                <i class="fa-solid fa-qrcode"></i>
                <span>QRIS</span>
            </div>
        </div>
        
        <div class="payment-details" id="payment-details">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <p style="color: var(--text-secondary); font-size: 16px;">Total Tagihan:</p>
                <h1 style="color: var(--accent); font-size: 32px;" id="modal-total">Rp 0</h1>
            </div>
            
            <div id="cash-input-section">
                <p style="margin-bottom: 12px; color: var(--text-secondary);">Jumlah Diterima (Tunai):</p>
                <input type="text" class="amount-input" id="amount-received" placeholder="Rp 0">
                
                <div class="quick-amounts" id="quick-amounts">
                    <!-- Quick amounts injected dynamically -->
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
                    <p style="color: var(--text-secondary); font-size: 16px;">Kembalian:</p>
                    <h2 style="color: var(--success); font-size: 24px;" id="modal-change">Rp 0</h2>
                </div>
            </div>
            
            <div id="non-cash-section" style="display: none; text-align: center; padding: 20px 0;">
                <i class="fa-solid fa-mobile-screen-button" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 16px;"></i>
                <p>Silakan arahkan pelanggan untuk melakukan pembayaran melalui mesin EDC atau scan kode QR.</p>
            </div>
        </div>
        
        <button class="btn-primary" style="width: 100%; font-size: 18px; padding: 20px;" id="confirm-payment">
            <i class="fa-solid fa-check-circle"></i> Konfirmasi & Cetak Struk
        </button>
    </div>
</div>
`);

const btnPay = document.getElementById('btn-pay');
const modalOverlay = document.getElementById('payment-modal');
const closeModal = document.getElementById('close-modal');
const modalTotal = document.getElementById('modal-total');
const methodBtns = document.querySelectorAll('.method-btn');
const cashInputSection = document.getElementById('cash-input-section');
const nonCashSection = document.getElementById('non-cash-section');
const amountReceivedInput = document.getElementById('amount-received');
const modalChange = document.getElementById('modal-change');
const quickAmountsContainer = document.getElementById('quick-amounts');
const confirmPaymentBtn = document.getElementById('confirm-payment');

let currentTotal = 0;
let paymentMethod = 'tunai';

// Show Modal
btnPay.addEventListener('click', () => {
    if (cart.length === 0) {
        alert('Keranjang masih kosong! Silakan tambahkan produk terlebih dahulu.');
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    currentTotal = subtotal + (subtotal * TAX_RATE);
    
    modalTotal.textContent = formatRupiah(currentTotal);
    amountReceivedInput.value = '';
    modalChange.textContent = 'Rp 0';
    
    // Generate quick amounts based on total
    generateQuickAmounts(currentTotal);
    
    modalOverlay.classList.add('active');
    
    if (paymentMethod === 'tunai') {
        setTimeout(() => amountReceivedInput.focus(), 100);
    }
});

// Close Modal
closeModal.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});

// Payment Method Switch
methodBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        methodBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        paymentMethod = btn.dataset.method;
        
        if (paymentMethod === 'tunai') {
            cashInputSection.style.display = 'block';
            nonCashSection.style.display = 'none';
        } else {
            cashInputSection.style.display = 'none';
            nonCashSection.style.display = 'block';
        }
    });
});

// Dynamic Quick Amounts Generator
const generateQuickAmounts = (total) => {
    quickAmountsContainer.innerHTML = '';
    
    // Exact amount
    const exactBtn = document.createElement('button');
    exactBtn.className = 'quick-amount-btn';
    exactBtn.textContent = 'Uang Pas';
    exactBtn.onclick = () => setAmountReceived(total);
    quickAmountsContainer.appendChild(exactBtn);
    
    // Generate rounded amounts (e.g. 50k, 100k)
    const bases = [50000, 100000, 150000, 200000];
    bases.forEach(base => {
        if (base > total && base < total + 100000) {
            const btn = document.createElement('button');
            btn.className = 'quick-amount-btn';
            btn.textContent = formatRupiah(base).replace(',00', '');
            btn.onclick = () => setAmountReceived(base);
            quickAmountsContainer.appendChild(btn);
        }
    });
};

const setAmountReceived = (amount) => {
    amountReceivedInput.value = amount.toLocaleString('id-ID');
    calculateChange(amount);
};

amountReceivedInput.addEventListener('input', (e) => {
    // Remove non-numeric chars
    let val = e.target.value.replace(/\D/g, '');
    if (val) {
        e.target.value = parseInt(val).toLocaleString('id-ID');
        calculateChange(parseInt(val));
    } else {
        e.target.value = '';
        modalChange.textContent = 'Rp 0';
    }
});

const calculateChange = (received) => {
    const change = received - currentTotal;
    if (change >= 0) {
        modalChange.textContent = formatRupiah(change);
        modalChange.style.color = 'var(--success)';
    } else {
        modalChange.textContent = 'Kurang: ' + formatRupiah(Math.abs(change));
        modalChange.style.color = 'var(--danger)';
    }
};

// Confirm Payment (API Integration)
confirmPaymentBtn.addEventListener('click', async () => {
    if (paymentMethod === 'tunai') {
        const received = parseInt(amountReceivedInput.value.replace(/\D/g, '')) || 0;
        if (received < currentTotal) {
            alert('Jumlah uang yang diterima kurang dari total tagihan!');
            return;
        }
    }
    
    const originalText = confirmPaymentBtn.innerHTML;
    confirmPaymentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    confirmPaymentBtn.disabled = true;
    
    try {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const tax = subtotal * TAX_RATE;
        const received = paymentMethod === 'tunai' ? (parseInt(amountReceivedInput.value.replace(/\D/g, '')) || 0) : currentTotal;
        const change = received - currentTotal;

        const orderData = {
            cart: cart,
            subtotal: subtotal,
            tax: tax,
            total: currentTotal,
            paymentMethod: paymentMethod,
            amountReceived: received,
            change: change
        };

        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const data = await res.json();

        if (data.success) {
            alert(`Transaksi Berhasil!\nNomor Order: ${data.orderNumber}`);
            
            // Reset Cart & UI
            cart = [];
            renderCart();
            
            // Refetch products to get updated stock
            await fetchProducts();
            
            modalOverlay.classList.remove('active');
        } else {
            alert('Gagal memproses transaksi: ' + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan jaringan.');
    } finally {
        confirmPaymentBtn.innerHTML = originalText;
        confirmPaymentBtn.disabled = false;
    }
});

// ---------------- Inventory & Reports Logic ----------------

const renderInventory = () => {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    products.forEach(p => {
        let badgeClass = '';
        let stockText = p.stock;
        if (p.stock === 0) { badgeClass = 'empty'; stockText = 'Habis'; }
        else if (p.stock <= 10) { badgeClass = 'low'; }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: monospace; color: var(--text-secondary);">${p.sku}</td>
            <td style="font-weight: 600;">${p.name}</td>
            <td style="color: var(--accent);">${formatRupiah(p.price)}</td>
            <td><span class="stock-badge ${badgeClass}">${stockText}</span></td>
            <td>
                <div class="inv-controls">
                    <button class="inv-btn minus" onclick="updateStockAPI(${p.id}, -1)"><i class="fa-solid fa-minus"></i></button>
                    <button class="inv-btn plus" onclick="updateStockAPI(${p.id}, 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.updateStockAPI = async (productId, quantityChange) => {
    try {
        const res = await fetch(`/api/products/${productId}/stock`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: quantityChange })
        });
        
        const data = await res.json();
        if (data.success) {
            // Refetch to get updated list
            await fetchProducts();
            // Re-render inventory since we are currently on that tab
            renderInventory();
        } else {
            alert(data.message || 'Gagal mengubah stok');
        }
    } catch (err) {
        console.error(err);
        alert('Kesalahan jaringan');
    }
};

window.fetchReports = async () => {
    try {
        const res = await fetch('/api/reports/today');
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('report-revenue').textContent = formatRupiah(data.report.total_revenue || 0);
            document.getElementById('report-orders').textContent = data.report.total_orders || 0;
        }
    } catch (err) {
        console.error(err);
    }
};

// ---------------- Product Management Logic ----------------

const renderProductManagement = () => {
    const tbody = document.getElementById('management-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    products.forEach(p => {
        const tr = document.createElement('tr');
        const imgUrl = p.image_url || 'https://via.placeholder.com/50';
        tr.innerHTML = `
            <td><img src="${imgUrl}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;"></td>
            <td style="font-family: monospace; color: var(--text-secondary);">${p.sku}</td>
            <td>
                <div style="font-weight: 600;">${p.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary); text-transform: capitalize;">${p.category}</div>
            </td>
            <td style="color: var(--accent);">${formatRupiah(p.price)}</td>
            <td style="text-align: center;">
                <button class="btn-remove" onclick="deleteProductAPI(${p.id}, '${p.name}')" style="margin: 0 auto; display: block;">
                    <i class="fa-solid fa-trash"></i> Hapus
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.deleteProductAPI = async (id, name) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus produk "${name}"? Data yang dihapus tidak bisa dikembalikan.`)) return;

    try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            await fetchProducts();
            renderProductManagement();
        } else {
            alert(data.message || 'Gagal menghapus produk');
        }
    } catch (err) {
        console.error(err);
        alert('Kesalahan jaringan');
    }
};

document.getElementById('newProductForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newProduct = {
        sku: document.getElementById('new-sku').value,
        name: document.getElementById('new-name').value,
        category: document.getElementById('new-category').value,
        price: parseInt(document.getElementById('new-price').value),
        stock: parseInt(document.getElementById('new-stock').value),
        image_url: document.getElementById('new-image').value
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct)
        });
        
        const data = await res.json();
        if (data.success) {
            alert('Produk berhasil ditambahkan!');
            document.getElementById('newProductForm').reset();
            document.getElementById('add-product-form').style.display = 'none';
            await fetchProducts();
            renderProductManagement();
        } else {
            alert(data.message || 'Gagal menambahkan produk');
        }
    } catch (err) {
        console.error(err);
        alert('Kesalahan jaringan');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// ---------------- Navigation Logic ----------------
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        viewSections.forEach(section => section.classList.remove('active'));
        
        const target = item.dataset.target;
        const targetId = target + '-view';
        const targetSection = document.getElementById(targetId);
        
        if (targetSection) {
            targetSection.classList.add('active');
            
            // Trigger specific renders based on tab
            if (target === 'inventory') {
                renderInventory();
            } else if (target === 'reports') {
                fetchReports();
            } else if (target === 'settings') {
                renderProductManagement();
            }
        }
    });
});

// Init App
fetchProducts();
renderCart();
