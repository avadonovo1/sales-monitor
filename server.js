const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const DATA_FILE = './data.json';

// 讀取/初始化資料
let products = [];
let history = {};

if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    products = data.products || [];
    history = data.history || {};
} else {
    // 預設商品
    products = [
        { id: 1, name: "izna UNIT A", apiUrl: "https://www.koreepop.com/products/izna-set-the-tempo-unit-poca-deco-event-in-taipei.json" },
        { id: 2, name: "izna UNIT B", apiUrl: "https://www.koreepop.com/products/izna-set-the-tempo-unit-poca-deco-event-in-taipei.json" },
        { id: 3, name: "izna TOTAL", apiUrl: "https://www.koreepop.com/products/izna-set-the-tempo-unit-poca-deco-event-in-taipei.json" }
    ];
    saveData();
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({products, history}, null, 2));
}

// 後端自動更新
async function autoUpdateAll() {
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

            if (!history[product.id]) history[product.id] = [];
            const last = history[product.id][0];
            const delta = last ? currentTotal - last.total_sold : 0;

            if (!last || delta !== 0) {
                history[product.id].unshift({
                    total_sold: currentTotal,
                    delta: delta,
                    timestamp: new Date().toISOString()
                });
                if (history[product.id].length > 100) history[product.id].pop();
            }
        } catch(e) {}
    }
    saveData();
}

setInterval(autoUpdateAll, 10000);
autoUpdateAll();

// API
app.get('/products', (req, res) => res.json(products));

app.get('/history/:productId', (req, res) => {
    res.json(history[parseInt(req.params.productId)] || []);
});

app.listen(PORT, () => console.log(`🚀 Server 運行中: http://localhost:${PORT}`));
