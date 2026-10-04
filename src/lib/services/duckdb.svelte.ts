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

	async loadSampleDataset(type: 'restock' | 'clearance' | 'abc' = 'restock'): Promise<void> {
		await this.init();

		if (type === 'restock') {
			const csv = `sku,product_title,category,warehouse_zone,stock_on_hand,monthly_velocity,reorder_point,lead_time_days,days_of_supply,unit_cost,holding_cost_month
SKU-ELC-1001,65W GaN Fast Charger Multi-Port,Electronics,Zone A (High Velocity),14,115,45,21,4,18.50,5.18
SKU-ELC-1002,USB-C Quad Display Docking Hub,Electronics,Zone A (High Velocity),120,65,40,14,55,62.00,148.80
SKU-IND-2001,Heavy-Duty Pneumatic Solenoid Valve,Machinery,Zone B (Bulk Pallets),8,85,50,28,3,45.00,7.20
SKU-IND-2002,Precision Digital Caliper Tool,Machinery,Zone B (Bulk Pallets),180,45,35,14,120,24.50,88.20
SKU-HOM-3001,Smart Programmable Thermostat Sensor,Home & Living,Zone D (Standard Racks),520,12,60,14,1300,38.00,395.20
SKU-HOM-3002,Stainless Steel Mixing Bowl Set 5L,Home & Living,Zone D (Standard Racks),95,40,30,10,71,16.50,31.35
SKU-AUT-4001,Synthetic Motor Oil 5W-30 Full Case,Automotive,Zone B (Bulk Pallets),18,92,45,25,6,32.00,11.52
SKU-AUT-4002,Ceramic Front Brake Pad Replacement Kit,Automotive,Zone B (Bulk Pallets),140,55,40,14,48.00,134.40
SKU-MED-5001,Sterile Nitrile Powder-Free Gloves L,Medical Supplies,Zone C (Cold Storage),620,18,70,14,1033,12.50,155.00
SKU-MED-5002,Digital Infrared Forehead Thermometer,Medical Supplies,Zone C (Cold Storage),110,60,35,12,55,22.00,48.40`;
			const file = new File([csv], 'warehouse_stock_restock.csv', { type: 'text/csv' });
			await this.registerFile(file);
		} else if (type === 'clearance') {
			const csv = `sku,item_name,category,stock_units,monthly_sales,days_dormant,days_of_supply,unit_cost,retail_price,tied_capital,markdown_tier
SKU-CLR-APP-8001,Winter Thermal Parka Heavy-Duty,Seasonal Apparel,340,3,145,3400,42.00,110.00,14280.00,Dead Stock (60% Off)
SKU-CLR-APP-8002,Breathable Mesh Running Shorts,Seasonal Apparel,85,22,25,116,14.00,34.00,1190.00,Full Margin
SKU-CLR-AUD-8003,Over-Ear Studio Headphones V1,Consumer Audio,210,5,110,1260,35.00,89.00,7350.00,Clearance (35% Off)
SKU-CLR-AUD-8004,Bluetooth Waterproof Speaker Mini,Consumer Audio,60,28,18,64,18.50,45.00,1110.00,Full Margin
SKU-CLR-KIT-8005,Programmable Cold Drip Coffee Maker,Kitchenware,190,4,130,1425,52.00,129.00,9880.00,Dead Stock (60% Off)
SKU-CLR-KIT-8006,Cast Iron Skillet Pre-Seasoned 12in,Kitchenware,75,32,14,70,22.00,55.00,1650.00,Full Margin
SKU-CLR-OUT-8007,UV Sunshade Camping Canopy 10x10,Outdoor Gear,160,6,85,800,48.00,120.00,7680.00,Clearance (35% Off)
SKU-CLR-OUT-8008,Compact Lightweight Camp Chair,Outdoor Gear,50,25,15,60,19.00,48.00,950.00,Full Margin
SKU-CLR-FIT-8009,Adjustable Dumbbell Weight Set 50lb,Fitness Gear,140,4,95,1050,68.00,175.00,9520.00,Clearance (35% Off)
SKU-CLR-FIT-8010,Non-Slip High Density Yoga Mat,Fitness Gear,40,35,10,34,12.00,30.00,480.00,Full Margin`;
			const file = new File([csv], 'warehouse_clearance_markdown.csv', { type: 'text/csv' });
			await this.registerFile(file);
		} else {
			const csv = `sku,product_name,category,abc_class,stock_on_hand,annual_demand_units,unit_cost,annual_consumption_value,carrying_cost_annual,lead_time_days,supplier
SKU-ABC-ELC-3001,PCIe Gen4 NVMe SSD 2TB,Electronics,Class A,240,1850,145.00,268250.00,7656.00,10,Apex Industrial LLC
SKU-ABC-ELC-3002,Cat-6A Shielded Cable 50m,Electronics,Class B,180,620,18.50,11470.00,732.60,18,Shenzhen Micro
SKU-ABC-ELC-3003,Cable Tie Wraps 100pk,Electronics,Class C,850,180,3.20,576.00,598.40,30,Global Wholesale
SKU-ABC-IND-3004,Hydraulic High-Pressure Flow Valve,Machinery,Class A,85,740,285.00,210900.00,5329.50,12,Kyoto Precision Co
SKU-ABC-IND-3005,Precision Digital Sensor Module,Machinery,Class B,160,480,54.00,25920.00,1900.80,16,Kyoto Precision Co
SKU-ABC-IND-3006,Stainless Flange Hex Bolt Pack,Machinery,Class C,1200,310,4.50,1395.00,1188.00,35,Global Wholesale
SKU-ABC-MED-3007,Digital Ultrasound Probe Sensor,Medical Supplies,Class A,65,520,410.00,213200.00,5863.00,14,Nordic Diagnostics AS
SKU-ABC-MED-3008,Adjustable Micropipette 1000uL,Medical Supplies,Class B,120,380,72.00,27360.00,1899.60,20,Nordic Diagnostics AS
SKU-ABC-MED-3009,Disposable Tongue Depressors 500pk,Medical Supplies,Class C,950,140,5.80,812.00,1212.20,30,Global Wholesale`;
			const file = new File([csv], 'inventory_abc_stratification.csv', { type: 'text/csv' });
			await this.registerFile(file);
		}
	}
}

export const duckdbService = new DuckDBService();
