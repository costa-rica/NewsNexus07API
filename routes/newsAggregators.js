var express = require("express");
var router = express.Router();
const {
  NewsArticleAggregatorSource,
  NewsApiRequest,
  EntityWhoFoundArticle,
  Keywords,
} = require("newsnexus05db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 Add API POST /news-aggregators/add-aggregator
router.post("/add-aggregator", authenticateToken, async (req, res) => {
  const { nameOfOrg, url, apiKey, state, isApi, isRss } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, ["url"]);

  if (!isValid) {
    return res.status(400).json({ error: `Missing ${missingKeys.join(", ")}` });
  }

  const existingAggregator = await NewsArticleAggregatorSource.findOne({
    where: { url },
  });
  if (existingAggregator) {
    return res.status(400).json({ error: "Aggregator already exists" });
  }

  const aggregator = await NewsArticleAggregatorSource.create({
    nameOfOrg,
    url,
    apiKey,
    state,
    isApi: isApi === "true",
    isRss: isRss === "true",
  });

  // Create EntityWhoFoundArticle record for the admin user
  await EntityWhoFoundArticle.create({
    newsArticleAggregatorSourceId: aggregator.id,
  });

  res.json({ message: "Aggregator added successfully", aggregator });
});
// 🔹 Add API GET /news-aggregators/requests
router.get("/requests", authenticateToken, async (req, res) => {
  // console.log("- starting /requests");
  const newsApiRequestsArray = await NewsApiRequest.findAll({
    include: [{ model: NewsArticleAggregatorSource, Keywords }],
  });
  // console.log(JSON.stringify(newsApiRequestsArray, null, 2));
  const arrayForTable = [];
  for (let request of newsApiRequestsArray) {
    if (!request.keywordId) {
      continue;
    }
    const keywordObj = await Keywords.findByPk(request.keywordId);
    const keyword = keywordObj ? keywordObj.keyword : "Unknown";

    arrayForTable.push({
      madeOn: request.dateEndOfRequest,
      nameOfOrg: request.NewsArticleAggregatorSource.nameOfOrg,
      keyword,
      startDate: request.dateStartOfRequest,
      endDate: request.dateEndOfRequest,
      count: request.countOfArticlesReceivedFromRequest,
      countSaved: request.countOfArticlesSavedToDbFromRequest,
      status: request.status,
    });
  }

  res.json({ newsApiRequestsArray: arrayForTable });
});
// 🔹 Add API GET /news-aggregators/news-org-apis: returns array of news aggregators
router.get("/news-org-apis", authenticateToken, async (req, res) => {
  const aggregatorsDbObjArray = await NewsArticleAggregatorSource.findAll({
    where: { isApi: true },
  });
  const newsOrgArray = [];
  for (let aggregator of aggregatorsDbObjArray) {
    newsOrgArray.push({
      id: aggregator.id,
      nameOfOrg: aggregator.nameOfOrg,
      url: aggregator.url,
    });
  }
  res.json({ newsOrgArray });
});
module.exports = router;
