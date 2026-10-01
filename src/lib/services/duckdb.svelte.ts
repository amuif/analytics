import * as duckdb from '@duckdb/duckdb-wasm';

export interface ColumnMetadata {
	name: string;
	type: string;
}

export interface TableMetadata {
	name: string;
	columns: ColumnMetadata[];
	rowCount: number;
	fileSize?: number;
	fileName?: string;
}

export interface QueryResult {
	columns: ColumnMetadata[];
	rows: Record<string, unknown>[];
	rowCount: number;
	executionTimeMs: number;
	sql: string;
}

function serializeValue(val: unknown): unknown {
	if (val === null || val === undefined) {
		return null;
	}
	if (typeof val === 'bigint') {
		const num = Number(val);
		return Number.isSafeInteger(num) ? num : val.toString();
	}
	if (val instanceof Date) {
		return val.toISOString();
	}
	if (val instanceof Uint8Array) {
		return Array.from(val);
	}
	return val;
}

class DuckDBService {
	// Svelte 5 Reactive State
	isReady = $state(false);
	isInitializing = $state(false);
	isQuerying = $state(false);
	tables = $state<TableMetadata[]>([]);
	activeTable = $state<string | null>(null);
	queryResult = $state<QueryResult | null>(null);
	error = $state<string | null>(null);
	history = $state<string[]>([]);

