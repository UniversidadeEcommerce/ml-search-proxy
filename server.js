// server.js - proxy resiliente para /sites/{SITE}/search
import express from "express";
import fetch from "node-fetch";

const app = express();

const TOKEN_URL = "https://universidadeecommerce.com/mercadolivre/access_token.php?key=SUA_CHAVE_BEM_FORTE";

app.get("/search", async (req, res) => {
  try {
    const site   = req.query.site   || "MLB";
    const q      = req.query.q      || "";
    const limit  = req.query.limit  || "10";
    const offset = req.query.offset || "0";

    // 1) pega token fresco do seu servidor
    const tok = await fetch(TOKEN_URL, { headers: { "Accept": "application/json" }});
    if (!tok.ok) return res.status(502).json({ error: "token_fetch_failed", status: tok.status });
    const { access_token } = await tok.json();
    if (!access_token) return res.status(500).json({ error: "no_token_from_server" });

    // 2) chama o /search autenticado
    const target = `https://api.mercadolibre.com/sites/${site}/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;
    const resp = await fetch(target, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": "https://www.mercadolivre.com.br/",
        "Origin": "https://www.mercadolivre.com.br",
        "Authorization": `Bearer ${access_token}`,
        "X-Client-Id": "925627129020063",
        "X-Caller-Id": "229673717"
      },
    });

    const text = await resp.text();
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", resp.headers.get("Content-Type") || "application/json; charset=utf-8");
    return res.status(resp.status).send(text);
  } catch (e) {
    return res.status(500).json({ error: "proxy_error", detail: String(e) });
  }
});

app.get("/", (req, res) => res.send("OK /search?site=MLB&q=iphone&limit=3&offset=0"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("up on " + PORT));
