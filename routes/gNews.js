var express = require("express");
var router = express.Router();
const {
  makeGNewsRequest,
  storeGNewsArticles,
} = require("../modules/requestsGNews");
const { checkBodyReturnMissing } = require("../modules/common");
const { NewsArticleAggregatorSource, Keywords } = require("newsnexus05db");

// POST news-searches/request-gnews
router.post("/request", async (req, res) => {
  console.log("- starting request-gnews");
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
    console.log(`- got correct body ${JSON.stringify(req.body)}`);
    const gNewsSourceObj = await NewsArticleAggregatorSource.findOne({
      where: { nameOfOrg: "GNews" },
    });
    // console.log(gNewsSourceObj);
    const keywordObj = await Keywords.findOne({
      where: { keyword: keywordString },
    });
    const keywordObjModified = { ...keywordObj, keywordId: keywordObj.id };
    // console.log(keywordObj);
    // // 2. make request
    // console.log(`- making request`);
    const { requestResponseData, newsApiRequest } = await makeGNewsRequest(
      gNewsSourceObj,
      keywordObjModified,
      startDate,
      1
    );

    // // 3 save articles to db
    // console.log(`- saving articles`);
    await storeGNewsArticles(
      requestResponseData,
      newsApiRequest,
      keywordObjModified
    );

    // // --- OBE ---
    // // --- OBE ---
    // // --- OBE ---
    // // --- OBE ---
    // // --- OBE ---

    // // 1. Get the keyword from DB
    // const keywordObj = await Keywords.findByPk(keywordId);
    // if (!keywordObj) {
    //   return res
    //     .status(404)
    //     .json({ result: false, message: "Keyword not found" });
    // }
    // // 2. Get the GNews API base url from the NewsApi table
    // const newsApiRecord = await NewsApi.findByPk(2); // GNews is id = 2
    // if (!newsApiRecord) {
    //   return res
    //     .status(404)
    //     .json({ result: false, message: "GNews API not found" });
    // }

    // const keyword = keywordObj.keyword;
    // const token = newsApiRecord.apiKey;

    // // 2. Construct the GNews API URL
    // // const urlGnews = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
    // const urlGnews = `${newsApiRecord.urlBase}search?q=${encodeURIComponent(
    //   keyword
    // )}&from=${startDate}&to=${endDate}&max=${max}&lang=en&token=${token}`;

    // const response = await fetch(urlGnews);
    // const data = await response.json();

    // // 3. Save raw API response to file
    // await saveApiResponseToFile("gnews", data);

    // if (!data.articles || !Array.isArray(data.articles)) {
    //   return res
    //     .status(500)
    //     .json({ result: false, message: "Invalid response from GNews" });
    // }
    // const filteredArticles = await checkForDupUrlAuthorTitle(data.articles);
    // // 4. Save each article to the Article table
    // let articleCount = 0;
    // for (const item of filteredArticles) {
    //   try {
    //     await Article.create({
    //       sourceName: item.source?.name || null,
    //       sourceId: item.source?.url || null,
    //       author: null, // Not provided by GNews
    //       title: item.title,
    //       description: item.description,
    //       url: item.url,
    //       urlToImage: item.image,
    //       publishedDate: item.publishedAt,
    //       content: item.content,
    //       apiSource: 2, // GNews = id 2
    //       keywordSearch: keyword,
    //     });
    //     articleCount++;
    //   } catch (err) {
    //     console.warn("Skipping article due to DB error:", err.message);
    //   }
    // }

    // // 5. Add a tracking row in NewsApiKeywordContract
    // await NewsApiKeywordContract.create({
    //   keywordId,
    //   newsApiId: 2, // GNews
    //   requestDate: new Date().toISOString().slice(0, 10), // today
    //   requestCount: articleCount,
    //   startDateOfRequest: startDate,
    //   endDateOfRequest: endDate,
    // });

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
