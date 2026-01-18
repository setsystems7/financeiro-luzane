export interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  color: string;
  supplier: string;
  costPrice: number;
  salePrice: number;
  markup: number;
  minStock: number;
  photo?: string;
  createdAt: Date;
  sizes: SizeVariant[];
}

export interface SizeVariant {
  size: string;
  quantity: number;
  barcode: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  date: Date;
  customerId?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  date: Date;
  notes?: string;
}

export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  dueDate: Date;
  paid: boolean;
  paidDate?: Date;
}

export interface DashboardStats {
  salesToday: number;
  salesMonth: number;
  profit: number;
  lowStockCount: number;
  topProducts: { name: string; quantity: number }[];
}
