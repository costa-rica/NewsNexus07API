![Logo](./docs/images/logoAndNameRound.png)

The API for the NewsNexus07Db and microservices suite of applications.

## API Requests

### NewsAPI

`https://newsapi.org/v2/everything?q=consumer%20product%20safety&from=2025-01-01&to=2025-04-12&pageSize=8&language=en&apiKey=<key>`

### GNews

`https://gnews.io/api/v4/search?q=product%20recall&from=2025-03-01&to=2025-04-14&max=10&lang=en&token=<key>`

## API Endpoints

### POST /artificial-intelligence/add-entity

To add a new Artificial Intelligence entity. This will add to the ArtificialIntelligence table and create a new EntityWhoCategorizedArticle record. Both necessary to track the articles scores created by the AI.

- body:

```json
{
  "name": "NewsNexusZeroShotClassifier01",
  "huggingFaceModelName": "Xenova/bart-large-mnli",
  "huggingFaceModelType": "zero-shot-classification"
}
```
