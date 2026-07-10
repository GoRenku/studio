import { describe, expect, it } from 'vitest';
import { requireLiveProviderApproval } from './live-provider-approval.js';

describe('requireLiveProviderApproval', () => {
  it('does not require approval for simulated runs', () => {
    expect(
      requireLiveProviderApproval({
        mode: 'simulated',
        specId: 'media_generation_spec_test0001',
        purpose: 'image.create',
      })
    ).toBeUndefined();
  });

  it('accepts explicitly approved live runs', () => {
    expect(
      requireLiveProviderApproval({
        mode: 'live',
        approveLiveProviderRun: true,
        specId: 'media_generation_spec_test0001',
        purpose: 'image.create',
      })
    ).toBeUndefined();
  });

  it('fails before live provider execution without explicit approval', () => {
    let error: unknown;
    try {
      requireLiveProviderApproval({
        mode: 'live',
        specId: 'media_generation_spec_test0001',
        purpose: 'image.create',
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      code: 'CORE_MEDIA_LIVE_PROVIDER_APPROVAL_REQUIRED',
    });
  });
});
