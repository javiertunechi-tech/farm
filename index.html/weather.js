// weather.js — fetch OpenWeather and give crop suggestions
// This file now calls a local proxy server to avoid exposing the API key in the client.
// Start the proxy (server.js) and set OPENWEATHER_API_KEY in the server's environment.

const cropRules = {
  Potattoes: { temp: [8, 25], moisture: 'moderate', humidity: '50-80%', rainfall_mm_per_week: '10-30', soil: 'well-drained loam', notes: 'Avoid waterlogging; hilling improves yields.' },
  Maize: { temp: [18, 30], moisture: 'moderate', humidity: '40-70%', rainfall_mm_per_week: '5-20', soil: 'well-drained fertile soils', notes: 'Requires fertile topsoil and balanced NPK; watch for fall armyworm.' },
  Rice: { temp: [20, 35], moisture: 'high', humidity: '70-90%', rainfall_mm_per_week: '20-50', soil: 'flooded clay/loam for paddy', notes: 'Optimal in standing water or irrigated paddies; manage pests and water depth.' },
  Sorghum: { temp: [20, 35], moisture: 'low', humidity: '30-60%', rainfall_mm_per_week: '0-8', soil: 'sandy-loam, drought tolerant', notes: 'Drought tolerant; plant at onset of rains and conserve moisture.' },
  Millet: { temp: [25, 36], moisture: 'low', humidity: '30-60%', rainfall_mm_per_week: '0-8', soil: 'sandy-loam', notes: 'Very drought tolerant; good for arid areas.' },
  Beans: { temp: [15, 30], moisture: 'moderate', humidity: '50-80%', rainfall_mm_per_week: '5-20', soil: 'well-drained loam', notes: 'Rotate with cereals; watch for root rots in waterlogged soils.' },
  'Tealeaves': { temp: [16, 28], moisture: 'high', humidity: '70-90%', rainfall_mm_per_week: '15-40', soil: 'acidic well-drained soils', notes: 'Grow at elevation; shade and consistent moisture improve quality.' },
  Coffee: { temp: [15, 24], moisture: 'high', humidity: '60-90%', rainfall_mm_per_week: '15-40', soil: 'rich, well-drained, slightly acidic', notes: 'Grows best in shaded highlands; avoid frost.' },
  Kales: { temp: [8, 24], moisture: 'moderate', humidity: '50-80%', rainfall_mm_per_week: '5-20', soil: 'fertile loam', notes: 'Harvest leaves continuously; prefers cool, moist conditions.' }
};

// Optional client-side fallback: the code will use a key from this variable or from localStorage.
// Warning: putting the API key in client JS or storing it in the browser exposes it to users.
// Prefer running the local proxy server (`server.js`) with the key in the server environment.
let OPENWEATHER_API_KEY = '';

function showApiKeyPanel(){
  const p = document.getElementById('apiKeyPanel');
  if (p) p.style.display = 'block';
}

function hideApiKeyPanel(){
  const p = document.getElementById('apiKeyPanel');
  if (p) p.style.display = 'none';
}

function loadStoredKey(){
  try{
    const k = localStorage.getItem('OPENWEATHER_API_KEY');
    if (k) OPENWEATHER_API_KEY = k;
    return k;
  }catch(e){ return null; }
}

function saveStoredKey(k){
  try{ if(k) localStorage.setItem('OPENWEATHER_API_KEY', k); else localStorage.removeItem('OPENWEATHER_API_KEY'); OPENWEATHER_API_KEY = k||''; }catch(e){}
}

function showError(msg){
  const r = document.getElementById('results');
  const s = document.getElementById('suggestion');
  if(r) r.style.display = '';
  if(s) s.textContent = msg;
}

// Choose base URL for proxy: if page opened via `file:` use localhost:3000, otherwise use origin-relative path.
function proxyBase(){
  try{
    if (window.location.protocol === 'file:') return 'http://localhost:3000';
    // when served from a webserver, call same origin
    return '';
  }catch(e){
    return 'http://localhost:3000';
  }
}

