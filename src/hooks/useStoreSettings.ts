import { useState } from 'react';

interface StoreSettings {
  storeName: string;
  cnpj: string;
  address: string;
  lowStockAlert: boolean;
  dailySummary: boolean;
  dueDateAlert: boolean;
}

const STORAGE_KEY = 'luzane_store_settings';

const defaultSettings: StoreSettings = {
  storeName: 'Luzane Moda Fitness',
  cnpj: '',
  address: '',
  lowStockAlert: true,
  dailySummary: false,
  dueDateAlert: true,
};

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return { settings, updateSettings };
}
