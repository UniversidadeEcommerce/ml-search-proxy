// server.js - proxy resiliente + DEBUG para /sites/{SITE}/search
import express from "express";
import fetch from "node-fetch";

const app = express();

// TROQUE a chave se mudou no seu servidor
const TOKEN_URL = "https://universidadeecommerce.com/mercadolivre/access_token.php?key=g7AK9vRZx2Qw38zLm4TTpT1sB0uYf3HkZ";

function baseHeaders() {
  return {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    // vamos ligar/desligar Origin/Referer conforme a tentativa
    "X-Client-Id": "925627129020063",
    "X-Caller-Id": "229673717",
  };
}

app.get("/", (req, res) => res.send("OK /search?site=MLB&q=iphone&limit=3&offset=0"));

app.get("/search", async (req, res) => {
  try {
    const site   = req.query.site   || "MLB";
    const q      = req.query.q      || "";
    const limit  = req.query.limit  || "10";
    const offset = req.query.offset || "0";
    const debug  = req.query.debug === "1";

    // 1) token fresco
    const tok = await fetch(TOKEN_URL, { headers: { "Accept": "application/json" }});
    if (!tok.ok) return res.status(502).json({ step:"token_fetch", error:"token_fetch_failed", status: tok.status });
    const { access_token } = await tok.json();
    if (!access_token) return res.status(500).json({ step:"token_fetch", error:"no_token_from_server" });

    const url = `https://api.mercadolibre.com/sites/${site}/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;
    const attempts = [];

    // helper
    async function tryFetch(target, headers, label) {
      const r = await fetch(target, { headers });
      const text = await r.text();
      attempts.push({
        step: label,
        status: r.status,
        body_preview: text.slice(0, 220),
      });
      return { r, text };
    }

    // Tentativa A — Authorization + Origin/Referer LIGADOS
    let hA = baseHeaders();
    hA["Authorization"] = `Bearer ${access_token}`;
    hA["Origin"]  = "https://www.mercadolivre.com.br";
    hA["Referer"] = "https://www.mercadolivre.com.br/";
    let A = await tryFetch(url, hA, "A_header_auth_with_origin");

    if (A.r.ok) {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Content-Type", A.r.headers.get("Content-Type") || "application/json; charset=utf-8");
      return res.status(A.r.status).send(A.text);
    }

    // Tentativa B — Authorization SEM Origin/Referer
    let hB = baseHeaders();
    hB["Authorization"] = `Bearer ${access_token}`;
    let B = await tryFetch(url, hB, "B_header_auth_no_origin");

    if (B.r.ok) {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Content-Type", B.r.headers.get("Content-Type") || "application/json; charset=utf-8");
      return res.status(B.r.status).send(B.text);
    }

    // Tentativa C — access_token na query + Origin/Referer LIGADOS
    let hC = baseHeaders();
    hC["Origin"]  = "https://www.mercadolivre.com.br";
    hC["Referer"] = "https://www.mercadolivre.com.br/";
    let C = await tryFetch(`${url}&access_token=${encodeURIComponent(access_token)}`, hC, "C_query_token_with_origin");

    if (C.r.ok) {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Content-Type", C.r.headers.get("Content-Type") || "application/json; charset=utf-8");
      return res.status(C.r.status).send(C.text);
    }

    // Tentativa D — access_token na query SEM Origin/Referer
    let hD = baseHeaders();
    let D = await tryFetch(`${url}&access_token=${encodeURIComponent(access_token)}`, hD, "D_query_token_no_origin");

    if (D.r.ok) {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Content-Type", D.r.headers.get("Content-Type") || "application/json; charset=utf-8");
      return res.status(D.r.status).send(D.text);
    }

    // Falhou tudo → retorna diagnóstico
    const token_preview = access_token.slice(0, 8) + "…";
    return res.status(403).json({ error: "forbidden_all_variants", token_preview, attempts });

  } catch (e) {
    return res.status(500).json({ error: "proxy_error", detail: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("up on " + PORT));
