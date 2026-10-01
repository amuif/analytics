export interface SampleDatasetInfo {
  name: string;
  filename: string;
  description: string;
  domain: string;
  generateRows: () => Record<string, any>[];
}

export const SAMPLE_DATASETS: SampleDatasetInfo[] = [
  {
    name: 'Warehouse Stock & Restock Triage',
    filename: 'warehouse_inventory_log.csv',
    description: '1,200 product SKUs tracking stock-on-hand, monthly sales velocity, reorder thresholds, lead time, and holding costs.',
    domain: 'Inventory',
    generateRows: () => {
      const categories = [
        'Electronics & Compute',
        'Industrial & Machinery',
        'Home & Smart Living',
        'Automotive & Fleet',
        'Medical & Lab Supplies',
      ];

      const productTemplates: Record<string, string[]> = {
        'Electronics & Compute': [
          '65W GaN Fast Charger Multi-Port',
          'USB-C Quad Display Docking Hub',
          'Cat-6A Shielded Ethernet Cable 50m',
          '2.4GHz Wireless Ergonomic Mouse',
          'Mechanical Backlit Keyboard Tactile',
          'PCIe Gen4 NVMe Solid State Drive 2TB',
          'Active Noise Cancelling Headset Pro',
          'DisplayPort to HDMI 4K Adapter Braided',
        ],
        'Industrial & Machinery': [
          'Heavy-Duty Pneumatic Solenoid Valve',
          'Precision Caliper Digital Measuring Tool',
          'Industrial HEPA Intake Air Filter',
          'Hydraulic High-Pressure Flow Gauge',
          'Double-Shielded Ball Bearing 25mm',
          'Stainless Steel Flange Bolt Pack 100pc',
          'Vibration Dampener Mount Industrial',
        ],
        'Home & Smart Living': [
          'Smart Programmable Thermostat Sensor',
          'Stainless Steel Mixing Bowl Set 5L',
          'Bamboo Fiber Cutting Board Antimicrobial',
          'Ultra-Quiet Ultrasonic Air Humidifier',
          'Modular Storage Organizer Drawer 4-Tier',
          'Cordless Handheld Vacuum High-Suction',
        ],
        'Automotive & Fleet': [
          'Synthetic Motor Oil 5W-30 Full Case',
          'Ceramic Front Brake Pad Replacement Kit',
          'Heavy Duty ODB2 Diagnostic Scanner',
          'Tire Pressure Monitoring Sensor TPMS',
          'Automotive Battery Booster Pack 2000A',
        ],
        'Medical & Lab Supplies': [
          'Sterile Nitrile Powder-Free Gloves L',
          'Digital Infrared Forehead Thermometer',
          'Borosilicate Glass Beaker Set 5-Piece',
          'N95 Medical Grade Respirator Mask 50pk',
          'Adjustable Volume Micropipette 100-1000uL',
        ],
      };

      const warehouseLocations = ['Zone A (High Velocity)', 'Zone B (Bulk Pallets)', 'Zone C (Cold Storage)', 'Zone D (Standard Racks)'];
      const suppliers = [
        'Shenzhen Micro Logistics (Tier 1)',
        'Apex Industrial Components LLC',
        'Nordic Medical Diagnostics AS',
        'Kyoto Precision Engineering Co',
        'Continental Automotive Parts GmbH',
      ];

      const rows: Record<string, any>[] = [];
      const count = 1200;

      for (let i = 1; i <= count; i++) {
        const cat = categories[i % categories.length];
        const templates = productTemplates[cat];
        const title = templates[(i * 3) % templates.length];
        const location = warehouseLocations[i % warehouseLocations.length];
        const supplier = suppliers[i % suppliers.length];

        // Realistic supply chain distribution:
        // ~15% critical stockout risk, ~20% sluggish overstock, ~65% balanced
        let stockOnHand: number;
        let monthlyVelocity: number;
        let reorderPoint = 35 + ((i * 7) % 85); // 35 to 120
        let leadTimeDays = 7 + ((i * 5) % 35); // 7 to 42 days

        if (i % 7 === 0) {
          // Critical stockout hazard
          stockOnHand = Math.floor(Math.random() * 20); // 0 to 19 units
          monthlyVelocity = 80 + Math.floor(Math.random() * 120); // High demand
          leadTimeDays = 21 + Math.floor(Math.random() * 20);
        } else if (i % 5 === 0) {
          // Heavy overstock
          stockOnHand = 350 + Math.floor(Math.random() * 400); // 350 to 750 units
          monthlyVelocity = 3 + Math.floor(Math.random() * 12); // Sluggish sales
        } else {
          // Healthy flow
          monthlyVelocity = 30 + Math.floor(Math.random() * 90);
          stockOnHand = reorderPoint + Math.floor(Math.random() * 120);
        }

        const dailyRunRate = Math.max(0.1, monthlyVelocity / 30);
        const daysOfSupply = Math.round(stockOnHand / dailyRunRate);
        const unitCost = Number((14.5 + ((i * 11) % 240)).toFixed(2));
        const holdingCostMonth = Number(((stockOnHand * unitCost * 0.02)).toFixed(2)); // ~2% monthly storage cost

        rows.push({
          SKU: `SKU-${cat.substring(0, 3).toUpperCase()}-${4000 + i}`,
          Product_Title: title,
          Category: cat,
          Warehouse_Location: location,
          Stock_On_Hand: stockOnHand,
          Monthly_Sales_Velocity: monthlyVelocity,
          Reorder_Point: reorderPoint,
          Lead_Time_Days: leadTimeDays,
          Days_Of_Supply: daysOfSupply,
          Unit_Cost: unitCost,
          Holding_Cost_Month: holdingCostMonth,
          Supplier_Reliability: supplier,
        });
      }
      return rows;
    },
  },
  {
    name: 'Overstock Markdown & Clearance Audit',
    filename: 'warehouse_clearance_markdown_log.csv',
    description: '1,000 retail and consumer SKUs with aging stock, dormant days, inventory valuation, and markdown urgency.',
    domain: 'Inventory',
    generateRows: () => {
      const categories = ['Seasonal Apparel', 'Consumer Audio', 'Kitchen Appliances', 'Outdoor & Patio', 'Fitness Gear'];
      const rows: Record<string, any>[] = [];
      const count = 1000;

      for (let i = 1; i <= count; i++) {
        const cat = categories[i % categories.length];
        const isDormant = i % 4 === 0;
        const stock = isDormant ? 250 + (i % 300) : 40 + (i % 120);
        const velocity = isDormant ? 2 + (i % 6) : 25 + (i % 80);
        const daysDormant = isDormant ? 120 + (i % 180) : 10 + (i % 45);
        const unitCost = Number((18 + (i % 95)).toFixed(2));
        const retailPrice = Number((unitCost * (1.6 + (i % 3) * 0.3)).toFixed(2));
        const dos = Math.round(stock / Math.max(0.1, velocity / 30));

        rows.push({
          SKU: `SKU-CLR-${cat.substring(0, 3).toUpperCase()}-${8000 + i}`,
          Item_Name: `${cat} Series #${i}`,
          Category: cat,
          Stock_Units: stock,
          Monthly_Sales: velocity,
          Days_Dormant: daysDormant,
          Days_Of_Supply: dos,
          Unit_Cost: unitCost,
          Retail_Price: retailPrice,
          Tied_Capital: Number((stock * unitCost).toFixed(2)),
        });
      }
      return rows;
    },
  },
  {
    name: 'B2B Sales Pipeline & Lead Velocity',
    filename: 'enterprise_sales_q3_2026.csv',
    description: '1,500 enterprise pipeline opportunities with deal size, stage, probability, and rep quotas.',
    domain: 'Sales',
    generateRows: () => {
      const stages = ['Discovery', 'Qualification', 'Demo Delivered', 'Proposal Review', 'Contract Negotiation', 'Closed Won', 'Closed Lost'];
      const regions = ['North America', 'EMEA', 'APAC', 'LATAM'];
      const reps = ['Alex Morgan', 'Marcus Vance', 'Sarah Chen', 'David Patel', 'Elena Rostova'];

      const rows: Record<string, any>[] = [];
      const count = 1500;

      for (let i = 1; i <= count; i++) {
        const stage = stages[i % stages.length];
        const region = regions[i % regions.length];
        const rep = reps[i % reps.length];
        const dealSize = 15000 + Math.floor(Math.random() * 185000);
        const winProb = Number((0.1 + Math.random() * 0.85).toFixed(2));
        const daysInPipeline = Math.floor(10 + Math.random() * 120);
        const interactions = Math.floor(2 + Math.random() * 25);
        const leadScore = Math.floor(30 + Math.random() * 70);

        rows.push({
          Deal_ID: `DEAL-${20000 + i}`,
          Company: `Client Corp ${i}`,
          Sales_Rep: rep,
          Region: region,
          Stage: stage,
          Deal_Size: dealSize,
          Win_Probability: winProb,
          Days_In_Pipeline: daysInPipeline,
          Total_Interactions: interactions,
          Lead_Score: leadScore,
        });
      }
      return rows;
    },
  },
];
