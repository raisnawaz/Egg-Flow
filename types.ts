
export enum AccountType {
  CUSTOMER = 'Customer',
  VENDOR = 'Vendor',
  EMPLOYEE = 'Employee',
  UTILITY = 'Utility',
  OWNER = 'Owner'
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  category?: 'Income' | 'Expense' | 'General'; // New Category Field
  phone: string;
  address: string;
  salary?: number; // Monthly salary for employees
  joiningDate?: string; // For employees
  archived?: boolean; // Soft delete status
}

export enum TransactionType {
  SALE = 'Sale',
  PAYMENT = 'Payment', // We pay them
  RECEIPT = 'Receipt', // They pay us
  EXPENSE = 'Expense',
  PURCHASE = 'Purchase',
  DEPOSIT = 'Deposit', // Owner puts money in
  WITHDRAWAL = 'Withdrawal' // Owner takes money out
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO String
  type: TransactionType;
  accountId: string; // "CASH" if null/general, or specific account ID
  amount: number;
  items?: InvoiceItem[]; // For Sales/Purchases
  notes?: string;
}

export interface EggCollection {
  id: string;
  date: string;
  collected: number;
  wasted: number;
  notes?: string;
}

export interface FeedTransaction {
  id: string;
  date: string;
  type: 'Purchase' | 'Consume' | 'Waste';
  quantity: number; // in kg or bags
  cost?: number; // Only for purchase
  vendorId?: string; // For purchase
  notes?: string;
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  eggCollections: EggCollection[];
  feedTransactions: FeedTransaction[];
  settings: {
    currency: string;
    farmName: string;
    theme: 'stained-glass' | 'minimal';
  };
}

export interface DateRange {
  startDate: string;
  endDate: string;
}