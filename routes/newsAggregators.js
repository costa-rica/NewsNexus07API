var express = require("express");
var router = express.Router();
const {
  NewsArticleAggregatorSource,
  NewsApiRequest,
  EntityWhoFoundArticle,
  Keyword,
  NewsApiRequestWebsiteDomainContract,
  WebsiteDomain,
} = require("newsnexus07db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 POST /news-aggregators/add-aggregator
router.post("/add-aggregator", authenticateToken, async (req, res) => {
  const { nameOfOrg, url, apiKey, state, isApi, isRss } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, ["url"]);

  console.log(`body: ${JSON.stringify(req.body)}`);

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
    isApi,
    isRss,
  });

  // Create EntityWhoFoundArticle record for the admin user
  await EntityWhoFoundArticle.create({
    newsArticleAggregatorSourceId: aggregator.id,
  });

  res.json({ message: "Aggregator added successfully", aggregator });
});
// 🔹 POST /news-aggregators/requests: this sends the list of all the requests the Portal "Get Articles page"
router.post("/requests", authenticateToken, async (req, res) => {
  console.log("- starting /requests");

  const { dateLimitOnRequestMade, includeIsFromAutomation } = req.body;
  console.log(`body: ${JSON.stringify(req.body)}`);

  // Build where clause dynamically
  const whereClause = {};

  if (dateLimitOnRequestMade) {
    whereClause.createdAt = {
      [require("sequelize").Op.gte]: new Date(dateLimitOnRequestMade),
    };
  }

  if (includeIsFromAutomation !== true) {
    whereClause.isFromAutomation = false;
  }

  const newsApiRequestsArray = await NewsApiRequest.findAll({
    where: whereClause,
    include: [
      {
        model: NewsArticleAggregatorSource,
      },

      {
        model: NewsApiRequestWebsiteDomainContract,
        include: [
          {
            model: WebsiteDomain,
          },
        ],
      },
    ],
  });

  const arrayForTable = [];
  for (let request of newsApiRequestsArray) {
    let keyword = "";

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

    let includeSourcesArray = [];
    let excludeSourcesArray = [];
    let includeString = "";
    let excludeString = "";
    // console.log(JSON.stringify(request.NewsApiRequestWebsiteDomainContracts));
    if (request.NewsApiRequestWebsiteDomainContracts.length > 0) {
      const excludeArrayForString = [];
      const includeArrayForString = [];
      request.NewsApiRequestWebsiteDomainContracts.forEach((domainContract) => {
        if (domainContract.includedOrExcludedFromRequest === "excluded") {
          excludeSourcesArray.push(domainContract.WebsiteDomain);
          excludeArrayForString.push(domainContract.WebsiteDomain.name);
        }
        if (domainContract.includedOrExcludedFromRequest === "included") {
          includeSourcesArray.push(domainContract.WebsiteDomain);
          includeArrayForString.push(domainContract.WebsiteDomain.name);
        }
      });
      includeString = includeArrayForString.join(", ");
      excludeString = excludeArrayForString.join(", ");
    }

    if (includeString) {
      // console.log(`- includeString: ${includeString}`);
      keyword += ` INCLUDE ${includeString}`;
    }
    if (excludeString) {
      // console.log(`- excludeString: ${excludeString}`);
      keyword += ` EXCLUDE ${excludeString}`;
    }

    arrayForTable.push({
      // madeOn: request.dateEndOfRequest,
      madeOn: request.createdAt.toISOString().split("T")[0],
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
      includeSourcesArray,
      includeString,
      excludeSourcesArray,
      excludeString,
    });
    // sort arrayForTable by madeOn descending
    arrayForTable.sort((a, b) => new Date(b.madeOn) - new Date(a.madeOn));
  }

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

// 🔹 POST /update/:newsArticleAggregatorSourceId: Update News Article Aggregator Source (PATCH-like behavior)
router.post(
  "/update/:newsArticleAggregatorSourceId",
  authenticateToken, // Ensure the user is authenticated
  async (req, res) => {
    const { newsArticleAggregatorSourceId } = req.params;
    const { nameOfOrg, url, apiKey, state, isApi, isRss } = req.body;

    console.log(
      `Updating news article aggregator source ${newsArticleAggregatorSourceId}`
    );

    // Find the user by ID
    const newsArticleAggregatorSource =
      await NewsArticleAggregatorSource.findByPk(newsArticleAggregatorSourceId);
    if (!newsArticleAggregatorSource) {
      return res
        .status(404)
        .json({ error: "News article aggregator source not found" });
    }

    // Prepare update object (only include non-null fields)
    const updatedFields = {};
    if (nameOfOrg) updatedFields.nameOfOrg = nameOfOrg;
    if (url) updatedFields.url = url;
    if (apiKey) updatedFields.apiKey = apiKey;
    if (state) updatedFields.state = state;
    if (typeof isApi === "boolean") {
      updatedFields.isApi = isApi;
    }
    if (typeof isRss === "boolean") {
      updatedFields.isRss = isRss;
    }

    // Perform the update if there are fields to update
    if (Object.keys(updatedFields).length > 0) {
      await newsArticleAggregatorSource.update(updatedFields);
      console.log(
        `News article aggregator source ${newsArticleAggregatorSourceId} updated successfully`
      );
    } else {
      console.log(
        `No updates applied for news article aggregator source ${newsArticleAggregatorSourceId}`
      );
    }

    res
      .status(200)
      .json({ message: "Mise à jour réussie.", newsArticleAggregatorSource });
  }
);

// 🔹 DELETE /news-aggregators/:newsArticleAggregatorSourceId: Delete News Article Aggregator Source
router.delete(
  "/:newsArticleAggregatorSourceId",
  authenticateToken, // Ensure the user is authenticated
  async (req, res) => {
    const { newsArticleAggregatorSourceId } = req.params;

    console.log(
      `Deleting news article aggregator source ${newsArticleAggregatorSourceId}`
    );

    // Find the user by ID
    const newsArticleAggregatorSource =
      await NewsArticleAggregatorSource.findByPk(newsArticleAggregatorSourceId);
    if (!newsArticleAggregatorSource) {
      return res
        .status(404)
        .json({ error: "News article aggregator source not found" });
    }

    // Perform the delete
    await newsArticleAggregatorSource.destroy();
    console.log(
      `News article aggregator source ${newsArticleAggregatorSourceId} deleted successfully`
    );

    res.status(200).json({ message: "Suppression réussie." });
  }
);

module.exports = router;
