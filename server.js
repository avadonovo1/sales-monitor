const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

const db = new sqlite3.Database('./sales.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, apiUrl TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS sales_history (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, total_sold INTEGER, delta INTEGER, timestamp TEXT)`);
});

// 後端自動更新所有商品（每10秒）
async function autoUpdateAll() {
    db.all('SELECT * FROM products', async (err, products) => {
        if (err || !products.length) return;

        for (const product of products) {
            try {
                const response = await fetch(product.apiUrl);
                const data = await response.json();

                let currentTotal = data.total_sold || 0;
                const nameUpper = product.name.toUpperCase();

                if (nameUpper.includes("UNIT A")) {
                    const va = data.variants.find(v => v.title && v.title.includes("UNIT A"));
                    currentTotal = va ? Math.abs(va.inventory_quantity || 0) : 0;
                } else if (nameUpper.includes("UNIT B")) {
                    const vb = data.variants.find(v => v.title && v.title.includes("UNIT B"));
                    currentTotal = vb ? Math.abs(vb.inventory_quantity || 0) : 0;
                }

                db.get('SELECT total_sold FROM sales_history WHERE product_id = ? ORDER BY id DESC LIMIT 1',
                    [product.id], (err, last) => {

                    const delta = last ? (currentTotal - last.total_sold) : 0;
                    if (!last || delta !== 0) {
                        db.run('INSERT INTO sales_history (product_id, total_sold, delta, timestamp) VALUES (?, ?, ?, ?)',
                            [product.id, currentTotal, delta, new Date().toISOString()]);
                    }
                });
            } catch(e) {}
        }
    });
}

// 每10秒自動更新
setInterval(autoUpdateAll, 10000);
autoUpdateAll(); // 啟動時立即執行一次

// API 路由
app.get('/products', (req, res) => db.all('SELECT * FROM products', [], (err, rows) => res.json(rows)));

app.get('/history/:productId', (req, res) => {
    db.all('SELECT * FROM sales_history WHERE product_id = ? ORDER BY id DESC', [parseInt(req.params.productId)], (err, rows) => res.json(rows));
});

app.listen(PORT, () => {
    console.log(`🚀 Server 運行中: http://localhost:${PORT} (後端自動更新已啟用)`);
});
