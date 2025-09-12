# OpenSearch Query Test Document

This document contains sample queries to test the OpenSearch Query Runner extension.

## Basic SQL Queries

### Simple SELECT Query

```sql
-- Description: Get all documents from an index
-- Timeout: 10s
SELECT * FROM logs LIMIT 5
```


### Filtered Query

```sql
-- Description: Filter logs by level
-- Timeout: 15s
SELECT timestamp, level, message 
FROM logs 
WHERE level = 'ERROR' 
ORDER BY timestamp DESC 
LIMIT 10
```

### Aggregation Query

```sql
-- Description: Count logs by level
SELECT level, COUNT(*) as count 
FROM logs 
GROUP BY level 
ORDER BY count DESC
```

## Index Management

### Create Index

```sql
-- Description: Create a new index with mapping
-- Timeout: 30s
CREATE TABLE logs (
    timestamp TIMESTAMP,
    level KEYWORD,
    message TEXT,
    user_id INTEGER,
    source_ip IP
)
```

<!-- OpenSearch Results Start -->
**OpenSearch Query Results** (9/12/2025, 11:06:16 AM)

❌ **Error**: SQL query must start with SELECT, WITH, SHOW, DESCRIBE, or EXPLAIN
**Execution Time**: 0ms

<!-- OpenSearch Results End -->


### Create Index with Settings

```sql
-- Description: Create index with custom settings
-- Timeout: 30s
CREATE TABLE metrics (
    timestamp TIMESTAMP,
    metric_name KEYWORD,
    value DOUBLE,
    tags NESTED
) WITH (
    number_of_shards = 3,
    number_of_replicas = 1,
    refresh_interval = '5s'
)
```

### Create Index Template

```sql
-- Description: Create an index template for log indices
-- Timeout: 30s
CREATE INDEX TEMPLATE log_template 
PATTERNS 'logs-*'
SETTINGS (
    number_of_shards = 2,
    number_of_replicas = 1
)
MAPPINGS (
    timestamp TIMESTAMP,
    level KEYWORD,
    message TEXT,
    service KEYWORD
)
```

### Check Index Exists

```sql
-- Description: Check if an index exists
-- Timeout: 10s
SHOW TABLES LIKE 'logs'
```

### Drop Index

```sql
-- Description: Delete an index (use with caution!)
-- Timeout: 15s
DROP TABLE logs
```

## PPL Queries

### Basic PPL Query

```ppl
-- Description: Get recent log entries
-- Timeout: 10s
source=logs | head 5
```

### Filtered PPL Query

```ppl
-- Description: Filter and analyze logs
source=logs 
| where level='ERROR' 
| stats count() by message 
| sort count desc 
| head 10
```

### Time-based Analysis

```ppl
-- Description: Analyze logs over time
-- Timeout: 30s
source=logs 
| where timestamp > '2023-01-01' 
| eval hour = date_format(timestamp, 'HH') 
| stats count() by hour 
| sort hour
```

## Advanced Queries

### Complex SQL with Joins

```sql
-- Description: Complex query example
-- Timeout: 45s
SELECT 
    l.timestamp,
    l.level,
    l.message,
    u.username
FROM logs l
LEFT JOIN users u ON l.user_id = u.id
WHERE l.timestamp > '2023-01-01'
AND l.level IN ('ERROR', 'WARN')
ORDER BY l.timestamp DESC
LIMIT 20
```

### PPL with Multiple Operations

```ppl
-- Description: Multi-step PPL analysis
source=logs 
| where timestamp > '2023-01-01' 
| eval severity = case(level='ERROR', 3, level='WARN', 2, level='INFO', 1, 0) 
| stats avg(severity) as avg_severity, count() as total_logs by bin(timestamp, 1h) 
| sort timestamp 
| head 24
```

## Test Instructions

1. **Configure Connection**: First, configure your OpenSearch connection using the status bar item or Command Palette
2. **Test CodeLens**: You should see "Run Query", "Inline", and "Separate Tab" buttons above each query block
3. **Test Inline Mode**: Click "Inline" to see results inserted below the query
4. **Test Separate Tab**: Click "Separate Tab" to open results in a new panel
5. **Test History**: After running queries in separate tab mode, use "OpenSearch: Show Query History" to view past queries
6. **Test Hover**: Hover over query blocks to see metadata and validation info

## Expected Behavior

- ✅ CodeLens buttons should appear above each query block
- ✅ Queries should execute and show results
- ✅ Inline results should appear with markdown formatting
- ✅ Separate tab should show formatted tables and JSON views
- ✅ History should track separate tab queries
- ✅ Status bar should show connection status
- ✅ Hover should provide query information

