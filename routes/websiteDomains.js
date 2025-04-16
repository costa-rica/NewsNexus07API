var express = require("express");
var router = express.Router();
const { WebsiteDomain } = require("newsnexus05db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 GET /website-domains: Get all the saved domain names
router.get("/", authenticateToken, async (req, res) => {
  const websiteDomains = await WebsiteDomain.findAll();
  res.json({ websiteDomains });
});

// 🔹 POST /website-domains/ Add a domain name
router.post("/", authenticateToken, async (req, res) => {
  const { name } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, ["name"]);

  if (!isValid) {
    return res.status(400).json({ error: `Missing ${missingKeys.join(", ")}` });
  }

  const websiteDomain = await WebsiteDomain.create({ name });
  res.json({ result: true, websiteDomain });
});

module.exports = router;
