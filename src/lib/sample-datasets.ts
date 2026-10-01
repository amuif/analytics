export interface SampleDatasetInfo {
  name: string;
  filename: string;
  description: string;
  domain: string;
  generateRows: () => Record<string, any>[];
}

export const SAMPLE_DATASETS: SampleDatasetInfo[] = [
  {
    name: 'HR Talent & Performance Audit',
    filename: 'corporate_hr_talent_2026.csv',
    description: '1,200 employee records with ratings, tenure, absences, compensation, and review notes.',
    domain: 'HR',
    generateRows: () => {
      const departments = ['Engineering', 'Product', 'Sales', 'Customer Success', 'Marketing', 'Finance', 'Operations'];
      const roles = ['Junior Associate', 'Mid-Level Specialist', 'Senior Lead', 'Staff Architect', 'Principal Manager'];
      const reviews = [
        'Exceeded all quarterly OKRs, highly collaborative, mentor to peers.',
        'Consistent delivery, reliable executor, standard velocity.',
        'High skill but showing signs of exhaustion and missed sprint deadlines.',
        'Frequent unexcused absences, struggles with cross-functional alignment.',
        'Top sales performer, closed largest enterprise account in Q3.',
        'Disengaged during team standups, low output relative to peer benchmark.',
        'Strong initiative, primed for leadership and promotion.',
        'Needs direct oversight, performance dropped sharply in recent cycle.',
      ];

      const rows: Record<string, any>[] = [];
      const count = 1200;

      for (let i = 1; i <= count; i++) {
        const dept = departments[i % departments.length];
        const role = roles[(i * 3) % roles.length];
        const rating = Number((2.0 + Math.random() * 3.0).toFixed(2)); // 2.0 to 5.0
        const absences = Math.floor(Math.random() * 20);
        const monthlyHours = 140 + Math.floor(Math.random() * 70);
        const salary = 55000 + Math.floor(Math.random() * 95000);
        const tenureYears = Number((0.5 + Math.random() * 8).toFixed(1));
        const reviewNote = reviews[i % reviews.length];

        rows.push({
          Employee_ID: `EMP-${1000 + i}`,
          Full_Name: `Employee ${i}`,
          Department: dept,
          Role: role,
          Salary: salary,
          Performance_Rating: rating,
          Absence_Days: absences,
          Monthly_Hours: monthlyHours,
          Tenure_Years: tenureYears,
          Evaluation_Notes: reviewNote,
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
  {
    name: 'E-Commerce Stock & Restock Risk',
    filename: 'warehouse_inventory_log.csv',
    description: '800 product inventory records tracking units, velocity, lead time, and return rates.',
    domain: 'E-Commerce',
    generateRows: () => {
      const categories = ['Electronics', 'Home & Kitchen', 'Apparel', 'Industrial', 'Health & Beauty'];
      const rows: Record<string, any>[] = [];
      const count = 800;

      for (let i = 1; i <= count; i++) {
        const cat = categories[i % categories.length];
        const currentStock = Math.floor(Math.random() * 500);
        const velocity = Math.floor(5 + Math.random() * 120);
        const unitCost = Number((12.5 + Math.random() * 180).toFixed(2));
        const leadTimeDays = Math.floor(3 + Math.random() * 30);
        const returnRate = Number((0.01 + Math.random() * 0.22).toFixed(3));

        rows.push({
          SKU: `SKU-${cat.substring(0, 3).toUpperCase()}-${3000 + i}`,
          Product_Title: `${cat} Model ${i}`,
          Category: cat,
          Current_Stock: currentStock,
          Monthly_Velocity: velocity,
          Unit_Cost: unitCost,
          Lead_Time_Days: leadTimeDays,
          Return_Rate: returnRate,
        });
      }
      return rows;
    },
  },
];
