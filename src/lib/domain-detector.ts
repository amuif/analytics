import type { BusinessDomain, DecisionPreset } from '../types';

export const BUILTIN_PRESETS: Record<BusinessDomain, DecisionPreset[]> = {
  hr: [
    {
      id: 'hr-performance-triage',
      name: 'Performance & Talent Triage',
      domain: 'hr',
      description: 'Classifies employee performance using rating, output metrics, and evaluation notes.',
      targetQuestion: 'How is this employee performing relative to their target goals and role expectations?',
      outputType: 'choice',
      choices: ['Top Performer', 'Solid Contributor', 'Performance Watch', 'Immediate PIP Needed'],
      criteria: 'performance, rating, evaluation, kpi, goals_met, score, output',
    },
    {
      id: 'hr-attrition-risk',
      name: 'Burnout & Flight Risk Audit',
      domain: 'hr',
      description: 'Evaluates probability of employee resignation, burnout, or voluntary turnover.',
      targetQuestion: 'Is this employee at risk of voluntary departure or burnout?',
      outputType: 'score',
      scoreScale: { min: 1, max: 5, lowLabel: 'Retained & Thriving', highLabel: 'Imminent Departure' },
      criteria: 'tenure, overtime, salary, promotion, satisfaction, absence, leaves, engagement',
    },
    {
      id: 'hr-promotion-readiness',
      name: 'Leadership & Promotion Readiness',
      domain: 'hr',
      description: 'Identifies high-potential employees ready for leadership succession or advancement.',
      targetQuestion: 'Is this employee ready for immediate promotion or leadership responsibility?',
      outputType: 'boolean',
      criteria: 'seniority, achievements, projects_led, peer_review, skill_level, impact',
    },
  ],
  sales: [
    {
      id: 'sales-lead-qualification',
      name: 'Lead Priority & Deal Velocity',
      domain: 'sales',
      description: 'Classifies sales opportunities and leads into high-conversion priorities.',
      targetQuestion: 'What is the priority and conversion potential of this deal or prospect?',
      outputType: 'choice',
      choices: ['Enterprise Priority', 'High Velocity', 'Nurture Needed', 'Low Probability'],
      criteria: 'deal_size, amount, budget, authority, stage, interactions, lead_score, industry',
    },
    {
      id: 'sales-churn-risk',
      name: 'Customer Account Churn Risk',
      domain: 'sales',
      description: 'Detects enterprise accounts displaying churn indicators or reduced contract renewal odds.',
      targetQuestion: 'What is the churn likelihood for this customer account upon contract renewal?',
      outputType: 'score',
      scoreScale: { min: 1, max: 5, lowLabel: 'Loyal & Expanding', highLabel: 'Severe Churn Risk' },
      criteria: 'arr, mrr, usage, tickets, renewal_date, contract_length, nps, last_contact',
    },
  ],
  ecommerce: [
    {
      id: 'ecom-inventory-action',
      name: 'Inventory Restock & Markdown Triage',
      domain: 'ecommerce',
      description: 'Prescribes action for product inventory balance, turnover rate, and stockout risk.',
      targetQuestion: 'What operational action is required for this product SKU inventory?',
      outputType: 'choice',
      choices: ['Urgent Restock', 'Healthy Velocity', 'Overstocked (Discount)', 'Dead Stock Liquidation'],
      criteria: 'stock, inventory, units_sold, velocity, lead_time, reorder_point, days_of_supply, cost',
    },
    {
      id: 'ecom-return-flag',
      name: 'Order Return & Disputed Flag',
      domain: 'ecommerce',
      description: 'Flags transactions with high return propensity, refund friction, or delivery risk.',
      targetQuestion: 'Does this order require shipping hold or return dispute inspection?',
      outputType: 'boolean',
      criteria: 'return_rate, discount_percent, shipping_method, order_value, return_history',
    },
  ],
  support: [
    {
      id: 'support-escalation',
      name: 'Support Ticket Severity & Escalation',
      domain: 'support',
      description: 'Identifies incoming tickets requiring immediate senior engineer or manager escalation.',
      targetQuestion: 'What triage routing and escalation priority does this customer ticket require?',
      outputType: 'choice',
      choices: ['Standard Resolution', 'Priority Follow-up', 'Executive / Tier-3 Escalation'],
      criteria: 'priority, severity, sla, customer_tier, sentiment, response_time, reopen_count',
    },
  ],
  general: [
    {
      id: 'general-anomaly-score',
      name: 'Operational Anomaly & Outlier Audit',
      domain: 'general',
      description: 'Identifies records with high statistical divergence or inconsistent metric signals.',
      targetQuestion: 'Does this record represent an operational risk or statistical anomaly?',
      outputType: 'choice',
      choices: ['Normal Profile', 'Moderate Variance', 'Critical Outlier Action Needed'],
      criteria: 'all numerical and categorical deviation indicators',
    },
    {
      id: 'general-health-score',
      name: 'Comprehensive Health & Status Index',
      domain: 'general',
      description: 'General 1-5 health grading based on normalized metrics and positive markers.',
      targetQuestion: 'Rate the overall operational health index for this entity (1-5).',
      outputType: 'score',
      scoreScale: { min: 1, max: 5, lowLabel: 'Severe Degradation', highLabel: 'Peak Performance' },
      criteria: 'composite multi-attribute normalization',
    },
  ],
};

