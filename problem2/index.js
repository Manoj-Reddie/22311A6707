const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;

const BASE_URL = process.env.EVALUATION_SERVICE_URL || "http://localhost:4000";
const TOKEN =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiZXhwIjoxNzQ4MzIxODM1LCJpYXQiOjE3NDgzMjE1MzUsImlzcyI6IkFmZm9yZG1lZCIsImp0aSI6ImRkNWQwNmVmLThjMmEtNDJjYy1iNmU1LWM2ZjhiNzBjZTUwMyIsInN1YiI6IjIyMzExYTYyMjZAY3Muc3JlZW5pZGhpLmVkdS5pbiJ9LCJlbWFpbCI6IjIyMzExYTYyMjZAY3Muc3JlZW5pZGhpLmVkdS5pbiIsIm5hbWUiOiJhcmVwYWxsaSBzaWRkaGFydGhhIGdvdWQiLCJyb2xsTm8iOiIyMjMxMWE2MjI2IiwiYWNjZXNzQ29kZSI6IlBDcUFVSyIsImNsaWVudElEIjoiZGQ1ZDA2ZWYtOGMyYS00MmNjLWI2ZTUtYzZmOGI3MGNlNTAzIiwiY2xpZW50U2VjcmV0IjoiWWdoVHdkZG1ubXVEVkpYWiJ9.HIPLsaoMwwNtnoy4ars7dzSmjcOI4vKqaPVrTFcgjuA";

const fetchStockData = async (ticker, minutes) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/stocks/${ticker}?minutes=${minutes}`,
      {
        headers: {
          Authorization: TOKEN,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error.message);
    throw error;
  }
};

app.get("/stocks/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const { minutes } = req.query;

  if (!ticker) {
    return res.status(400).json({ error: "Ticker is required" });
  }

  try {
    const data = await fetchStockData(ticker, minutes || 60);
    const prices = data.priceHistory.map((entry) => entry.price);
    const averagePrice =
      prices.reduce((sum, price) => sum + price, 0) / prices.length;

    res.json({
      averageStockPrice: averagePrice,
      priceHistory: data.priceHistory,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

app.get("/stockcorrelation", async (req, res) => {
  const { minutes, ticker1, ticker2 } = req.query;

  if (!ticker1 || !ticker2) {
    return res
      .status(400)
      .json({ error: "Both ticker1 and ticker2 are required" });
  }

  try {
    const [data1, data2] = await Promise.all([
      fetchStockData(ticker1, minutes || 60),
      fetchStockData(ticker2, minutes || 60),
    ]);

    const prices1 = data1.priceHistory.map((entry) => entry.price);
    const prices2 = data2.priceHistory.map((entry) => entry.price);

    if (prices1.length !== prices2.length) {
      return res
        .status(400)
        .json({ error: "Price histories must have the same length" });
    }

    const avg1 =
      prices1.reduce((sum, price) => sum + price, 0) / prices1.length;
    const avg2 =
      prices2.reduce((sum, price) => sum + price, 0) / prices2.length;

    const covariance =
      prices1.reduce(
        (sum, price, i) => sum + (price - avg1) * (prices2[i] - avg2),
        0
      ) / prices1.length;
    const stdDev1 = Math.sqrt(
      prices1.reduce((sum, price) => sum + Math.pow(price - avg1, 2), 0) /
        prices1.length
    );
    const stdDev2 = Math.sqrt(
      prices2.reduce((sum, price) => sum + Math.pow(price - avg2, 2), 0) /
        prices2.length
    );
    const correlation = covariance / (stdDev1 * stdDev2);

    res.json({
      correlation,
      stocks: {
        [ticker1]: {
          averagePrice: avg1,
          priceHistory: data1.priceHistory,
        },
        [ticker2]: {
          averagePrice: avg2,
          priceHistory: data2.priceHistory,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate correlation" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
