import { describe, expect, it } from 'vitest';
import {
  AddressPoolLimitExceededError,
  AddressPoolStateError,
  bindCloudDepositAddress,
  createAddressPoolSummary,
  importCloudAddressPoolDraft,
  normalizeCloudAddressPoolEntry,
  releaseCloudDepositAddress,
  type CloudAddressPoolEntry,
} from '../../src/index.js';

const tenant = { organizationId: 'org-address', tenantId: 'org-address' };

function entry(overrides: Partial<CloudAddressPoolEntry> = {}): CloudAddressPoolEntry {
  return normalizeCloudAddressPoolEntry({
    tenant,
    address: '0x1111111111111111111111111111111111111111',
    protocol: 'evm',
    state: 'idle',
    derivationIndex: 0,
    masterPublicKeyRef: 'secret://xpub/address-pool',
    ...overrides,
  });
}

describe('Cloud address pool/deposit contract', () => {
  it('normalizes address pool entries and requires secret refs for derivation material', () => {
    expect(entry()).toMatchObject({
      tenant,
      address: '0x1111111111111111111111111111111111111111',
      protocol: 'evm',
      state: 'idle',
      derivationIndex: 0,
      masterPublicKeyRef: 'secret://xpub/address-pool',
    });

    expect(() => entry({ address: '   ' })).toThrow('Address is required');
    expect(() => entry({ masterPublicKeyRef: 'xpub-raw-value' })).toThrow('masterPublicKeyRef must be a secret:// reference');
  });

  it('builds tenant-scoped import drafts and enforces address pool limits', () => {
    const imported = importCloudAddressPoolDraft({
      tenant,
      protocol: 'evm',
      addresses: [
        { address: '0x1111111111111111111111111111111111111111', derivationIndex: 0 },
        { address: '0x2222222222222222222222222222222222222222', derivationIndex: 1 },
      ],
      masterPublicKeyRef: 'secret://xpub/address-pool',
      existingCount: 1,
      limit: 3,
    });

    expect(imported).toHaveLength(2);
    expect(imported[0]).toMatchObject({ tenant, protocol: 'evm', state: 'idle' });

    expect(() => importCloudAddressPoolDraft({
      tenant,
      protocol: 'evm',
      addresses: [{ address: '0x3333333333333333333333333333333333333333' }],
      existingCount: 3,
      limit: 3,
    })).toThrow(AddressPoolLimitExceededError);
  });

  it('summarizes address pool availability by protocol for one tenant only', () => {
    const summary = createAddressPoolSummary([
      entry({ address: '0x1', protocol: 'evm', state: 'idle' }),
      entry({ address: '0x2', protocol: 'evm', state: 'bound' }),
      entry({ address: 'T1', protocol: 'tron', state: 'idle' }),
    ], tenant);

    expect(summary).toEqual({
      tenant,
      totalAddresses: 3,
      hasAddresses: true,
      protocols: [
        { protocol: 'evm', total: 2, available: 1, bound: 1, reserved: 0 },
        { protocol: 'tron', total: 1, available: 1, bound: 0, reserved: 0 },
      ],
    });

    expect(() => createAddressPoolSummary([
      entry(),
      entry({ tenant: { organizationId: 'org-other' } }),
    ], tenant)).toThrow('Address pool summary cannot include another tenant');
  });

  it('binds idle addresses to deposit references and rejects non-idle addresses', () => {
    const bound = bindCloudDepositAddress(entry(), {
      depositReference: 'dep-1',
      orderId: 'order-1',
    });

    expect(bound).toMatchObject({
      state: 'bound',
      depositReference: 'dep-1',
      orderId: 'order-1',
    });

    expect(() => bindCloudDepositAddress(bound, { depositReference: 'dep-2' })).toThrow(AddressPoolStateError);
    expect(() => bindCloudDepositAddress(entry(), { depositReference: ' ' })).toThrow('depositReference is required');
  });

  it('releases bound addresses back to idle state', () => {
    const bound = bindCloudDepositAddress(entry(), { depositReference: 'dep-1' });
    const released = releaseCloudDepositAddress(bound);

    expect(released).toMatchObject({ state: 'idle' });
    expect(released.depositReference).toBeUndefined();
    expect(released.orderId).toBeUndefined();

    expect(() => releaseCloudDepositAddress(entry())).toThrow('Only bound or reserved addresses can be released');
  });
});
