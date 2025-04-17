const {
  Article,
  NewsApiRequest,
  EntityWhoFoundArticle,
  NewsArticleAggregatorSource,
  ArticleContent,
  WebsiteDomain,
  NewsApiRequestWebsiteDomainContract,
} = require("newsnexus07db");
const { writeResponseDataFromNewsAggregator } = require("../common");
const fs = require("fs");
const path = require("path");

// Make a single requuest to the News API API
async function makeNewsApiRequest(
  source,
  // keyword,
  keywordString,
  startDate,
  endDate,
  max = 100
) {
  // Step 1: prepare token and dates
  const token = source.apiKey;
  if (!endDate) {
    endDate = new Date().toISOString().split("T")[0];
  }
  if (!startDate) {
    // startDate should be 29 days prior to endDate - account limitation
    startDate = new Date(new Date().setDate(new Date().getDate() - 29))
      .toISOString()
      .split("T")[0];
  }

  console.log("- keywordString :  ", keywordString);
  // Step 2: make request url
  const urlNewsApi = `${source.url}everything?q=${encodeURIComponent(
    keywordString
  )}&from=${startDate}&to=${endDate}&pageSize=${max}&language=en&apiKey=${token}`;

  // console.log("- urlNewsApi :  ", urlNewsApi);
  // if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "false") {
  //   return { requestResponseData: null, newsApiRequest: urlNewsApi };
  // }
  // Step 3: send request
  const response = await fetch(urlNewsApi);
  const requestResponseData = await response.json();

  // console.log("- requestResponseData.articles", requestResponseData.articles);

  let status = "success";
  if (!requestResponseData.articles) {
    status = "error";
    writeResponseDataFromNewsAggregator(
      source.id,
      { id: "failed", url: urlNewsApi },
      requestResponseData,
      true
    );
    // return { requestResponseData, newsApiRequest: null };
  }

  // Step 4: create new NewsApiRequest
  const newsApiRequest = await NewsApiRequest.create({
    newsArticleAggregatorSourceId: source.id,
    // keywordId: keyword.keywordId,
    andString: keywordString,
    dateStartOfRequest: startDate,
    dateEndOfRequest: new Date(),
    countOfArticlesReceivedFromRequest: requestResponseData.articles?.length,
    status,
    url: urlNewsApi,
  });

  return { requestResponseData, newsApiRequest };
}

async function storeNewsApiArticles(
  requestResponseData,
  newsApiRequest
  // keyword = null
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
        newsApiRequestId: newsApiRequest.id,
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

    writeResponseDataFromNewsAggregator(
      newsApiSource.id,
      // keyword?.keywordId,
      newsApiRequest,
      requestResponseData,
      false
      // newsApiRequest.url
    );
  } catch (error) {
    console.error(error);
    writeResponseDataFromNewsAggregator(
      newsApiSource.id,
      newsApiRequest,
      // keyword?.keywordId,
      requestResponseData,
      true
      // newsApiRequest.url
    );
  }
}

// Make a single requuest to the News API API
async function makeNewsApiRequestDetailed(
  source,
  startDate,
  endDate,
  includeWebsiteDomainObjArray = [],
  excludeWebsiteDomainObjArray = [],
  keywordsAnd,
  keywordsOr,
  keywordsNot
  // max = 100
) {
  // console.log(`keywordsAnd: ${keywordsAnd}, ${typeof keywordsAnd}`);
  // console.log(`keywordsOr: ${keywordsOr}, ${typeof keywordsOr}`);
  // console.log(`keywordsNot: ${keywordsNot}, ${typeof keywordsNot}`);

  // if (Array.isArray(includeWebsiteDomainObjArray)) {
  //   const includeSourcesArrayNames = includeWebsiteDomainObjArray.map(
  //     (obj) => obj.name
  //   );
  //   console.log(
  //     "[makeNewsApiRequestDetailed02] includeSourcesArrayNames:",
  //     includeSourcesArrayNames
  //   );
  // } else {
  //   console.log(
  //     "[makeNewsApiRequestDetailed02] includeWebsiteDomainObjArray is not an array:",
  //     includeWebsiteDomainObjArray
  //   );
  // }

  function splitPreservingQuotes(str) {
    return str.match(/"[^"]+"|\S+/g)?.map((s) => s.trim()) || [];
  }

  const andArray = splitPreservingQuotes(keywordsAnd ? keywordsAnd : "");
  const orArray = splitPreservingQuotes(keywordsOr ? keywordsOr : "");
  const notArray = splitPreservingQuotes(keywordsNot ? keywordsNot : "");

  const includeSourcesArray = includeWebsiteDomainObjArray.map(
    (obj) => obj.name
  );
  const excludeSourcesArray = excludeWebsiteDomainObjArray.map(
    (obj) => obj.name
  );

  // Step 1: prepare token and dates
  const token = source.apiKey;
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

  if (includeSourcesArray && includeSourcesArray.length > 0) {
    queryParams.push(`domains=${includeSourcesArray.join(",")}`);
  }

  if (excludeSourcesArray && excludeSourcesArray.length > 0) {
    queryParams.push(`excludeDomains=${excludeSourcesArray.join(",")}`);
  }

  const andPart = andArray.length > 0 ? andArray.join(" AND ") : "";
  const orPart = orArray.length > 0 ? `(${orArray.join(" OR ")})` : "";
  const notPart =
    notArray.length > 0 ? notArray.map((k) => `NOT ${k}`).join(" AND ") : "";

  const fullQuery = [andPart, orPart, notPart].filter(Boolean).join(" AND ");

  if (fullQuery) {
    queryParams.push(`q=${encodeURIComponent(fullQuery)}`);
  }

  if (startDate) {
    queryParams.push(`from=${startDate}`);
  }

  if (endDate) {
    queryParams.push(`to=${endDate}`);
  }

  // Always required
  queryParams.push("language=en");
  queryParams.push(`apiKey=${source.apiKey}`);

  const requestUrl = `${source.url}everything?${queryParams.join("&")}`;
  console.log("- [makeNewsApiRequestDetailed] requestUrl", requestUrl);
  let status = "success";
  let requestResponseData = null;
  let newsApiRequest = null;
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
    newsApiRequest = await NewsApiRequest.create({
      newsArticleAggregatorSourceId: source.id,
      dateStartOfRequest: startDate,
      dateEndOfRequest: new Date(),
      countOfArticlesReceivedFromRequest: requestResponseData.articles?.length,
      status,
      url: requestUrl,
      andString: keywordsAnd,
      orString: keywordsOr,
      notString: keywordsNot,
    });

    for (const domain of includeWebsiteDomainObjArray) {
      await NewsApiRequestWebsiteDomainContract.create({
        newsApiRequestId: newsApiRequest.id,
        websiteDomainId: domain.websiteDomainId,
        includedOrExcludedFromRequest: "included",
      });
    }
    for (const domain of excludeWebsiteDomainObjArray) {
      await NewsApiRequestWebsiteDomainContract.create({
        newsApiRequestId: newsApiRequest.id,
        websiteDomainId: domain.websiteDomainId,
        includedOrExcludedFromRequest: "excluded",
      });
    }
  } else {
    newsApiRequest = requestUrl;
  }

  return { requestResponseData, newsApiRequest };
}

module.exports = {
  makeNewsApiRequest,
  storeNewsApiArticles,
  makeNewsApiRequestDetailed,
};
