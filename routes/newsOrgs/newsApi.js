var express = require("express");
var router = express.Router();

const { checkBodyReturnMissing } = require("../../modules/common");
const { NewsArticleAggregatorSource, Keywords } = require("newsnexus05db");
const {
  makeNewsApiRequest,
  storeNewsApiArticles,
} = require("../../modules/newsOrgs/requestsNewsApi");

// POST news-api/request
router.post("/request", async (req, res) => {
  console.log("- starting request news-api");
  try {
    const { startDate, endDate, keywordString, max } = req.body;

    const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
      "startDate",
      "endDate",
      "keywordString",
      "max",
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
    // Step 2: create Keyword obj
    const keywordObj = await Keywords.findOne({
      where: { keyword: keywordString },
      raw: true, // Returns data without all the database gibberish
    });
    const keywordObjModified = { ...keywordObj, keywordId: keywordObj.id };
    // Step 3: make request
    const { requestResponseData, newsApiRequest } = await makeNewsApiRequest(
      newsApiSourceObj,
      keywordObjModified,
      startDate,
      endDate,
      max
    );
    if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "false") {
      return res.status(200).json({
        result: true,
        newsApiRequest,
      });
    }

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
      newsApiRequest,
      keywordObjModified
    );

    res.json({
      result: true,
      message: "Request sent successfully",
      newsApiSourceObj,
      keywordObjModified,
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

module.exports = router;
