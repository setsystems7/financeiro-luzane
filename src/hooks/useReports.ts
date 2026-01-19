import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } from 'date-fns';

export interface SalesReportData {
  date: string;
  total: number;
  count: number;
  profit: number;
}

export interface ProductSalesData {
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
}

export interface PaymentMethodData {
  method: string;
  total: number;
  count: number;
}

export interface CategorySalesData {
  category_id: string;
  category_name: string;
  quantity: number;
  revenue: number;
}

export function useSalesReport(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['sales-report', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: sales, error } = await supabase
        .from('sales')
        .select(`
          id,
          total,
          final_total,
          net_amount,
          payment_method,
          card_fee_amount,
          created_at,
          sale_items(
            quantity,
            unit_price,
            total,
            product_id
          )
        `)
        .eq('status', 'concluida')
        .gte('created_at', startOfDay(startDate).toISOString())
        .lte('created_at', endOfDay(endDate).toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get cost prices for profit calculation
      const productIds = [...new Set(sales?.flatMap(s => s.sale_items?.map(i => i.product_id) || []).filter(Boolean))];
      
      const { data: products } = await supabase
        .from('products')
        .select('id, cost_price')
        .in('id', productIds);

      const costMap: Record<string, number> = {};
      products?.forEach(p => { costMap[p.id] = p.cost_price; });

      // Calculate totals
      let totalRevenue = 0;
      let totalProfit = 0;
      let totalFees = 0;
      let salesCount = 0;

      sales?.forEach(sale => {
        totalRevenue += Number(sale.final_total) || 0;
        totalFees += Number(sale.card_fee_amount) || 0;
        salesCount++;

        sale.sale_items?.forEach(item => {
          const cost = costMap[item.product_id] || 0;
          const itemProfit = (item.unit_price - cost) * item.quantity;
          totalProfit += itemProfit;
        });
      });

      // Group by day for chart
      const dailyData: Record<string, { total: number; count: number; profit: number }> = {};
      
      sales?.forEach(sale => {
        const day = sale.created_at.split('T')[0];
        if (!dailyData[day]) {
          dailyData[day] = { total: 0, count: 0, profit: 0 };
        }
        dailyData[day].total += Number(sale.final_total) || 0;
        dailyData[day].count += 1;

        sale.sale_items?.forEach(item => {
          const cost = costMap[item.product_id] || 0;
          dailyData[day].profit += (item.unit_price - cost) * item.quantity;
        });
      });

      const chartData = Object.entries(dailyData).map(([date, data]) => ({
        date,
        ...data,
      }));

      return {
        totalRevenue,
        totalProfit: totalProfit - totalFees,
        totalFees,
        salesCount,
        averageTicket: salesCount > 0 ? totalRevenue / salesCount : 0,
        chartData,
        sales: sales || [],
      };
    },
  });
}

export function useTopProducts(startDate: Date, endDate: Date, limit: number = 10) {
  return useQuery({
    queryKey: ['top-products-report', startDate.toISOString(), endDate.toISOString(), limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          product_name,
          quantity,
          total,
          sales!inner(created_at, status)
        `)
        .eq('sales.status', 'concluida')
        .gte('sales.created_at', startOfDay(startDate).toISOString())
        .lte('sales.created_at', endOfDay(endDate).toISOString());

      if (error) throw error;

      // Group by product
      const productMap: Record<string, { product_name: string; quantity: number; revenue: number }> = {};

      data?.forEach(item => {
        if (!productMap[item.product_id]) {
          productMap[item.product_id] = {
            product_name: item.product_name,
            quantity: 0,
            revenue: 0,
          };
        }
        productMap[item.product_id].quantity += item.quantity;
        productMap[item.product_id].revenue += Number(item.total);
      });

      return Object.entries(productMap)
        .map(([product_id, data]) => ({ product_id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    },
  });
}

export function usePaymentMethodsReport(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['payment-methods-report', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('payment_method, final_total')
        .eq('status', 'concluida')
        .gte('created_at', startOfDay(startDate).toISOString())
        .lte('created_at', endOfDay(endDate).toISOString());

      if (error) throw error;

      const methodMap: Record<string, { total: number; count: number }> = {};

      data?.forEach(sale => {
        const method = sale.payment_method;
        if (!methodMap[method]) {
          methodMap[method] = { total: 0, count: 0 };
        }
        methodMap[method].total += Number(sale.final_total);
        methodMap[method].count += 1;
      });

      return Object.entries(methodMap).map(([method, data]) => ({
        method,
        ...data,
      }));
    },
  });
}

export function useCategorySalesReport(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['category-sales-report', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: saleItems, error } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          quantity,
          total,
          sales!inner(created_at, status)
        `)
        .eq('sales.status', 'concluida')
        .gte('sales.created_at', startOfDay(startDate).toISOString())
        .lte('sales.created_at', endOfDay(endDate).toISOString());

      if (error) throw error;

      // Get products with categories
      const productIds = [...new Set(saleItems?.map(i => i.product_id).filter(Boolean))];
      
      const { data: products } = await supabase
        .from('products')
        .select('id, category_id, categories(id, name)')
        .in('id', productIds);

      const productCategoryMap: Record<string, { id: string; name: string }> = {};
      products?.forEach(p => {
        if (p.categories) {
          productCategoryMap[p.id] = {
            id: (p.categories as any).id,
            name: (p.categories as any).name,
          };
        }
      });

      // Group by category
      const categoryMap: Record<string, { category_name: string; quantity: number; revenue: number }> = {};

      saleItems?.forEach(item => {
        const category = productCategoryMap[item.product_id];
        if (category) {
          if (!categoryMap[category.id]) {
            categoryMap[category.id] = {
              category_name: category.name,
              quantity: 0,
              revenue: 0,
            };
          }
          categoryMap[category.id].quantity += item.quantity;
          categoryMap[category.id].revenue += Number(item.total);
        }
      });

      return Object.entries(categoryMap)
        .map(([category_id, data]) => ({ category_id, ...data }))
        .sort((a, b) => b.revenue - a.revenue);
    },
  });
}
