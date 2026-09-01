# AGENTS.md

> **Project Purpose & Agent Guidelines for Analytics Workbench**

---

## 1. Project Vision & Purpose

**Analytics** is a 100% client-side, in-browser SQL analytics workbench. It allows users to drag-and-drop or paste datasets (CSV, Parquet, JSON, Arrow, SQLite) and instantly query, transform, explore, and visualize them using DuckDB running directly inside the browser.

### Key Objectives
- **Zero Server Footprint & 100% Privacy**: All data processing, storage, and querying happen locally on the user's device via Web Workers / WebAssembly. No data or telemetry is sent to any server.
- **Instant Data Exploration**: Users drop a file and immediately get an interactive workspace with:
  - Fast, virtualized **Data Grid / Table Viewer** for inspecting rows and columns.
  - Built-in **Charting & Visualizations** (bar, line, scatter, histogram, area charts).
  - High-performance SQL queries executed by the DuckDB engine.
- **Ephemeral & Clean Sessions**: Sessions are in-memory and ephemeral by default for speed, simplicity, and complete privacy.

---

## 2. Tech Stack & Architecture

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | Svelte 5 + SvelteKit 2 | Modern Svelte 5 Runes (`$state`, `$derived`, `$props`, `$bindable`, snippets) |
| **Language** | TypeScript (Strict) | Checked with `svelte-check` / `bun run check` |
| **Styling** | Tailwind CSS v4 + tw-animate-css | Shadcn-style design system with OKLCH CSS variables and dark mode support |
| **UI Primitives** | Bits UI (`bits-ui`), Lucide Icons (`@lucide/svelte`), Phosphor Icons (`phosphor-svelte`) | Accessible, unstyled primitives styled with Tailwind |
| **Engine** | DuckDB (Client-side / Web Worker) + Apache Arrow | Vectorized columnar database in WebAssembly |
| **Package Manager** | Bun | Run commands using `bun run <script>` |

---

## 3. Directory Structure

```text
/mnt/Learning/Work/analytics/
├── src/
│   ├── app.d.ts
│   ├── app.html
│   ├── routes/
│   │   ├── +layout.svelte      # Root layout, theme, and favicon setup
│   │   ├── +page.svelte        # Home landing page with hero and centered dropzone
│   │   └── layout.css          # Tailwind CSS imports and OKLCH color variables
│   └── lib/
│       ├── assets/             # Static SVGs and icons
│       ├── components/
│       │   ├── button.svelte   # Enhanced button primitive with loading spinner
│       │   ├── home/
│       │   │   └── file-drop.svelte # Dropzone component with file list and drag overlay
│       │   └── ui/             # Reusable UI component library (shadcn/bits-ui)
│       │       ├── button/
│       │       ├── file-drop-zone/
│       │       └── spinner/
│       ├── services/
│       │   └── duckdb.ts       # DuckDB service client communicating with Web Worker
│       ├── workers/
│       │   └── duckdb.worker.ts # DuckDB Web Worker execution thread
│       └── utils.ts            # Class merging (cn) and shared helpers
├── AGENTS.md                   # This document
├── package.json
└── tsconfig.json
```

---

## 4. Svelte 5 & Coding Conventions for Agents

When creating or modifying components, agents **must** adhere to these Svelte 5 standards:

1. **Use Runes Exclusively**:
   - Use `$state()` for reactive variables (do NOT use `let x = 1` with legacy `$:` reactivity).
   - Use `$derived()` or `$derived.by()` for computed/derived values.
   - Use `$props()` and `$bindable()` for component inputs.
   - Use `$effect()` only for side effects (e.g. event listeners, DOM measurements).
2. **Use Snippets Instead of Slots**:
   - Use `{#snippet name()}` and `{@render name()}` instead of `<slot />`.
3. **Event Handlers**:
   - Use `onclick`, `onkeydown`, `onchange` (lowercase attributes) instead of legacy `on:click`, `on:keydown`.
4. **Tailwind CSS v4 Classes**:
   - Use semantic theme tokens (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, etc.).
   - Use `cn(...)` utility from `$lib/utils.js` for dynamic class merging.
5. **Type Safety Verification**:
   - Always run `bun run check` after modifying Svelte or TypeScript files to ensure zero compiler/type errors.

---

## 5. Implementation Roadmap & Milestones

1. **DuckDB Worker Engine**:
   - Initialize DuckDB-Wasm in `src/lib/workers/duckdb.worker.ts`.
   - Register uploaded `File` objects into DuckDB virtual filesystem.
   - Provide query execution API with Arrow / JSON materialized results in `src/lib/services/duckdb.ts`.

2. **Data Grid & Table View**:
   - Build a virtualized table component for smooth scrolling over large query results.
   - Support column sorting, pagination, and data type formatting.

3. **Charting & Visualizations**:
   - Provide instant visualization templates (Bar, Line, Scatter, Area, Histogram).
   - Allow column mapping (X-axis, Y-axis, aggregation functions like SUM, AVG, COUNT).

4. **Interactive SQL Workbench**:
   - Code editor for writing custom SQL queries against registered tables.
   - Schema tree showing loaded tables, column names, and inferred data types.
