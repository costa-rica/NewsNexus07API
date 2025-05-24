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
const { sqlQueryRequestsFromApi } = require("../modules/queriesSql");
const { DateTime } = require("luxon");

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
  // console.log("- starting /requests");

  const { dateLimitOnRequestMade, includeIsFromAutomation } = req.body;
  // console.log(`body: ${JSON.stringify(req.body)}`);

  // Build where clause dynamically
  // const whereClause = {};

  // if (dateLimitOnRequestMade) {
  //   whereClause.createdAt = {
  //     [require("sequelize").Op.gte]: new Date(dateLimitOnRequestMade),
  //   };
  // }

  // if (includeIsFromAutomation !== true) {
  //   whereClause.isFromAutomation = false;
  // }

  const rawRows = await sqlQueryRequestsFromApi({
    dateLimitOnRequestMade,
    includeIsFromAutomation,
  });
  // const newsApiRequestsArray = await NewsApiRequest.findAll({
  //   where: whereClause,
  //   include: [
  //     {
  //       model: NewsArticleAggregatorSource,
  //     },

  //     {
  //       model: NewsApiRequestWebsiteDomainContract,
  //       include: [
  //         {
  //           model: WebsiteDomain,
  //         },
  //       ],
  //     },
  //   ],
  // });

  const requestsMap = new Map();

  for (const row of rawRows) {
    if (!requestsMap.has(row.newsApiRequestId)) {
      requestsMap.set(row.newsApiRequestId, {
        // madeOn: row.createdAt.toISOString().split("T")[0],
        madeOn: DateTime.fromISO(row.createdAt).toFormat("yyyy-MM-dd"),
        nameOfOrg: row.nameOfOrg,
        keyword: "",
        startDate: row.dateStartOfRequest,
        endDate: row.dateEndOfRequest,
        count: row.countOfArticlesReceivedFromRequest,
        countSaved: row.countOfArticlesSavedToDbFromRequest,
        status: row.status,
        andArray: row.andString,
        orArray: row.orString,
        notArray: row.notString,
        includeSourcesArray: [],
        excludeSourcesArray: [],
      });
    }

    const request = requestsMap.get(row.newsApiRequestId);

    // Build keyword string
    let keywordString = "";
    if (request.andArray) keywordString += `AND ${request.andArray}`;
    if (request.orArray) keywordString += ` OR ${request.orArray}`;
    if (request.notArray) keywordString += ` NOT ${request.notArray}`;
    request.keyword = keywordString;

    // Handle domains
    if (row.domainName) {
      const domainObj = { name: row.domainName };
      if (row.includedOrExcludedFromRequest === "included") {
        request.includeSourcesArray.push(domainObj);
      }
      if (row.includedOrExcludedFromRequest === "excluded") {
        request.excludeSourcesArray.push(domainObj);
      }
    }
  }

  const newsApiRequestsArray = Array.from(requestsMap.values()).map((r) => ({
    ...r,
    includeString: r.includeSourcesArray.map((d) => d.name).join(", "),
    excludeString: r.excludeSourcesArray.map((d) => d.name).join(", "),
  }));

  // // ---- START OLD Logic
  // const arrayForTable = [];
  // for (let request of newsApiRequestsArray) {
  //   let keyword = "";

  //   let keywordString = "";
  //   if (request.andString) {
  //     keywordString = `AND ${request.andString}`;
  //   }
  //   if (request.orString) {
  //     keywordString += ` OR ${request.orString}`;
  //   }
  //   if (request.notString) {
  //     keywordString += ` NOT ${request.notString}`;
  //   }
  //   keyword = keywordString;

  //   let includeSourcesArray = [];
  //   let excludeSourcesArray = [];
  //   let includeString = "";
  //   let excludeString = "";
  //   // console.log(JSON.stringify(request.NewsApiRequestWebsiteDomainContracts));
  //   if (request.NewsApiRequestWebsiteDomainContracts.length > 0) {
  //     const excludeArrayForString = [];
  //     const includeArrayForString = [];
  //     request.NewsApiRequestWebsiteDomainContracts.forEach((domainContract) => {
  //       if (domainContract.includedOrExcludedFromRequest === "excluded") {
  //         excludeSourcesArray.push(domainContract.WebsiteDomain);
  //         excludeArrayForString.push(domainContract.WebsiteDomain.name);
  //       }
  //       if (domainContract.includedOrExcludedFromRequest === "included") {
  //         includeSourcesArray.push(domainContract.WebsiteDomain);
  //         includeArrayForString.push(domainContract.WebsiteDomain.name);
  //       }
  //     });
  //     includeString = includeArrayForString.join(", ");
  //     excludeString = excludeArrayForString.join(", ");
  //   }

  //   if (includeString) {
  //     // console.log(`- includeString: ${includeString}`);
  //     keyword += ` INCLUDE ${includeString}`;
  //   }
  //   if (excludeString) {
  //     // console.log(`- excludeString: ${excludeString}`);
  //     keyword += ` EXCLUDE ${excludeString}`;
  //   }

  //   arrayForTable.push({
  //     // madeOn: request.dateEndOfRequest,
  //     madeOn: request.createdAt.toISOString().split("T")[0],
  //     nameOfOrg: request.NewsArticleAggregatorSource.nameOfOrg,
  //     keyword,
  //     startDate: request.dateStartOfRequest,
  //     endDate: request.dateEndOfRequest,
  //     count: request.countOfArticlesReceivedFromRequest,
  //     countSaved: request.countOfArticlesSavedToDbFromRequest,
  //     status: request.status,
  //     andArray: request.andString,
  //     orArray: request.orString,
  //     notArray: request.notString,
  //     includeSourcesArray,
  //     includeString,
  //     excludeSourcesArray,
  //     excludeString,
  //   });
  //   // sort arrayForTable by madeOn descending
  //   arrayForTable.sort((a, b) => new Date(b.madeOn) - new Date(a.madeOn));
  // }
  // // ----- END old logic
  // res.json({ newsApiRequestsArray: arrayForTable });
  res.json({ newsApiRequestsArray });
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
