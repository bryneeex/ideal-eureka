const express = require('express');
const cors = require('cors');
const pool = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Discord Webhook URL
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1500836394602332244/OZEjil1yUPySeyS_q0Tx3qKoE_2UFOwycesIXH4PdaC6DU7T6hoDEsJRePIYVFcJ1oKL';

// Google Sheets Webhook URL
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyO6L7YDKhzXMmZallonSp_iSP5yCPgovGq1Rvu0DvAOoVSgyJ2ab-2Nvno2LrkPeYM/exec';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- API ENDPOINTS ---

// 1. Auth: Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    try {
        const result = await pool.query(
            "SELECT id, username, role FROM users WHERE username = $1 AND password = $2",
            [username, password]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 2. Products: Get all
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY id ASC");
        res.json({ success: true, products: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 3. Orders: Create order and deduct stock
app.post('/api/orders', async (req, res) => {
    const { cart, subtotal, tax, total, paymentMethod, amountReceived, change } = req.body;

    if (!cart || cart.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const orderNumber = 'ORD-' + Date.now();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Insert order
        const orderResult = await client.query(
            `INSERT INTO orders (order_number, subtotal, tax, total, payment_method, amount_received, change)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [orderNumber, subtotal, tax, total, paymentMethod, amountReceived, change]
        );
        const orderId = orderResult.rows[0].id;

        // Insert items & deduct stock
        for (const item of cart) {
            await client.query(
                "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)",
                [orderId, item.id, item.qty, item.price]
            );
            const stockResult = await client.query(
                "UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id",
                [item.qty, item.id]
            );
            if (stockResult.rowCount === 0) {
                throw new Error('Stok tidak mencukupi untuk produk: ' + item.name);
            }
        }

        await client.query('COMMIT');

        // Send Google Sheets Log
        if (GOOGLE_SHEETS_URL) {
            const sheetData = {
                waktu: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
                orderNumber: orderNumber,
                items: cart.map(item => `${item.qty}x ${item.name}`).join(', '),
                metode: paymentMethod.toUpperCase(),
                total: 'Rp ' + total.toLocaleString('id-ID'),
                kasir: 'Muhammad Fardhan Ilmansyah'
            };
            fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sheetData)
            }).catch(err => console.error('Google Sheets Error:', err));
        }

        // Send Discord Webhook
        if (DISCORD_WEBHOOK_URL) {
            const itemsList = cart.map(item => `- ${item.qty}x **${item.name}** (Rp ${item.price.toLocaleString('id-ID')})`).join('\n');
            const webhookBody = {
                username: "tantingmur Cafe POS",
                avatar_url: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                embeds: [{
                    title: "🧾 Pesanan Baru Diterima!",
                    color: 12730636,
                    fields: [
                        { name: "Nomor Order", value: "```" + orderNumber + "```", inline: true },
                        { name: "Metode Pembayaran", value: paymentMethod.toUpperCase(), inline: true },
                        { name: "Total Pembayaran", value: "**Rp " + total.toLocaleString('id-ID') + "**", inline: false },
                        { name: "Daftar Pesanan", value: itemsList || "Tidak ada item", inline: false }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: "Kasir: Muhammad Fardhan Ilmansyah" }
                }]
            };
            fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookBody)
            }).catch(err => console.error("Discord Webhook Error:", err));
        }

        res.json({ success: true, orderId, orderNumber });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ success: false, message: err.message || 'Transaction failed' });
    } finally {
        client.release();
    }
});

// 4. Products: Update Stock
app.put('/api/products/:id/stock', async (req, res) => {
    const productId = req.params.id;
    const { quantity } = req.body;

    if (quantity === undefined || isNaN(quantity)) {
        return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }

    try {
        const result = await pool.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2 RETURNING id",
            [quantity, productId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, message: 'Stock updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 5. Reports: Get today's summary
app.get('/api/reports/today', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(id) as total_orders,
                COALESCE(SUM(total), 0) as total_revenue
            FROM orders
            WHERE created_at::date = CURRENT_DATE AT TIME ZONE 'Asia/Jakarta'
        `);
        res.json({ success: true, report: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 6. Products: Add new product
app.post('/api/products', async (req, res) => {
    const { sku, name, category, price, stock, image_url } = req.body;

    if (!sku || !name || !category || price === undefined || stock === undefined) {
        return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi!' });
    }

    try {
        const result = await pool.query(
            "INSERT INTO products (sku, name, category, price, stock, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [sku, name, category, price, stock, image_url || '']
        );
        res.json({ success: true, message: 'Produk berhasil ditambahkan', id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'SKU sudah digunakan!' });
        }
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 7. Products: Delete product
app.delete('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        await pool.query("DELETE FROM products WHERE id = $1", [productId]);
        res.json({ success: true, message: 'Produk berhasil dihapus' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
