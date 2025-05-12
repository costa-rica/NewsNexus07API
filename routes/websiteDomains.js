var express = require("express");
var router = express.Router();
const { WebsiteDomain } = require("newsnexus07db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// GET /website-domains
router.get("/", authenticateToken, async (req, res) => {
  const websiteDomains = await WebsiteDomain.findAll();
  res.json({ websiteDomains });
});

// 🔹 POST /website-domains/get-website-domains-array: Get all the saved domain names
router.post(
  "/get-website-domains-array",
  authenticateToken,
  async (req, res) => {
    const { excludeArchievedNewsDataIo } = req.body;

    console.log(
      "---> excludeArchievedNewsDataIo: ",
      excludeArchievedNewsDataIo
    );
    let websiteDomainsArray;
    if (excludeArchievedNewsDataIo) {
      websiteDomainsArray = await WebsiteDomain.findAll({
        where: {
          isArchievedNewsDataIo: false,
        },
      });
      console.log(
        "websiteDomainsArray (excludeArchievedNewsDataIo): ",
        websiteDomainsArray.length
      );
    } else {
      websiteDomainsArray = await WebsiteDomain.findAll();
      console.log("websiteDomainsArray: ", websiteDomainsArray.length);
    }

    res.json({ websiteDomainsArray });
  }
);

// 🔹 POST /website-domains/add: Add a domain name
router.post("/add", authenticateToken, async (req, res) => {
  const { name } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, ["name"]);

  if (!isValid) {
    return res.status(400).json({ error: `Missing ${missingKeys.join(", ")}` });
  }

  const websiteDomain = await WebsiteDomain.create({ name });
  res.json({ result: true, websiteDomain });
});

module.exports = router;
