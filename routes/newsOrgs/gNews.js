var express = require("express");
var router = express.Router();
const {
  makeGNewsRequest,
  storeGNewsArticles,
  makeGNewsApiRequestDetailed,
} = require("../../modules/newsOrgs/requestsGNews");
const { checkBodyReturnMissing } = require("../../modules/common");
const { NewsArticleAggregatorSource } = require("newsnexus07db");

// POST /gnews/request
router.post("/request", async (req, res) => {
  // console.log("- starting request-gnews");
  try {
    const { startDate, endDate, keywordString } = req.body;

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
    // console.log(`- got correct body ${JSON.stringify(req.body)}`);
    const gNewsSourceObj = await NewsArticleAggregatorSource.findOne({
      where: { nameOfOrg: "GNews" },
      raw: true, // Returns data without all the database gibberish
    });
    // console.log(gNewsSourceObj);
    // const keywordObj = await Keyword.findOne({
    //   where: { keyword: keywordString },
    //   raw: true, // Returns data without all the database gibberish
    // });
    // const keywordObjModified = { ...keywordObj, keywordId: keywordObj.id };
    // console.log(keywordObj);
    // // 2. make request
    // console.log(`- making request`);
    const { requestResponseData, newsApiRequestObj } = await makeGNewsRequest(
      gNewsSourceObj,
      keywordString,
      startDate,
      endDate
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
    await storeGNewsArticles(requestResponseData, newsApiRequestObj);

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

// 🔹 POST /gnews/get-articles [OBE: POST /gnews/request-detailed]
router.post("/get-articles", async (req, res) => {
  const { startDate, endDate, keywordsAnd, keywordsOr, keywordsNot } = req.body;
  // Step 1: find NewsArticleAggregatorSource
  const gNewsSourceObj = await NewsArticleAggregatorSource.findOne({
    where: { nameOfOrg: "GNews" },
    raw: true, // Returns data without all the database gibberish
  });
  try {
    const { requestResponseData, newsApiRequestObj } =
      await makeGNewsApiRequestDetailed(
        gNewsSourceObj,
        startDate,
        endDate,
        keywordsAnd,
        keywordsOr,
        keywordsNot
      );

    if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "true") {
      if (requestResponseData.articles) {
        console.log("- articles count: ", requestResponseData.articles.length);
        // Step 4: store articles to db

        await storeGNewsArticles(requestResponseData, newsApiRequestObj);
      } else {
        console.log("--- > there was no articles element in the response ???/");
        return res.status(400).json({
          status: requestResponseData?.status || "error",
          result: false,
          message: requestResponseData?.message || "Failed to fetch articles",
        });
      }
    } else {
      console.log("--- > ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES is false");
      console.log(
        `requestResponseData: ${JSON.stringify(requestResponseData, null, 2)}`
      );
    }

    res.json({
      result: true,
      requestResponseData,
      newsApiRequestObj,
    });
  } catch (error) {
    console.error("Error in /request-detailed-gnews:", error);
    res.status(500).json({
      result: false,
      message: "NewsNexusAPI internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
