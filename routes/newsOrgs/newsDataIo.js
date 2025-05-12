var express = require("express");
var router = express.Router();

const { checkBodyReturnMissing } = require("../../modules/common");
const { NewsArticleAggregatorSource } = require("newsnexus07db");
const {
  storeNewsDataIoArticles,
  makeNewsDataIoRequest,
} = require("../../modules/newsOrgs/requestsNewsDataIo");

// parameters for NewsDataIo
// country: `country=us`
// language: `language=en`
//excludecategory: `excludecategory=entertainment,world,politics`

// 🔹 POST /news-data-io/get-articles
router.post("/get-articles", async (req, res) => {
  const {
    startDate,
    endDate,
    includeWebsiteDomainObjArray,
    excludeWebsiteDomainObjArray,
    keywordsAnd,
    keywordsOr,
    keywordsNot,
  } = req.body;
  // NOTE: andArray, orArray, notArray can include exact phrases i.e. "" or not ""

  // if (Array.isArray(includeWebsiteDomainObjArray)) {
  //   const includeSourcesArrayNames = includeWebsiteDomainObjArray.map(
  //     (obj) => obj.name
  //   );
  //   console.log("includeSourcesArrayNames:", includeSourcesArrayNames);
  // } else {
  //   console.log(
  //     "includeWebsiteDomainObjArray is not an array:",
  //     includeWebsiteDomainObjArray
  //   );
  // }

  // Step 1: find NewsArticleAggregatorSource
  const newsApiSourceObj = await NewsArticleAggregatorSource.findOne({
    where: { nameOfOrg: "NewsData.IO" },
    raw: true, // Returns data without all the database gibberish
  });

  const { requestResponseData, newsApiRequest } = await makeNewsDataIoRequest(
    newsApiSourceObj,
    startDate,
    endDate,
    includeWebsiteDomainObjArray,
    excludeWebsiteDomainObjArray,
    keywordsAnd,
    keywordsOr,
    keywordsNot
  );
  // console.log("includeWebsiteDomainObjArray:", includeWebsiteDomainObjArray);

  // if (Array.isArray(includeWebsiteDomainObjArray)) {
  //   const includeSourcesArrayNames = includeWebsiteDomainObjArray.map(
  //     (obj) => obj.name
  //   );
  //   console.log("includeSourcesArrayNames:", includeSourcesArrayNames);
  // } else {
  //   console.log(
  //     "includeWebsiteDomainObjArray is not an array:",
  //     includeWebsiteDomainObjArray
  //   );
  // }

  if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "true") {
    if (requestResponseData.status === "success") {
      console.log("- articles count: ", requestResponseData.results.length);
      // Step 4: store articles to db
      await storeNewsDataIoArticles(requestResponseData, newsApiRequest, null);
    } else {
      console.log(
        "--- > [NewsData.IO] there was no articles element in the response ???/"
      );
      return res.status(400).json({
        status: requestResponseData?.status || "error",
        result: false,
        message: requestResponseData?.message || "Failed to fetch articles",
      });
    }
  }

  res.json({
    result: true,
    requestResponseData,
    newsApiRequest,
  });
});

module.exports = router;