async function geocodeCity(city){
  // try same-origin proxy first, fall back to localhost:3000 if that fails
  const tryUrls = [`/api/geocode?q=${encodeURIComponent(city)}`, `http://localhost:3000/api/geocode?q=${encodeURIComponent(city)}`];
  let res, data;
  for (const u of tryUrls) {
    try {
      res = await fetch(u);
    } catch (err) {
      res = null;
    }
    if (!res) continue;
    // if server returned HTML 404 page (e.g. "Cannot GET /api/..."), treat as failure
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok) {
      // try next
      continue;
    }
    if (ctype.includes('text/html')) {
      const txt = await res.text().catch(()=>'');
      if (txt.includes('Cannot GET')) continue;
    }
    data = await res.json().catch(()=>null);
    if (data) break;
  }
  // If proxy failed, optionally fall back to direct OpenWeather geocoding when key provided
  if (!data) {
    if (OPENWEATHER_API_KEY) {
      const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OPENWEATHER_API_KEY}`;
      const r = await fetch(url).catch(()=>null);
      if (!r || !r.ok) throw new Error('Geocoding failed (direct API).');
      const arr = await r.json().catch(()=>null);
      if (!arr || arr.length === 0) throw new Error('Location not found. Try entering a different city or area.');
      return { lat: arr[0].lat, lon: arr[0].lon, name: arr[0].name + (arr[0].country?(', '+arr[0].country):'') };
    }
      // fallback: use Nominatim forward geocoding (no API key) so page works without the proxy
      try{
        const nu = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`;
        const nr = await fetch(nu, {headers:{'Accept':'application/json','User-Agent':'wat-weather-app'}}).catch(()=>null);
        if (nr && nr.ok){
          const narr = await nr.json().catch(()=>null);
          if (narr && narr.length>0){
            return { lat: parseFloat(narr[0].lat), lon: parseFloat(narr[0].lon), name: narr[0].display_name };
          }
        }
      }catch(e){}
      // show API key input so user can paste a key instead of running the proxy
      showApiKeyPanel();
      throw new Error('Proxy unavailable — start the local proxy (npm start) or paste an OpenWeather API key below. (Attempted OpenStreetMap fallback)');
  }
  if (data.length === 0) throw new Error('Location not found. Try entering a different city or area.');
  return { lat: data[0].lat, lon: data[0].lon, name: data[0].name + (data[0].country?(', '+data[0].country):'') };
}

async function fetchWeather(lat, lon){
  const qs = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const tryUrls = [`/api/weather?${qs}`, `http://localhost:3000/api/weather?${qs}`];
  let res, data;
  for (const u of tryUrls) {
    try { res = await fetch(u); } catch(e) { res = null; }
    if (!res) continue;
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok) continue;
    if (ctype.includes('text/html')) {
      const txt = await res.text().catch(()=>'');
      if (txt.includes('Cannot GET')) continue;
    }
    data = await res.json().catch(()=>null);
    if (data) break;
  }
  // Proxy failed — fall back to OpenWeather OneCall if API key is provided
  if (!data) {
    if (OPENWEATHER_API_KEY) {
      const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&exclude=minutely,hourly,alerts&units=metric&appid=${OPENWEATHER_API_KEY}`;
      const r = await fetch(url).catch(()=>null);
      if (!r || !r.ok) throw new Error('Weather fetch failed (direct API).');
      const d = await r.json().catch(()=>null);
      if (!d) throw new Error('Weather fetch failed (direct API returned no data)');
      return d;
    }
      // fallback: use Open-Meteo (free, no key) and map to OpenWeather-like structure
      try{
        const omu = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_mean&timezone=UTC`;
        const omr = await fetch(omu).catch(()=>null);
        if (omr && omr.ok){
          const od = await omr.json().catch(()=>null);
          if (od && od.daily){
            const dates = od.daily.time || [];
            const tmax = od.daily.temperature_2m_max || [];
            const tmin = od.daily.temperature_2m_min || [];
            const rain = od.daily.precipitation_sum || [];
            const pop = od.daily.precipitation_probability_mean || [];
            const daily = dates.map((d,i)=>{
              const dt = Math.floor(new Date(d + 'T00:00:00Z').getTime()/1000);
              const dayTemp = ((tmax[i]||0) + (tmin[i]||0))/2;
              return { dt, temp: { day: dayTemp, max: tmax[i]||null, min: tmin[i]||null }, rain: rain[i]||0, pop: pop[i]||0, weather: [{ description: '' }] };
            });
            return { daily };
          }
        }
      }catch(e){}
      showApiKeyPanel();
      throw new Error('Weather proxy unavailable — start the local proxy (npm start) or paste an OpenWeather API key below.');
  }
  return data;
}

