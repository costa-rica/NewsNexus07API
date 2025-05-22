![Logo](./docs/images/logoAndNameRound.png)

The API for the NewsNexus07Db and microservices suite of applications.

## .env

```
APP_NAME=NewsNexus07
JWT_SECRET=NewsNexus07_SECRET
NAME_DB=newsnexus07.db
PATH_DATABASE=/home/shared/databases/NewsNexus07/
PATH_DB_BACKUPS=/home/shared/project_resources/NewsNexus07/db_backups
PATH_PROJECT_RESOURCES=/home/shared/project_resources/NewsNexus07
PATH_PROJECT_RESOURCES_REPORTS=/home/shared/project_resources/NewsNexus07/reports
PATH_TO_API_RESPONSE_JSON_FILES=/home/shared/project_resources/NewsNexus07/api_response_json_files
PATH_TO_AUTOMATION_EXCEL_FILES=/home/shared/project_resources/NewsNexus07/utilities/automation_excel_files
PATH_TO_UTILITIES_ANALYSIS_SPREADSHEETS=/home/shared/project_resources/NewsNexus07/utilities/analysis_spreadsheets
ADMIN_EMAIL_CREATE_ON_STARTUP=["nickrodriguez@kineticmetrics.com"]
NODE_ENV=production
AUTHENTIFICATION_TURNED_OFF=false
ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES=true
```

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
