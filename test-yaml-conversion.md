# Test JSON to YAML Conversion Feature

This file contains test queries to demonstrate the new JSON to YAML conversion functionality.

## Test Query 1: Simple Search

```opensearch-api
GET /_search
{
  "query": {
    "match_all": {}
  },
  "size": 5
}
```

## Test Query 2: Complex Query with Aggregations

```opensearch-api
GET /my-index/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "title": "search"
          }
        }
      ],
      "filter": [
        {
          "range": {
            "timestamp": {
              "gte": "2023-01-01",
              "lte": "2023-12-31"
            }
          }
        }
      ]
    }
  },
  "aggs": {
    "categories": {
      "terms": {
        "field": "category.keyword",
        "size": 10
      }
    },
    "date_histogram": {
      "date_histogram": {
        "field": "timestamp",
        "calendar_interval": "month"
      }
    }
  },
  "size": 20,
  "sort": [
    {
      "timestamp": {
        "order": "desc"
      }
    }
  ]
}
```

## Instructions for Testing

1. Run any of the above queries using the OpenSearch Query Runner extension
2. In the results view, look for the "Convert to YAML" button in the top-right corner of JSON content areas
3. The button should appear in:
   - JSON View tab
   - Raw Response sections
   - Explain sections (if using explain queries)
   - Request Details sections
4. Click the button to toggle between JSON and YAML formats
5. The button text should change to "Show JSON" when viewing YAML
6. The button should be disabled for non-JSON content

## Expected Behavior

- Button only appears when content is valid JSON
- Clicking toggles between JSON and YAML display
- YAML format should be compact and uniform
- Original JSON is preserved when toggling back
- Button is positioned in the top-right corner of content containers
