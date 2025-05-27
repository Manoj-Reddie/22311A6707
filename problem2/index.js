import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

const stockData = {
  "NVDA": [
    { price: 231.95, lastUpdatedAt: "2025-05-08T04:26:27Z" },
    { price: 124.95, lastUpdatedAt: "2025-05-08T04:30:23Z" },
    { price: 459.09, lastUpdatedAt: "2025-05-08T04:39:14Z" },
    { price: 998.27, lastUpdatedAt: "2025-05-08T04:50:03Z" },
  ],
  "PYPL": [
    { price: 680.59, lastUpdatedAt: "2025-05-09T02:04:27Z" },
    { price: 368.12, lastUpdatedAt: "2025-05-09T02:10:27Z" },
    { price: 457.09, lastUpdatedAt: "2025-05-09T02:12:27Z" },
  ]
};

function filterByMinutes(data, minutes) {
  const now = new Date();
  return data.filter(entry => {
    const diff = (now - new Date(entry.lastUpdatedAt)) / 60000;
    return diff <= minutes;
  });
}

function calculateAverage(prices) {
  if (!prices.length) return 0;
  const sum = prices.reduce((acc, val) => acc + val.price, 0);
  return parseFloat((sum / prices.length).toFixed(2));
}

function computeCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  x = x.slice(0, n);
  y = y.slice(0, n);
  const avgX = x.reduce((a, b) => a + b, 0) / n;
  const avgY = y.reduce((a, b) => a + b, 0) / n;
  const numerator = x.reduce((sum, xi, i) => sum + ((xi - avgX) * (y[i] - avgY)), 0);
  const denominator = Math.sqrt(
    x.reduce((sum, xi) => sum + Math.pow(xi - avgX, 2), 0) *
    y.reduce((sum, yi) => sum + Math.pow(yi - avgY, 2), 0)
  );
  return denominator === 0 ? 0 : parseFloat((numerator / denominator).toFixed(3));
}

app.get('/stocks/:ticker', (req, res) => {
  const { ticker } = req.params;
  const { minutes, aggregation } = req.query;
  if (!minutes || aggregation !== 'average') {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }
  const data = stockData[ticker.toUpperCase()];
  if (!data) return res.status(404).json({ error: 'Ticker not found' });
  const filtered = filterByMinutes(data, parseInt(minutes));
  const avg = calculateAverage(filtered);
  return res.json({ averageStockPrice: avg, priceHistory: filtered });
});

app.get('/stockcorrelation', (req, res) => {
  const { ticker, minutes } = req.query;
  if (!Array.isArray(ticker) || ticker.length !== 2 || !minutes) {
    return res.status(400).json({ error: 'Provide 2 tickers and minutes' });
  }
  const [t1, t2] = ticker.map(t => t.toUpperCase());
  const d1 = filterByMinutes(stockData[t1] || [], parseInt(minutes));
  const d2 = filterByMinutes(stockData[t2] || [], parseInt(minutes));
  if (!d1.length || !d2.length) {
    return res.status(404).json({ error: 'Insufficient data' });
  }
  const prices1 = d1.map(p => p.price);
  const prices2 = d2.map(p => p.price);
  const correlation = computeCorrelation(prices1, prices2);
  return res.json({
    correlation,
    stocks: {
      [t1]: { averagePrice: calculateAverage(d1), priceHistory: d1 },
      [t2]: { averagePrice: calculateAverage(d2), priceHistory: d2 }
    }
  });
});

app.get('/evaluation-service/stocks/:ticker', (req, res) => {
  const { ticker } = req.params;
  const { minutes } = req.query;
  const data = stockData[ticker.toUpperCase()];
  if (!data) return res.status(404).json({ error: 'Stock not found' });
  if (minutes) {
    const filtered = filterByMinutes(data, parseInt(minutes));
    return res.json(filtered);
  }
  return res.json({ stock: data[data.length - 1] });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