async function fetchCurrentWeather(lat, lon){
  const qs = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const tryUrls = [`/api/current-weather?${qs}`, `http://localhost:3000/api/current-weather?${qs}`];
  let res, data;
  for (const u of tryUrls) {
    try { res = await fetch(u); } catch(e) { res = null; }
    if (!res) continue;
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok) continue;
    if (ctype.includes('text/html')) {
      const txt = await res.text().catch(()=>'');
      if (txt.includes('Cannot GET')) continue;
    }
    data = await res.json().catch(()=>null);
    if (data) break;
  }
  // Proxy failed — fall back to OpenWeather current weather endpoint if API key is provided
  if (!data) {
    if (OPENWEATHER_API_KEY) {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=metric&appid=${OPENWEATHER_API_KEY}`;
      const r = await fetch(url).catch(()=>null);
      if (!r || !r.ok) throw new Error('Current weather fetch failed (direct API).');
      const d = await r.json().catch(()=>null);
      if (!d) throw new Error('Current weather fetch failed (direct API returned no data)');
      return d;
    }
      // fallback: use Open-Meteo current weather (no key)
      try{
        const omu = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current_weather=true&timezone=UTC`;
        const omr = await fetch(omu).catch(()=>null);
        if (omr && omr.ok){
          const od = await omr.json().catch(()=>null);
          if (od && od.current_weather){
            return { temperature: od.current_weather.temperature, windspeed_kmh: od.current_weather.windspeed, weather: od.current_weather.weathercode, time: od.current_weather.time };
          }
        }
      }catch(e){}
      showApiKeyPanel();
      throw new Error('Current weather proxy unavailable — start the local proxy (npm start) or paste an OpenWeather API key below.');
  }
  return data;

}

function analyzeForCrop(weather, crop){
  const rule = cropRules[crop];
  if(!rule) return 'No rules for this crop.';

  // compute 7-day averages
  const days = weather.daily.slice(0,7);
  const avgTemp = Math.round(days.reduce((s,d)=>s + (d.temp.day || d.temp.max),0)/days.length);
  const totalRain = days.reduce((s,d)=>s + (d.rain||0),0);
  const avgPop = Math.round(days.reduce((s,d)=>s + (d.pop||0),0)/days.length*100);

  const tempOk = avgTemp >= rule.temp[0] && avgTemp <= rule.temp[1];
  const moisture = rule.moisture;
  let moistureOk = true;
  if(moisture === 'high') moistureOk = totalRain >= 10 || avgPop >= 30;
  if(moisture === 'moderate') moistureOk = totalRain >= 4 || avgPop >= 20;
  if(moisture === 'low') moistureOk = totalRain < 6 || avgPop < 25; // drought tolerant prefers lower rainfall

  let advice = `Avg temp (7d): ${avgTemp}°C • Expected rain (7d): ${totalRain.toFixed(1)} mm • Avg chance of precipitation: ${avgPop}%\n`;

  if(tempOk && moistureOk){
    advice += `Good conditions for planting ${crop} in next 7 days.`;
  } else if(!tempOk && moistureOk){
    advice += `Temperature looks outside ideal range for ${crop}. Consider waiting or use varieties suited to current temps.`;
  } else if(tempOk && !moistureOk){
    advice += `Temperature is okay but moisture conditions are not ideal for ${crop}. Consider irrigation or delaying planting.`;
  } else {
    advice += `Conditions not ideal for planting ${crop}. Consider buying mature produce from the store instead.`;
  }

  // buying suggestion
  let buySuggestion = '';
  if(totalRain > 30) buySuggestion = 'Heavy rain expected — harvesting may be affected. Consider buying stored grains on products page.';
  if(avgPop > 60) buySuggestion = 'High rainfall probability — focus on buying processed goods or storage products.';
  if(!buySuggestion && !tempOk) buySuggestion = 'If planting is delayed, you may want to buy seedlings or starter packs from products page.';

  return {advice, buySuggestion, avgTemp, totalRain, avgPop};
}

