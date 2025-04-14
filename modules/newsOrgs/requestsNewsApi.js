const {
  Article,
  NewsApiRequest,
  EntityWhoFoundArticle,
  NewsArticleAggregatorSource,
  ArticleContent,
} = require("newsnexus05db");
const { writeResponseDataFromNewsAggregator } = require("../common");
const fs = require("fs");
const path = require("path");

// Make a single requuest to the News API API
async function makeNewsApiRequest(source, keyword, startDate, endDate, max) {
  // Step 1: prepare token and dates
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

  console.log("- keyword :  ", keyword);
  // Step 2: make request url
  const urlNewsApi = `${source.url}everything?q=${encodeURIComponent(
    keyword.keyword
  )}&from=${startDate}&to=${endDate}&pageSize=${max}&language=en&apiKey=${token}`;

  console.log("- urlNewsApi :  ", urlNewsApi);
  if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "false") {
    return { requestResponseData: null, newsApiRequest: urlNewsApi };
  }
  // Step 3: send request
  const response = await fetch(urlNewsApi);
  const requestResponseData = await response.json();

  console.log("- requestResponseData.articles", requestResponseData.articles);

  let status = "success";
  if (!requestResponseData.articles) {
    status = "error";
    writeResponseDataFromNewsAggregator(
      source.id,
      keyword.keywordId,
      requestResponseData,
      true
    );
    // return { requestResponseData, newsApiRequest: null };
  }

  // Step 4: create new NewsApiRequest
  const newsApiRequest = await NewsApiRequest.create({
    newsArticleAggregatorSourceId: source.id,
    keywordId: keyword.keywordId,
    dateStartOfRequest: startDate,
    dateEndOfRequest: new Date(),
    countOfArticlesReceivedFromRequest: requestResponseData.articles?.length,
    status,
  });

  return { requestResponseData, newsApiRequest };
}

async function storeNewsApiArticles(
  requestResponseData,
  newsApiRequest,
  keyword
) {
  // leverages the hasOne association from the NewsArticleAggregatorSource model
  const newsApiSource = await NewsArticleAggregatorSource.findOne({
    where: { nameOfOrg: "NewsAPI" },
    include: [{ model: EntityWhoFoundArticle }],
  });

  const entityWhoFoundArticleId = newsApiSource.EntityWhoFoundArticle?.id;

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
      const newArticle = await Article.create({
        publicationName: article.source.name,
        title: article.title,
        author: article.author,
        description: article.description,
        url: article.url,
        urlToImage: article.urlToImage,
        publishedDate: article.publishedAt,
        entityWhoFoundArticleId: entityWhoFoundArticleId,
      });

      // Append ArticleContent
      await ArticleContent.create({
        articleId: newArticle.id,
        content: article.content,
      });
      countOfArticlesSavedToDbFromRequest++;
    }
    // Append NewsApiRequest
    await newsApiRequest.update({
      countOfArticlesSavedToDbFromRequest: countOfArticlesSavedToDbFromRequest,
    });
    // store response JSON file
    // const formattedDate = new Date()
    //   .toISOString()
    //   .split("T")[0]
    //   .replace(/-/g, "");
    // const responseDir = process.env.PATH_TO_API_RESPONSE_JSON_FILES;
    // const responseFileName = `${formattedDate}apiId${newsApiSource.id}keywordId${keyword.keywordId}.json`;
    // const responseFilePath = path.join(responseDir, responseFileName);
    // fs.writeFileSync(
    //   responseFilePath,
    //   JSON.stringify(requestResponseData, null, 2),
    //   "utf-8"
    // );
    writeResponseDataFromNewsAggregator(
      newsApiSource.id,
      keyword.keywordId,
      requestResponseData
    );
  } catch (error) {
    console.error(error);
    // store file with `failedToSaveYYYYMMDDapiId${gNewsSource.id}keywordId${keyword.id}`. json
    // const formattedDate = new Date()
    //   .toISOString()
    //   .split("T")[0]
    //   .replace(/-/g, "");
    // const responseDir = process.env.PATH_TO_API_RESPONSE_JSON_FILES;
    // const failedFileName = `failedToSave${formattedDate}apiId${newsApiSource.id}keywordId${keyword.keywordId}.json`;
    // const failedFilePath = path.join(responseDir, failedFileName);
    // fs.writeFileSync(
    //   failedFilePath,
    //   JSON.stringify(requestResponseData, null, 2),
    //   "utf-8"
    // );
    writeResponseDataFromNewsAggregator(
      newsApiSource.id,
      keyword.keywordId,
      requestResponseData,
      true
    );
  }
}
module.exports = {
  makeNewsApiRequest,
  storeNewsApiArticles,
};