const DOMAIN_KEYWORDS: Record<BusinessDomain, string[]> = {
  hr: [
    'employee', 'emp_', 'staff', 'salary', 'compensation', 'payroll', 'department',
    'hire_date', 'tenure', 'performance', 'rating', 'review', 'manager', 'leave',
    'absence', 'attrition', 'burnout', 'bonus', 'overtime', 'job_title', 'role',
    'satisfaction', 'turnover', 'headcount'
  ],
  sales: [
    'lead', 'deal', 'opportunity', 'pipeline', 'quota', 'arr', 'mrr', 'revenue',
    'stage', 'close_date', 'rep', 'salesperson', 'conversion', 'prospect', 'won',
    'lost', 'forecast', 'booking', 'contract', 'expansion'
  ],
  ecommerce: [
    'order', 'sku', 'product', 'inventory', 'stock', 'cart', 'checkout', 'quantity',
    'unit_price', 'shipping', 'return', 'refund', 'supplier', 'reorder', 'customer_id',
    'asin', 'barcode', 'variant', 'discount', 'cost_of_goods'
  ],
  support: [
    'ticket', 'incident', 'issue', 'severity', 'priority', 'resolution', 'agent',
    'csat', 'sla', 'first_response', 'queue', 'requester', 'satisfaction', 'complaint'
  ],
  general: ['id', 'date', 'name', 'value', 'type', 'status', 'score', 'total']
};

export function detectBusinessDomain(headers: string[]): { domain: BusinessDomain; confidence: number; matchedKeywords: string[] } {
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  
  const scores: Record<BusinessDomain, { count: number; matched: string[] }> = {
    hr: { count: 0, matched: [] },
    sales: { count: 0, matched: [] },
    ecommerce: { count: 0, matched: [] },
    support: { count: 0, matched: [] },
    general: { count: 0, matched: [] }
  };

  for (const header of normalizedHeaders) {
    for (const [domainKey, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const domain = domainKey as BusinessDomain;
      for (const kw of keywords) {
        if (header.includes(kw)) {
          scores[domain].count += 1;
          if (!scores[domain].matched.includes(header)) {
            scores[domain].matched.push(header);
          }
          break;
        }
      }
    }
  }

  // Find domain with max matches (excluding general unless no other matches)
  let bestDomain: BusinessDomain = 'general';
  let maxCount = 0;

  for (const domain of ['hr', 'sales', 'ecommerce', 'support'] as BusinessDomain[]) {
    if (scores[domain].count > maxCount) {
      maxCount = scores[domain].count;
      bestDomain = domain;
    }
  }

  if (maxCount === 0) {
    return {
      domain: 'general',
      confidence: 0.5,
      matchedKeywords: scores.general.matched
    };
  }

  // Calculate confidence between 0.65 and 0.98 based on match density
  const confidence = Math.min(0.98, Math.max(0.65, (maxCount / Math.max(headers.length, 3)) * 1.5));

  return {
    domain: bestDomain,
    confidence: Number(confidence.toFixed(2)),
    matchedKeywords: scores[bestDomain].matched
  };
}
