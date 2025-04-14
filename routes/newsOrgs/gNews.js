var express = require("express");
var router = express.Router();
const {
  makeGNewsRequest,
  storeGNewsArticles,
} = require("../../modules/newsOrgs/requestsGNews");
const { checkBodyReturnMissing } = require("../../modules/common");
const { NewsArticleAggregatorSource, Keywords } = require("newsnexus05db");

// POST /gnews/request
router.post("/request", async (req, res) => {
  // console.log("- starting request-gnews");
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
    // console.log(`- got correct body ${JSON.stringify(req.body)}`);
    const gNewsSourceObj = await NewsArticleAggregatorSource.findOne({
      where: { nameOfOrg: "GNews" },
      raw: true, // Returns data without all the database gibberish
    });
    // console.log(gNewsSourceObj);
    const keywordObj = await Keywords.findOne({
      where: { keyword: keywordString },
      raw: true, // Returns data without all the database gibberish
    });
    const keywordObjModified = { ...keywordObj, keywordId: keywordObj.id };
    // console.log(keywordObj);
    // // 2. make request
    // console.log(`- making request`);
    const { requestResponseData, newsApiRequestObj } = await makeGNewsRequest(
      gNewsSourceObj,
      keywordObjModified,
      startDate,
      endDate,
      max
    );

    // if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "false") {
    //   return res.status(200).json({
    //     result: true,
    //     newsApiRequestObj,
    //   });
    // } else {
    //   console.log(
    //     `what is process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES: ${process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES}`
    //   );
    // }

    // // 3 save articles to db
    // console.log(`- saving articles`);
    await storeGNewsArticles(
      requestResponseData,
      newsApiRequestObj,
      keywordObjModified
    );

    res.json({
      result: true,
      message: `Imported ## articles from GNews.`,
    });
  } catch (error) {
    console.error("Error in /request-gnews:", error);
    res.status(500).json({
      result: false,
      message: "NewsNexusAPI internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
