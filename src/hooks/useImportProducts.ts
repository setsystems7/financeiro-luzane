import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ProductRow {
  nome: string;
  preco_compra: number;
  preco_venda: number;
  fornecedor: string;
  pp: number;
  p: number;
  m: number;
  g: number;
  gg: number;
  g1: number;
  g2: number;
  g3: number;
  g4: number;
}

export function useImportProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (products: ProductRow[]) => {
      const results = [];

      // Get unique supplier names from products (filter empty strings)
      const supplierNames = [...new Set(
        products
          .map(p => p.fornecedor?.trim())
          .filter(name => name && name.length > 0)
      )];

      // Fetch existing suppliers
      const { data: existingSuppliers } = await supabase
        .from('suppliers')
        .select('id, name');

      const supplierMap: Record<string, string> = {};

      // Map existing suppliers
      existingSuppliers?.forEach(s => {
        supplierMap[s.name.toLowerCase()] = s.id;
      });

      // Create new suppliers (only if not already existing)
      for (const supplierName of supplierNames) {
        const normalizedName = supplierName.toLowerCase();
        if (!supplierMap[normalizedName]) {
          const { data: newSupplier, error } = await supabase
            .from('suppliers')
            .insert({ name: supplierName })
            .select()
            .single();

          if (!error && newSupplier) {
            supplierMap[normalizedName] = newSupplier.id;
          }
        }
      }

      for (const product of products) {
        // Get supplier_id from map
        const supplierId = product.fornecedor?.trim()
          ? supplierMap[product.fornecedor.trim().toLowerCase()]
          : null;

        // Create product
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            name: product.nome,
            cost_price: product.preco_compra || 0,
            sale_price: product.preco_venda || 0,
            min_stock: 0,
            supplier_id: supplierId,
          })
          .select()
          .single();

        if (productError) {
          console.error('Error creating product:', productError);
          continue;
        }

        // Tamanhos na ordem correta: PP, P, M, G, GG, G1, G2, G3, G4
        const sizesToInsert = [
          { size: 'PP', quantity: product.pp || 0 },
          { size: 'P', quantity: product.p || 0 },
          { size: 'M', quantity: product.m || 0 },
          { size: 'G', quantity: product.g || 0 },
          { size: 'GG', quantity: product.gg || 0 },
          { size: 'G1', quantity: product.g1 || 0 },
          { size: 'G2', quantity: product.g2 || 0 },
          { size: 'G3', quantity: product.g3 || 0 },
          { size: 'G4', quantity: product.g4 || 0 },
        ].filter(s => s.quantity > 0);

        if (sizesToInsert.length > 0) {
          const { error: sizesError } = await supabase
            .from('product_sizes')
            .insert(
              sizesToInsert.map(s => ({
                product_id: newProduct.id,
                size: s.size,
                quantity: s.quantity,
              }))
            );

          if (sizesError) {
            console.error('Error creating sizes:', sizesError);
          }
        }

        results.push(newProduct);
      }

      // Invalidate suppliers query to reflect new suppliers
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });

      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${data.length} produtos importados com sucesso!`);
    },
    onError: (error) => {
      console.error('Import error:', error);
      toast.error('Erro ao importar produtos');
    },
  });
}

export function generateTemplateExcel(): void {
  // Ordem atualizada de tamanhos: PP, P, M, G, GG, G1, G2, G3, G4
  const headers = ['Nome', 'Preço Compra', 'Preço Venda', 'Fornecedor', 'PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4'];
  const exampleRow1 = ['Legging Fitness Premium', 45.00, 89.90, 'Distribuidora Fashion', 2, 5, 8, 6, 3, 0, 0, 0, 0];
  const exampleRow2 = ['Top Esportivo Basic', 25.00, 49.90, 'Distribuidora Fashion', 3, 6, 10, 8, 4, 0, 0, 0, 0];
  const exampleRow3 = ['Conjunto Yoga', 80.00, 159.90, 'Fornecedor XYZ', 0, 0, 0, 0, 0, 5, 3, 2, 1];

  const wsData = [headers, exampleRow1, exampleRow2, exampleRow3];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 30 }, // Nome
    { wch: 15 }, // Preço Compra
    { wch: 15 }, // Preço Venda
    { wch: 25 }, // Fornecedor
    { wch: 6 },  // PP
    { wch: 6 },  // P
    { wch: 6 },  // M
    { wch: 6 },  // G
    { wch: 6 },  // GG
    { wch: 6 },  // XG
    { wch: 6 },  // XXG
    { wch: 8 },  // Único
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos');

  XLSX.writeFile(wb, 'modelo_produtos.xlsx');
}

export function parseExcel(file: File): Promise<ProductRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          resolve([]);
          return;
        }

        const headers = jsonData[0].map((h: any) =>
          String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        );

        const products: ProductRow[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[0]) continue;

          const getValue = (colName: string): any => {
            const idx = headers.findIndex(h => h.includes(colName));
            return idx >= 0 ? row[idx] : colName === 'fornecedor' ? '' : 0;
          };

          const product: ProductRow = {
            nome: String(getValue('nome') || ''),
            preco_compra: parseFloat(getValue('compra')) || 0,
            preco_venda: parseFloat(getValue('venda')) || 0,
            fornecedor: String(getValue('fornecedor') || ''),
            pp: parseInt(getValue('pp')) || 0,
            p: parseInt(headers.indexOf('p') >= 0 ? row[headers.indexOf('p')] : 0) || 0,
            m: parseInt(headers.indexOf('m') >= 0 ? row[headers.indexOf('m')] : 0) || 0,
            g: parseInt(headers.indexOf('g') >= 0 ? row[headers.indexOf('g')] : 0) || 0,
            gg: parseInt(getValue('gg')) || 0,
            g1: parseInt(getValue('g1')) || 0,
            g2: parseInt(getValue('g2')) || 0,
            g3: parseInt(getValue('g3')) || 0,
            g4: parseInt(getValue('g4')) || 0,
          };

          if (product.nome) {
            products.push(product);
          }
        }

        resolve(products);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}
