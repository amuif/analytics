import * as duckdb from '@duckdb/duckdb-wasm';

export interface WorkerRPCRequest {
	id: string;
	type: 'INIT' | 'REGISTER_FILE' | 'QUERY' | 'GET_TABLES' | 'DROP_TABLE';
	payload?: unknown;
}

export interface WorkerRPCResponse {
	id: string;
	type: string;
	payload?: unknown;
	error?: string;
}

// Dedicated worker module
console.log('[DuckDB Worker] Worker thread initialized.');
