declare module '@actual-app/api' {
  export interface InitConfig {
    dataDir: string;
    serverURL: string;
    password: string;
    verbose?: boolean;
  }

  export interface ActualInternal {
    send: (name: string, args?: unknown) => Promise<unknown>;
  }

  export interface ActualBudget {
    id?: string;
    groupId?: string;
    name: string;
    hasKey?: boolean;
  }

  export interface ActualAccount {
    id: string;
    name: string;
    offbudget?: boolean;
    closed?: boolean;
  }

  export interface ActualCategoryGroup {
    id: string;
    name: string;
    is_income?: boolean;
    hidden?: boolean;
  }

  export interface ActualCategory {
    id: string;
    name: string;
    group_id: string;
    is_income?: boolean;
    hidden?: boolean;
  }

  export interface ActualPayee {
    id: string;
    name: string;
    transfer_acct?: string | null;
  }

  export interface ActualTransaction {
    id: string;
    date: string;
    amount: number;
    payee: string | null;
    category: string | null;
    account: string;
    notes: string | null;
    cleared: boolean;
    transfer_id: string | null;
    parent_id: string | null;
    is_parent: boolean;
    is_child: boolean;
  }

  export interface ActualBudgetMonthCategory {
    id: string;
    name: string;
    budgeted: number | null;
    spent: number | null;
    balance: number | null;
  }

  export interface ActualBudgetMonthGroup {
    id: string;
    name: string;
    is_income?: boolean;
    categories: ActualBudgetMonthCategory[];
  }

  export interface ActualBudgetMonth {
    month: string;
    toBudget: number;
    totalBudgeted: number;
    incomeAvailable: number;
    categoryGroups?: ActualBudgetMonthGroup[];
  }

  export interface QueryBuilder {
    select: (fields: Array<string | Record<string, unknown>>) => QueryBuilder;
    filter: (filter: Record<string, unknown>) => QueryBuilder;
    orderBy: (order: Record<string, 'asc' | 'desc'>) => QueryBuilder;
    limit: (limit: number) => QueryBuilder;
    groupBy: (field: string) => QueryBuilder;
  }

  export function init(config: InitConfig): Promise<ActualInternal>;
  export function getServerVersion(): Promise<{ version: string }>;
  export function getBudgets(): Promise<ActualBudget[]>;
  export function loadBudget(id: string): Promise<void>;
  export function downloadBudget(
    syncId: string,
    options?: { password?: string },
  ): Promise<void>;
  export function getAccounts(): Promise<ActualAccount[]>;
  export function getAccountBalance(id: string): Promise<number>;
  export function getCategoryGroups(): Promise<ActualCategoryGroup[]>;
  export function getCategories(): Promise<ActualCategory[]>;
  export function getPayees(): Promise<ActualPayee[]>;
  export function getBudgetMonths(): Promise<string[]>;
  export function getBudgetMonth(month: string): Promise<ActualBudgetMonth>;
  export function sync(): Promise<void>;
  export function q(table: string): QueryBuilder;
  export function aqlQuery<T = Record<string, unknown>>(
    query: QueryBuilder,
  ): Promise<{ data: T[] }>;
}
