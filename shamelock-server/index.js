const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// Replace this with your actual deployed URL (you can make it pretty later)
const BASE_URL = "https://shamelock-server-gi1ui7sx6-udays-projects-f250ded9.vercel.app";

app.use(cors());
app.use(express.json());

// Step 1: Redirect to GitHub for OAuth
app.get("/auth/github", (req, res) => {
  const redirect_uri = `${BASE_URL}/github/callback`;
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirect_uri}&scope=repo`);
});

// Step 2: GitHub calls us back with a ?code=123
app.get("/github/callback", async (req, res) => {
  const code = req.query.code;

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code
    })
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

// This line is mostly ignored by Vercel, but useful for local dev
app.listen(PORT, () => {
  console.log(`Shame server up on port ${PORT}`);
});