function renderForecast(weather){
  const list = document.getElementById('forecastList');
  list.innerHTML = '';
  weather.daily.slice(0,7).forEach(d => {
    const date = new Date(d.dt*1000);
    const card = document.createElement('div');
    card.className = 'forecast-card';
    const desc = d.weather && d.weather[0] ? d.weather[0].description : '';
    card.innerHTML = `<h4>${date.toLocaleDateString()}</h4><div class="temp">${Math.round(d.temp.day)}°C</div><div class="desc">${desc}</div><div>Rain: ${d.rain?d.rain+' mm':'0 mm'}</div>`;
    list.appendChild(card);
  });
}

// wire UI
document.addEventListener('DOMContentLoaded', ()=>{
  // initialize API key panel
  const saved = loadStoredKey();
  const apiInput = document.getElementById('apiKeyInput');
  const saveBtn = document.getElementById('saveApiKeyBtn');
  const clearBtn = document.getElementById('clearApiKeyBtn');
  if (apiInput) apiInput.value = saved || '';
  if (saveBtn){
    saveBtn.addEventListener('click', ()=>{
      const v = apiInput.value.trim();
      if (!v) return alert('Enter a key or click Clear');
      saveStoredKey(v);
      hideApiKeyPanel();
      alert('API key saved to browser storage. You can now retry the lookup.');
    });
  }
  if (clearBtn){
    clearBtn.addEventListener('click', ()=>{
      apiInput.value = '';
      saveStoredKey('');
      hideApiKeyPanel();
      alert('API key cleared.');
    });
  }
  // if a key was stored, ensure it's used
  if (saved) { OPENWEATHER_API_KEY = saved; }

  const cityEl = document.getElementById('city');
  const cropEl = document.getElementById('crop');
  const btn = document.getElementById('checkBtn');
  const useLoc = document.getElementById('useLocation');
  const results = document.getElementById('results');
  const locLabel = document.getElementById('locationLabel');
  const sug = document.getElementById('suggestion');

  async function runForCoords(lat, lon, locationName){
    try{
      results.style.display = 'block';
      locLabel.textContent = `Location: ${locationName || (lat+','+lon)}`;
      const data = await fetchWeather(lat, lon);
      renderForecast(data);
        const crop = cropEl.value;
        const report = analyzeForCrop(data, crop);
          // build a visible crop requirements block from cropRules
          let reqHtml = '';
          const rule = cropRules[crop] || cropRules[crop.replace(/\s+/g,'')] || null;
          if(rule){
          reqHtml = `<div style="margin-top:10px;padding:12px;border-radius:8px;background:#fffef8;border:2px solid #222;color:#111;font-weight:700;font-size:1.02rem">` +
                `<div style="margin-bottom:6px"><strong>Crop requirements: ${crop}</strong></div>` +
                `<div>Temperature: <strong>${rule.temp ? rule.temp[0]+'–'+rule.temp[1]+'°C' : 'N/A'}</strong></div>` +
                `<div>Humidity: <strong>${rule.humidity || 'N/A'}</strong></div>` +
                `<div>Rainfall (approx): <strong>${rule.rainfall_mm_per_week || 'N/A'} mm/week</strong></div>` +
                `<div>Soil: <strong>${rule.soil || 'N/A'}</strong></div>` +
                `<div style="margin-top:6px">${rule.notes || ''}</div>` +
                `</div>`;
          }
          sug.innerHTML = reqHtml + `<pre style="white-space:pre-wrap;margin-top:8px">${report.advice}</pre>` + (report.buySuggestion?`<div style="margin-top:8px;color:#222;background:#fff;padding:8px;border-radius:6px">${report.buySuggestion} <a href="products.html">(See products)</a></div>`:'');

          // fetch current weather conditions first
          try{
            const base = proxyBase();
            const cu = `${base}/api/current-weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
            console.log('Fetching current weather from:', cu);
            const cr = await fetch(cu);
            console.log('Current weather response:', cr.status, cr.ok);
            if (cr.ok){
              const c = await cr.json();
              console.log('Current weather data:', c);
              const temp = Math.round(c.main.temp);
              const feelsLike = Math.round(c.main.feels_like);
              const humidity = c.main.humidity;
              const desc = c.weather && c.weather[0] ? c.weather[0].description : 'N/A';
              const windSpeed = c.wind ? Math.round(c.wind.speed * 3.6) : 0; // m/s to km/h
              const pressure = c.main.pressure;
              const currentHtml = `<div style="margin-top:12px;padding:10px;border-radius:8px;background:#222;color:#fff;border:1px solid #3498db"><strong>📍 Current Weather Conditions</strong><div style="margin-top:8px"><strong>${temp}°C</strong> (feels ${feelsLike}°C)</div><div>💧 Humidity: ${humidity}%</div><div>💨 Wind: ${windSpeed} km/h</div><div>🔽 Pressure: ${pressure} mb</div><div style="margin-top:6px;text-transform:capitalize">${desc}</div></div>`;
              sug.innerHTML += currentHtml;
            } else {
              console.warn('Current weather response not ok:', cr.status);
            }
          }catch(err){
            console.warn('Current weather fetch error:', err.message);
          }

          // fetch market prices from proxy
          try{
            const base = proxyBase();
            const mu = `${base}/api/market?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&crop=${encodeURIComponent(crop)}`;
            const mr = await fetch(mu);
            if (mr.ok){
              const m = await mr.json();
              const priceHtml = `<div style="margin-top:12px;padding:10px;border-radius:8px;background:#111;color:#fff;border:1px solid #333"><strong>Market prices (KSh)</strong><div style="margin-top:8px">Buy from farmer: <strong>${m.buyPrice}</strong></div><div>Sell to market: <strong>${m.sellPrice}</strong></div><div style="font-size:0.85rem;color:#bdbdbd;margin-top:6px">Base:${m.base} adj:${m.adj}</div></div>`;
              sug.innerHTML += priceHtml;
            } else {
              const txt = await mr.text().catch(()=>mr.statusText||'');
              sug.innerHTML += `<div style="margin-top:8px;color:#f88">Price data unavailable: ${txt}</div>`;
            }
          }catch(err){
            sug.innerHTML += `<div style="margin-top:8px;color:#f88">Price lookup error: ${err.message}</div>`;
          }
    }catch(err){
      showError('Error: ' + err.message + (err.message.includes('API key')? ' — add your OpenWeather API key in weather.js':'') );
    }
  }

  btn.addEventListener('click', async ()=>{
    const city = cityEl.value.trim();
    if(!city){ showError('Please enter a city or use location'); return; }
    try{
      const loc = await geocodeCity(city);
      runForCoords(loc.lat, loc.lon, loc.name);
    }catch(err){ showError(err.message); }
  });

  useLoc.addEventListener('click', ()=>{
    if(!navigator.geolocation){ showError('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(async pos =>{
      const {latitude:lat, longitude:lon} = pos.coords;
      runForCoords(lat, lon, 'Your location');
    }, err => showError('Unable to get location: '+err.message));
  });

});
