import { describe, expect, it } from 'vitest';
import {
  createDefaultRelationRegistry,
  RelationEndpointError,
  UnknownRelationKindError,
} from '../../src/domain/relations.ts';

describe('RelationKindRegistry', () => {
  const registry = createDefaultRelationRegistry();

  it('accepts a valid answers relation', () => {
    expect(() =>
      registry.validate({
        kind: 'answers',
        from: { kind: 'finding', id: 'f1' },
        to: { kind: 'research-question', id: 'q1' },
      }),
    ).not.toThrow();
  });

  it('rejects wrong endpoint kinds', () => {
    expect(() =>
      registry.validate({
        kind: 'answers',
        from: { kind: 'goal', id: 'g1' },
        to: { kind: 'research-question', id: 'q1' },
      }),
    ).toThrow(RelationEndpointError);
  });

  it('derived-from accepts any from-kind but only instruction to-kind', () => {
    expect(() =>
      registry.validate({
        kind: 'derived-from',
        from: { kind: 'goal', id: 'g1' },
        to: { kind: 'instruction', id: 'i1' },
      }),
    ).not.toThrow();
    expect(() =>
      registry.validate({
        kind: 'derived-from',
        from: { kind: 'goal', id: 'g1' },
        to: { kind: 'goal', id: 'g2' },
      }),
    ).toThrow(RelationEndpointError);
  });

  it('rejects unknown relation kinds', () => {
    expect(() =>
      registry.validate({
        kind: 'nope',
        from: { kind: 'goal', id: 'g1' },
        to: { kind: 'goal', id: 'g2' },
      }),
    ).toThrow(UnknownRelationKindError);
  });
});
