import * as assert from 'assert';
import * as vscode from 'vscode';
import { HistoryManager } from '../historyManager';
import { QueryResult } from '../types';

suite('HistoryManager Test Suite', () => {
    let historyManager: HistoryManager;
    let mockContext: vscode.ExtensionContext;

    setup(() => {
        // Create a mock extension context
        mockContext = {
            globalState: {
                get: (key: string, defaultValue?: any) => defaultValue || [],
                update: async (key: string, value: any) => Promise.resolve()
            },
            subscriptions: []
        } as any;

        historyManager = new HistoryManager(mockContext);
    });

    test('Should add history item correctly', async () => {
        const query = 'SELECT * FROM test';
        const queryType = 'sql' as const;
        const result: QueryResult = {
            success: true,
            executionTime: 100,
            executedAt: new Date(),
            rowCount: 5,
            data: []
        };
        const endpoint = 'http://localhost:9200';

        await historyManager.addToHistory(query, queryType, result, endpoint);
        
        const history = historyManager.getHistory();
        assert.strictEqual(history.length, 1);
        assert.strictEqual(history[0].query, query);
        assert.strictEqual(history[0].queryType, queryType);
        assert.strictEqual(history[0].endpoint, endpoint);
    });

    test('Should remove history item correctly', async () => {
        // Add a test item
        const query = 'SELECT * FROM test';
        const queryType = 'sql' as const;
        const result: QueryResult = {
            success: true,
            executionTime: 100,
            executedAt: new Date(),
            rowCount: 5,
            data: []
        };
        const endpoint = 'http://localhost:9200';

        await historyManager.addToHistory(query, queryType, result, endpoint);
        
        let history = historyManager.getHistory();
        assert.strictEqual(history.length, 1);
        
        const itemId = history[0].id;
        
        // Remove the item
        await historyManager.removeHistoryItem(itemId);
        
        history = historyManager.getHistory();
        assert.strictEqual(history.length, 0);
    });

    test('Should clear all history correctly', async () => {
        // Add multiple test items
        const result: QueryResult = {
            success: true,
            executionTime: 100,
            executedAt: new Date(),
            rowCount: 5,
            data: []
        };

        await historyManager.addToHistory('SELECT * FROM test1', 'sql', result, 'http://localhost:9200');
        await historyManager.addToHistory('SELECT * FROM test2', 'sql', result, 'http://localhost:9200');
        await historyManager.addToHistory('source=logs | head 10', 'ppl', result, 'http://localhost:9200');
        
        let history = historyManager.getHistory();
        assert.strictEqual(history.length, 3);
        
        // Clear all history
        await historyManager.clearHistory();
        
        history = historyManager.getHistory();
        assert.strictEqual(history.length, 0);
    });

    test('Should search history correctly', async () => {
        const result: QueryResult = {
            success: true,
            executionTime: 100,
            executedAt: new Date(),
            rowCount: 5,
            data: []
        };

        await historyManager.addToHistory('SELECT * FROM users', 'sql', result, 'http://localhost:9200');
        await historyManager.addToHistory('SELECT * FROM orders', 'sql', result, 'http://localhost:9200');
        await historyManager.addToHistory('source=logs | head 10', 'ppl', result, 'http://localhost:9200');
        
        const searchResults = historyManager.searchHistory('users');
        assert.strictEqual(searchResults.length, 1);
        assert.strictEqual(searchResults[0].query, 'SELECT * FROM users');
        
        const sqlResults = historyManager.getHistoryByType('sql');
        assert.strictEqual(sqlResults.length, 2);
        
        const pplResults = historyManager.getHistoryByType('ppl');
        assert.strictEqual(pplResults.length, 1);
    });

    test('Should get statistics correctly', async () => {
        const successResult: QueryResult = {
            success: true,
            executionTime: 100,
            executedAt: new Date(),
            rowCount: 5,
            data: []
        };

        const errorResult: QueryResult = {
            success: false,
            executionTime: 0,
            executedAt: new Date(),
            error: 'Connection failed'
        };

        await historyManager.addToHistory('SELECT * FROM users', 'sql', successResult, 'http://localhost:9200');
        await historyManager.addToHistory('SELECT * FROM orders', 'sql', errorResult, 'http://localhost:9200');
        await historyManager.addToHistory('source=logs | head 10', 'ppl', successResult, 'http://localhost:9200');
        
        const stats = historyManager.getStatistics();
        assert.strictEqual(stats.totalQueries, 3);
        assert.strictEqual(stats.successfulQueries, 2);
        assert.strictEqual(stats.failedQueries, 1);
        assert.strictEqual(stats.sqlQueries, 2);
        assert.strictEqual(stats.pplQueries, 1);
        assert.strictEqual(stats.averageExecutionTime, 100);
    });
});
