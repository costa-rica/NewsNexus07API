const {
  Article,
  NewsApiRequest,
  EntityWhoFoundArticle,
  NewsArticleAggregatorSource,
} = require("newsnexus05db");

const fs = require("fs");
const path = require("path");

// Make a single request to the API
async function makeGNewsRequest(
  source,
  keyword,
  startDate = false,
  endDate = false,
  max = 10
) {
  const token = source.apiKey;
  if (!endDate) {
    endDate = new Date().toISOString().split("T")[0];
  }
  if (!startDate) {
    // startDate should be 160 days prior to endDate
    startDate = new Date(
      new Date().setDate(
        new Date().getDate() - process.env.COUNT_OF_DAYS_HISTORY_LIMIT
      )
    )
      .toISOString()
      .split("T")[0];
  }

  const urlGnews = `${source.url}search?q=${encodeURIComponent(
    keyword.keyword
  )}&from=${startDate}&to=${endDate}&max=${max}&lang=en&token=${token}`;

  let requestResponseData;
  let newsApiRequestObj;

  const requestResponse = await fetch(urlGnews);
  requestResponseData = await requestResponse.json();

  console.log(urlGnews);

  // create new NewsApiRequest
  newsApiRequestObj = await NewsApiRequest.create({
    newsArticleAggregatorSourceId: source.id,
    keywordId: keyword.keywordId,
    dateStartOfRequest: startDate,
    dateEndOfRequest: new Date(),
    countOfArticlesReceivedFromRequest: requestResponseData.articles.length,
  });

  return { requestResponseData, newsApiRequestObj };
}

// Store the articles of a single request in Aritcle and update NewsApiRequest
async function storeGNewsArticles(
  requestResponseData,
  newsApiRequest,
  keyword
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
        newsApiRequestId: newsApiRequest.id,
      });
      countOfArticlesSavedToDbFromRequest++;
    }
    // Append NewsApiRequest
    await newsApiRequest.update({
      countOfArticlesSavedToDbFromRequest: countOfArticlesSavedToDbFromRequest,
    });
    // store file with `YYYYMMDDapiId${gNewsSource.id}keywordId${keyword.id}`. json
    // store response JSON file
    const formattedDate = new Date()
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "");
    const responseDir = process.env.PATH_TO_API_RESPONSE_JSON_FILES;
    const responseFileName = `${formattedDate}apiId${gNewsSource.id}keywordId${keyword.keywordId}.json`;
    const responseFilePath = path.join(responseDir, responseFileName);
    fs.writeFileSync(
      responseFilePath,
      JSON.stringify(requestResponseData, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error(error);
    // store file with `failedToSaveYYYYMMDDapiId${gNewsSource.id}keywordId${keyword.id}`. json
    const formattedDate = new Date()
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "");
    const responseDir = process.env.PATH_TO_API_RESPONSE_JSON_FILES;
    const failedFileName = `failedToSave${formattedDate}apiId${gNewsSource.id}keywordId${keyword.keywordId}.json`;
    const failedFilePath = path.join(responseDir, failedFileName);
    fs.writeFileSync(
      failedFilePath,
      JSON.stringify(requestResponseData, null, 2),
      "utf-8"
    );
  }
}

module.exports = {
  makeGNewsRequest,
  storeGNewsArticles,
};
