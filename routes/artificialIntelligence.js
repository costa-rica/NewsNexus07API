var express = require("express");
var router = express.Router();
const {
  EntityWhoCategorizedArticle,
  ArtificialIntelligence,
  Article,
  ArticleApproved,
} = require("newsnexus07db");
const { authenticateToken } = require("../modules/userAuthentication");
const {
  createFilteredArticlesArray,
} = require("../modules/artificialIntelligence");

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

// 🔹 GET /artificial-intelligence/articles-for-semantic-scoring
router.get(
  "/articles-for-semantic-scoring",
  authenticateToken,
  async (req, res) => {
    const aiModel = await ArtificialIntelligence.findOne({
      where: {
        name: "NewsNexusSemanticScorer02",
        huggingFaceModelName: "Xenova/paraphrase-MiniLM-L6-v2",
        huggingFaceModelType: "feature-extraction",
      },
      include: [
        {
          model: EntityWhoCategorizedArticle,
          as: "EntityWhoCategorizedArticles",
        },
      ],
    });

    const entity = aiModel?.EntityWhoCategorizedArticles?.[0];
    const entityWhoCategorizesId = entity?.id;

    console.log("EntityWhoCategorizedArticle:", entityWhoCategorizesId);
    const articlesArray = await createFilteredArticlesArray(
      entityWhoCategorizesId
    );

    const articlesArrayModified = articlesArray.map((article) => {
      let description = article.description;
      if (article.description === null || article.description === "") {
        const articleApproved = article.ArticleApproveds?.[0];
        if (articleApproved) {
          description = articleApproved.textForPdfReport;
        }
      }
      return {
        id: article.id,
        title: article.title,
        description,
        publishedDate: article.publishedDate,
        url: article.url,
      };
    });

    res.json({
      articleCount: articlesArray.length,
      articlesArray: articlesArrayModified,
    });
  }
);

module.exports = router;
