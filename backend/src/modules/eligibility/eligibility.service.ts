import * as XLSX from 'xlsx';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middleware/error-handler';
import { config } from '../../config/env';
import { logger } from '../../config/logger';

// Simple rule DSL evaluator
// Rules: { "and": [ { "field": "hasProduct", "op": "eq", "value": "FD" }, ... ] }
function evaluateRule(rule: unknown, customerData: Record<string, unknown>): boolean {
  if (!rule || typeof rule !== 'object') return true;
  const r = rule as Record<string, unknown>;

  if (r['and']) {
    return (r['and'] as unknown[]).every((sub) => evaluateRule(sub, customerData));
  }
  if (r['or']) {
    return (r['or'] as unknown[]).some((sub) => evaluateRule(sub, customerData));
  }

  const { field, op, value } = r as { field: string; op: string; value: unknown };
  const actual = customerData[field];

  switch (op) {
    case 'eq': return actual === value;
    case 'neq': return actual !== value;
    case 'gt': return Number(actual) > Number(value);
    case 'gte': return Number(actual) >= Number(value);
    case 'lt': return Number(actual) < Number(value);
    case 'lte': return Number(actual) <= Number(value);
    case 'in': return Array.isArray(value) && value.includes(actual);
    default: return false;
  }
}

export class EligibilityService {
  // Check if a customer is eligible for a campaign
  async isEligible(campaignId: string, customerCif: string): Promise<boolean> {
    const config = await prisma.eligibilityConfig.findUnique({
      where: { campaignId },
    });
    if (!config) return true; // No config = open to all

    if (config.mode === 'CIF_UPLOAD' || config.mode === 'HYBRID') {
      const inList = await prisma.eligibleCustomer.findUnique({
        where: { campaignId_customerCif: { campaignId, customerCif } },
      });
      if (config.mode === 'CIF_UPLOAD') return !!inList;
      if (inList) return true; // HYBRID: if in list, eligible
    }

    if ((config.mode === 'API_RULE' || config.mode === 'HYBRID') && config.apiRules) {
      const customerData = await this.fetchCustomerData(customerCif);
      return evaluateRule(config.apiRules, customerData);
    }

    return false;
  }

  // Fetch from bank core API (stub — replace with real integration)
  private async fetchCustomerData(cif: string): Promise<Record<string, unknown>> {
    if (!config.bankCoreApi.url) {
      logger.warn('Bank core API not configured, returning empty customer data');
      return { cif };
    }
    try {
      const res = await fetch(`${config.bankCoreApi.url}/customers/${cif}`, {
        headers: { 'x-api-key': config.bankCoreApi.key ?? '' },
      });
      if (!res.ok) throw new Error(`Bank API error: ${res.status}`);
      return res.json();
    } catch (err) {
      logger.error('Failed to fetch customer data from bank core', { cif, err });
      return { cif };
    }
  }

  // Upload CIF list from Excel file
  async uploadCifList(
    campaignId: string,
    fileBuffer: Buffer,
    uploadedBy: string,
    tenantId: string
  ): Promise<{ processed: number; duplicates: number }> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<{ cif?: string; CIF?: string }>(sheet);

    const cifs = rows
      .map((r) => String(r.cif ?? r.CIF ?? '').trim())
      .filter((c) => c.length > 0);

    if (cifs.length === 0) throw new AppError(400, 'No CIF values found in Excel file', 'EMPTY_FILE');

    // Ensure eligibility config exists
    let eligConfig = await prisma.eligibilityConfig.findUnique({ where: { campaignId } });
    if (!eligConfig) {
      eligConfig = await prisma.eligibilityConfig.create({
        data: { campaignId, mode: 'CIF_UPLOAD' },
      });
    }

    const batchId = `batch_${Date.now()}_${uploadedBy}`;
    let processed = 0;
    let duplicates = 0;

    // Upsert in chunks of 500
    for (let i = 0; i < cifs.length; i += 500) {
      const chunk = cifs.slice(i, i + 500);
      const result = await prisma.eligibleCustomer.createMany({
        data: chunk.map((cif) => ({
          campaignId,
          eligibilityConfigId: eligConfig!.id,
          customerCif: cif,
          source: 'UPLOAD',
          uploadBatchId: batchId,
        })),
        skipDuplicates: true,
      });
      processed += result.count;
      duplicates += chunk.length - result.count;
    }

    logger.info('CIF upload complete', { campaignId, processed, duplicates, batchId });
    return { processed, duplicates };
  }

  // Configure API-based eligibility rules
  async setApiRules(campaignId: string, rules: unknown): Promise<void> {
    await prisma.eligibilityConfig.upsert({
      where: { campaignId },
      create: { campaignId, mode: 'API_RULE', apiRules: rules as never },
      update: { mode: 'API_RULE', apiRules: rules as never },
    });
  }
}

export const eligibilityService = new EligibilityService();
