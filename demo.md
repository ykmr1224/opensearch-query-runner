# OpenSearch Query Runner - Demo & Use Cases

This document demonstrates the major use cases of the OpenSearch Query Runner VSCode extension with simple, practical examples using a single sample index.

## Setup and Configuration

### Quick Setup

1. **Install the extension** from VSCode marketplace
2. **Configure your OpenSearch connection**:
   - Use Command Palette → "OpenSearch: Configure Connection"
   - Or manually edit VSCode settings:

```json
{
  "opensearch.endpoint": "http://localhost:9200",
  "opensearch.auth.type": "none",
  "opensearch.timeout": 30000,
  "opensearch.enableCodeLens": true
}
```

### Per-Document Configuration (New Feature!)

You can now override connection settings within markdown documents using configuration blocks. This is perfect for working with multiple clusters or different authentication methods:

```config
@endpoint = 'http://localhost:9201'
@auth_type = 'none'
@timeout = '30s'
```

**Configuration Variables:**
- `@endpoint` - OpenSearch cluster URL
- `@auth_type` - Authentication type: 'none', 'basic', 'apikey'
- `@username` / `@password` - Basic authentication credentials
- `@api_key` - API key for apikey authentication
- `@timeout` - Request timeout (e.g., '30s', '5000ms', '2m')

**How it works:**
- Configuration blocks apply to all queries that follow them in the document
- If you have multiple config blocks, each query uses the closest preceding configuration
- Falls back to global VSCode settings if no configuration block is found

## Sample Data Setup

First, let's create a simple logs index and add some sample data:

### Create Index

```opensearch-api
-- Description: Create a simple logs index
-- Method: PUT
-- Endpoint: /sample_logs
{
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
      },
      "user_id": {
        "type": "long"
      }
    }
  }
}
```

### Add Sample Data

```opensearch-api
-- Description: Add sample log entries
-- Method: POST
-- Endpoint: /_bulk
{ "index": { "_index": "sample_logs" } }
{ "timestamp": "2024-01-15T10:00:00Z", "level": "INFO", "message": "User login successful", "service": "auth", "user_id": 1001 }
{ "index": { "_index": "sample_logs" } }
{ "timestamp": "2024-01-15T10:05:00Z", "level": "ERROR", "message": "Database connection failed", "service": "database", "user_id": null }
{ "index": { "_index": "sample_logs" } }
{ "timestamp": "2024-01-15T10:10:00Z", "level": "INFO", "message": "Order processed", "service": "orders", "user_id": 1002 }
{ "index": { "_index": "sample_logs" } }
{ "timestamp": "2024-01-15T10:15:00Z", "level": "WARN", "message": "High memory usage detected", "service": "monitoring", "user_id": null }
{ "index": { "_index": "sample_logs" } }
{ "timestamp": "2024-01-15T10:20:00Z", "level": "INFO", "message": "User logout", "service": "auth", "user_id": 1001 }
```

## SQL Query Examples

### 1. Basic Data Exploration

```sql
-- Description: View all log entries
SELECT * FROM sample_logs 
LIMIT 10
```

### 2. Filter by Log Level

```sql
-- Description: Find all error logs
SELECT timestamp, message, service 
FROM sample_logs 
WHERE level = 'ERROR'
```

### 3. Count Logs by Service

```sql
-- Description: Count logs by service
SELECT service, COUNT(*) as log_count
FROM sample_logs 
GROUP BY service
ORDER BY log_count DESC
```

### 4. Recent Logs

```sql
-- Description: Get logs from the last hour
SELECT timestamp, level, message, service
FROM sample_logs 
WHERE timestamp >= '2024-01-15T10:00:00Z'
ORDER BY timestamp DESC
```

### 5. User Activity

```sql
-- Description: Find logs for specific user
SELECT timestamp, level, message, service
FROM sample_logs 
WHERE user_id = 1001
ORDER BY timestamp
```

## PPL Query Examples

### 1. Basic Data Exploration

```ppl
-- Description: View all log entries
source=sample_logs 
| head 10
```

### 2. Filter by Log Level

```ppl
-- Description: Find all error logs
source=sample_logs 
| where level = "ERROR" 
| fields timestamp, message, service
```

### 3. Count Logs by Service

