const {
  sequelize,
  NewsApiRequest,
  NewsArticleAggregatorSource,
  NewsApiRequestWebsiteDomainContract,
  WebsiteDomain,
  Article,
  ArticleApproved,
} = require("newsnexus07db");
const { Op } = require("sequelize");
/**
 * Returns article metadata with the max keywordRating and its keyword,
 * filtered by a specific entityWhoCategorizesId.
 *
 * @param {number} entityWhoCategorizesId
 * @param {string|null} publishedDateAfter - Optional publishedDate filter
 * @returns {Promise<Array>} rawArticles
 */
async function createArticlesArrayWithSqlForSemanticKeywordsRating(
  entityWhoCategorizesId,
  publishedDateAfter = null
) {
  let dateCondition = "";
  if (publishedDateAfter) {
    dateCondition = `AND a.publishedDate >= '${publishedDateAfter}'`;
  }

  const sql = `
    SELECT
      a.id,
      a.title,
      a.description,
      a.url,
      a.publishedDate,
      arc.keyword AS keywordOfRating,
      arc.keywordRating
    FROM Articles a
    LEFT JOIN (
      SELECT arc1.*
      FROM ArticleEntityWhoCategorizedArticleContracts arc1
      JOIN (
        SELECT articleId, MAX(keywordRating) AS maxRating
        FROM ArticleEntityWhoCategorizedArticleContracts
        WHERE entityWhoCategorizesId = ${entityWhoCategorizesId}
        GROUP BY articleId
      ) arc2
      ON arc1.articleId = arc2.articleId AND arc1.keywordRating = arc2.maxRating
      WHERE arc1.entityWhoCategorizesId = ${entityWhoCategorizesId}
    ) arc
    ON a.id = arc.articleId
    WHERE 1=1 ${dateCondition}
  `;

  const [rawArticles, metadata] = await sequelize.query(sql);
  return rawArticles;
}

// --------------------------------
// Queries
// --------------------------------
async function createNewsApiRequestsArray() {
  const requestsArray = await NewsApiRequest.findAll({
    include: [
      {
        model: NewsArticleAggregatorSource,
        attributes: ["nameOfOrg"],
      },
      {
        model: NewsApiRequestWebsiteDomainContract,
        include: [
          {
            model: WebsiteDomain,
            attributes: ["name"],
          },
        ],
      },
    ],
  });

  console.log("requestsArray.length: ", requestsArray.length);

  const requestArrayFormatted = requestsArray.map((request) => {
    // Extract domain names from included contracts
    const domainNames = request.NewsApiRequestWebsiteDomainContracts.map(
      (contract) => contract.WebsiteDomain?.name
    ).filter(Boolean);

    return {
      id: request.id,
      andString: request.andString,
      orString: request.orString,
      notString: request.notString,
      nameOfOrg: request.NewsArticleAggregatorSource?.nameOfOrg || "N/A",
      includeOrExcludeDomainsString: domainNames.join(", "),
      createdAt: request.createdAt,
    };
  });

  return requestArrayFormatted;
}

async function createArticlesApprovedArray(dateRequestsLimit) {
  let articles;
  if (dateRequestsLimit) {
    dateRequestsLimit = new Date(dateRequestsLimit);
    articles = await Article.findAll({
      where: {
        createdAt: {
          [Op.gte]: dateRequestsLimit,
        },
      },
      include: [
        {
          model: ArticleApproved,
          required: true, // ensures only articles with approved entries are fetched
        },
      ],
    });
  } else {
    articles = await Article.findAll({
      include: [
        {
          model: ArticleApproved,
          required: true, // ensures only articles with approved entries are fetched
        },
      ],
    });
  }

  // const whereClause = dateRequestsLimit
  //   ? { createdAt: { [Op.gte]: dateRequestsLimit } }
  //   : {};

  // // Fetch Articles joined with any existing ArticleApproved rows
  // const articles = await Article.findAll({
  //   where: whereClause,
  //   include: [
  //     {
  //       model: ArticleApproved,
  //       required: true, // ensures only articles with approved entries are fetched
  //     },
  //   ],
  // });

  console.log("✅ Approved articles count:", articles.length);

  const requestIdArray = [];
  let manualFoundCount = 0;

  for (const article of articles) {
    if (article.newsApiRequestId) {
      requestIdArray.push(article.newsApiRequestId);
    } else {
      manualFoundCount++;
    }
  }

  return { requestIdArray, manualFoundCount };
}

// async function createArticlesApprovedArray(dateRequestsLimit) {
//   let articlesArray;
//   if (!dateRequestsLimit) {
//     articlesArray = await Article.findAll({
//       include: [
//         {
//           model: ArticleApproved,
//         },
//       ],
//     });
//   } else {
//     articlesArray = await Article.findAll({
//       where: {
//         createdAt: {
//           [Op.gte]: dateRequestsLimit,
//         },
//       },
//       include: [
//         {
//           model: ArticleApproved,
//         },
//       ],
//     });
//   }

//   const approvedArticlesArray = articlesArray.filter((article) => {
//     return article.ArticleApproveds && article.ArticleApproveds.length > 0;
//   });

//   console.log("approvedArticlesArray.length: ", approvedArticlesArray.length);

//   let requestIdArray = [];
//   let manualFoundCount = 0;

//   approvedArticlesArray.forEach((article) => {
//     if (article.newsApiRequestId) {
//       requestIdArray.push(article.newsApiRequestId);
//     } else {
//       manualFoundCount++;
//     }
//   });

//   return { requestIdArray, manualFoundCount };
// }

module.exports = {
  createArticlesArrayWithSqlForSemanticKeywordsRating,
  createNewsApiRequestsArray,
  createArticlesApprovedArray,
};
