const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

app.post("/api/proxy", async (req, res) => {
  const body = Object.entries(req.body)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");

  const response = await fetch("https://h5.lot-ml.com/H5OrderEn/Save", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://h5.lot-ml.com",
      Referer:
        "https://h5.lot-ml.com/h5orderEn/index?pudID=3a63e330af913423&userid=5879e81e899912ce",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });

  const text = await response.text();
  res.status(response.status).send(text);
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
});
