import { useState, useRef, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts, Product } from '@/hooks/useProducts';
import { Printer, Tag, Search, Plus, Minus, X, Package, Check, FileDown, Usb, AlertTriangle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Configurações para Elgin L42 Pro Full - 3 etiquetas por linha
const LABEL_WIDTH_MM = 33;
const LABEL_HEIGHT_MM = 22;
const LABELS_PER_ROW = 3;
const PAGE_WIDTH_MM = 108;
const DPI = 203;
const DOTS_PER_MM = DPI / 25.4;

interface LabelSelection {
  productId: string;
  sizeId: string;
  size: string;
  barcode: string;
  productName: string;
  quantity: number;
  stockQuantity: number;
}

// Componente para renderizar código de barras
function BarcodeDisplay({ value, width = 1.5, height = 30 }: { value: string; width?: number; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'EAN13',
          width,
          height,
          displayValue: true,
          fontSize: 8,
          margin: 0,
          background: 'transparent',
        });
      } catch {
        try {
          JsBarcode(svgRef.current, value, {
            format: 'CODE128',
            width,
            height,
            displayValue: true,
            fontSize: 8,
            margin: 0,
            background: 'transparent',
          });
        } catch {
          // Fallback silencioso
        }
      }
    }
  }, [value, width, height]);

  if (!value) {
    return (
      <div className="flex items-center justify-center h-full text-[8px] text-muted-foreground">
        Sem código
      </div>
    );
  }

  return <svg ref={svgRef} />;
}

