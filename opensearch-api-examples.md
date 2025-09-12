# OpenSearch API Examples

This document demonstrates the new OpenSearch API functionality that allows you to create indices, insert data, and perform other operations using the OpenSearch REST API directly from markdown.

## Index Management

### Create an Index with Mappings

```opensearch-api
-- Description: Create a logs index with field mappings
-- Method: PUT
-- Endpoint: /logs-2024
{
  "mappings": {
    "properties": {
      "timestamp": {
        "type": "date",
        "format": "strict_date_optional_time||epoch_millis"
      },
      "level": {
        "type": "keyword"
      },
      "message": {
        "type": "text",
        "analyzer": "standard"
      },
      "service": {
        "type": "keyword"
      },
      "user_id": {
        "type": "long"
      }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}
```

### Check Index Exists

```opensearch-api
-- Description: Check if the logs index exists
-- Method: HEAD
-- Endpoint: /logs-2024
```

### Get Index Information

```opensearch-api
-- Description: Get information about the logs index
-- Method: GET
-- Endpoint: /logs-2024
```

## Document Operations

### Index a Single Document

```opensearch-api
-- Description: Add a log entry
-- Method: POST
-- Endpoint: /logs-2024/_doc
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "message": "Application started successfully",
  "service": "web-server",
  "user_id": 12345
}
```

### Index Document with Specific ID

```opensearch-api
-- Description: Add a log entry with specific ID
-- Method: PUT
-- Endpoint: /logs-2024/_doc/log-001
{
  "timestamp": "2024-01-15T10:31:00Z",
  "level": "INFO",
  "message": "User authentication successful",
  "service": "auth-service",
  "user_id": 12345
}
```

### Get Document by ID

```opensearch-api
-- Description: Retrieve a specific log entry
-- Method: GET
-- Endpoint: /logs-2024/_doc/log-001
```

### Update Document

```opensearch-api
-- Description: Update a log entry
-- Method: POST
-- Endpoint: /logs-2024/_update/log-001
{
  "doc": {
    "level": "WARN",
    "message": "User authentication successful (updated)"
  }
}
```

## Bulk Operations

### Bulk Insert Multiple Documents

```opensearch-api
-- Description: Bulk insert multiple log entries
-- Method: POST
-- Endpoint: /_bulk
{ "index": { "_index": "logs-2024" } }
{ "timestamp": "2024-01-15T10:32:00Z", "level": "INFO", "message": "Processing user request", "service": "api-gateway", "user_id": 12346 }
{ "index": { "_index": "logs-2024" } }
{ "timestamp": "2024-01-15T10:33:00Z", "level": "ERROR", "message": "Database connection failed", "service": "database", "user_id": null }
{ "index": { "_index": "logs-2024" } }
{ "timestamp": "2024-01-15T10:34:00Z", "level": "INFO", "message": "Request completed successfully", "service": "api-gateway", "user_id": 12346 }
```

## Search Operations

### Basic Search

```opensearch-api
-- Description: Search for error logs
-- Method: GET
-- Endpoint: /logs-2024/_search
{
  "query": {
    "match": {
      "level": "ERROR"
    }
  }
}
```

### Search with Filters and Sorting

```opensearch-api
-- Description: Search logs from specific service, sorted by timestamp
-- Method: POST
-- Endpoint: /logs-2024/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "service": "api-gateway"
          }
        }
      ],
      "filter": [
        {
          "range": {
            "timestamp": {
              "gte": "2024-01-15T10:00:00Z",
              "lte": "2024-01-15T11:00:00Z"
            }
          }
        }
      ]
    }
  },
  "sort": [
    {
      "timestamp": {
        "order": "desc"
      }
    }
  ],
  "size": 10
}
```

## Aggregations

### Count by Log Level

```opensearch-api
-- Description: Aggregate log entries by level
-- Method: POST
-- Endpoint: /logs-2024/_search
{
  "size": 0,
  "aggs": {
    "log_levels": {
      "terms": {
        "field": "level",
        "size": 10
      }
    }
  }
}
```

### Time-based Histogram

```opensearch-api
-- Description: Create histogram of logs over time
-- Method: POST
-- Endpoint: /logs-2024/_search
{
  "size": 0,
  "aggs": {
    "logs_over_time": {
      "date_histogram": {
        "field": "timestamp",
        "calendar_interval": "1h"
      }
    }
  }
}
```

## Index Templates

### Create Index Template

```opensearch-api
-- Description: Create template for log indices
-- Method: PUT
-- Endpoint: /_index_template/logs-template
{
  "index_patterns": ["logs-*"],
  "template": {
    "mappings": {
      "properties": {
        "timestamp": {
          "type": "date"
        },
        "level": {
          "type": "keyword"
        },
        "message": {
          "type": "text"
        },
        "service": {
          "type": "keyword"
        }
      }
    },
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    }
  }
}
```

## Cleanup Operations

### Delete Document

```opensearch-api
-- Description: Delete a specific log entry
-- Method: DELETE
-- Endpoint: /logs-2024/_doc/log-001
```

### Delete Index

```opensearch-api
-- Description: Delete the logs index
-- Method: DELETE
-- Endpoint: /logs-2024
```

## How to Use

1. **Configure Connection**: Make sure your OpenSearch connection is configured
2. **Run Operations**: Click the "Run Query" CodeLens above any API operation
3. **View Results**: Results will show the API response, including success/error status
4. **Chain Operations**: Run operations in sequence to build up your data

## Benefits

- **Complete CRUD Operations**: Create, read, update, and delete data
- **Index Management**: Create and configure indices with custom mappings
- **Bulk Operations**: Efficiently insert multiple documents
- **Advanced Search**: Use the full power of OpenSearch query DSL
- **Template Management**: Set up index templates for consistent structure

This complements the existing SQL and PPL query capabilities, giving you full control over your OpenSearch cluster!