	private db: duckdb.AsyncDuckDB | null = null;
	private conn: duckdb.AsyncDuckDBConnection | null = null;
	private initPromise: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.isReady && this.conn) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			this.isInitializing = true;
			this.error = null;
			try {
				const bundles = duckdb.getJsDelivrBundles();
				const bundle = await duckdb.selectBundle(bundles);
				const worker = await duckdb.createWorker(bundle.mainWorker!);
				const logger = new duckdb.VoidLogger();

				this.db = new duckdb.AsyncDuckDB(logger, worker);
				await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
				this.conn = await this.db.connect();
				this.isReady = true;
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Failed to initialize DuckDB WebAssembly engine.';
				this.error = msg;
				console.error('DuckDB Initialization Error:', err);
				throw err;
			} finally {
				this.isInitializing = false;
			}
		})();

		return this.initPromise;
	}

	async registerFile(file: File): Promise<TableMetadata> {
		await this.init();
		if (!this.db || !this.conn) throw new Error('DuckDB not initialized');

		this.error = null;
		const buffer = new Uint8Array(await file.arrayBuffer());
		const fileName = file.name;
		await this.db.registerFileBuffer(fileName, buffer);

		const ext = fileName.split('.').pop()?.toLowerCase() || '';
		// Clean table name: alphanumeric + underscores
		const rawName = fileName.replace(/\.[^/.]+$/, '');
		let tableName = rawName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
		if (/^[0-9]/.test(tableName)) {
			tableName = `t_${tableName}`;
		}
		if (!tableName) {
			tableName = 'dataset';
		}

		try {
			if (['csv', 'tsv', 'txt'].includes(ext)) {
				await this.conn.query(
					`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}', header=True);`
				);
			} else if (ext === 'parquet') {
				await this.conn.query(
					`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_parquet('${fileName}');`
				);
			} else if (ext === 'json') {
				await this.conn.query(
					`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${fileName}');`
				);
			} else if (ext === 'arrow') {
				await this.conn.insertArrowFromIPCStream(buffer, { name: tableName, create: true });
			} else {
				// Default to csv auto-detect
				await this.conn.query(
					`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}');`
				);
			}

			const tableMeta = await this.getTableMetadata(tableName, file.size, fileName);
			await this.refreshTables();
			this.activeTable = tableName;

			// Run initial preview query
			await this.query(`SELECT * FROM "${tableName}" LIMIT 100;`);

			return tableMeta;
		} catch (err) {
			const msg = err instanceof Error ? err.message : `Failed to import ${fileName}`;
			this.error = msg;
			throw new Error(msg);
		}
	}

	async registerFiles(files: File[]): Promise<TableMetadata[]> {
		const results: TableMetadata[] = [];
		for (const file of files) {
			const meta = await this.registerFile(file);
			results.push(meta);
		}
		return results;
	}

	async query(sql: string): Promise<QueryResult> {
		await this.init();
		if (!this.conn) throw new Error('DuckDB not initialized');

		this.isQuerying = true;
		this.error = null;
		const trimmedSql = sql.trim();

		try {
			const startTime = performance.now();
			const result = await this.conn.query(trimmedSql);
			const executionTimeMs = Math.max(1, Math.round(performance.now() - startTime));

			const columns: ColumnMetadata[] = result.schema.fields.map((f) => ({
				name: f.name,
				type: f.type.toString()
			}));

			const rows: Record<string, unknown>[] = [];
			const numRows = result.numRows;

			for (let i = 0; i < numRows; i++) {
				const row = result.get(i);
				if (row) {
					const obj: Record<string, unknown> = {};
					for (const col of columns) {
						obj[col.name] = serializeValue(row[col.name]);
					}
					rows.push(obj);
				}
			}

			const queryRes: QueryResult = {
				columns,
				rows,
				rowCount: numRows,
				executionTimeMs,
				sql: trimmedSql
			};

			this.queryResult = queryRes;

			// Add to history (deduplicated)
			if (this.history[0] !== trimmedSql) {
				this.history = [trimmedSql, ...this.history.slice(0, 19)];
			}

			return queryRes;
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Query execution failed.';
			this.error = msg;
			throw new Error(msg);
		} finally {
			this.isQuerying = false;
		}
	}

	async getTableMetadata(tableName: string, fileSize?: number, fileName?: string): Promise<TableMetadata> {
		if (!this.conn) throw new Error('DuckDB not initialized');

		// Columns
		const describeRes = await this.conn.query(`DESCRIBE "${tableName}";`);
		const columns: ColumnMetadata[] = [];
		for (let i = 0; i < describeRes.numRows; i++) {
			const row = describeRes.get(i);
			if (row) {
				columns.push({
					name: String(row['column_name']),
					type: String(row['column_type'])
				});
			}
		}

		// Row count
		const countRes = await this.conn.query(`SELECT COUNT(*) as cnt FROM "${tableName}";`);
		let rowCount = 0;
		if (countRes.numRows > 0) {
			const row = countRes.get(0);
			if (row) {
				rowCount = Number(row['cnt']) || 0;
			}
		}

		return {
			name: tableName,
			columns,
			rowCount,
			fileSize,
			fileName
		};
	}

	async refreshTables(): Promise<TableMetadata[]> {
		if (!this.conn) return [];

		const res = await this.conn.query(
			`SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name;`
		);

		const updatedTables: TableMetadata[] = [];
		for (let i = 0; i < res.numRows; i++) {
			const row = res.get(i);
			if (row) {
				const tableName = String(row['table_name']);
				const existing = this.tables.find((t) => t.name === tableName);
				const meta = await this.getTableMetadata(tableName, existing?.fileSize, existing?.fileName);
				updatedTables.push(meta);
			}
		}

		this.tables = updatedTables;
		if (updatedTables.length > 0 && (!this.activeTable || !updatedTables.some((t) => t.name === this.activeTable))) {
			this.activeTable = updatedTables[0].name;
		}
		return updatedTables;
	}

	async dropTable(tableName: string): Promise<void> {
		if (!this.conn) return;
		await this.conn.query(`DROP TABLE IF EXISTS "${tableName}";`);
		await this.refreshTables();
		if (this.activeTable === tableName) {
			this.activeTable = this.tables[0]?.name || null;
			if (this.activeTable) {
				await this.query(`SELECT * FROM "${this.activeTable}" LIMIT 100;`);
			} else {
				this.queryResult = null;
			}
		}
	}

	async exportData(queryOrTable: string, format: 'csv' | 'parquet' | 'json'): Promise<Blob> {
		if (!this.db || !this.conn) throw new Error('DuckDB not initialized');

		const fileName = `export_${Date.now()}.${format}`;
		const query = queryOrTable.trim().toLowerCase().startsWith('select ')
			? queryOrTable
			: `SELECT * FROM "${queryOrTable}"`;

		if (format === 'csv') {
			await this.conn.query(`COPY (${query}) TO '${fileName}' (HEADER, DELIMITER ',');`);
			const buf = await this.db.copyFileToBuffer(fileName);
			return new Blob([buf as unknown as BlobPart], { type: 'text/csv' });
		} else if (format === 'parquet') {
			await this.conn.query(`COPY (${query}) TO '${fileName}' (FORMAT PARQUET);`);
			const buf = await this.db.copyFileToBuffer(fileName);
			return new Blob([buf as unknown as BlobPart], { type: 'application/octet-stream' });
		} else {
			await this.conn.query(`COPY (${query}) TO '${fileName}' (FORMAT JSON, ARRAY true);`);
			const buf = await this.db.copyFileToBuffer(fileName);
			return new Blob([buf as unknown as BlobPart], { type: 'application/json' });
		}
	}

	async loadSampleDataset(type: 'iris' | 'sales' | 'stocks' = 'iris'): Promise<void> {
		await this.init();

		if (type === 'iris') {
			const csv = `sepal_length,sepal_width,petal_length,petal_width,species
5.1,3.5,1.4,0.2,setosa
4.9,3.0,1.4,0.2,setosa
4.7,3.2,1.3,0.2,setosa
4.6,3.1,1.5,0.2,setosa
5.0,3.6,1.4,0.2,setosa
5.4,3.9,1.7,0.4,setosa
4.6,3.4,1.4,0.3,setosa
5.0,3.4,1.5,0.2,setosa
4.4,2.9,1.4,0.2,setosa
4.9,3.1,1.5,0.1,setosa
5.4,3.7,1.5,0.2,setosa
4.8,3.4,1.6,0.2,setosa
4.8,3.0,1.4,0.1,setosa
4.3,3.0,1.1,0.1,setosa
5.8,4.0,1.2,0.2,setosa
5.7,4.4,1.5,0.4,setosa
5.4,3.9,1.3,0.4,setosa
5.1,3.5,1.4,0.3,setosa
5.7,3.8,1.7,0.3,setosa
5.1,3.8,1.5,0.3,setosa
7.0,3.2,4.7,1.4,versicolor
6.4,3.2,4.5,1.5,versicolor
6.9,3.1,4.9,1.5,versicolor
5.5,2.3,4.0,1.3,versicolor
6.5,2.8,4.6,1.5,versicolor
5.7,2.8,4.5,1.3,versicolor
6.3,3.3,4.7,1.6,versicolor
4.9,2.4,3.3,1.0,versicolor
6.6,2.9,4.6,1.3,versicolor
5.2,2.7,3.9,1.4,versicolor
5.0,2.0,3.5,1.0,versicolor
5.9,3.0,4.2,1.5,versicolor
6.0,2.2,4.0,1.0,versicolor
6.1,2.9,4.7,1.4,versicolor
5.6,2.9,3.6,1.3,versicolor
6.7,3.1,4.4,1.4,versicolor
5.6,3.0,4.5,1.5,versicolor
5.8,2.7,4.1,1.0,versicolor
6.2,2.2,4.5,1.5,versicolor
5.6,2.5,3.9,1.1,versicolor
6.3,3.3,6.0,2.5,virginica
5.8,2.7,5.1,1.9,virginica
7.1,3.0,5.9,2.1,virginica
6.3,2.9,5.6,1.8,virginica
6.5,3.0,5.8,2.2,virginica
7.6,3.0,6.6,2.1,virginica
4.9,2.5,4.5,1.7,virginica
7.3,2.9,6.3,1.8,virginica
6.7,2.5,5.8,1.8,virginica
7.2,3.6,6.1,2.5,virginica
6.5,3.2,5.1,2.0,virginica
6.4,2.7,5.3,1.9,virginica
6.8,3.0,5.5,2.1,virginica
5.7,2.5,5.0,2.0,virginica
5.8,2.8,5.1,2.4,virginica
6.4,3.2,5.3,2.3,virginica
6.5,3.0,5.5,1.8,virginica
7.7,3.8,6.7,2.2,virginica
7.7,2.6,6.9,2.3,virginica
6.0,2.2,5.0,1.5,virginica`;
			const file = new File([csv], 'iris_dataset.csv', { type: 'text/csv' });
			await this.registerFile(file);
		} else if (type === 'sales') {
			const csv = `order_id,order_date,customer,category,sub_category,sales,quantity,profit
CA-2024-1001,2024-01-15,Acme Corp,Technology,Phones,1249.99,2,312.50
CA-2024-1002,2024-01-18,Global Logistics,Furniture,Chairs,450.00,4,85.20
CA-2024-1003,2024-02-04,Stark Industries,Technology,Laptops,2499.00,1,620.00
CA-2024-1004,2024-02-11,Wayne Enterprises,Office Supplies,Binders,42.50,10,18.75
CA-2024-1005,2024-03-01,Cyberdyne Systems,Technology,Accessories,189.90,5,45.00
CA-2024-1006,2024-03-14,Umbrella Corp,Office Supplies,Paper,78.20,8,22.10
CA-2024-1007,2024-04-02,Hooli,Furniture,Bookcases,890.00,3,145.00
CA-2024-1008,2024-04-19,Pied Piper,Technology,Phones,849.50,1,190.00
CA-2024-1009,2024-05-08,Initech,Office Supplies,Appliances,315.00,2,72.40
CA-2024-1010,2024-05-23,Massive Dynamic,Furniture,Tables,1150.00,2,-45.00
CA-2024-1011,2024-06-03,Tyrell Corp,Technology,Laptops,3199.99,2,850.00
CA-2024-1012,2024-06-17,Soylent Corp,Office Supplies,Storage,230.00,6,52.80
CA-2024-1013,2024-07-05,Wonka Industries,Furniture,Furnishings,160.00,4,34.00
CA-2024-1014,2024-07-22,Aperture Science,Technology,Phones,1100.00,2,240.00
CA-2024-1015,2024-08-11,Oscorp,Office Supplies,Paper,64.00,5,19.20`;
			const file = new File([csv], 'superstore_sales.csv', { type: 'text/csv' });
			await this.registerFile(file);
		} else {
			const csv = `date,symbol,open,high,low,close,volume
2024-01-02,AAPL,187.15,188.44,183.89,185.64,82488700
2024-01-03,AAPL,184.22,185.88,183.43,184.25,58414500
2024-01-04,AAPL,182.15,183.09,180.88,181.91,71983600
2024-01-05,AAPL,181.99,182.76,180.17,181.18,62303300
2024-01-02,MSFT,373.86,376.22,369.84,370.87,25258600
2024-01-03,MSFT,369.01,373.26,368.51,370.60,23083500
2024-01-04,MSFT,370.67,373.10,367.17,367.94,20901500
2024-01-05,MSFT,368.97,372.14,366.50,367.75,20982400
2024-01-02,NVDA,492.58,499.97,476.90,481.68,41125400
2024-01-03,NVDA,474.85,481.84,472.61,475.69,32089700
2024-01-04,NVDA,477.67,485.00,475.08,479.98,30653500
2024-01-05,NVDA,484.62,495.47,483.06,490.97,41456800`;
			const file = new File([csv], 'tech_stocks.csv', { type: 'text/csv' });
			await this.registerFile(file);
		}
	}
}

export const duckdbService = new DuckDBService();
