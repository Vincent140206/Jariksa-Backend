const pool = require('./config/db');

const seedDatabase = async () => {
    try {
        console.log("Starting database seed...");

        const createTablesQuery = `
            CREATE TABLE IF NOT EXISTS stores (
                id SERIAL PRIMARY KEY,
                store_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                phone_number VARCHAR(20) NOT NULL,
                loyalty_status VARCHAR(50) DEFAULT 'Regular', 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
                category_name VARCHAR(100) NOT NULL 
            );

            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
                service_name VARCHAR(255) NOT NULL, 
                description VARCHAR(255), 
                price INTEGER NOT NULL,
                unit VARCHAR(50) DEFAULT 'kg'
            );

            CREATE TABLE orders (
                id SERIAL PRIMARY KEY,
                store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
                customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
                total_price INTEGER NOT NULL DEFAULT 0,
                status VARCHAR(50) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
                quantity DECIMAL NOT NULL DEFAULT 1,
                price INTEGER NOT NULL,
                image_url VARCHAR(255),
                ai_status VARCHAR(50),
                ai_report JSONB
            );
        `;

        await pool.query(createTablesQuery);
        console.log("Database tables created.");

        const checkStore = await pool.query("SELECT * FROM stores WHERE email = 'vincentiusdylan01@gmail.com'");

        if (checkStore.rows.length === 0) {
            console.log("Inserting data seeder...");

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('supersecretpassword', salt);

            const newStore = await pool.query(
                "INSERT INTO stores (store_name, email, password) VALUES ($1, $2, $3) RETURNING id",
                ['Roketto Laundry Prod', 'vincentiusdylan01@gmail.com', hashedPassword]
            );
            const storeId = newStore.rows[0].id;

            const newCategory = await pool.query(
                "INSERT INTO categories (store_id, category_name) VALUES ($1, $2) RETURNING id",
                [storeId, 'Pakaian']
            );
            const categoryId = newCategory.rows[0].id;

            await pool.query(
                "INSERT INTO services (category_id, service_name, description, price, unit) VALUES ($1, $2, $3, $4, $5)",
                [categoryId, 'Cuci Kering', 'Reguler - 3 hari', 6000, 'kg']
            );

            console.log("Data Inserted.");
        } else {
            console.log("Database already seeded.");
        }

        console.log("Database seeded successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    }
};

seedDatabase();