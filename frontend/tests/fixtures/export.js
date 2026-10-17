// Exercise the production serializer with independent, stable scenario inputs.
import { buildSyntheticReport as serialize } from '../../src/fixtures/export.js';
import { demoHistorySource } from './history.js';

export const buildSyntheticReport = (version, options = {}) => serialize(version, { source: demoHistorySource, ...options });
export const demoExportSource = { ...demoHistorySource, loadExport: version => buildSyntheticReport(version) };
