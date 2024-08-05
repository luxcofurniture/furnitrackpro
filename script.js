// Global variables
let inventory = [];
let cart = [];
let addCart = [];
let isLoggedIn = false;

// Constants
const LOW_STOCK_THRESHOLD = 10;
const SHEET_URL = 'https://script.google.com/macros/s/AKfycby5QDc7cdJnJ7JS32BkqFrDnFQ_O6G5DlwaHMI2IPIdDY0wBtp9yG-0jkgtXvLAnjFf/exec';

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        await loadData();
        initializeCategoryTabs();
        initializeSupplierFilter();
        initializeModals();
        updateCartCount();
        updateAddCartCount();
        filterItems();

        // Event listeners
        document.getElementById('loginBtn').addEventListener('click', handleLogin);
        document.getElementById('searchInput').addEventListener('input', filterItems);
        document.getElementById('requestItemsBtn').addEventListener('click', showRequestModal);
        document.getElementById('addItemsBtn').addEventListener('click', showAddModal);
        document.getElementById('confirmRequest').addEventListener('click', confirmRequest);
        document.getElementById('confirmAdd').addEventListener('click', confirmAdd);
    } catch (error) {
        console.error('Error initializing app:', error);
        showAlert('Error initializing app. Please refresh the page and try again.', 'error');
    }
}

function handleLogin() {
    isLoggedIn = !isLoggedIn;
    document.getElementById('loginBtn').textContent = isLoggedIn ? 'Odjavi se' : 'Prijavi se';
    showAlert(isLoggedIn ? 'Uspješno ste se prijavili.' : 'Uspješno ste se odjavili.', 'success');
    updateUIForLoginState();
}

function updateUIForLoginState() {
    const addItemsBtn = document.getElementById('addItemsBtn');
    const requestItemsBtn = document.getElementById('requestItemsBtn');
    
    addItemsBtn.disabled = !isLoggedIn;
    requestItemsBtn.disabled = !isLoggedIn;
    
    document.querySelectorAll('.add-btn, .request-btn').forEach(btn => {
        btn.disabled = !isLoggedIn || parseInt(btn.dataset.quantity) === 0;
    });
}

async function loadData() {
    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data || !Array.isArray(data.inventory)) {
            throw new Error('Invalid data format received from server');
        }
        inventory = data.inventory;
        
        if (inventory.length === 0) {
            console.warn('Inventory is empty');
        }
        
        console.log('Inventory loaded:', inventory);
    } catch (error) {
        console.error('Error loading data:', error);
        showAlert('Error loading data. Please try again later.', 'error');
        inventory = [];
    }
}

function initializeCategoryTabs() {
    const categories = [...new Set(inventory.filter(item => item && item.Category).map(item => item.Category))];
    const categoryTabs = document.getElementById('categoryTabs');
    categoryTabs.innerHTML = `
        <button class="category-tab active" data-category="all">Sve vrste</button>
        ${categories.map(category => `
            <button class="category-tab" data-category="${category}">${category}</button>
        `).join('')}
    `;
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            filterItems();
        });
    });
}

function initializeSupplierFilter() {
    const suppliers = [...new Set(inventory.filter(item => item && item.Supplier).map(item => item.Supplier))];
    const supplierSelect = document.getElementById('supplierSelect');
    supplierSelect.innerHTML = `<option value="all">Svi Dobavljači</option>` +
        suppliers.map(supplier => `<option value="${supplier}">${supplier}</option>`).join('');
    supplierSelect.addEventListener('change', filterItems);
}

function filterItems() {
    const selectedCategory = document.querySelector('.category-tab.active').dataset.category;
    const selectedSupplier = document.getElementById('supplierSelect').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const filteredItems = inventory.filter(item => {
        if (!item) return false;
        
        const categoryMatch = selectedCategory === 'all' || (item.Category && item.Category === selectedCategory);
        const supplierMatch = selectedSupplier === 'all' || (item.Supplier && item.Supplier === selectedSupplier);
        const searchMatch = (item.Name && item.Name.toLowerCase().includes(searchTerm)) || 
                            (item.ID && item.ID.toString().includes(searchTerm));
        return categoryMatch && supplierMatch && searchMatch;
    });

    displayFilteredItems(filteredItems);
}

