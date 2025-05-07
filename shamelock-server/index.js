const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
require("dotenv").config();

const app = express();
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("👋 Hello from ShameLock.");
});

app.get("/auth/github", (req, res) => {
  const redirect_uri = "https://shamelock-server.vercel.app/github/callback";
  res.redirect(
    `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirect_uri}&scope=repo`
  );
});

app.get("/github/callback", async (req, res) => {
  const code = req.query.code;
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  res.send(`
    <script>
      window.opener.postMessage({ token: "${accessToken}" }, "*");
      window.close();
    </script>
  `);
});

module.exports = app;
