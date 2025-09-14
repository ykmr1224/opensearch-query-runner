import * as vscode from 'vscode';
import { QueryHistoryItem, QueryResult, OpenSearchConfig } from './types';

export class HistoryManager {
    private history: QueryHistoryItem[] = [];
    private context: vscode.ExtensionContext;
    private maxHistoryItems: number = 100;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadHistory();
        this.updateMaxHistoryItems();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('opensearch.maxHistoryItems')) {
                this.updateMaxHistoryItems();
            }
        });
    }

    private updateMaxHistoryItems(): void {
        const config = vscode.workspace.getConfiguration('opensearch');
        this.maxHistoryItems = config.get('maxHistoryItems', 100);
        this.trimHistory();
    }

    private loadHistory(): void {
        const savedHistory = this.context.globalState.get<QueryHistoryItem[]>('opensearch.queryHistory', []);
        
        // Convert timestamp strings back to Date objects
        this.history = savedHistory.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp)
        }));
    }

    private async saveHistory(): Promise<void> {
        await this.context.globalState.update('opensearch.queryHistory', this.history);
    }

    public async addToHistory(
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api',
        result: QueryResult,
        endpoint: string,
        explainResult?: QueryResult
    ): Promise<void> {
        const historyItem: QueryHistoryItem = {
            id: this.generateId(),
            query,
            queryType,
            timestamp: result.executedAt,
            result,
            endpoint,
            explainResult
        };

        // Add to beginning of history
        this.history.unshift(historyItem);
        
        // Trim history if needed
        this.trimHistory();
        
        // Save to persistent storage
        await this.saveHistory();
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    private trimHistory(): void {
        if (this.history.length > this.maxHistoryItems) {
            this.history = this.history.slice(0, this.maxHistoryItems);
        }
    }

    public getHistory(): QueryHistoryItem[] {
        return [...this.history];
    }

    public getHistoryItem(id: string): QueryHistoryItem | undefined {
        return this.history.find(item => item.id === id);
    }

    public async clearHistory(): Promise<void> {
        this.history = [];
        await this.saveHistory();
    }

    public async removeHistoryItem(id: string): Promise<void> {
        this.history = this.history.filter(item => item.id !== id);
        await this.saveHistory();
    }

    public searchHistory(searchTerm: string): QueryHistoryItem[] {
        const term = searchTerm.toLowerCase();
        return this.history.filter(item => 
            item.query.toLowerCase().includes(term) ||
            item.queryType.toLowerCase().includes(term) ||
            item.endpoint.toLowerCase().includes(term)
        );
    }

    public getHistoryByType(queryType: 'sql' | 'ppl'): QueryHistoryItem[] {
        return this.history.filter(item => item.queryType === queryType);
    }

    public getRecentHistory(count: number = 10): QueryHistoryItem[] {
        return this.history.slice(0, count);
    }



    public getStatistics(): {
        totalQueries: number;
        successfulQueries: number;
        failedQueries: number;
        sqlQueries: number;
        pplQueries: number;
        averageExecutionTime: number;
    } {
        const total = this.history.length;
        const successful = this.history.filter(item => item.result.success).length;
        const failed = total - successful;
        const sql = this.history.filter(item => item.queryType === 'sql').length;
        const ppl = this.history.filter(item => item.queryType === 'ppl').length;
        
        const executionTimes = this.history
            .filter(item => item.result.success)
            .map(item => item.result.executionTime);
        
        const averageExecutionTime = executionTimes.length > 0 
            ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
            : 0;

        return {
            totalQueries: total,
            successfulQueries: successful,
            failedQueries: failed,
            sqlQueries: sql,
            pplQueries: ppl,
            averageExecutionTime: Math.round(averageExecutionTime)
        };
    }
}