function displayFilteredItems(items) {
    const inventoryItems = document.getElementById('inventoryItems');
    if (items.length === 0) {
        inventoryItems.innerHTML = '<p>Nema pronađenih stavki.</p>';
        return;
    }

    inventoryItems.innerHTML = items.map(item => `
        <div class="item-card">
            ${getStockAlertHTML(item.Quantity)}
            <div class="item-name">${item.Name || 'Unnamed Item'}</div>
            <div class="item-details">
                <p><strong>Kategorija:</strong> ${item.Category || 'N/A'}</p>
                <p><strong>Dobavljač:</strong> ${item.Supplier || 'N/A'}</p>
                <p><strong>Količina:</strong> ${item.Quantity || 0}</p>
                <p><strong>Polica:</strong> ${item.Shelf || 'N/A'}</p>
            </div>
            <div class="item-actions">
                <div class="quantity-control">
                    <button class="quantity-btn minus" data-id="${item.ID}">-</button>
                    <input type="number" class="quantity-input" data-id="${item.ID}" value="1" min="1" max="${item.Quantity || 0}" readonly>
                    <button class="quantity-btn plus" data-id="${item.ID}">+</button>
                </div>
                <button class="action-btn add-btn" data-id="${item.ID}" data-quantity="${item.Quantity || 0}">Dodaj Stavku</button>
                <button class="action-btn request-btn" data-id="${item.ID}" data-quantity="${item.Quantity || 0}">Zahtijevaj Stavku</button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.add-btn').forEach(btn => btn.addEventListener('click', addToCart));
    document.querySelectorAll('.request-btn').forEach(btn => btn.addEventListener('click', requestItem));
    document.querySelectorAll('.quantity-btn').forEach(btn => btn.addEventListener('click', updateItemQuantity));
    updateUIForLoginState();
}

function getStockAlertHTML(quantity) {
    quantity = Number(quantity) || 0;
    if (quantity === 0) return '<div class="stock-alert out-of-stock">Nema na stanju</div>';
    if (quantity <= LOW_STOCK_THRESHOLD) return '<div class="stock-alert low-stock">Nisko stanje</div>';
    return '';
}

function updateItemQuantity(e) {
    const id = e.target.dataset.id;
    const quantityInput = e.target.parentElement.querySelector('.quantity-input');
    let quantity = parseInt(quantityInput.value);
    const inventoryItem = findInventoryItemById(id);

    if (e.target.classList.contains('minus')) {
        quantity = Math.max(1, quantity - 1);
    } else {
        quantity = Math.min(inventoryItem.Quantity, quantity + 1);
    }

    quantityInput.value = quantity;
}

function initializeModals() {
    const modals = ['requestModal', 'addModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });
}

function showRequestModal() {
    if (!isLoggedIn) {
        showAlert('Morate se prijaviti za zahtijevanje stavki.', 'error');
        return;
    }
    updateCartModal();
    document.getElementById('requestModal').style.display = 'block';
}

function showAddModal() {
    if (!isLoggedIn) {
        showAlert('Morate se prijaviti za dodavanje stavki.', 'error');
        return;
    }
    updateAddModal();
    document.getElementById('addModal').style.display = 'block';
}

function addToCart(e) {
    if (!isLoggedIn) {
        showAlert('Morate se prijaviti za dodavanje stavki.', 'error');
        return;
    }

    const id = e.target.dataset.id;
    const quantityInput = e.target.parentElement.querySelector('.quantity-input');
    const quantity = parseInt(quantityInput.value);
    const item = findInventoryItemById(id);

    if (!item) {
        showAlert('Stavka nije pronađena', 'error');
        return;
    }

    if (quantity > item.Quantity) {
        showAlert('Nema dovoljno zaliha', 'error');
        return;
    }

    const addCartItem = addCart.find(i => i.ID === id);
    if (addCartItem) {
        addCartItem.quantity += quantity;
    } else {
        addCart.push({ ...item, quantity });
    }

    updateAddCartCount();
    showAlert('Stavka dodana za dodavanje u inventar', 'success');
}

function requestItem(e) {
    if (!isLoggedIn) {
        showAlert('Morate se prijaviti za zahtijevanje stavki.', 'error');
        return;
    }

    const id = e.target.dataset.id;
    const quantityInput = e.target.parentElement.querySelector('.quantity-input');
    const quantity = parseInt(quantityInput.value);
    const item = findInventoryItemById(id);

    if (!item) {
        showAlert('Stavka nije pronađena', 'error');
        return;
    }

    if (quantity > item.Quantity) {
        showAlert('Nema dovoljno zaliha', 'error');
        return;
    }

    const cartItem = cart.find(i => i.ID === id);
    if (cartItem) {
        cartItem.quantity += quantity;
    } else {
        cart.push({ ...item, quantity });
    }

    updateCartCount();
    showAlert('Stavka dodana u košaricu za zahtjev', 'success');
}

function updateCartCount() {
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    document.getElementById('cartCount').textContent = cartCount;
}

function updateAddCartCount() {
    const addCartCount = addCart.reduce((acc, item) => acc + item.quantity, 0);
    document.getElementById('addCartCount').textContent = addCartCount;
}

function updateCartModal() {
    const cartItems = document.getElementById('cartItems');
    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-details">
                <span class="cart-item-name">${item.Name || 'Unnamed Item'}</span>
                <div class="cart-item-quantity">
                    <button class="quantity-btn minus" data-id="${item.ID}">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn plus" data-id="${item.ID}">+</button>
                </div>
            </div>
            <button class="remove-btn" data-id="${item.ID}">Ukloni</button>
        </div>
    `).join('');
    
    cartItems.querySelectorAll('.quantity-btn').forEach(btn => btn.addEventListener('click', updateCartItemQuantity));
    cartItems.querySelectorAll('.remove-btn').forEach(btn => btn.addEventListener('click', removeFromCart));

    const cartTotal = cart.reduce((acc, item) => acc + item.quantity, 0);
    document.getElementById('cartTotal').textContent = `Ukupno stavki: ${cartTotal}`;
}

