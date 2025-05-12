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

async function storeNewsDataIoArticles(
  requestResponseData,
  newsApiRequest
  // keyword = null
) {
  // leverages the hasOne association from the NewsArticleAggregatorSource model
  const newsApiSource = await NewsArticleAggregatorSource.findOne({
    where: { nameOfOrg: "NewsData.IO" },
    include: [{ model: EntityWhoFoundArticle }],
  });

  const entityWhoFoundArticleId = newsApiSource.EntityWhoFoundArticle?.id;

  try {
    let countOfArticlesSavedToDbFromRequest = 0;
    // for (let article of requestResponseData.articles) {
    for (let article of requestResponseData.results) {
      // Append article

      const existingArticle = await Article.findOne({
        where: { url: article.link },
      });
      if (existingArticle) {
        continue;
      }
      const newArticle = await Article.create({
        publicationName: article.source_name,
        title: article.title,
        author: article?.creator?.[0],
        description: article.description,
        url: article.link,
        urlToImage: article.image_url,
        publishedDate: article.pubDate,
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

// Make a single requuest to the NewsData.IO API
async function makeNewsDataIoRequest(
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

  // Limit to 4 sources
  const includeSourcesArray = includeWebsiteDomainObjArray
    .splice(0, 4)
    .map((obj) => obj.name);
  const excludeSourcesArray = excludeWebsiteDomainObjArray
    .splice(0, 4)
    .map((obj) => obj.name);

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
    queryParams.push(`domainurl=${includeSourcesArray.join(",")}`);
  }

  if (excludeSourcesArray && excludeSourcesArray.length > 0) {
    queryParams.push(`excludedomain=${excludeSourcesArray.join(",")}`);
  }

  const andPart = andArray.length > 0 ? andArray.join(" AND ") : "";
  const orPart = orArray.length > 0 ? `(${orArray.join(" OR ")})` : "";
  const notPart =
    notArray.length > 0 ? notArray.map((k) => `NOT ${k}`).join(" AND ") : "";

  const fullQuery = [andPart, orPart, notPart].filter(Boolean).join(" AND ");

  if (fullQuery) {
    queryParams.push(`q=${encodeURIComponent(fullQuery)}`);
  }

  // if (startDate) {
  //   queryParams.push(`from=${startDate}`);
  // }

  // if (endDate) {
  //   queryParams.push(`to=${endDate}`);
  // }

  // Always required
  queryParams.push("language=en");
  queryParams.push(`apiKey=${source.apiKey}`);
  queryParams.push(`removeduplicate=1`);
  queryParams.push(`country=us`);
  queryParams.push(`excludecategory=entertainment,politics,world`);
  // queryParams.push(`timeframe=48`);

  const requestUrl = `${source.url}latest?${queryParams.join("&")}`;
  console.log("- [makeNewsDataIoRequest] requestUrl", requestUrl);
  let status = "success";
  let requestResponseData = null;
  let newsApiRequest = null;
  if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "true") {
    const response = await fetch(requestUrl);
    requestResponseData = await response.json();

    if (requestResponseData.status === "error") {
      status = "error";
      writeResponseDataFromNewsAggregator(
        source.id,
        { id: "failed", url: requestUrl },
        requestResponseData,
        true
      );
      await handleErrorNewsDataIoRequest(requestResponseData, newsApiRequest);
    }
    // Step 4: create new NewsApiRequest
    newsApiRequest = await NewsApiRequest.create({
      newsArticleAggregatorSourceId: source.id,
      dateStartOfRequest: startDate,
      dateEndOfRequest: endDate,
      countOfArticlesReceivedFromRequest: requestResponseData.results?.length,
      countOfArticlesAvailableFromRequest: requestResponseData?.totalResults,
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

async function handleErrorNewsDataIoRequest(
  requestResponseData,
  newsApiRequest
) {
  if (
    Array.isArray(requestResponseData.results?.message) &&
    typeof requestResponseData.results.message[0]?.message === "string" &&
    requestResponseData.results.message[0].message.includes(
      "The domain you provided does not exist"
    )
  ) {
    console.log(
      "- [makeNewsDataIoRequest] invalid domain: ",
      requestResponseData.results?.message?.[0]?.invalid_domain
    );
    await WebsiteDomain.update(
      {
        isArchievedNewsDataIo: true,
      },
      {
        where: {
          name: requestResponseData.results.message[0].invalid_domain,
        },
      }
    );
  } else {
    console.log("Correctly handled invalid_domain with no message 🤩");
  }

  if (requestResponseData.results.message[0]?.suggestion) {
    console.log(
      "- [makeNewsDataIoRequest] suggestion: ",
      requestResponseData.results.message[0].suggestion
    );
    for (const msg of requestResponseData.results.message) {
      const invalidDomain = msg.invalid_domain;
      const suggestions = msg.suggestion;

      if (invalidDomain) {
        console.log(
          "- [makeNewsDataIoRequest] Archiving invalid domain:",
          invalidDomain
        );
        await WebsiteDomain.update(
          { isArchievedNewsDataIo: true },
          { where: { name: invalidDomain } }
        );
      }

      if (Array.isArray(suggestions)) {
        for (const suggestion of suggestions) {
          try {
            const websiteDomain = await WebsiteDomain.create({
              name: suggestion,
            });
            console.log(
              "- [makeNewsDataIoRequest] Added suggestion:",
              websiteDomain.name
            );
          } catch (err) {
            console.warn(
              `⚠️ Failed to add suggestion ${suggestion}:`,
              err.message
            );
          }
        }
      }
    }
  }
}

module.exports = {
  storeNewsDataIoArticles,
  makeNewsDataIoRequest,
};
