OpenSearch Query Runner - RST Demo
==================================

This document demonstrates RST (reStructuredText) support for the OpenSearch Query Runner extension.

SQL Query Example
-----------------

.. code-block:: sql

   -- Description: Get recent log entries
   -- Timeout: 30s
   SELECT timestamp, level, message 
   FROM logs 
   WHERE timestamp > '2023-01-01' 
   ORDER BY timestamp DESC 
   LIMIT 10

PPL Query Example
-----------------

.. code-block:: ppl

   -- Description: Analyze log levels
   -- Timeout: 15s
   source=logs 
   | where timestamp > '2023-01-01' 
   | stats count() by level 
   | sort count desc

OpenSearch API Examples
-----------------------

Create Index
~~~~~~~~~~~~

.. code-block:: opensearch-api

   PUT /logs-2024
   -- Description: Create a new index with mappings
   {
     "mappings": {
       "properties": {
         "timestamp": { "type": "date" },
         "level": { "type": "keyword" },
         "message": { "type": "text" }
       }
     }
   }

Index Document
~~~~~~~~~~~~~~

.. code-block:: opensearch-api

   POST /logs-2024/_doc
   -- Description: Index a new log entry
   {
     "timestamp": "2024-01-15T10:00:00Z",
     "level": "INFO",
     "message": "Application started successfully"
   }

Search Documents
~~~~~~~~~~~~~~~~

.. code-block:: opensearch-api

   GET /logs-2024/_search
   -- Description: Search for error logs
   {
     "query": {
       "match": {
         "level": "ERROR"
       }
     }
   }

Configuration Blocks
--------------------

You can configure connection settings using RST code blocks:

.. code-block:: config

   @endpoint = 'http://localhost:9200'
   @auth_type = 'none'
   @timeout = '30s'

.. code-block:: sql

   -- Description: Query using the configuration above
   SELECT COUNT(*) FROM logs

Multi-Cluster Configuration
---------------------------

Development Environment
~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: opensearch-config

   @endpoint = 'http://localhost:9200'
   @auth_type = 'none'

.. code-block:: sql

   -- Description: Query development cluster
   SELECT COUNT(*) FROM dev_logs

Production Environment
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: connection

   @endpoint = 'https://prod-cluster:9200'
   @auth_type = 'basic'
   @username = 'readonly'
   @password = 'secure_password'
   @timeout = '60s'

.. code-block:: sql

   -- Description: Query production cluster with extended timeout
   SELECT COUNT(*) FROM prod_logs WHERE timestamp > NOW() - INTERVAL 1 DAY

Bulk Operations
---------------

.. code-block:: opensearch-api

   POST /_bulk
   -- Description: Bulk index multiple documents
   { "index": { "_index": "logs-2024" } }
   { "timestamp": "2024-01-15T10:00:00Z", "level": "INFO", "message": "Log 1" }
   { "index": { "_index": "logs-2024" } }
   { "timestamp": "2024-01-15T10:05:00Z", "level": "ERROR", "message": "Log 2" }

How to Use
----------

1. **Configure Connection**: Click the OpenSearch status bar item or use Command Palette → "OpenSearch: Configure Connection"
2. **Run Operations**: Click the "Run Query" CodeLens above any query block or API operation
3. **Choose Display Mode**: Select "Inline" to show results in this document, or "Separate Tab" for a dedicated results view
4. **View History**: Query history is integrated into the results tab - previous queries appear as clickable squares at the top

Query Types
-----------

- **SQL**: Traditional SQL queries using OpenSearch SQL plugin
- **PPL**: Piped Processing Language for log analysis  
- **OpenSearch API**: Direct REST API operations for index management, data insertion, and advanced operations

Query Metadata
---------------

You can add metadata to your queries using comments:

- ``-- Connection: my-cluster`` - Specify connection (future feature)
- ``-- Timeout: 30s`` - Set query timeout
- ``-- Description: What this query does`` - Add description
- ``-- Method: POST`` - HTTP method for API operations
- ``-- Endpoint: /index/_doc`` - API endpoint for operations

Happy querying! 🚀