function updateAddModal() {
    const addItems = document.getElementById('addItems');
    addItems.innerHTML = addCart.map(item => `
        <div class="cart-item">
            <div class="cart-item-details">
                <span class="cart-item-name">${item.Name || 'Unnamed Item'}</span>
                <div class="cart-item-quantity">
                    <button class="quantity-btn minus" data-id="${item.ID}">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn plus" data-id="${item.ID}">+</button>
                </div>
            </div>
            <button class="remove-btn" data-id="${item.ID}">Ukloni</button>
        </div>
    `).join('');
    
    addItems.querySelectorAll('.quantity-btn').forEach(btn => btn.addEventListener('click', updateAddCartItemQuantity));
    addItems.querySelectorAll('.remove-btn').forEach(btn => btn.addEventListener('click', removeFromAddCart));

    const addTotal = addCart.reduce((acc, item) => acc + item.quantity, 0);
    document.getElementById('addTotal').textContent = `Ukupno stavki za dodavanje: ${addTotal}`;
}

function updateCartItemQuantity(e) {
    const id = e.target.dataset.id;
    const item = cart.find(item => item.ID === id);
    const inventoryItem = findInventoryItemById(id);
    if (e.target.classList.contains('minus')) {
        if (item.quantity > 1) {
            item.quantity--;
        }
    } else {
        if (item.quantity < inventoryItem.Quantity) {
            item.quantity++;
        }
    }
    updateCartModal();
    updateCartCount();
}

function updateAddCartItemQuantity(e) {
    const id = e.target.dataset.id;
    const item = addCart.find(item => item.ID === id);
    if (e.target.classList.contains('minus')) {
        if (item.quantity > 1) {
            item.quantity--;
        }
    } else {
        item.quantity++;
    }
    updateAddModal();
    updateAddCartCount();
}

