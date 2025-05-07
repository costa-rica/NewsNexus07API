var express = require("express");
var router = express.Router();
const {
  EntityWhoCategorizedArticle,
  ArtificialIntelligence,
} = require("newsnexus07db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 POST /artificial-intelligence/add-entity
router.post("/add-entity", authenticateToken, async (req, res) => {
  const { name, description, huggingFaceModelName, huggingFaceModelType } =
    req.body;

  console.log("body.name: ", req.body.name);
  console.log("body.description: ", req.body.description);
  console.log("body.huggingFaceModelName: ", req.body.huggingFaceModelName);
  console.log("body.huggingFaceModelType: ", req.body.huggingFaceModelType);

  const ai = await ArtificialIntelligence.create({
    name,
    description,
    huggingFaceModelName,
    huggingFaceModelType,
  });

  const entity = await EntityWhoCategorizedArticle.create({
    artificialIntelligenceId: ai.id,
  });

  res.json({
    message: "Artificial Intelligence created successfully",
    ai,
    entity,
  });
});

module.exports = router;
