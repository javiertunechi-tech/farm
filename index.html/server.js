// server.js — simple proxy for OpenWeather API
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const KEY = process.env.OPENWEATHER_API_KEY;
if (!KEY) {
  console.warn('Warning: OPENWEATHER_API_KEY is not set. Set it in .env before running.');
}

// simple on-disk cache for geocoded admin areas
const fs = require('fs');
const CACHE_FILE = './kenya_cache.json';
let kenyaCache = {};
try{
  if (fs.existsSync(CACHE_FILE)) {
    kenyaCache = JSON.parse(fs.readFileSync(CACHE_FILE));
  }
}catch(e){ console.warn('Could not read cache file', e.message); }

function saveCache(){
  try{ fs.writeFileSync(CACHE_FILE, JSON.stringify(kenyaCache, null, 2)); }catch(e){ console.warn('Could not write cache', e.message); }
}

// Geocoding proxy
app.get('/api/geocode', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });
  try {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Current weather
app.get('/api/current-weather', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Weather proxy (One Call)
app.get('/api/weather', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });
  try {
    const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=metric&appid=${KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Locate by county and optional subcounty. Uses cache; if not found, server geocodes using OpenWeather
app.get('/api/locate', async (req, res) => {
  const county = (req.query.county || '').trim();
  const sub = (req.query.subcounty || '').trim();
  if (!county) return res.status(400).json({ error: 'Missing county parameter' });

  const key = (sub ? (sub + ', ' + county) : county).toLowerCase();
  if (kenyaCache[key]) return res.json(kenyaCache[key]);

  if (!KEY) return res.status(500).json({ error: 'Server API key not configured' });

  try {
    const q = sub ? `${sub}, ${county}, Kenya` : `${county}, Kenya`;
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!data || data.length === 0) return res.status(404).json({ error: 'Location not found' });
    const entry = { name: data[0].name + (data[0].country?(', '+data[0].country):''), lat: data[0].lat, lon: data[0].lon };
    kenyaCache[key] = entry;
    // also store county-only key for convenience
    const countyKey = county.toLowerCase();
    if (!kenyaCache[countyKey]) kenyaCache[countyKey] = entry;
    saveCache();
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pre-warm all 47 counties: geocode each county and cache results. Use with caution (consumes API calls).
app.get('/api/prewarm-counties', async (req, res) => {
  if (!KEY) return res.status(500).json({ error: 'Server API key not configured' });
  try {
    const counties = require('./kenya_counties_list.json');
    const results = [];
    for (const c of counties){
      const key = c.toLowerCase();
      if (kenyaCache[key]) { results.push({ county: c, cached: true, entry: kenyaCache[key] }); continue; }
      const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(c + ', Kenya')}&limit=1&appid=${KEY}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data && data.length) {
        const entry = { name: data[0].name + (data[0].country?(', '+data[0].country):''), lat: data[0].lat, lon: data[0].lon };
        kenyaCache[key] = entry;
        results.push({ county: c, cached: false, entry });
      } else {
        results.push({ county: c, error: 'not found' });
      }
    }
    saveCache();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple market endpoint: returns estimated buy/sell prices for a crop based on
// recent weather conditions near the provided lat/lon. This is a heuristic demo.
app.get('/api/market', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  const crop = req.query.crop || '';
  if (!lat || !lon || !crop) return res.status(400).json({ error: 'Missing lat/lon/crop' });
  try {
    // get 7-day weather
    const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=current,minutely,hourly,alerts&units=metric&appid=${KEY}`;
    const r = await fetch(url);
    const data = await r.json();

    // base prices (KSh) derived from products
    const basePrices = {
      Potattoes: 2400,
      Maize: 2400,
      Rice: 2700,
      Sorghum: 2400,
      Millet: 2400,
      Beans: 1800,
      'Tea leaves': 4000,
      Coffee: 4000,
      Kales: 1600
    };

    const base = basePrices[crop] || 2000;

    // compute simple weather metrics
    const days = (data.daily || []).slice(0,7);
    const avgTemp = days.length ? days.reduce((s,d)=>s + (d.temp.day||d.temp.max),0)/days.length : 25;
    const totalRain = days.reduce((s,d)=>s + (d.rain||0),0);
    const avgPop = days.length ? days.reduce((s,d)=>s + (d.pop||0),0)/days.length*100 : 0;

    // adjustment heuristics
    let adj = 0;
    if (totalRain > 30) adj += 0.15; // heavy rain increases prices due to supply impact
    if (avgPop > 60) adj += 0.12; // high chance precipitation
    // temperature stress
    // small penalty if avgTemp outside typical 15-30 range
    if (avgTemp < 15 || avgTemp > 30) adj += 0.10;

    // small random noise
    const noise = (Math.random() - 0.5) * 0.06;
    adj += noise;

    const buyPrice = Math.max(50, Math.round(base * (1 + adj)));
    const sellPrice = Math.max(50, Math.round(base * (1 - Math.max(0, adj) * 0.5)));

    res.json({ crop, buyPrice, sellPrice, base, adj: Number(adj.toFixed(3)), avgTemp: Number(avgTemp.toFixed(1)), totalRain: Number(totalRain.toFixed(1)), avgPop: Math.round(avgPop) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});
