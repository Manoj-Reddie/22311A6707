import express from 'express';
import axios from 'axios';

const app = express();
const PORT = 3000;
const BASE_URL = 'https://prototype.sbulltech.com/api';

// Helper to fetch stock data for last `minutes`
async function fetchStockPrices(ticker, minutes) {
  const res = await axios.get(`${BASE_URL}/stocks/${ticker}`);
  const allPrices = res.data[ticker];
  const cutoff = Date.now() - minutes * 60 * 1000;

  return allPrices
    .map(p => ({
      price: parseFloat(p.price),
      lastUpdatedAt: p.lastUpdatedAt,
      timestamp: new Date(p.lastUpdatedAt).getTime(),
    }))
    .filter(p => p.timestamp >= cutoff);
}

// Pearson correlation calculation
function computeCorrelation(dataX, dataY) {
  const minLen = Math.min(dataX.length, dataY.length);
  const x = dataX.slice(0, minLen).map(p => p.price);
  const y = dataY.slice(0, minLen).map(p => p.price);

  const meanX = x.reduce((a, b) => a + b, 0) / x.length;
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;

  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  const denominatorX = Math.sqrt(x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0));
  const denominatorY = Math.sqrt(y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0));

  if (denominatorX === 0 || denominatorY === 0) return 0;
  return +(numerator / (denominatorX * denominatorY)).toFixed(4);
}

// GET /stocks/:ticker?minutes=10&aggregation=average
app.get('/stocks/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const { minutes, aggregation } = req.query;

  if (!minutes || isNaN(minutes)) {
    return res.status(400).json({ error: 'Invalid or missing "minutes" query parameter.' });
  }

  try {
    const prices = await fetchStockPrices(ticker, parseInt(minutes));
    if (!prices.length) {
      return res.status(404).json({ error: 'No recent data found for this ticker.' });
    }

    if (aggregation === 'average') {
      const average = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
      res.json({ ticker, averagePrice: +average.toFixed(6), priceHistory: prices });
    } else {
      res.status(400).json({ error: 'Unsupported aggregation. Use "average".' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /stockcorrelation?minutes=10&ticker=NVDA&ticker=PYPL
app.get('/stockcorrelation', async (req, res) => {
  const { minutes, ticker } = req.query;

  if (!minutes || isNaN(minutes) || !ticker || !Array.isArray(ticker) || ticker.length !== 2) {
    return res.status(400).json({ error: 'Provide exactly 2 tickers and valid minutes.' });
  }

  try {
    const [data1, data2] = await Promise.all([
      fetchStockPrices(ticker[0], parseInt(minutes)),
      fetchStockPrices(ticker[1], parseInt(minutes)),
    ]);

    const correlation = computeCorrelation(data1, data2);

    const avg1 = data1.reduce((sum, p) => sum + p.price, 0) / data1.length;
    const avg2 = data2.reduce((sum, p) => sum + p.price, 0) / data2.length;

    res.json({
      correlation,
      stocks: {
        [ticker[0]]: { averagePrice: +avg1.toFixed(6), priceHistory: data1 },
        [ticker[1]]: { averagePrice: +avg2.toFixed(6), priceHistory: data2 },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
