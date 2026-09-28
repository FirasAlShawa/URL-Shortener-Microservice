import express from "express";
import cors from "cors";
import { DatabaseSync } from "node:sqlite";
import dns from "dns/promises";
import { url } from "inspector";
import { isUint16Array } from "util/types";
import { isReadable } from "stream";

const app = express();
const db = new DatabaseSync("database.sqlite");
db.exec(`
    create table if not EXISTS  shorturls(
      id integer primary key autoincrement,
      original_url text not null,
      short_url text
    )
    `);

const insertUrlStmt = db.prepare(`
  INSERT INTO shorturls (original_url) 
  VALUES (:url)
`);
const getUrlRow = db.prepare("SELECT * FROM shorturls WHERE id = ?");
// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use("/public", express.static(`${process.cwd()}/public`));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// Your first API endpoint
app.get("/api/hello", function (req, res) {
  res.json({ greeting: "hello API" });
});

app.post("/api/shorturl", async (req, res) => {
  let { url } = req.body;
  url = sanitizeUserUrl(url);
  const parsedUrl = new URL(url);
  try {
    const lookupResult = await dns.lookup(parsedUrl.hostname);
    if(lookupResult){
      console.log(lookupResult)
    }
    const result = insertUrlStmt.run({ url: url });

    res.json({
      original_url: url,
      short_url: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Lookup failed:', error.message);
    res.json({ error: "invalid url", summary:error });
  }
  //http://iioiqwoe.com/ as invalud url
});

app.get("/api/shorturl/:id", (req, res) => {
  const id = req.params.id;

  const queryResult = getUrlRow.get(id);

  if (!queryResult) {
    res.json({ error: "invalid url" });
    return;
  }

  // res.json(
  //    queryResult
  // )
  // const result = insertUrlStmt.run(original)
  res.redirect(queryResult.original_url);
});

app.get("/api/check", (req, res) => {
  const urls = ["https:/google.com","www.google2.com/noon/books/aasd", "https://google2.com", "http://google3.com", "https://www.google4.com", "http://www.google5.com"]

  const checkValue = urls.map((url) => {
    try {
      return {
        old: url,
        sanitized: sanitizeUserUrl(url),
      };
    } catch (error) {
      console.log(`url :$${url} \nError ${error}`)
      return;
    }

  });

  res.json(checkValue)
})

function sanitizeUserUrl(input) {
  if (!input || typeof input !== 'string') return null;

  let trimmedInput = input.trim();

  // 1. Fix single-slash typos after scheme (e.g., https:/google.com -> https://google.com)
  trimmedInput = trimmedInput.replace(/^([a-z][a-z0-9+.-]*):\/([^\/])/i, '$1://$2');

  // 2. Automatically prepend https:// if missing a valid scheme with double slashes
  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedInput);
  if (!hasProtocol) {
    trimmedInput = `https://${trimmedInput}`;
  }

  try {
    const parsedUrl = new URL(trimmedInput);

    // 3. Enforce secure protocols ONLY (Blocks javascript:, data:, file:, etc.)
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return null;
    }

    // 4. Ensure a valid hostname exists
    if (!parsedUrl.hostname) {
      return null;
    }

    return parsedUrl.href;
  } catch (error) {
    return null;
  }
}

app.listen(3000,"0.0.0.0", function () {
  console.log(`Listening on port ${port}`);
});
