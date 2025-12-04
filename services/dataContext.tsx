
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Account, AppState, EggCollection, Transaction, TransactionType, AccountType } from '../types';

const INITIAL_STATE: AppState = {
  accounts: [],
  transactions: [],
  eggCollections: [],
  settings: {
    currency: 'PKR',
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
  
  importData: (data: string) => void;
  exportData: () => string;
  resetData: () => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  useEffect(() => {
    const saved = localStorage.getItem('eggflow_data');
    if (saved) {
      try {
        const parsedData = JSON.parse(saved);
        // Ensure legacy data doesn't break new state shape
        const { feedTransactions, ...cleanData } = parsedData; 
        
        // Merge with initial state to ensure new fields (like theme) exist
        setState(prev => ({
            ...INITIAL_STATE,
            ...cleanData,
            settings: { ...INITIAL_STATE.settings, ...cleanData.settings }
        }));
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

  const importData = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      const { feedTransactions, ...cleanData } = parsed;
      setState(cleanData);
    } catch (e) {
      alert("Invalid JSON data");
    }
  };

  const exportData = () => JSON.stringify(state, null, 2);

  const resetData = () => setState(INITIAL_STATE);

  const updateSettings = (newSettings: Partial<AppState['settings']>) => {
      setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }));
  };

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
      importData,
      exportData,
      resetData,
      updateSettings
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