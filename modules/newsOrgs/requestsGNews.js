const {
  Article,
  NewsApiRequest,
  EntityWhoFoundArticle,
  NewsArticleAggregatorSource,
} = require("newsnexus07db");
const { writeResponseDataFromNewsAggregator } = require("../common");
const fs = require("fs");
const path = require("path");

// Make a single request to the API
async function makeGNewsRequest(
  source,
  // keyword,
  keywordString,
  startDate = false,
  endDate = false,
  max = 10
) {
  const token = source.apiKey;
  if (!endDate) {
    endDate = new Date().toISOString().replace(".000", "");
  } else {
    endDate = new Date(endDate).toISOString().replace(".000", "");
  }
  if (!startDate) {
    // startDate should be 160 days prior to endDate
    startDate = new Date(
      new Date().setDate(
        new Date().getDate() - process.env.COUNT_OF_DAYS_HISTORY_LIMIT
      )
    )
      .toISOString()
      .replace(".000", "");
  } else {
    startDate = new Date(startDate).toISOString().replace(".000", "");
  }
  const keywordLowerCase = keywordString.toLowerCase();

  const urlGnews = `${source.url}search?q=${encodeURIComponent(
    keywordLowerCase
  )}&from=${startDate}&to=${endDate}&max=${max}&lang=en&token=${token}`;

  let requestResponseData;
  let newsApiRequestObj;

  const requestResponse = await fetch(urlGnews);
  requestResponseData = await requestResponse.json();

  // create new NewsApiRequest
  newsApiRequestObj = await NewsApiRequest.create({
    newsArticleAggregatorSourceId: source.id,
    andString: keywordString,
    dateStartOfRequest: startDate,
    dateEndOfRequest: new Date(),
    countOfArticlesReceivedFromRequest: requestResponseData.articles.length,
  });

  return { requestResponseData, newsApiRequestObj };
}

// Store the articles of a single request in Aritcle and update NewsApiRequest
async function storeGNewsArticles(
  requestResponseData,
  newsApiRequestObj
  // keywordString
) {
  // leverages the hasOne association from the NewsArticleAggregatorSource model
  const gNewsSource = await NewsArticleAggregatorSource.findOne({
    where: { nameOfOrg: "GNews" },
    include: [{ model: EntityWhoFoundArticle }],
  });

  const entityWhoFoundArticleId = gNewsSource.EntityWhoFoundArticle?.id;
  try {
    let countOfArticlesSavedToDbFromRequest = 0;
    for (let article of requestResponseData.articles) {
      // Append article

      const existingArticle = await Article.findOne({
        where: { url: article.url },
      });
      if (existingArticle) {
        continue;
      }

      await Article.create({
        publicationName: article.source.name,
        title: article.title,
        description: article.description,
        url: article.url,
        urlToImage: article.image,
        publishedDate: article.publishedAt,
        entityWhoFoundArticleId: entityWhoFoundArticleId,
        newsApiRequestId: newsApiRequestObj.id,
      });
      countOfArticlesSavedToDbFromRequest++;
    }
    // Append NewsApiRequest
    await newsApiRequestObj.update({
      countOfArticlesSavedToDbFromRequest: countOfArticlesSavedToDbFromRequest,
    });

    writeResponseDataFromNewsAggregator(
      gNewsSource.id,
      // keyword?.keywordId,
      newsApiRequestObj,
      requestResponseData,
      false
      // newsApiRequest.url
    );
  } catch (error) {
    console.error(error);

    writeResponseDataFromNewsAggregator(
      gNewsSource.id,
      newsApiRequestObj,
      requestResponseData,
      true
      // newsApiRequest.url
    );
  }
}

async function makeGNewsApiRequestDetailed(
  sourceObj,
  startDate,
  endDate,
  keywordsAnd,
  keywordsOr,
  keywordsNot
) {
  console.log("- in makeGNewsApiRequestDetailed");

  function splitPreservingQuotes(str) {
    return str.match(/"[^"]+"|\S+/g)?.map((s) => s.trim()) || [];
  }

  const andArray = splitPreservingQuotes(keywordsAnd ? keywordsAnd : "");
  const orArray = splitPreservingQuotes(keywordsOr ? keywordsOr : "");
  const notArray = splitPreservingQuotes(keywordsNot ? keywordsNot : "");

  console.log(`andArray: ${andArray}`);

  // Step 1: prepare token and dates
  const token = sourceObj.apiKey;
  if (!endDate) {
    endDate = new Date().toISOString().split("T")[0];
  }
  if (!startDate) {
    // startDate should be 29 days prior to endDate - account limitation
    startDate = new Date(new Date().setDate(new Date().getDate() - 29))
      .toISOString()
      .split("T")[0];
  }

  let queryParams = [];

  console.log(`startDate: ${startDate}`);
  const andPart = andArray.length > 0 ? andArray.join(" AND ") : "";
  const orPart = orArray.length > 0 ? `(${orArray.join(" OR ")})` : "";
  const notPart =
    notArray.length > 0 ? notArray.map((k) => `NOT ${k}`).join(" AND ") : "";

  const fullQuery = [andPart, orPart, notPart].filter(Boolean).join(" AND ");
  console.log(`fullQuery: ${fullQuery}`);
  if (fullQuery) {
    queryParams.push(`q=${encodeURIComponent(fullQuery)}`);
  }

  if (startDate) {
    const formattedStartDate = new Date(startDate)
      .toISOString()
      .replace(".000", "");
    queryParams.push(`from=${formattedStartDate}`);
  }

  if (endDate) {
    const formattedEndDate = new Date(endDate)
      .toISOString()
      .replace(".000", "");
    queryParams.push(`to=${formattedEndDate}`);
  }
  queryParams.push(`max=100`);

  // Always required
  queryParams.push("lang=en");
  queryParams.push("country=us");
  queryParams.push(`apikey=${sourceObj.apiKey}`);

  const requestUrl = `${sourceObj.url}search?${queryParams.join("&")}`;
  console.log(` [in makeGNewsApiRequestDetailed] requestUrl: ${requestUrl}`);
  // console.log(` [in makeGNewsApiRequestDetailed] queryParams: ${queryParams}`);

  let status = "success";
  let requestResponseData = null;
  let newsApiRequestObj = null;
  if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "true") {
    const response = await fetch(requestUrl);
    requestResponseData = await response.json();

    if (!requestResponseData.articles) {
      status = "error";
      writeResponseDataFromNewsAggregator(
        source.id,
        { id: "failed", url: requestUrl },
        requestResponseData,
        true
      );
    }
    // Step 4: create new NewsApiRequest
    newsApiRequestObj = await NewsApiRequest.create({
      newsArticleAggregatorSourceId: sourceObj.id,
      dateStartOfRequest: startDate,
      dateEndOfRequest: new Date(),
      countOfArticlesReceivedFromRequest: requestResponseData.articles?.length,
      status,
      url: requestUrl,
      andString: keywordsAnd,
      orString: keywordsOr,
      notString: keywordsNot,
    });
  } else {
    newsApiRequestObj = requestUrl;
  }

  return { requestResponseData, newsApiRequestObj };
}

module.exports = {
  makeGNewsRequest,
  storeGNewsArticles,
  makeGNewsApiRequestDetailed,
};