function removeFromCart(e) {
    const id = e.target.dataset.id;
    cart = cart.filter(item => item.ID !== id);
    updateCartModal();
    updateCartCount();
}

function removeFromAddCart(e) {
    const id = e.target.dataset.id;
    addCart = addCart.filter(item => item.ID !== id);
    updateAddModal();
    updateAddCartCount();
}

async function confirmRequest() {
    if (cart.length === 0) {
        showAlert('Vaša košarica je prazna', 'error');
        return;
    }

    const jobOrderNumber = document.getElementById('jobOrderNumber').value;
    if (!jobOrderNumber) {
        showAlert('Molimo unesite broj radnog naloga', 'error');
        return;
    }

    try {
        const updates = [];
        const logEntries = [];
        const timestamp = new Date().toISOString();

        cart.forEach((item) => {
            const inventoryItem = findInventoryItemById(item.ID);
            const newQuantity = inventoryItem.Quantity - item.quantity;
            
            if (newQuantity < 0) {
                throw new Error(`Nedovoljno zaliha za ${item.Name}`);
            }

            updates.push({ id: inventoryItem.ID, newQuantity });
            logEntries.push({
                Timestamp: timestamp,
                JobOrderNumber: jobOrderNumber,
                MaterialID: item.ID,
                RequestedQuantity: item.quantity,
                OldQuantity: inventoryItem.Quantity,
                NewQuantity: newQuantity
            });

            inventoryItem.Quantity = newQuantity;
        });

        await updateGoogleSheet('updateInventory', { updates });
        for (const logEntry of logEntries) {
            await updateGoogleSheet('requestLog', { logEntry });
        }

        showAlert(`Zahtjev potvrđen za radni nalog ${jobOrderNumber}`, 'success');
        document.getElementById('requestModal').style.display = 'none';
        cart = [];
        updateCartCount();
        filterItems();
    } catch (err) {
        console.error("Error confirming request:", err);
        showAlert(err.message || 'Greška pri potvrđivanju zahtjeva', 'error');
    }
}

async function confirmAdd() {
    if (addCart.length === 0) {
        showAlert('Vaša košarica za dodavanje je prazna', 'error');
        return;
    }

    try {
        const updates = [];
        const logEntries = [];
        const timestamp = new Date().toISOString();

        addCart.forEach((item) => {
            const inventoryItem = findInventoryItemById(item.ID);
            const newQuantity = inventoryItem.Quantity + item.quantity;

            updates.push({ id: inventoryItem.ID, newQuantity });
            logEntries.push({
                Timestamp: timestamp,
                MaterialID: item.ID,
                AddedQuantity: item.quantity,
                OldQuantity: inventoryItem.Quantity,
                NewQuantity: newQuantity
            });

            inventoryItem.Quantity = newQuantity;
        });

        await updateGoogleSheet('updateInventory', { updates });
        for (const logEntry of logEntries) {
            await updateGoogleSheet('addLog', { logEntry });
        }

        showAlert('Stavke uspješno dodane u inventar', 'success');
        document.getElementById('addModal').style.display = 'none';
        addCart = [];
        updateAddCartCount();
        filterItems();
    } catch (err) {
        console.error("Error confirming add:", err);
        showAlert('Greška pri dodavanju stavki', 'error');
    }
}

async function updateGoogleSheet(action, data) {
    try {
        const response = await fetch(SHEET_URL, {
            method: 'POST',
            mode: 'no-cors', // This allows the request to be sent without CORS headers
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, ...data }),
        });
        
        // Since 'no-cors' mode doesn't allow reading the response, we assume success if no error is thrown
        return { success: true, message: "Operation completed" };
    } catch (error) {
        console.error('Error updating Google Sheet:', error);
        throw error;
    }
}

function showAlert(message, type) {
    const alertBox = document.getElementById('alert');
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = 'block';
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 3000);
}

function findInventoryItemById(id) {
    return inventory.find(item => item.ID === id);
}

// Initialize the application
initializeApp();