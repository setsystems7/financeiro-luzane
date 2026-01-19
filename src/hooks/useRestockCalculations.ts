import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RestockProduct {
  productId: string;
  productName: string;
  categoryName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  currentStock: number;
  minStock: number;
  dailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  economicOrderQty: number;
  daysUntilStockout: number | null;
  daysOfCoverage: number;
  suggestedQuantity: number;
  estimatedCost: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  abcClass: 'A' | 'B' | 'C';
  xyzClass: 'X' | 'Y' | 'Z';
  costPrice: number;
  salePrice: number;
  stockValue: number;
}

export interface RestockSummary {
  criticalProducts: number;
  totalSuggestedCost: number;
  averageCoverage: number;
  predictedStockouts7Days: number;
  predictedStockouts30Days: number;
  excessStockValue: number;
  totalStockValue: number;
}

export function useRestockCalculations() {
  return useQuery({
    queryKey: ['restock-calculations'],
    queryFn: async () => {
      // Get products with supplier info
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          cost_price,
          sale_price,
          min_stock,
          supplier_id,
          suppliers (name, default_lead_time_days, order_cost),
          category_id,
          categories (name),
          product_sizes (quantity)
        `)
        .eq('is_active', true);

      if (productsError) throw productsError;

      // Get restock settings
      const { data: restockSettings } = await supabase
        .from('restock_settings')
        .select('*');

      const settingsMap = new Map(restockSettings?.map(s => [s.product_id, s]) || []);

      // Get sales data for the last 30 days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('product_id, quantity')
        .gte('created_at', startDate.toISOString());

      // Calculate demand per product
      const demandMap = new Map<string, number>();
      saleItems?.forEach(item => {
        if (!item.product_id) return;
        demandMap.set(item.product_id, (demandMap.get(item.product_id) || 0) + item.quantity);
      });

      const restockProducts: RestockProduct[] = [];
      const holdingCostRate = 0.25; // 25% annual holding cost

      products?.forEach(product => {
        const currentStock = product.product_sizes?.reduce((sum, ps) => sum + (ps.quantity || 0), 0) || 0;
        const settings = settingsMap.get(product.id);
        const supplier = product.suppliers as any;

        // Lead time from settings, supplier, or default
        const leadTimeDays = settings?.lead_time_days || supplier?.default_lead_time_days || 7;

        // Calculate daily demand
        const totalDemand = demandMap.get(product.id) || 0;
        const dailyDemand = totalDemand / 30;

        // Safety stock calculation: Z * σ * √L
        // Using Z = 1.65 for 95% service level
        const safetyMultiplier = settings?.safety_stock_multiplier || 1.65;
        const demandStdDev = dailyDemand * 0.3; // Simplified - using 30% of demand as std dev
        const safetyStock = Math.ceil(safetyMultiplier * demandStdDev * Math.sqrt(leadTimeDays));

        // Reorder point: (Daily demand × Lead time) + Safety stock
        const reorderPoint = Math.ceil((dailyDemand * leadTimeDays) + safetyStock);

        // EOQ calculation: √(2DS/H)
        // D = annual demand, S = order cost, H = holding cost per unit
        const annualDemand = dailyDemand * 365;
        const orderCost = supplier?.order_cost || 50;
        const holdingCost = Number(product.cost_price) * holdingCostRate;
        const eoq = holdingCost > 0
          ? Math.ceil(Math.sqrt((2 * annualDemand * orderCost) / holdingCost))
          : Math.ceil(dailyDemand * 30); // Default to 1 month supply

        // Days until stockout
        const daysUntilStockout = dailyDemand > 0 ? Math.round(currentStock / dailyDemand) : null;

        // Days of coverage
        const daysOfCoverage = dailyDemand > 0 ? currentStock / dailyDemand : 999;

        // Suggested quantity
        let suggestedQuantity = 0;
        if (currentStock <= reorderPoint) {
          suggestedQuantity = Math.max(eoq, Math.ceil(dailyDemand * leadTimeDays) + safetyStock - currentStock);
        }

        // Determine urgency
        let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (daysUntilStockout !== null) {
          if (daysUntilStockout <= 3) urgency = 'critical';
          else if (daysUntilStockout <= 7) urgency = 'high';
          else if (daysUntilStockout <= 14) urgency = 'medium';
        }
        if (currentStock === 0) urgency = 'critical';

        const stockValue = currentStock * Number(product.cost_price);

        restockProducts.push({
          productId: product.id,
          productName: product.name,
          categoryName: (product.categories as any)?.name || null,
          supplierId: product.supplier_id,
          supplierName: supplier?.name || null,
          currentStock,
          minStock: product.min_stock,
          dailyDemand,
          leadTimeDays,
          safetyStock,
          reorderPoint,
          economicOrderQty: eoq,
          daysUntilStockout,
          daysOfCoverage,
          suggestedQuantity,
          estimatedCost: suggestedQuantity * Number(product.cost_price),
          urgency,
          abcClass: (settings?.abc_class as 'A' | 'B' | 'C') || 'C',
          xyzClass: (settings?.xyz_class as 'X' | 'Y' | 'Z') || 'Z',
          costPrice: Number(product.cost_price),
          salePrice: Number(product.sale_price),
          stockValue,
        });
      });

      // Sort by urgency then by days until stockout
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      restockProducts.sort((a, b) => {
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999);
      });

      // Calculate summary
      const summary: RestockSummary = {
        criticalProducts: restockProducts.filter(p => p.urgency === 'critical').length,
        totalSuggestedCost: restockProducts.reduce((sum, p) => sum + p.estimatedCost, 0),
        averageCoverage: restockProducts.length > 0
          ? restockProducts.reduce((sum, p) => sum + p.daysOfCoverage, 0) / restockProducts.length
          : 0,
        predictedStockouts7Days: restockProducts.filter(p =>
          p.daysUntilStockout !== null && p.daysUntilStockout <= 7
        ).length,
        predictedStockouts30Days: restockProducts.filter(p =>
          p.daysUntilStockout !== null && p.daysUntilStockout <= 30
        ).length,
        excessStockValue: restockProducts
          .filter(p => p.daysOfCoverage > 90)
          .reduce((sum, p) => sum + p.stockValue, 0),
        totalStockValue: restockProducts.reduce((sum, p) => sum + p.stockValue, 0),
      };

      return { products: restockProducts, summary };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateRestockSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: {
      productId: string;
      leadTimeDays?: number;
      safetyStockMultiplier?: number;
      abcClass?: 'A' | 'B' | 'C';
      xyzClass?: 'X' | 'Y' | 'Z';
    }) => {
      const { data: existing } = await supabase
        .from('restock_settings')
        .select('id')
        .eq('product_id', settings.productId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('restock_settings')
          .update({
            lead_time_days: settings.leadTimeDays,
            safety_stock_multiplier: settings.safetyStockMultiplier,
            abc_class: settings.abcClass,
            xyz_class: settings.xyzClass,
            last_calculated_at: new Date().toISOString(),
          })
          .eq('product_id', settings.productId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('restock_settings')
          .insert({
            product_id: settings.productId,
            lead_time_days: settings.leadTimeDays || 7,
            safety_stock_multiplier: settings.safetyStockMultiplier || 1.65,
            abc_class: settings.abcClass || 'C',
            xyz_class: settings.xyzClass || 'Z',
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restock-calculations'] });
      toast.success('Configurações atualizadas');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar configurações');
      console.error(error);
    },
  });
}
