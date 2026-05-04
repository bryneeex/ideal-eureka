const { Pool } = require('pg');

// Connect to PostgreSQL via DATABASE_URL environment variable (provided by Railway)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

async function initDb() {
    const client = await pool.connect();
    try {
        // Create Users Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'kasir'
            )
        `);

        // Migrasi: Tambah kolom full_name jika belum ada (untuk DB yang sudah running)
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name') THEN
                    ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
                END IF;
            END $$;
        `);

        // Create Products Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                sku VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                price NUMERIC NOT NULL,
                stock INTEGER NOT NULL,
                image_url TEXT
            )
        `);

        // Create Orders Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_number VARCHAR(100) UNIQUE NOT NULL,
                subtotal NUMERIC NOT NULL,
                tax NUMERIC NOT NULL,
                total NUMERIC NOT NULL,
                payment_method VARCHAR(50) NOT NULL,
                amount_received NUMERIC,
                change NUMERIC,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create Order Items Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id),
                product_id INTEGER REFERENCES products(id),
                quantity INTEGER NOT NULL,
                price NUMERIC NOT NULL
            )
        `);

        // Seed Users
        const usersToSeed = [
            ['admin', 'admin', 'Muhammad Fardhan Ilmansyah', 'admin'],
            ['admin1', 'admin1', 'Raditya Caesar Gozal', 'admin']
        ];

        for (const u of usersToSeed) {
            await client.query(
                "INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO UPDATE SET full_name = $3",
                u
            );
        }
        console.log('Admin users synchronized.');

        // Seed Dummy Products
        const productCheck = await client.query("SELECT COUNT(*) as count FROM products");
        if (parseInt(productCheck.rows[0].count) === 0) {
            const dummyProducts = [
                ["BEV-001", "Espresso Single Origin", "minuman", 25000, 50, "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=300&h=300"],
                ["BEV-002", "Caramel Macchiato", "minuman", 35000, 40, "https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&q=80&w=300&h=300"],
                ["BEV-003", "Matcha Latte", "minuman", 32000, 8, "https://images.unsplash.com/photo-1536514072410-5019a3c69182?auto=format&fit=crop&q=80&w=300&h=300"],
                ["FOD-001", "Nasi Goreng Spesial", "makanan", 45000, 20, "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=300&h=300"],
                ["FOD-002", "Mie Goreng Seafood", "makanan", 48000, 15, "https://images.unsplash.com/photo-1612929633738-8fe01f728091?auto=format&fit=crop&q=80&w=300&h=300"],
                ["SNK-001", "Truffle French Fries", "snack", 30000, 30, "https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&q=80&w=300&h=300"],
                ["SNK-002", "Croissant Butter", "snack", 25000, 5, "https://images.unsplash.com/photo-1555507036-ab1e4006aaeb?auto=format&fit=crop&q=80&w=300&h=300"],
                ["BEV-004", "Artisan Mineral Water", "minuman", 15000, 100, "https://images.unsplash.com/photo-1548839140-29a749e1bc4c?auto=format&fit=crop&q=80&w=300&h=300"],
                ["FOD-003", "Ayam Bakar Madu", "makanan", 55000, 12, "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=300&h=300"]
            ];

            for (const prod of dummyProducts) {
                await client.query(
                    "INSERT INTO products (sku, name, category, price, stock, image_url) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (sku) DO NOTHING",
                    prod
                );
            }
            console.log('Dummy products seeded.');
        }

        console.log('Connected to PostgreSQL database.');
    } finally {
        client.release();
    }
}

initDb().catch(console.error);

module.exports = pool;
