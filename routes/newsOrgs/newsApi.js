var express = require("express");
var router = express.Router();

const { checkBodyReturnMissing } = require("../../modules/common");
const { NewsArticleAggregatorSource, Keyword } = require("newsnexus07db");
const {
  makeNewsApiRequest,
  storeNewsApiArticles,
  makeNewsApiRequestDetailed,
  // makeNewsApiRequestDetailed02,
} = require("../../modules/newsOrgs/requestsNewsApi");

// 🔹 POST news-api/request
router.post("/request", async (req, res) => {
  console.log("- starting request news-api");
  try {
    const { startDate, endDate, keywordString, max } = req.body;

    const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
      "startDate",
      "endDate",
      "keywordString",
    ]);
    if (!isValid) {
      return res.status(400).json({
        result: false,
        message: `Missing ${missingKeys.join(", ")}`,
      });
    }

    // Step 1: find NewsArticleAggregatorSource
    const newsApiSourceObj = await NewsArticleAggregatorSource.findOne({
      where: { nameOfOrg: "NewsAPI" },
      raw: true, // Returns data without all the database gibberish
    });
    // // Step 2: create Keyword obj
    // const keywordObj = await Keyword.findOne({
    //   where: { keyword: keywordString },
    //   raw: true, // Returns data without all the database gibberish
    // });
    // const keywordObjModified = { ...keywordObj, keywordId: keywordObj.id };
    // Step 3: make request
    const { requestResponseData, newsApiRequest } = await makeNewsApiRequest(
      newsApiSourceObj,
      keywordString,
      startDate,
      endDate
    );
    // if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "false") {
    //   return res.status(200).json({
    //     result: true,
    //     newsApiRequest,
    //   });
    // }

    if (requestResponseData.status === "error") {
      return res.status(400).json({
        status: requestResponseData.status,
        result: false,
        message: requestResponseData.message,
      });
    }
    // Step 4: store articles to db
    await storeNewsApiArticles(
      requestResponseData,
      newsApiRequest
      // keywordObjModified
    );

    res.json({
      result: true,
      message: "Request sent successfully",
      newsApiSourceObj,
      // keywordObjModified,
    });
  } catch (error) {
    console.error("Error in /request:", error);
    res.status(500).json({
      result: false,
      message: "NewsNexusAPI internal server error",
      error: error.message,
    });
  }
});

// 🔹 POST /news-api/get-articles [OBE: POST /news-api/detailed-news-api]
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
    where: { nameOfOrg: "NewsAPI" },
    raw: true, // Returns data without all the database gibberish
  });

  const { requestResponseData, newsApiRequest } =
    await makeNewsApiRequestDetailed(
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
    if (requestResponseData.articles) {
      console.log("- articles count: ", requestResponseData.articles.length);
      // Step 4: store articles to db
      await storeNewsApiArticles(requestResponseData, newsApiRequest, null);
    } else {
      console.log("--- > there was no articles element in the response ???/");
      return res.status(400).json({
        status: requestResponseData?.status || "error",
        result: false,
        message: requestResponseData?.message || "Failed to fetch articles",
      });
    }
  }

  // res.status(400).json({
  //   status: requestResponseData?.status || "error",
  //   result: false,
  //   message: newsApiRequest,
  // });
  res.json({
    result: true,
    requestResponseData,
    newsApiRequest,
  });
});

module.exports = router;
