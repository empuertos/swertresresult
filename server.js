const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());

const cache = new NodeCache({ stdTTL: 25, checkperiod: 30 });
const SOURCE_URL = "https://www.lottopcso.com/swertres-result-today/";

function parseResultsFromText(text) {
  const slots = {
    "2:00 PM": null,
    "5:00 PM": null,
    "9:00 PM": null,
  };
  const normalized = text.replace(/\u00A0/g, " ");
  Object.keys(slots).forEach((timeLabel) => {
    const timeRegex = new RegExp(`${timeLabel.replace(" ", "\\s*")}`, "i");
    const matchTime = normalized.match(timeRegex);
    if (matchTime) {
      const after = normalized.slice(matchTime.index + matchTime[0].length, matchTime.index + matchTime[0].length + 30);
      const numMatch = after.match(/\b(\d{1,3})\b/);
      if (numMatch) {
        slots[timeLabel] = numMatch[1].padStart(3, "0");
      }
    }
  });
  return slots;
}

async function fetchWithPuppeteer() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );
    await page.goto(SOURCE_URL, { waitUntil: "networkidle2", timeout: 25000 });
    await page.waitForTimeout(1500);
    const html = await page.content();
    const $ = cheerio.load(html);
    let dateText = $(".entry-content h1").first().text().trim();
    if (!dateText) {
      dateText = $("h1, h2").first().text().trim();
    }
    if (!dateText) {
      dateText = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }
    const bodyText = $("body").text();
    const results = parseResultsFromText(bodyText);
    return { date: dateText, results, fetched_at: new Date().toISOString(), source: SOURCE_URL, method: "puppeteer" };
  } finally {
    await browser.close();
  }
}

async function fetchWithAxios() {
  const resp = await axios.get(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    },
    timeout: 10000,
  });
  const html = resp.data;
  const $ = cheerio.load(html);
  let dateText = $(".entry-content h1").first().text().trim();
  if (!dateText) {
    dateText = $("h1, h2").first().text().trim();
  }
  if (!dateText) {
    dateText = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  const bodyText = $("body").text();
  const results = parseResultsFromText(bodyText);
  return { date: dateText, results, fetched_at: new Date().toISOString(), source: SOURCE_URL, method: "axios" };
}

async function fetchSwertresResults() {
  try {
    return await fetchWithPuppeteer();
  } catch (e) {
    console.warn("Puppeteer fetch failed, falling back to axios:", e.message);
    return await fetchWithAxios();
  }
}

app.get("/api/swertres", async (req, res) => {
  try {
    const cacheKey = "swertres_latest";
    let data = cache.get(cacheKey);
    if (!data) {
      data = await fetchSwertresResults();
      cache.set(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (e) {
    const fallback = cache.get("swertres_latest");
    if (fallback) {
      res.json({ success: true, data: fallback, warning: "Using cached data due to fetch error." });
    } else {
      res.status(500).json({ success: false, error: "Unable to retrieve results." });
    }
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Swertres API server running on port ${PORT}`);
});