## Troubleshooting

If queries don't work:

1. Check OpenSearch connection configuration
2. Verify OpenSearch cluster is running and accessible
3. Ensure SQL/PPL plugins are enabled on your cluster
4. Check the VSCode Developer Console for error messages
5. Try simpler queries first (like `SELECT 1` or `source=_cat/indices`)

## API Setup for Test Data

Before running the example queries, you need to create the indices and populate them with sample data. Use these OpenSearch API requests (click "Run Query" above each block):

### 1. Create Logs Index

```opensearch-api
-- Description: Create logs index with field mappings
-- Method: PUT
-- Endpoint: /logs
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
      "user_id": {
        "type": "integer"
      },
      "source_ip": {
        "type": "ip"
      },
      "service": {
        "type": "keyword"
      }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "refresh_interval": "1s"
  }
}
```


### 2. Create Users Index

```opensearch-api
-- Description: Create users index for join queries
-- Method: PUT
-- Endpoint: /users
{
  "mappings": {
    "properties": {
      "id": {
        "type": "integer"
      },
      "username": {
        "type": "keyword"
      },
      "email": {
        "type": "keyword"
      },
      "created_at": {
        "type": "date"
      }
    }
  }
}
```

### 3. Create Metrics Index

```opensearch-api
-- Description: Create metrics index with nested tags
-- Method: PUT
-- Endpoint: /metrics
{
  "mappings": {
    "properties": {
      "timestamp": {
        "type": "date"
      },
      "metric_name": {
        "type": "keyword"
      },
      "value": {
        "type": "double"
      },
      "tags": {
        "type": "nested",
        "properties": {
          "key": {
            "type": "keyword"
          },
          "value": {
            "type": "keyword"
          }
        }
      }
    }
  },
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "5s"
  }
}
```

### 4. Insert Sample Log Data

```opensearch-api
-- Description: Bulk insert sample log entries
-- Method: POST
-- Endpoint: /logs/_bulk
{"index": {}}
{"timestamp": "2023-12-01T10:00:00Z", "level": "INFO", "message": "Application started successfully", "user_id": 1, "source_ip": "192.168.1.100", "service": "web-server"}
{"index": {}}
{"timestamp": "2023-12-01T10:01:00Z", "level": "ERROR", "message": "Database connection failed", "user_id": 2, "source_ip": "192.168.1.101", "service": "api-server"}
{"index": {}}
{"timestamp": "2023-12-01T10:02:00Z", "level": "WARN", "message": "High memory usage detected", "user_id": 1, "source_ip": "192.168.1.100", "service": "web-server"}
{"index": {}}
{"timestamp": "2023-12-01T10:03:00Z", "level": "INFO", "message": "User login successful", "user_id": 3, "source_ip": "192.168.1.102", "service": "auth-service"}
{"index": {}}
{"timestamp": "2023-12-01T10:04:00Z", "level": "ERROR", "message": "Payment processing failed", "user_id": 2, "source_ip": "192.168.1.101", "service": "payment-service"}
{"index": {}}
{"timestamp": "2023-12-01T10:05:00Z", "level": "DEBUG", "message": "Cache miss for user profile", "user_id": 3, "source_ip": "192.168.1.102", "service": "user-service"}
{"index": {}}
{"timestamp": "2023-12-01T10:06:00Z", "level": "INFO", "message": "Scheduled backup completed", "user_id": null, "source_ip": "192.168.1.200", "service": "backup-service"}
{"index": {}}
{"timestamp": "2023-12-01T10:07:00Z", "level": "WARN", "message": "API rate limit approaching", "user_id": 1, "source_ip": "192.168.1.100", "service": "api-server"}
{"index": {}}
{"timestamp": "2023-12-01T10:08:00Z", "level": "ERROR", "message": "External service timeout", "user_id": 3, "source_ip": "192.168.1.102", "service": "integration-service"}
{"index": {}}
{"timestamp": "2023-12-01T10:09:00Z", "level": "INFO", "message": "Health check passed", "user_id": null, "source_ip": "192.168.1.200", "service": "monitoring"}
{"index": {}}
{"timestamp": "2023-12-01T11:00:00Z", "level": "ERROR", "message": "Disk space critical", "user_id": null, "source_ip": "192.168.1.200", "service": "system"}
{"index": {}}
{"timestamp": "2023-12-01T11:01:00Z", "level": "INFO", "message": "User logout", "user_id": 1, "source_ip": "192.168.1.100", "service": "auth-service"}
{"index": {}}
{"timestamp": "2023-12-01T11:02:00Z", "level": "WARN", "message": "Slow query detected", "user_id": 2, "source_ip": "192.168.1.101", "service": "database"}
{"index": {}}
{"timestamp": "2023-12-01T11:03:00Z", "level": "INFO", "message": "Configuration reloaded", "user_id": null, "source_ip": "192.168.1.200", "service": "config-service"}
{"index": {}}
{"timestamp": "2023-12-01T11:04:00Z", "level": "ERROR", "message": "Authentication failed", "user_id": 4, "source_ip": "192.168.1.103", "service": "auth-service"}
```

