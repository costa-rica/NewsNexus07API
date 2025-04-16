var express = require("express");
var router = express.Router();
const {
  NewsArticleAggregatorSource,
  NewsApiRequest,
  EntityWhoFoundArticle,
  Keyword,
} = require("newsnexus05db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 POST /news-aggregators/add-aggregator
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
// 🔹 GET /news-aggregators/requests: this sends the list of all the requests the Portal "Get Articles page"
router.get("/requests", authenticateToken, async (req, res) => {
  console.log("- starting /requests");
  const newsApiRequestsArray = await NewsApiRequest.findAll({
    include: [{ model: NewsArticleAggregatorSource, Keyword }],
  });
  console.log(`- newsApiRequestsArray.length: ${newsApiRequestsArray.length}`);
  const arrayForTable = [];
  for (let request of newsApiRequestsArray) {
    let keyword = "";
    if (request.keywordId) {
      const keywordObj = await Keyword.findByPk(request.keywordId);
      keyword = keywordObj ? keywordObj.keyword : "Unknown";
    } else {
      let keywordString = "";
      if (request.andString) {
        keywordString = `AND ${request.andString}`;
      }
      if (request.orString) {
        keywordString += ` OR ${request.orString}`;
      }
      if (request.notString) {
        keywordString += ` NOT ${request.notString}`;
      }
      keyword = keywordString;
    }

    arrayForTable.push({
      madeOn: request.dateEndOfRequest,
      nameOfOrg: request.NewsArticleAggregatorSource.nameOfOrg,
      keyword,
      startDate: request.dateStartOfRequest,
      endDate: request.dateEndOfRequest,
      count: request.countOfArticlesReceivedFromRequest,
      countSaved: request.countOfArticlesSavedToDbFromRequest,
      status: request.status,
      andArray: request.andString,
      orArray: request.orString,
      notArray: request.notString,
    });
  }
  console.log(`- returning arrayForTable.length: ${arrayForTable.length}`);

  res.json({ newsApiRequestsArray: arrayForTable });
});
// 🔹 GET /news-aggregators/news-org-apis: returns array of news aggregators
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
