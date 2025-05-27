const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const PORT = 3000;
const WINDOW_SIZE = 10;

let windowCurrState = [];
let accessToken = process.env.ACCESS_TOKEN;

const VALID_IDS = {
  p: "http://20.244.56.144/evaluation-service/primes",
  f: "http://20.244.56.144/evaluation-service/fibo",
  e: "http://20.244.56.144/evaluation-service/even",
  r: "http://20.244.56.144/evaluation-service/rand",
};

async function refreshAccessToken() {
  try {
    const { data } = await axios.post(process.env.AUTH_URL, {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
    });
    accessToken = data.access_token;
    console.log("✅ Access token refreshed");
    return accessToken;
  } catch (error) {
    console.error(
      "❌ Failed to refresh token:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function tryFetch(url) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  };

  const response = await axios.get(url, { headers, timeout: 500 });
  return response.data.numbers || [];
}

async function fetchNumbers(url) {
  try {
    return await tryFetch(url);
  } catch (error) {
    if (error.response?.status === 401) {
      console.warn("⚠️ Access token expired. Refreshing...");
      const newToken = await refreshAccessToken();
      if (newToken) return await tryFetch(url);
    }
    console.error(
      "❌ Error fetching numbers:",
      error.response?.data || error.message
    );
    return [];
  }
}

function updateWindow(numbers) {
  for (const num of numbers) {
    if (!windowCurrState.includes(num)) {
      if (windowCurrState.length >= WINDOW_SIZE) {
        windowCurrState.shift();
      }
      windowCurrState.push(num);
    }
  }
}

function calculateAverage(arr) {
  if (arr.length === 0) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  return parseFloat((sum / arr.length).toFixed(2));
}

app.get("/numbers/:numberid", async (req, res) => {
  const { numberid: id } = req.params;

  if (!VALID_IDS[id]) {
    return res.status(400).json({ error: "Invalid number ID" });
  }

  const prevState = [...windowCurrState];
  const numbers = await fetchNumbers(VALID_IDS[id]);

  updateWindow(numbers);

  return res.json({
    windowPrevState: prevState,
    windowCurrState,
    numbers,
    avg: calculateAverage(windowCurrState),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
