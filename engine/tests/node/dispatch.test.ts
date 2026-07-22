import { describe, expect, it } from 'vitest';
import {
  WorkflowInvocationNotConfiguredError,
  WorkflowAdmissionError,
} from '@flue/runtime';
import { __test } from '../../src/orchestrator/dispatch.ts';

const { isNoRuntimeError } = __test;

describe('isNoRuntimeError (dispatch failure classification)', () => {
  it('treats a WorkflowInvocationNotConfiguredError as the benign no-runtime case', () => {
    expect(isNoRuntimeError(new WorkflowInvocationNotConfiguredError())).toBe(true);
  });

  it('matches by name too (bundling can break instanceof across module copies)', () => {
    expect(isNoRuntimeError({ name: 'WorkflowInvocationNotConfiguredError' })).toBe(true);
  });

  it('does NOT swallow a real admission failure', () => {
    expect(
      isNoRuntimeError(new WorkflowAdmissionError({ workflow: 'interpret', cause: new Error('boom') })),
    ).toBe(false);
  });

  it('does NOT swallow an arbitrary runtime error', () => {
    expect(isNoRuntimeError(new Error('DO overloaded'))).toBe(false);
    expect(isNoRuntimeError(undefined)).toBe(false);
  });
});
