const request = require("supertest");
const app = require("../app"); // uses the default exported app
// jest.setTimeout(200000); // ensure test doesn’t timeout 200 seconds
const secondsBeforeTimeout = 60; // ← change this value to adjust per-test timeout
const perTestTimeout = secondsBeforeTimeout * 1000;

describe("POST /articles/with-ratings", () => {
  it(
    "should return JSON with articlesArray property",
    async () => {
      const response = await request(app)
        .post("/articles/with-ratings")
        .set("Authorization", `Bearer ${process.env.TEST_TOKEN}`)
        .send({});

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("articlesArray");
      expect(Array.isArray(response.body.articlesArray)).toBe(true);
    },
    perTestTimeout
  );
});

it(
  "should include article with id 42 and expected properties",
  async () => {
    const response = await request(app)
      .post("/articles/with-ratings")
      .set("Authorization", `Bearer ${process.env.TEST_TOKEN}`)
      .send({});

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.articlesArray)).toBe(true);

    const expectedArticle = {
      id: 42,
      title:
        "Tennessee driver charged with deadly hit-and-run had posted about how the victim would ‘be missed’",
      description:
        'A Tennessee woman charged in a deadly hit-and-run crash posted that the man she allegedly killed would "be missed" hours before authorities arrested her, according to reports. Haley Layman, 25, allegedly ran over Bobby Green with her vehicle while he was ridi…',
      publishedDate: "2025-04-04",
      publicationName: "New York Post",
      url: "https://nypost.com/2025/04/04/us-news/driver-charged-with-deadly-hit-and-run-posted-about-how-victim-would-be-missed/",
      statesStringCommaSeparated: "Colorado",
      isRelevant: true,
      isApproved: true,
      requestQueryString:
        "AND crash OR bicycle scooter lawnmower skateboard atv",
      nameOfOrg: "NewsAPI",
      semanticRatingMaxLabel: "N/A",
      semanticRatingMax: "N/A",
      zeroShotRatingMaxLabel: "N/A",
      zeroShotRatingMax: "N/A",
      isBeingReviewed: false,
    };

    const articleFound = response.body.articlesArray.some((article) => {
      return (
        article.id === expectedArticle.id &&
        article.title === expectedArticle.title &&
        article.description === expectedArticle.description &&
        article.publishedDate === expectedArticle.publishedDate &&
        article.publicationName === expectedArticle.publicationName &&
        article.url === expectedArticle.url &&
        article.statesStringCommaSeparated ===
          expectedArticle.statesStringCommaSeparated &&
        article.isRelevant === expectedArticle.isRelevant &&
        article.isApproved === expectedArticle.isApproved &&
        article.requestQueryString === expectedArticle.requestQueryString &&
        article.nameOfOrg === expectedArticle.nameOfOrg &&
        article.semanticRatingMaxLabel ===
          expectedArticle.semanticRatingMaxLabel &&
        article.semanticRatingMax === expectedArticle.semanticRatingMax &&
        article.zeroShotRatingMaxLabel ===
          expectedArticle.zeroShotRatingMaxLabel &&
        article.zeroShotRatingMax === expectedArticle.zeroShotRatingMax &&
        article.isBeingReviewed === expectedArticle.isBeingReviewed
      );
    });

    expect(articleFound).toBe(true);
  },
  perTestTimeout
);
