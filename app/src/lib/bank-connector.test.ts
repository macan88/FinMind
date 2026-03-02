// WHY: Focused unit tests prove the abstraction contract holds for both
// import and refresh flows, and that the factory wires up correctly.
// These tests run without a network and without mocking fetch.

import { describe, it, expect } from 'vitest';
import {
  MockBankConnector,
  createConnector,
  type BankTransaction,
} from './bank-connector';

const FIXTURES: BankTransaction[] = [
  { id: 'a', date: '2024-01-10', description: 'Old txn', amount: -10, currency: 'USD' },
  { id: 'b', date: '2024-06-15', description: 'Mid txn', amount: 500, currency: 'USD' },
  { id: 'c', date: '2024-11-20', description: 'New txn', amount: -75, currency: 'USD' },
];

describe('MockBankConnector', () => {
  it('importTransactions returns only transactions within the date range', async () => {
    const connector = new MockBankConnector(FIXTURES);
    const from = new Date('2024-01-01');
    const to = new Date('2024-06-30');

    const { imported, errors } = await connector.importTransactions('acct-1', from, to);

    // WHY: Only 'a' (Jan) and 'b' (Jun) fall within the range; 'c' (Nov) must be excluded.
    expect(errors).toHaveLength(0);
    expect(imported).toHaveLength(2);
    expect(imported.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('refreshTransactions returns only transactions strictly after `since`', async () => {
    const connector = new MockBankConnector(FIXTURES);
    const since = new Date('2024-06-15'); // same day as 'b' — should be excluded (strictly after)

    const { refreshed, errors } = await connector.refreshTransactions('acct-1', since);

    // WHY: Refresh semantics are "newer than", not "on or after", so 'b' must not appear.
    expect(errors).toHaveLength(0);
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0].id).toBe('c');
  });

  it('createConnector("mock") returns a working BankConnector via the factory', async () => {
    // WHY: Validates the factory pattern — callers should never need to import
    // MockBankConnector directly; the factory is the only public entry point.
    const connector = createConnector('mock');
    const from = new Date('2000-01-01');
    const to = new Date('2099-12-31');

    const { imported } = await connector.importTransactions('acct-x', from, to);

    // Default fixture data has 3 entries — all should come back for a wide range.
    expect(imported.length).toBeGreaterThan(0);
  });
});
