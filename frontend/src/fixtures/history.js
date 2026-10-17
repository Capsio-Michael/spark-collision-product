import { pricingData } from './pricing-data.js';
import { getDemoOverview } from './demo.js';
import { getDemoInsightDetail, getDemoDetailRecord } from './insight-details.js';

// Version 3 adds meeting coverage, not a new collision or action approval.
export const demoHistorySource = {
  projectId: 'prj_demo',
  async loadVersions() { return structuredClone({ items: pricingData.versions }); },
  async loadOverview(version) { return getDemoOverview(version); },
  async loadDetail(id, version) { return getDemoInsightDetail(id, version); },
  async loadRecord(id) { return getDemoDetailRecord(id); },
};
