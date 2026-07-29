import { describe, expect, it } from 'vitest';
import { INTRA_IDS, catalogEntry } from '../../src/orchestrator/catalog.ts';

describe('goals intra workflows', () => {
  it('registers consolidate and prioritize in INTRA_IDS', () => {
    expect(INTRA_IDS).toContain('goals-consolidate');
    expect(INTRA_IDS).toContain('goals-prioritize');
  });

  it('consolidate context includes aspiration', () => {
    expect(catalogEntry('goals-consolidate')?.contextKinds).toContain('aspiration');
  });
});
