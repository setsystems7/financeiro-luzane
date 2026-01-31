import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Ordem fixa dos tamanhos - exportado para uso em outros componentes
export const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4'];

// Função para ordenar tamanhos conforme a ordem padrão
export function sortSizesByOrder<T extends { size: string }>(sizes: T[]): T[] {
  return [...sizes].sort((a, b) => {
    const indexA = SIZE_ORDER.indexOf(a.size);
    const indexB = SIZE_ORDER.indexOf(b.size);
    // Se não encontrar na lista, coloca no final
    const orderA = indexA === -1 ? SIZE_ORDER.length : indexA;
    const orderB = indexB === -1 ? SIZE_ORDER.length : indexB;
    return orderA - orderB;
  });
}

export interface ProductSize {
  id: string;
  size: string;
  quantity: number;
  barcode: string | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name?: string;
  color_id: string | null;
  color_name?: string;
  supplier_id: string | null;
  supplier_name?: string;
  cost_price: number;
  sale_price: number;
  markup: number | null;
  min_stock: number;
  photo_url: string | null;
  is_active: boolean | null;
  created_at: string;
  sizes: ProductSize[];
}

export interface ProductFormData {
  name: string;
  description?: string;
  category_id?: string;
  color_id?: string;
  supplier_id?: string;
  cost_price: number;
  sale_price: number;
  min_stock: number;
  sizes: { size: string; quantity: number; barcode?: string }[];
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name),
          colors(name),
          suppliers(name),
          product_sizes(id, size, quantity, barcode)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return products.map((product: any) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        category_id: product.category_id,
        category_name: product.categories?.name || '',
        color_id: product.color_id,
        color_name: product.colors?.name || '',
        supplier_id: product.supplier_id,
        supplier_name: product.suppliers?.name || '',
        cost_price: Number(product.cost_price),
        sale_price: Number(product.sale_price),
        markup: product.markup ? Number(product.markup) : null,
        min_stock: product.min_stock,
        photo_url: product.photo_url,
        is_active: product.is_active,
        created_at: product.created_at,
        sizes: sortSizesByOrder(product.product_sizes || []),
      })) as Product[];
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Categoria atualizada com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating category:', error);
      toast.error('Erro ao atualizar categoria');
    },
  });
}

export function useColors() {
  return useQuery({
    queryKey: ['colors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('colors')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

// Função para deduplicar tamanhos (junta quantidades se mesmo tamanho aparecer mais de uma vez)
function deduplicateSizes(sizes: { size: string; quantity: number; barcode?: string }[]) {
  const sizeMap = new Map<string, { size: string; quantity: number; barcode?: string }>();
  
  for (const s of sizes) {
    const existing = sizeMap.get(s.size);
    if (existing) {
      // Se já existe, soma as quantidades e mantém o primeiro barcode não-vazio
      existing.quantity += s.quantity;
      if (!existing.barcode && s.barcode) {
        existing.barcode = s.barcode;
      }
    } else {
      sizeMap.set(s.size, { ...s });
    }
  }
  
  return Array.from(sizeMap.values());
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProductFormData) => {
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          name: data.name,
          description: data.description || null,
          category_id: data.category_id || null,
          color_id: data.color_id || null,
          supplier_id: data.supplier_id || null,
          cost_price: data.cost_price,
          sale_price: data.sale_price,
          min_stock: data.min_stock,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Deduplica tamanhos antes de inserir
      const uniqueSizes = deduplicateSizes(data.sizes);
      
      if (uniqueSizes.length > 0) {
        const sizesData = uniqueSizes.map(s => ({
          product_id: product.id,
          size: s.size,
          quantity: s.quantity,
          barcode: s.barcode || null,
        }));

        const { error: sizesError } = await supabase
          .from('product_sizes')
          .insert(sizesData);

        if (sizesError) throw sizesError;
      }

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto cadastrado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating product:', error);
      toast.error('Erro ao cadastrar produto');
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductFormData }) => {
      const { error: productError } = await supabase
        .from('products')
        .update({
          name: data.name,
          description: data.description || null,
          category_id: data.category_id || null,
          color_id: data.color_id || null,
          supplier_id: data.supplier_id || null,
          cost_price: data.cost_price,
          sale_price: data.sale_price,
          min_stock: data.min_stock,
        })
        .eq('id', id);

      if (productError) throw productError;

      // Deduplica tamanhos antes de processar
      const uniqueSizes = deduplicateSizes(data.sizes);

      // Get existing sizes for this product
      const { data: existingSizes } = await supabase
        .from('product_sizes')
        .select('id, size')
        .eq('product_id', id);

      const existingSizeMap = new Map(existingSizes?.map(s => [s.size, s.id]) || []);
      const newSizeNames = new Set(uniqueSizes.map(s => s.size));

      // Delete sizes that are no longer in the list
      const sizesToDelete = existingSizes?.filter(s => !newSizeNames.has(s.size)).map(s => s.id) || [];
      if (sizesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('product_sizes')
          .delete()
          .in('id', sizesToDelete);
        if (deleteError) throw deleteError;
      }

      // Upsert remaining sizes (update existing, insert new)
      for (const s of uniqueSizes) {
        const existingId = existingSizeMap.get(s.size);
        
        if (existingId) {
          // Update existing size
          const { error: updateError } = await supabase
            .from('product_sizes')
            .update({
              quantity: s.quantity,
              barcode: s.barcode || null,
            })
            .eq('id', existingId);
          if (updateError) throw updateError;
        } else {
          // Insert new size
          const { error: insertError } = await supabase
            .from('product_sizes')
            .insert({
              product_id: id,
              size: s.size,
              quantity: s.quantity,
              barcode: s.barcode || null,
            });
          if (insertError) throw insertError;
        }
      }

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto atualizado');
    },
    onError: (error: any) => {
      console.error('Error updating product:', error);
      toast.error('Não foi possível atualizar o produto. Tente novamente.');
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto removido');
    },
    onError: (error: any) => {
      console.error('Error deleting product:', error);
      toast.error('Não foi possível remover o produto. Tente novamente.');
    },
  });
}
