var express = require("express");
var router = express.Router();
const { State, ArticleStateContract } = require("newsnexus05db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 GET /states: Get API
router.get("/", authenticateToken, async (req, res) => {
  const statesArray = await State.findAll();
  // make an array of just the states
  res.json({ statesArray });
});

// 🔹 POST /state/:articleId: Add API
router.post("/:articleId", authenticateToken, async (req, res) => {
  console.log("- starting /state/:articleId");
  const { articleId } = req.params;
  const { stateIdArray } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
    "stateIdArray",
  ]);

  if (!isValid) {
    return res.status(400).json({ error: `Missing ${missingKeys.join(", ")}` });
  }

  const articleStateContracts = stateIdArray.map((stateId) => {
    return {
      articleId: articleId,
      stateId: stateId,
    };
  });

  await ArticleStateContract.bulkCreate(articleStateContracts);
  console.log(
    `articleStateContracts: ${JSON.stringify(articleStateContracts)}`
  );
  res.json({ result: true, articleStateContracts });
});

module.exports = router;
