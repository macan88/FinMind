// WHY: Issue #266 requires a connector abstraction for bank integrations.
// This file defines the core interface and a mock implementation so that:
// 1. Real bank connectors can be swapped in without changing calling code.
// 2. The mock validates the import + refresh flows end-to-end in tests/dev.

export interface BankTransaction {
  id: string;
  date: string;          // ISO 8601
  description: string;
  amount: number;        // positive = credit, negative = debit
  currency: string;      // ISO 4217
  category?: string;
}

export interface ImportResult {
  imported: BankTransaction[];
  errors: string[];
}

export interface RefreshResult {
  refreshed: BankTransaction[];
  errors: string[];
}

// WHY: A single interface ensures every connector (mock, Plaid, Open Banking, etc.)
// exposes identical surface area, allowing dependency injection at the call site.
export interface BankConnector {
  /** One-time full import of historical transactions. */
  importTransactions(accountId: string, from: Date, to: Date): Promise<ImportResult>;

  /** Incremental refresh — only fetch transactions newer than `since`. */
  refreshTransactions(accountId: string, since: Date): Promise<RefreshResult>;
}

// ---------------------------------------------------------------------------
// Mock connector — deterministic, no network, suitable for tests & local dev.
// WHY: Having a concrete mock in the same file lets consumers import it
// directly without a separate test-only package while keeping the abstraction.
// ---------------------------------------------------------------------------

const MOCK_TRANSACTIONS: BankTransaction[] = [
  {
    id: 'mock-txn-001',
    date: '2024-01-15',
    description: 'Grocery Store',
    amount: -42.5,
    currency: 'USD',
    category: 'Food',
  },
  {
    id: 'mock-txn-002',
    date: '2024-02-01',
    description: 'Salary',
    amount: 3000,
    currency: 'USD',
    category: 'Income',
  },
  {
    id: 'mock-txn-003',
    date: '2024-03-10',
    description: 'Electric Bill',
    amount: -110.0,
    currency: 'USD',
    category: 'Utilities',
  },
];

export class MockBankConnector implements BankConnector {
  // WHY: Inject a custom dataset so tests can control exactly what comes back.
  constructor(private readonly data: BankTransaction[] = MOCK_TRANSACTIONS) {}

  async importTransactions(
    _accountId: string,
    from: Date,
    to: Date
  ): Promise<ImportResult> {
    // WHY: Filter by date range to mirror real connector behaviour.
    const imported = this.data.filter((txn) => {
      const d = new Date(txn.date);
      return d >= from && d <= to;
    });
    return { imported, errors: [] };
  }

  async refreshTransactions(
    _accountId: string,
    since: Date
  ): Promise<RefreshResult> {
    // WHY: Refresh only returns rows newer than `since`, matching incremental-sync semantics.
    const refreshed = this.data.filter((txn) => new Date(txn.date) > since);
    return { refreshed, errors: [] };
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// WHY: Centralising connector creation means callers never import concrete
// classes directly — they ask for a connector by name, making future real
// connectors a one-line addition here.
// ---------------------------------------------------------------------------
export type ConnectorName = 'mock'; // extend union as real connectors are added

export function createConnector(name: ConnectorName): BankConnector {
  switch (name) {
    case 'mock':
      return new MockBankConnector();
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown connector: ${exhaustive}`);
    }
  }
}
