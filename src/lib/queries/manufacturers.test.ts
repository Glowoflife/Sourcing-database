import { expect, test, describe } from 'vitest';
import { leadStatusEnum, sourcingStatusEnum } from '@/db/schema';

describe('Enum filter validation', () => {
  test('lead_status enum contains expected values', () => {
    expect(leadStatusEnum.enumValues).toEqual([
      'New',
      'Processing',
      'Crawled',
      'Extracted',
      'Errored',
    ]);
  });

  test('sourcing_status enum contains expected values', () => {
    expect(sourcingStatusEnum.enumValues).toEqual([
      'Unqualified',
      'Approved',
      'Rejected',
      'Flagged',
    ]);
  });

  test('arbitrary user filter strings are rejected against the enum set', () => {
    const allowed = new Set<string>(leadStatusEnum.enumValues);
    expect(allowed.has('New')).toBe(true);
    expect(allowed.has('DROP TABLE leads;--')).toBe(false);
    expect(allowed.has('approved')).toBe(false); // case sensitive
  });
});