### 5. Insert Sample User Data

```opensearch-api
-- Description: Bulk insert user data for join queries
-- Method: POST
-- Endpoint: /users/_bulk
{"index": {"_id": 1}}
{"id": 1, "username": "john_doe", "email": "john@example.com", "created_at": "2023-01-15T09:00:00Z"}
{"index": {"_id": 2}}
{"id": 2, "username": "jane_smith", "email": "jane@example.com", "created_at": "2023-02-20T14:30:00Z"}
{"index": {"_id": 3}}
{"id": 3, "username": "bob_wilson", "email": "bob@example.com", "created_at": "2023-03-10T11:15:00Z"}
{"index": {"_id": 4}}
{"id": 4, "username": "alice_brown", "email": "alice@example.com", "created_at": "2023-04-05T16:45:00Z"}
```

### 6. Insert Sample Metrics Data

```opensearch-api
-- Description: Bulk insert metrics data with nested tags
-- Method: POST
-- Endpoint: /metrics/_bulk
{"index": {}}
{"timestamp": "2023-12-01T10:00:00Z", "metric_name": "cpu_usage", "value": 45.2, "tags": [{"key": "host", "value": "server-01"}, {"key": "env", "value": "prod"}]}
{"index": {}}
{"timestamp": "2023-12-01T10:01:00Z", "metric_name": "memory_usage", "value": 78.5, "tags": [{"key": "host", "value": "server-01"}, {"key": "env", "value": "prod"}]}
{"index": {}}
{"timestamp": "2023-12-01T10:02:00Z", "metric_name": "disk_usage", "value": 62.1, "tags": [{"key": "host", "value": "server-01"}, {"key": "env", "value": "prod"}]}
{"index": {}}
{"timestamp": "2023-12-01T10:03:00Z", "metric_name": "network_io", "value": 1024.8, "tags": [{"key": "host", "value": "server-01"}, {"key": "env", "value": "prod"}]}
{"index": {}}
{"timestamp": "2023-12-01T10:04:00Z", "metric_name": "response_time", "value": 125.3, "tags": [{"key": "service", "value": "api"}, {"key": "env", "value": "prod"}]}
{"index": {}}
{"timestamp": "2023-12-01T10:05:00Z", "metric_name": "cpu_usage", "value": 52.7, "tags": [{"key": "host", "value": "server-02"}, {"key": "env", "value": "prod"}]}
{"index": {}}
{"timestamp": "2023-12-01T10:06:00Z", "metric_name": "memory_usage", "value": 81.2, "tags": [{"key": "host", "value": "server-02"}, {"key": "env", "value": "prod"}]}
{"index": {}}
{"timestamp": "2023-12-01T10:07:00Z", "metric_name": "error_rate", "value": 0.05, "tags": [{"key": "service", "value": "payment"}, {"key": "env", "value": "prod"}]}
```

### 7. Create Index Template for Log Rotation

```opensearch-api
-- Description: Create index template for logs-* pattern
-- Method: PUT
-- Endpoint: /_index_template/logs_template
{
  "index_patterns": ["logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 2,
      "number_of_replicas": 1,
      "refresh_interval": "5s"
    },
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
    }
  },
  "priority": 100
}
```

### 8. Verify Setup

After running the above requests, verify your setup:

```opensearch-api
-- Description: List all indices
-- Method: GET
-- Endpoint: /_cat/indices?v
```

```opensearch-api
-- Description: Count documents in logs index
-- Method: GET
-- Endpoint: /logs/_count
```

```opensearch-api
-- Description: Count documents in users index
-- Method: GET
-- Endpoint: /users/_count
```

```opensearch-api
-- Description: Count documents in metrics index
-- Method: GET
-- Endpoint: /metrics/_count
```

## Sample Data Setup (Alternative SQL Method)

If you need test data and your cluster supports SQL INSERT statements:

```sql
-- Create sample data (if your cluster supports it)
INSERT INTO logs VALUES 
('2023-12-01T10:00:00Z', 'INFO', 'Application started'),
('2023-12-01T10:01:00Z', 'ERROR', 'Database connection failed'),
('2023-12-01T10:02:00Z', 'WARN', 'High memory usage detected')
```

Happy testing! 🚀
