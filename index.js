import express from "express";
import cors from "cors";
import { DatabaseSync } from "node:sqlite";
import dns from "dns/promises";

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
  VALUES (?)
`);
const getUrlRow = db.prepare("SELECT * FROM shorturls WHERE id = ?");
// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
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

  console.log(req.body)
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }

  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;
  try {
    await dns.lookup(hostname);
    const result = insertUrlStmt.run([parsedUrl]);

    res.json({
      original_url: parsedUrl,
      short_url: result.lastInsertRowid,
    });
  } catch (error) {
    res.json({ error: "invalid url" });
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
  res.redirect(`https://${queryResult.original_url}`);
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
