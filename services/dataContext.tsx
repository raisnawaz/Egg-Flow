import React, { createContext, useContext, useEffect, useState } from 'react';
import { Account, AppState, EggCollection, FeedTransaction, Transaction, TransactionType, AccountType } from '../types';

const INITIAL_STATE: AppState = {
  accounts: [],
  transactions: [],
  eggCollections: [],
  feedTransactions: [],
  settings: {
    currency: '$',
    farmName: 'My Egg Farm',
    theme: 'stained-glass',
  },
};

interface DataContextType extends AppState {
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  
  addEggCollection: (collection: Omit<EggCollection, 'id'>) => void;
  deleteEggCollection: (id: string) => void;
  
  addFeedTransaction: (transaction: Omit<FeedTransaction, 'id'>) => void;
  deleteFeedTransaction: (id: string) => void;

  importData: (data: string) => void;
  exportData: () => string;
  resetData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  useEffect(() => {
    const saved = localStorage.getItem('eggflow_data');
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load data", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('eggflow_data', JSON.stringify(state));
  }, [state]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addAccount = (account: Omit<Account, 'id'>) => {
    setState(prev => ({ ...prev, accounts: [...prev.accounts, { ...account, id: generateId() }] }));
  };

  const updateAccount = (account: Account) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === account.id ? account : a) }));
  };

  const deleteAccount = (id: string) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id) }));
  };

  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    setState(prev => ({ ...prev, transactions: [...prev.transactions, { ...transaction, id: generateId() }] }));
  };

  const deleteTransaction = (id: string) => {
    setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
  };

  const addEggCollection = (collection: Omit<EggCollection, 'id'>) => {
    setState(prev => ({ ...prev, eggCollections: [...prev.eggCollections, { ...collection, id: generateId() }] }));
  };

  const deleteEggCollection = (id: string) => {
    setState(prev => ({ ...prev, eggCollections: prev.eggCollections.filter(c => c.id !== id) }));
  };

  const addFeedTransaction = (transaction: Omit<FeedTransaction, 'id'>) => {
    setState(prev => ({ ...prev, feedTransactions: [...prev.feedTransactions, { ...transaction, id: generateId() }] }));
  };

  const deleteFeedTransaction = (id: string) => {
    setState(prev => ({ ...prev, feedTransactions: prev.feedTransactions.filter(t => t.id !== id) }));
  };

  const importData = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      setState(parsed);
    } catch (e) {
      alert("Invalid JSON data");
    }
  };

  const exportData = () => JSON.stringify(state, null, 2);

  const resetData = () => setState(INITIAL_STATE);

  return (
    <DataContext.Provider value={{
      ...state,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      deleteTransaction,
      addEggCollection,
      deleteEggCollection,
      addFeedTransaction,
      deleteFeedTransaction,
      importData,
      exportData,
      resetData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};