```ppl
-- Description: Count logs by service
source=sample_logs 
| stats count() as log_count by service 
| sort log_count desc
```

### 4. Count Logs by Level

```ppl
-- Description: Count logs by level
source=sample_logs 
| stats count() by level 
| sort count desc
```

### 5. Recent Activity Analysis

```ppl
-- Description: Analyze recent activity by service and level
source=sample_logs 
| where timestamp >= "2024-01-15T10:00:00Z" 
| stats count() as events by service, level 
| sort service, level
```

### 6. User Activity Tracking

```ppl
-- Description: Track user activity
source=sample_logs 
| where user_id > 0 
| stats count() as activity_count by user_id 
| sort activity_count desc
```

## OpenSearch REST API Examples

### 1. Simple Search

```opensearch-api
-- Description: Search for error logs
-- Method: GET
-- Endpoint: /sample_logs/_search
{
  "query": {
    "match": {
      "level": "ERROR"
    }
  }
}
```

### 2. Search with Filters

```opensearch-api
-- Description: Search logs from auth service
-- Method: POST
-- Endpoint: /sample_logs/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "service": "auth"
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
  ]
}
```

### 3. Aggregation by Service

```opensearch-api
-- Description: Count logs by service
-- Method: POST
-- Endpoint: /sample_logs/_search
{
  "size": 0,
  "aggs": {
    "services": {
      "terms": {
        "field": "service"
      }
    }
  }
}
```

## How to Use

### Running Queries

1. **CodeLens Buttons**: Click "Run Query" above any query block
2. **Command Palette**: Use "OpenSearch: Run Query" commands
3. **Context Menu**: Right-click in query blocks

### Display Options

- **Inline**: Results appear below the query in the markdown file
- **Separate Tab**: Results open in a dedicated tab with history

### Query Comments

Add metadata to your queries:

```sql
-- Description: What this query does
-- Timeout: 30s
SELECT * FROM sample_logs LIMIT 5
```

## Multi-Cluster Configuration Example

Here's how to work with multiple OpenSearch clusters in a single document:

```config
@endpoint = 'http://localhost:9200'
@auth_type = 'none'
```

```sql
-- Description: Query development cluster
SELECT COUNT(*) as dev_log_count FROM sample_logs
```

```config
@endpoint = 'http://production-cluster:9200'
@auth_type = 'basic'
@username = 'readonly_user'
@password = 'secure_password'
@timeout = '60s'
```

```sql
-- Description: Query production cluster (uses different connection)
SELECT COUNT(*) as prod_log_count FROM production_logs
```

```opensearch-api
-- Description: Check production cluster health
-- Method: GET
-- Endpoint: /_cluster/health
```

```config
@endpoint = 'http://staging-cluster:9200'
@auth_type = 'apikey'
@api_key = 'staging-api-key-here'
```

```ppl
-- Description: Analyze staging logs
source=staging_logs 
| stats count() by level 
| sort count desc
```

## Common Use Cases

### 1. Log Monitoring

```sql
-- Description: Monitor error rates
SELECT 
    level,
    COUNT(*) as count,
    COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sample_logs) as percentage
FROM sample_logs 
GROUP BY level
```

### 2. Service Health Check

```ppl
-- Description: Check service activity
source=sample_logs 
| stats count() as total_logs, 
        count(eval(level="ERROR")) as error_count by service 
| eval error_rate = round(error_count * 100.0 / total_logs, 2) 
| sort error_rate desc
```

### 3. User Behavior Analysis

```sql
-- Description: Analyze user sessions
SELECT 
    user_id,
    COUNT(*) as total_actions,
    MIN(timestamp) as first_action,
    MAX(timestamp) as last_action
FROM sample_logs 
WHERE user_id IS NOT NULL
GROUP BY user_id
```

## Tips

- Start with simple queries and gradually add complexity
- Use descriptive comments for each query
- Use inline mode for quick exploration
- Use separate tab mode for detailed analysis
- Check the OpenSearch status bar for connection status

## Troubleshooting

- **Connection Failed**: Check endpoint URL in settings
- **No Results**: Verify index name exists
- **Syntax Error**: Check query syntax
- **Timeout**: Increase timeout in settings

---

This demo uses a simple `sample_logs` index to demonstrate the core functionality. Adapt these examples to work with your own data!
