// Cleaned and consolidated script: theme toggle, cart management, modal/payment handlers
// Theme Toggle
const themeToggle = document.getElementById('themetoggle');
const htmlElement = document.documentElement;

const currentTheme = localStorage.getItem('theme') || 'dark';
htmlElement.setAttribute('data-theme', currentTheme);
updateThemeButton(currentTheme);

function updateThemeButton(theme) {
    if (!themeToggle) return;
    themeToggle.textContent = theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
}

if (themeToggle) {
    themeToggle.addEventListener('click', function() {
        const current = htmlElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        htmlElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeButton(next);
    });
}

// Cart Functions
function getCart() {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
    updateCartCount();
}

function addToCart(productId, productName, productPrice) {
    const cart = getCart();
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) existingItem.quantity += 1;
    else cart.push({ id: productId, name: productName, price: Number(productPrice), quantity: 1 });
    saveCart(cart);
    showNotification(`${productName} added to cart!`);
}

function updateCartCount() {
    const cart = getCart();
    const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
    const el = document.getElementById('CartCount');
    if (el) {
        el.textContent = totalItems;
        // trigger bump animation
        el.classList.remove('bump');
        // force reflow to restart animation
        void el.offsetWidth;
        el.classList.add('bump');
        el.addEventListener('animationend', () => el.classList.remove('bump'), { once: true });
    }
}

function showNotification(message) {
    // create toast element with CSS animation
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // trigger show animation
    requestAnimationFrame(() => toast.classList.add('show'));

    // hide and remove after 2.5s
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 2500);
}

// Attach add-to-cart listeners (if any on the page)
document.querySelectorAll('.add-to-cart').forEach(button => {
    button.addEventListener('click', function() {
        const productId = this.getAttribute('data-product-id');
        const productName = this.getAttribute('data-product-name');
        const productPrice = this.getAttribute('data-product-price');
        addToCart(productId, productName, productPrice);
    });
});

// Animations
const style = document.createElement('style');
style.textContent = `@keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(400px);opacity:0}}`;
document.head.appendChild(style);

function renderCart() {
    const cart = getCart();
    const emptyCart = document.getElementById('emptyCart');
    const cartContent = document.getElementById('cartContent');
    const cartItemsList = document.getElementById('cartItemsList');

    // If we're not on the cart page, avoid manipulating missing DOM nodes.
    if (!cartItemsList || !cartContent || !emptyCart) {
        updateCartCount();
        return;
    }

    if (cart.length === 0) {
        emptyCart.style.display = 'block';
        cartContent.style.display = 'none';
        updateCartCount();
        return;
    }

    emptyCart.style.display = 'none';
    cartContent.style.display = 'block';
    cartItemsList.innerHTML = '';

    let subtotal = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="item-name">${item.name}</div>
            <div class="item-price">KSh ${parseInt(item.price).toLocaleString()}</div>
            <div class="item-quantity">
                <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="item-subtotal">KSh ${itemTotal.toLocaleString()}</span>
                <button class="remove-btn" onclick="removeItem('${item.id}')">Remove</button>
            </div>
        `;
        cartItemsList.appendChild(cartItem);
    });

    const shipping = subtotal > 0 ? 500 : 0;
    const total = subtotal + shipping;

    const subtotalEl = document.getElementById('subtotal');
    const shippingEl = document.getElementById('shipping');
    const totalEl = document.getElementById('total');
    if (subtotalEl) subtotalEl.textContent = subtotal.toLocaleString();
    if (shippingEl) shippingEl.textContent = shipping.toLocaleString();
    if (totalEl) totalEl.textContent = total.toLocaleString();
        }

        function updateQuantity(productId, change) {
            const cart = getCart();
            const item = cart.find(i => i.id == productId);
            
            if (item) {
                item.quantity += change;
                if (item.quantity <= 0) {
                    removeItem(productId);
                } else {
                    saveCart(cart);
                }
            }
        }

        function removeItem(productId) {
            const cart = getCart();
            const updatedCart = cart.filter(item => item.id != productId);
            saveCart(updatedCart);
        }

        function clearCart() {
            if (confirm('Are you sure you want to clear your entire cart?')) {
                localStorage.removeItem('cart');
                renderCart();
            }
        }

        function checkout() {
            const cart = getCart();
            if (cart.length === 0) {
                alert('Your cart is empty!');
                return;
            }
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 500;
            document.getElementById('modalTotal').textContent = total.toLocaleString();
            openCheckoutModal();
        }

        function openCheckoutModal() {
            document.getElementById('checkoutModal').classList.add('active');
        }

        function closeCheckoutModal() {
            document.getElementById('checkoutModal').classList.remove('active');
            document.getElementById('paymentForm').reset();
            clearFormErrors();
        }

        function clearFormErrors() {
            const phoneErr = document.getElementById('phoneError');
            const pinErr = document.getElementById('pinError');
            if (phoneErr) phoneErr.classList.remove('show');
            if (pinErr) pinErr.classList.remove('show');
        }

        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            const modal = document.getElementById('checkoutModal');
            if (event.target === modal) {
                closeCheckoutModal();
            }
        });

        // Handle payment form submission (only if form exists on page)
        const paymentForm = document.getElementById('paymentForm');
        if (paymentForm) {
            paymentForm.addEventListener('submit', function(e) {
                e.preventDefault();

                const phoneEl = document.getElementById('phoneNumber');
                const pinEl = document.getElementById('mpesaPin');
                const phone = phoneEl ? phoneEl.value.trim() : '';
                const pin = pinEl ? pinEl.value.trim() : '';
                let isValid = true;

                clearFormErrors();

                // Validate phone number (Kenyan format: +254XXXXXXXXX or 0XXXXXXXXX)
                const phoneRegex = /^(\+254|0)[0-9]{9}$/;
                if (!phoneRegex.test(phone)) {
                    const phoneErr = document.getElementById('phoneError');
                    if (phoneErr) phoneErr.classList.add('show');
                    isValid = false;
                }

                // Validate PIN (exactly 4 digits)
                if (pin.length !== 4 || !/^[0-9]{4}$/.test(pin)) {
                    const pinErr = document.getElementById('pinError');
                    if (pinErr) pinErr.classList.add('show');
                    isValid = false;
                }

                if (!isValid) return;

                // Process payment
                const cart = getCart();
                const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 500;

                const paymentData = {
                    phone: phone,
                    pin: '*'.repeat(pin.length),
                    amount: total,
                    timestamp: new Date().toISOString(),
                    items: cart
                };

                console.log('Payment initiated:', paymentData);

                // Show success message
                alert(`✅ Payment initiated!\nAmount: KSh ${total.toLocaleString()}\nPhone: ${phone}\n\nPlease complete the M-Pesa prompt on your phone.`);

                // Clear cart and close modal
                localStorage.removeItem('cart');
                closeCheckoutModal();
                renderCart();
            })
        }

        // Initialize cart on page load (only on cart page)
        if (document.getElementById('cartContent')) {
            renderCart();
        }
   