// Preview de linha de 3 etiquetas (simulando impressão real)
function LabelRowPreview({ labels }: { labels: LabelSelection[] }) {
  return (
    <div className="flex gap-0.5 justify-center">
      {[0, 1, 2].map((idx) => {
        const label = labels[idx];
        return (
          <div
            key={idx}
            className="bg-white border border-gray-200 flex flex-col items-center justify-between overflow-hidden"
            style={{
              width: '90px',
              height: '60px',
              padding: '2px',
            }}
          >
            {label ? (
              <>
                <p className="text-[7px] font-bold text-black text-center truncate w-full leading-tight">
                  {label.productName}
                </p>
                <p className="text-[6px] text-gray-500">Tam: {label.size}</p>
                <div className="flex-1 flex items-center">
                  <BarcodeDisplay value={label.barcode} width={0.6} height={16} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[8px] text-gray-300">vazio</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Labels() {
  const { data: products = [], isLoading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [selections, setSelections] = useState<LabelSelection[]>([]);
  const [showPrintHelp, setShowPrintHelp] = useState(false);
  const [showPrintFallback, setShowPrintFallback] = useState(false);
  const [printError, setPrintError] = useState<string>('');

  // Filtrar produtos que têm pelo menos 1 unidade em qualquer tamanho e código de barras
  const productsWithStock = useMemo(() => {
    return products
      .map(product => ({
        ...product,
        // Mostrar tamanhos com quantidade >= 1 (pelo menos 1 unidade) e código de barras
        sizes: product.sizes.filter(s => s.quantity >= 1 && s.barcode),
      }))
      // Mostrar produto se tiver pelo menos um tamanho disponível
      .filter(product => product.sizes.length > 0);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return productsWithStock;
    const term = searchTerm.toLowerCase();
    return productsWithStock.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.category_name?.toLowerCase().includes(term) ||
      p.color_name?.toLowerCase().includes(term)
    );
  }, [productsWithStock, searchTerm]);

  const totalStock = useMemo(() => {
    return productsWithStock.reduce((acc, p) =>
      acc + p.sizes.reduce((sAcc, s) => sAcc + s.quantity, 0), 0
    );
  }, [productsWithStock]);

  const toggleSelection = (product: Product, sizeData: { id: string; size: string; barcode?: string | null; quantity: number }) => {
    const exists = selections.find(s => s.sizeId === sizeData.id);
    if (exists) {
      setSelections(selections.filter(s => s.sizeId !== sizeData.id));
    } else {
      const newSelection: LabelSelection = {
        productId: product.id,
        sizeId: sizeData.id,
        size: sizeData.size,
        barcode: sizeData.barcode || '',
        productName: product.name,
        quantity: 1,
        stockQuantity: sizeData.quantity,
      };
      setSelections([...selections, newSelection]);
    }
  };

  const selectAllSizes = (product: Product) => {
    const validSizes = product.sizes.filter(s => s.quantity > 0 && s.barcode);
    const allSelected = validSizes.every(s => selections.some(sel => sel.sizeId === s.id));

    if (allSelected) {
      // Deselecionar todos
      setSelections(selections.filter(s => s.productId !== product.id));
    } else {
      // Selecionar todos que ainda não estão selecionados
      const newSelections = [...selections];
      validSizes.forEach(sizeData => {
        if (!selections.find(s => s.sizeId === sizeData.id)) {
          newSelections.push({
            productId: product.id,
            sizeId: sizeData.id,
            size: sizeData.size,
            barcode: sizeData.barcode || '',
            productName: product.name,
            quantity: 1,
            stockQuantity: sizeData.quantity,
          });
        }
      });
      setSelections(newSelections);
    }
  };

  const updateQuantity = (sizeId: string, delta: number) => {
    setSelections(selections.map(s => {
      if (s.sizeId === sizeId) {
        const newQty = Math.max(1, Math.min(s.stockQuantity, s.quantity + delta));
        return { ...s, quantity: newQty };
      }
      return s;
    }));
  };

  const setQuantity = (sizeId: string, quantity: number) => {
    setSelections(selections.map(s => {
      if (s.sizeId === sizeId) {
        const newQty = Math.max(1, Math.min(s.stockQuantity, quantity));
        return { ...s, quantity: newQty };
      }
      return s;
    }));
  };

  const setQuantityToStock = (sizeId: string) => {
    setSelections(selections.map(s =>
      s.sizeId === sizeId ? { ...s, quantity: s.stockQuantity } : s
    ));
  };

  const removeSelection = (sizeId: string) => {
    setSelections(selections.filter(s => s.sizeId !== sizeId));
  };

  const clearAll = () => {
    setSelections([]);
  };

  const isSelected = (sizeId: string) => selections.some(s => s.sizeId === sizeId);

  const totalLabels = selections.reduce((acc, s) => acc + s.quantity, 0);

  // Expandir seleções para preview
  const expandedLabels = useMemo(() => {
    const labels: LabelSelection[] = [];
    selections.forEach(sel => {
      for (let i = 0; i < sel.quantity; i++) {
        labels.push(sel);
      }
    });
    return labels;
  }, [selections]);

  // Gerar PDF para impressora térmica Elgin L42 Pro Full
  const handleGeneratePDF = () => {
    if (selections.length === 0) {
      toast.error('Selecione pelo menos um produto!');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão. Verifique se pop-ups estão permitidos.');
      return;
    }

    // Calcular altura total baseada no número de linhas
    const totalRows = Math.ceil(expandedLabels.length / LABELS_PER_ROW);
    const totalHeightMM = totalRows * LABEL_HEIGHT_MM;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas - Elgin L42 Pro</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>
          /* Configuração para impressora térmica contínua */
          @page {
            size: ${PAGE_WIDTH_MM}mm ${totalHeightMM}mm;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          @media print {
            html, body {
              width: ${PAGE_WIDTH_MM}mm !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print { display: none !important; }
            .row { 
              page-break-inside: avoid !important; 
              break-inside: avoid !important;
            }
            .label { 
              border: none !important; 
              box-shadow: none !important;
            }
          }
          
          * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
          }
          
          html, body {
            font-family: Arial, Helvetica, sans-serif;
            width: ${PAGE_WIDTH_MM}mm;
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .labels-container { 
            width: ${PAGE_WIDTH_MM}mm; 
            margin: 0;
            padding: 0;
          }
          
          .row {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            width: ${PAGE_WIDTH_MM}mm;
            height: ${LABEL_HEIGHT_MM}mm;
            margin: 0;
            padding: 0;
          }
          
          .label {
            width: ${LABEL_WIDTH_MM}mm;
            height: ${LABEL_HEIGHT_MM}mm;
            min-width: ${LABEL_WIDTH_MM}mm;
            max-width: ${LABEL_WIDTH_MM}mm;
            min-height: ${LABEL_HEIGHT_MM}mm;
            max-height: ${LABEL_HEIGHT_MM}mm;
            border: 0.2px dashed #ddd;
            padding: 1mm 0.5mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            overflow: hidden;
            background: white;
          }
          
          .product-name {
            font-size: 7pt;
            font-weight: bold;
            text-align: center;
            line-height: 1.1;
            max-height: 4mm;
            overflow: hidden;
            width: 100%;
            white-space: nowrap;
            text-overflow: ellipsis;
            color: #000;
          }
          
          .size { 
            font-size: 6pt; 
            color: #333; 
            margin-top: 0.5mm;
          }
          
          .barcode-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            overflow: hidden;
            margin-top: 1mm;
          }
          
          .barcode-container svg {
            max-width: ${LABEL_WIDTH_MM - 2}mm !important;
            height: auto !important;
          }
          
          .instructions {
            padding: 10px;
            margin: 10px;
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 8px;
            font-size: 12px;
            color: #0369a1;
          }
          
          .instructions h3 {
            margin-bottom: 8px;
            font-weight: bold;
          }
          
          .instructions ol {
            margin-left: 20px;
          }
          
          .instructions li {
            margin-bottom: 4px;
          }
          
          .print-btn {
            display: block;
            margin: 15px auto;
            padding: 12px 24px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
          }
          
          .print-btn:hover {
            background: #059669;
          }
        </style>
      </head>
      <body>
        <div class="no-print instructions">
          <h3>📋 Instruções para Impressão na Elgin L42 Pro:</h3>
          <ol>
            <li>Clique no botão <strong>"Imprimir Etiquetas"</strong> abaixo</li>
            <li>Na janela de impressão, selecione <strong>"Elgin L42 Pro"</strong> como impressora</li>
            <li>Em "Mais configurações" → <strong>Tamanho do papel: 108mm x 22mm</strong> (ou personalizado)</li>
            <li>Margens: <strong>Nenhuma</strong></li>
            <li>Escala: <strong>100%</strong> (não usar "ajustar ao papel")</li>
          </ol>
        </div>
        <button class="no-print print-btn" onclick="window.print()">🖨️ Imprimir Etiquetas</button>
        
        <div class="labels-container" id="labels"></div>
        
        <script>
          const labels = ${JSON.stringify(expandedLabels.map(l => ({ productName: l.productName, size: l.size, barcode: l.barcode })))};
          const container = document.getElementById('labels');
          const labelsPerRow = ${LABELS_PER_ROW};

          for (let i = 0; i < labels.length; i += labelsPerRow) {
            const row = document.createElement('div');
            row.className = 'row';

            for (let j = 0; j < labelsPerRow; j++) {
              const labelData = labels[i + j];
              const labelDiv = document.createElement('div');
              labelDiv.className = 'label';

              if (labelData) {
                labelDiv.innerHTML = \`
                  <div class="product-name">\${labelData.productName}</div>
                  <div class="size">Tam: \${labelData.size}</div>
                  <div class="barcode-container">
                    <svg id="barcode-\${i + j}"></svg>
                  </div>
                \`;
              }
              row.appendChild(labelDiv);
            }
            container.appendChild(row);
          }

          labels.forEach((label, idx) => {
            const svg = document.getElementById('barcode-' + idx);
            if (label.barcode && svg) {
              try {
                JsBarcode(svg, label.barcode, { 
                  format: 'EAN13', 
                  width: 1.0, 
                  height: 18, 
                  displayValue: true, 
                  fontSize: 7, 
                  margin: 0, 
                  textMargin: 1,
                  background: 'transparent'
                });
              } catch(e) {
                try { 
                  JsBarcode(svg, label.barcode, { 
                    format: 'CODE128', 
                    width: 0.8, 
                    height: 18, 
                    displayValue: true, 
                    fontSize: 7, 
                    margin: 0, 
                    textMargin: 1,
                    background: 'transparent'
                  }); 
                } catch(e2) {
                  console.warn('Código de barras inválido:', label.barcode);
                }
              }
            }
          });
        <\/script>
      </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    toast.success(`Preparando ${totalLabels} etiquetas para impressão...`);
  };


  // Impressão Direta via USB (Web USB API) com tratamento melhorado
  const handleDirectPrintUSB = async () => {
    if (selections.length === 0) {
      toast.error('Selecione pelo menos um produto!');
      return;
    }

    // Verificar suporte a Web USB
    const nav = navigator as any;
    if (!nav.usb) {
      setPrintError('Seu navegador não suporta impressão USB direta. Use o Chrome ou Edge.');
      setShowPrintFallback(true);
      return;
    }

    try {
      toast.info('Conectando à impressora... Selecione-a na janela que abrir.');
      console.log('[Impressão USB] Iniciando conexão...');

      // Solicitar acesso ao dispositivo USB (impressora térmica)
      const device = await nav.usb.requestDevice({
        filters: [
          { vendorId: 0x0DD4 }, // Elgin
          { vendorId: 0x0A5F }, // Zebra
          { vendorId: 0x04B8 }, // Epson
          { vendorId: 0x0745 }, // Argox
          { classCode: 7 }, // Classe de impressora
        ]
      });

      console.log('[Impressão USB] Dispositivo selecionado:', device.productName);
      await device.open();
      console.log('[Impressão USB] Dispositivo aberto');

      // Selecionar configuração
      if (device.configuration === null) {
        await device.selectConfiguration(1);
        console.log('[Impressão USB] Configuração selecionada');
      }

      // Encontrar interface de impressora
      const printerInterface = device.configuration?.interfaces.find(
        (iface: any) => iface.alternate.interfaceClass === 7
      );

      if (!printerInterface) {
        throw new Error('Interface de impressora não encontrada. A impressora pode estar sendo usada por outro programa.');
      }

      console.log('[Impressão USB] Interface encontrada:', printerInterface.interfaceNumber);
      await device.claimInterface(printerInterface.interfaceNumber);
      console.log('[Impressão USB] Interface reivindicada');

      // Encontrar endpoint de saída
      const outEndpoint = printerInterface.alternate.endpoints.find(
        (ep: any) => ep.direction === 'out'
      );

      if (!outEndpoint) {
        throw new Error('Endpoint de saída não encontrado na impressora.');
      }

      // Gerar comandos ZPL inline
      const labelWidthDots = Math.round(LABEL_WIDTH_MM * DOTS_PER_MM);
      const labelHeightDots = Math.round(LABEL_HEIGHT_MM * DOTS_PER_MM);
      let zplCommands = '';
      expandedLabels.forEach((label) => {
        const productName = label.productName.length > 18 ? label.productName.substring(0, 18) + '...' : label.productName;
        const sizeText = `Tam: ${label.size}`;
        zplCommands += `^XA^PW${labelWidthDots}^LL${labelHeightDots}^FO5,5^A0N,20,20^FB${labelWidthDots - 10},1,0,C,0^FD${productName}^FS^FO5,28^A0N,16,16^FB${labelWidthDots - 10},1,0,C,0^FD${sizeText}^FS^FO15,48^BY1.2,2.0,40^BCN,40,Y,N,N^FD${label.barcode}^FS^XZ`;
      });
      const encoder = new TextEncoder();
      const data = encoder.encode(zplCommands);

      console.log('[Impressão USB] Enviando', data.byteLength, 'bytes para endpoint', outEndpoint.endpointNumber);
      await device.transferOut(outEndpoint.endpointNumber, data);

      // Liberar recursos
      await device.releaseInterface(printerInterface.interfaceNumber);
      await device.close();
      console.log('[Impressão USB] Impressão concluída com sucesso');

      toast.success(`${totalLabels} etiquetas enviadas para a impressora!`);
    } catch (error: any) {
      console.error('[Impressão USB] Erro detalhado:', error);
      console.error('[Impressão USB] Nome do erro:', error.name);
      console.error('[Impressão USB] Mensagem:', error.message);

      let errorMessage = '';
      let showFallback = true;

      if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhuma impressora foi selecionada. Clique em "Imprimir USB" novamente e selecione a impressora na janela que aparecer.';
        showFallback = false;
        toast.warning('Nenhuma impressora selecionada');
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Permissão negada para acessar a impressora USB.\n\nIsso pode acontecer porque:\n• A impressora está sendo usada por outro programa (feche o software da Elgin ou drivers)\n• O navegador bloqueou o acesso (verifique as permissões do site)\n• O sistema operacional restringiu o acesso USB';
      } else if (error.message?.includes('Interface')) {
        errorMessage = 'A interface da impressora não foi encontrada ou está ocupada.\n\nFeche outros programas que possam estar usando a impressora e tente novamente.';
      } else if (error.message?.includes('claimed')) {
        errorMessage = 'A impressora já está em uso por outro programa.\n\nFeche o software da Elgin, drivers ou outros aplicativos de impressão e tente novamente.';
      } else {
        errorMessage = `Erro ao conectar com a impressora: ${error.message || 'Falha na conexão USB'}`;
      }

      if (showFallback) {
        setPrintError(errorMessage);
        setShowPrintFallback(true);
      }
    }
  };

  // Impressão via janela do navegador (alternativa mais compatível)
  const handleBrowserPrint = () => {
    if (selections.length === 0) {
      toast.error('Selecione pelo menos um produto!');
      return;
    }
    handleGeneratePDF();
    setShowPrintFallback(false);
  };

  return (
    <MainLayout title="Etiquetas" subtitle="Impressora Elgin L42 Pro Full">
      {/* Mobile: Layout em abas / Desktop: Grid */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 animate-fade-in h-[calc(100vh-140px)] lg:h-[calc(100vh-160px)]">

        {/* Mobile: Resumo fixo no topo */}
        <div className="lg:hidden flex items-center justify-between bg-card border rounded-lg p-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-pink-primary" />
              <span className="text-sm font-medium">{selections.length} itens</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{totalLabels} etiquetas</span>
            </div>
          </div>
          {selections.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={clearAll}
            >
              Limpar
            </Button>
          )}
        </div>

        {/* Coluna Esquerda: Produtos */}
        <Card variant="elevated" className="lg:col-span-5 flex flex-col min-h-0 flex-1 lg:flex-none">
          <CardHeader className="pb-2 shrink-0 px-3 lg:px-6">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-sm lg:text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-pink-primary" />
                <span className="hidden sm:inline">Produtos com Estoque</span>
                <span className="sm:hidden">Produtos</span>
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] lg:text-xs">
                {productsWithStock.length} • {totalStock} un.
              </Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 lg:h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
            <ScrollArea className="h-full px-2 lg:px-3 pb-3">
              {isLoading ? (
                <div className="space-y-2 pt-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 lg:h-16 w-full" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-6 lg:py-8 text-muted-foreground">
                  <Package className="w-8 lg:w-10 h-8 lg:h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs lg:text-sm">Nenhum produto com estoque</p>
                </div>
              ) : (
                <div className="space-y-1.5 pt-2">
                  {filteredProducts.map((product) => {
                    const validSizes = product.sizes.filter(s => s.quantity >= 1 && s.barcode);
                    const selectedCount = validSizes.filter(s => isSelected(s.id)).length;
                    const allSelected = selectedCount === validSizes.length && validSizes.length > 0;

                    return (
                      <div
                        key={product.id}
                        className={`p-2 lg:p-2.5 rounded-lg border transition-all ${
                          selectedCount > 0
                            ? 'border-pink-primary/50 bg-pink-light/10'
                            : 'border-border hover:border-pink-light/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-xs lg:text-sm text-foreground truncate">{product.name}</h4>
                            <div className="flex items-center gap-1 text-[9px] lg:text-[10px] text-muted-foreground">
                              {product.category_name && <span>{product.category_name}</span>}
                              {product.color_name && <span>• {product.color_name}</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={allSelected ? "pink" : "outline"}
                            className="h-6 text-[9px] lg:text-[10px] px-2 shrink-0"
                            onClick={() => selectAllSizes(product)}
                          >
                            {allSelected ? <Check className="w-3 h-3" /> : 'Todos'}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {validSizes.map((sizeData) => {
                            const selected = isSelected(sizeData.id);
                            return (
                              <button
                                key={sizeData.id}
                                onClick={() => toggleSelection(product, sizeData)}
                                className={`
                                  px-2 py-0.5 rounded text-[9px] lg:text-[10px] font-medium transition-all flex items-center gap-0.5 lg:gap-1
                                  ${selected
                                    ? 'bg-pink-primary text-white'
                                    : 'bg-muted hover:bg-pink-light/30 text-foreground'
                                  }
                                `}
                                title={`Estoque: ${sizeData.quantity}`}
                              >
                                {sizeData.size}
                                <span className={`${selected ? 'text-white/70' : 'text-muted-foreground'}`}>
                                  ({sizeData.quantity})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Mobile: Selecionados e Ações em row / Desktop: Duas colunas separadas */}
        <div className="lg:col-span-7 flex flex-col md:flex-row lg:grid lg:grid-cols-7 gap-3 lg:gap-4 min-h-0 lg:h-full">

          {/* Coluna Central: Selecionados */}
          <Card variant="elevated" className="md:flex-1 lg:col-span-4 flex flex-col min-h-[200px] lg:min-h-0">
            <CardHeader className="pb-2 shrink-0 px-3 lg:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm lg:text-base flex items-center gap-2">
                  <Tag className="w-4 h-4 text-pink-primary" />
                  Selecionados
                  {selections.length > 0 && (
                    <Badge variant="pink" className="text-[10px] lg:text-xs">{selections.length}</Badge>
                  )}
                </CardTitle>
                <span className="hidden lg:inline">
                  {selections.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-muted-foreground hover:text-destructive"
                      onClick={clearAll}
                    >
                      Limpar
                    </Button>
                  )}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
              <ScrollArea className="h-full px-2 lg:px-3 pb-3">
                {selections.length === 0 ? (
                  <div className="text-center py-6 lg:py-8 text-muted-foreground">
                    <Tag className="w-6 lg:w-8 h-6 lg:h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs lg:text-sm">Clique nos tamanhos</p>
                    <p className="text-[10px] lg:text-xs">para selecionar</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 pt-2">
                    {selections.map((sel) => (
                      <div
                        key={sel.sizeId}
                        className="p-2 rounded-lg border border-border bg-background"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] lg:text-xs font-medium truncate">{sel.productName}</p>
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-[8px] lg:text-[9px] h-3.5 lg:h-4">{sel.size}</Badge>
                              <span className="text-[8px] lg:text-[9px] text-muted-foreground">
                                Est: {sel.stockQuantity}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeSelection(sel.sizeId)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between bg-muted/50 rounded px-1.5 lg:px-2 py-0.5 lg:py-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 text-[8px] lg:text-[9px] px-1 lg:px-1.5"
                            onClick={() => setQuantityToStock(sel.sizeId)}
                          >
                            =Est
                          </Button>
                          <div className="flex items-center gap-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => updateQuantity(sel.sizeId, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              max={sel.stockQuantity}
                              value={sel.quantity}
                              onChange={(e) => setQuantity(sel.sizeId, parseInt(e.target.value) || 1)}
                              className="h-5 w-8 lg:w-10 text-center text-[10px] lg:text-xs px-0 border-0 bg-background"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => updateQuantity(sel.sizeId, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Coluna Direita: Preview e Ações */}
          <Card variant="elevated" className="md:w-64 lg:w-auto lg:col-span-3 flex flex-col shrink-0">
            <CardHeader className="pb-2 shrink-0 px-3 lg:px-6">
              <CardTitle className="text-sm lg:text-base flex items-center gap-2">
                <Printer className="w-4 h-4 text-pink-primary" />
                <span className="hidden sm:inline">Prévia</span>
                <span className="sm:hidden">Imprimir</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-2 lg:gap-3 px-3 lg:px-6">
              {/* Preview de linha - esconde em mobile pequeno */}
              <div className="hidden sm:flex flex-1 flex-col items-center justify-center bg-muted/30 rounded-lg p-2 lg:p-3 min-h-[80px] lg:min-h-[100px]">
                {expandedLabels.length > 0 ? (
                  <div className="space-y-1 lg:space-y-2">
                    <p className="text-[9px] lg:text-[10px] text-muted-foreground text-center">
                      Primeira linha
                    </p>
                    <LabelRowPreview labels={expandedLabels.slice(0, 3)} />
                    {expandedLabels.length > 3 && (
                      <p className="text-[8px] lg:text-[9px] text-muted-foreground text-center">
                        + {Math.ceil((expandedLabels.length - 3) / 3)} linha(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Printer className="w-5 lg:w-6 h-5 lg:h-6 mx-auto mb-1 opacity-50" />
                    <p className="text-[9px] lg:text-[10px]">Selecione itens</p>
                  </div>
                )}
              </div>

              {/* Informações */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1 lg:gap-1.5">
                  <div className="p-1 lg:p-1.5 rounded bg-muted/50 text-center">
                    <p className="text-[8px] lg:text-[9px] text-muted-foreground uppercase">Etiqueta</p>
                    <p className="font-medium text-[9px] lg:text-[10px]">{LABEL_WIDTH_MM}×{LABEL_HEIGHT_MM}mm</p>
                  </div>
                  <div className="p-1 lg:p-1.5 rounded bg-muted/50 text-center">
                    <p className="text-[8px] lg:text-[9px] text-muted-foreground uppercase">Por linha</p>
                    <p className="font-medium text-[9px] lg:text-[10px]">{LABELS_PER_ROW} etiq.</p>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-pink-light/20 border border-pink-light/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] lg:text-xs text-muted-foreground">Total</span>
                    <Badge variant="pink" className="text-xs lg:text-sm font-bold">{totalLabels}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 lg:mt-1">
                    <span className="text-[9px] lg:text-[10px] text-muted-foreground">Linhas</span>
                    <span className="text-[9px] lg:text-[10px] font-medium">{Math.ceil(totalLabels / 3)}</span>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="space-y-1 lg:space-y-1.5">
                <Button
                  variant="pink"
                  className="w-full h-9 lg:h-10 text-xs lg:text-sm font-semibold"
                  onClick={handleGeneratePDF}
                  disabled={selections.length === 0}
                >
                  <Printer className="w-4 lg:w-4.5 h-4 lg:h-4.5 mr-1.5 lg:mr-2" />
                  Imprimir PDF ({totalLabels})
                </Button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    className="flex-1 h-7 lg:h-8 text-[10px] lg:text-xs"
                    onClick={handleDirectPrintUSB}
                    disabled={selections.length === 0}
                  >
                    <Usb className="w-3 h-3 mr-1" />
                    USB Direto
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 lg:h-8 w-7 lg:w-8"
                    onClick={() => setShowPrintHelp(true)}
                    title="Ajuda com impressão"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Ajuda para Impressão */}
      <Dialog open={showPrintHelp} onOpenChange={setShowPrintHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Como Imprimir
            </DialogTitle>
            <DialogDescription>
              Escolha o método mais adequado para seu ambiente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Printer className="w-4 h-4 text-pink-primary" />
                Imprimir PDF (Recomendado)
              </h4>
              <p className="text-muted-foreground pl-2">
                Abre a janela de impressão do Windows/navegador. Funciona com qualquer impressora configurada no sistema. 
                <strong> Selecione a Elgin L42 Pro</strong> na lista de impressoras.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Usb className="w-4 h-4" />
                USB Direto (Avançado)
              </h4>
              <p className="text-muted-foreground pl-2">
                Envia comandos direto para a impressora via USB. Requer Chrome ou Edge e pode ser bloqueado pelo sistema.
              </p>
            </div>

            <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
              <h4 className="font-semibold">Configuração da Elgin L42 Pro</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Etiquetas: 33mm x 22mm (3 por linha)</li>
                <li>Gap: 3mm entre etiquetas</li>
                <li>Rolo de 108mm de largura</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setShowPrintHelp(false)}>
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Fallback quando USB falha */}
      <AlertDialog open={showPrintFallback} onOpenChange={setShowPrintFallback}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              USB Bloqueado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="whitespace-pre-line text-sm">{printError}</p>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="font-medium text-foreground mb-1">
                    Use a impressão via PDF:
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Imprimir PDF" e selecione a <strong>Elgin L42 Pro</strong> na lista de impressoras do Windows.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBrowserPrint} className="bg-pink-primary hover:bg-pink-primary/90">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir PDF ({totalLabels} etiquetas)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
