Server-side proxy for OpenWeather API

What this does:
- Runs a small Express server (`server.js`) that proxies requests to OpenWeather.
- Keeps your API key on the server (in `.env`), not in client JS.

Setup
1. Install Node.js (v14+ recommended). In the project root run:

```bash
npm install
```

2. Copy `.env.example` to `.env` and set your API key:

```bash
copy .env.example .env  # Windows
# then edit .env and set OPENWEATHER_API_KEY
```

3. Start the proxy server:

```bash
npm start
```

By default the proxy listens on port `3000`. With the server running, open `weather.html` in your browser (served from the filesystem is ok) and the client will call `/api/geocode` and `/api/weather` on the proxy.

Security notes
- For production, run the proxy on a proper host, serve the frontend from the same origin, and secure the server.
- The proxy is intentionally simple as an example; consider rate-limiting and caching for a production deployment.
