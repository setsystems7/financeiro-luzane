import { useState, useRef, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProducts, Product } from '@/hooks/useProducts';
import { Printer, Tag, Search, Plus, Minus, X, Package, Check, FileDown, Usb, AlertTriangle, HelpCircle, ExternalLink } from 'lucide-react';
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

// ============================================
// CONFIGURAÇÕES PARA ELGIN L42 PRO
// Baseado nas medidas que funcionam:
// - Página: 110mm x 30mm
// - Etiqueta: 34.1mm x 24mm
// - 3 colunas, 1 linha
// - Margens: Superior 4mm, Inferior 2mm, Esq/Dir 3.5mm
// - Gap horizontal: 0.3mm
// ============================================
const LABEL_CONFIG = {
  // Página
  pageWidth: 110,    // mm
  pageHeight: 30,    // mm
  
  // Etiqueta individual
  labelWidth: 34.1,  // mm
  labelHeight: 24,   // mm
  
  // Layout
  columns: 3,
  rows: 1,
  
  // Margens da página
  marginTop: 4,      // mm
  marginBottom: 2,   // mm
  marginLeft: 3.5,   // mm
  marginRight: 3.5,  // mm
  
  // Espaçamento entre etiquetas
  gapHorizontal: 0.3, // mm
  gapVertical: 0,     // mm
  
  // DPI da impressora
  dpi: 203,
};

// Calcular dots por mm
const DOTS_PER_MM = LABEL_CONFIG.dpi / 25.4;

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
function BarcodeDisplay({ value, width = 1.2, height = 35 }: { value: string; width?: number; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'EAN13',
          width,
          height,
          displayValue: true,
          fontSize: 10,
          margin: 0,
          textMargin: 1,
          background: 'transparent',
        });
      } catch {
        try {
          JsBarcode(svgRef.current, value, {
            format: 'CODE128',
            width,
            height,
            displayValue: true,
            fontSize: 10,
            margin: 0,
            textMargin: 1,
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

// Preview de linha de etiquetas (simulando impressão real)
function LabelRowPreview({ labels }: { labels: LabelSelection[] }) {
  return (
    <div className="flex gap-[1px] justify-center">
      {[0, 1, 2].map((idx) => {
        const label = labels[idx];
        return (
          <div
            key={idx}
            className="bg-white border border-gray-300 flex flex-col items-center justify-between overflow-hidden"
            style={{
              width: '95px',
              height: '65px',
              padding: '3px 2px',
            }}
          >
            {label ? (
              <>
                <p className="text-[8px] font-bold text-black text-center truncate w-full leading-tight">
                  {label.productName} - {label.size}
                </p>
                <div className="flex-1 flex items-center justify-center w-full">
                  <BarcodeDisplay value={label.barcode} width={0.8} height={25} />
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
  
  // Detectar se está em iframe (preview do editor)
  const isInIframe = window.self !== window.top;

  // Filtrar produtos que têm pelo menos 1 unidade em qualquer tamanho e código de barras
  const productsWithStock = useMemo(() => {
    return products
      .map(product => ({
        ...product,
        sizes: product.sizes.filter(s => s.quantity >= 1 && s.barcode),
      }))
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
      setSelections(selections.filter(s => s.productId !== product.id));
    } else {
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

  // Expandir seleções para impressão
  const expandedLabels = useMemo(() => {
    const labels: LabelSelection[] = [];
    selections.forEach(sel => {
      for (let i = 0; i < sel.quantity; i++) {
        labels.push(sel);
      }
    });
    return labels;
  }, [selections]);

  // ============================================
  // IMPRESSÃO PDF - Formato exato para Elgin L42 Pro
  // Página: 110mm x 30mm
  // Etiqueta: 34.1mm x 24mm (3 por linha)
  // ============================================
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

    const { pageWidth, pageHeight, labelWidth, labelHeight, columns, marginTop, marginLeft, gapHorizontal } = LABEL_CONFIG;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas - Elgin L42 Pro</title>
        <meta charset="UTF-8">
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>
          /* Reset completo */
          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          /* Configuração de página para impressão - EXATA */
          @page {
            size: ${pageWidth}mm ${pageHeight}mm;
            margin: 0mm;
          }

          /* Estilos de impressão */
          @media print {
            html, body {
              width: ${pageWidth}mm !important;
              height: ${pageHeight}mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              overflow: hidden !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print { display: none !important; }
            .preview-container { display: none !important; }
            .labels-container { box-shadow: none !important; margin: 0 !important; }
            .row {
              page-break-inside: avoid !important;
              page-break-after: always !important;
              border: none !important;
            }
            .row:last-child {
              page-break-after: avoid !important;
            }
            .label {
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              background: white !important;
            }
            /* MUITO IMPORTANTE: etiquetas vazias NÃO podem ter fundo/borda (evita “manchas”/pontilhado) */
            .label.empty {
              border: none !important;
              background: transparent !important;
            }

            /* Nitidez do código de barras (SVG) */
            svg { shape-rendering: crispEdges !important; }
          }

          /* Estilos de visualização em tela */
          html, body {
            font-family: Arial, Helvetica, sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 0;
          }

          .preview-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }

          .labels-container {
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin: 20px auto;
            width: ${pageWidth}mm;
          }

          /* Cada linha de etiquetas = 1 página de impressão */
          .row {
            width: ${pageWidth}mm;
            height: ${pageHeight}mm;
            padding: ${marginTop}mm 0 0 ${marginLeft}mm;
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            background: white;
            border-bottom: 1px dashed #ccc;
          }

          .row:last-child {
            border-bottom: none;
          }

          /* Cada etiqueta individual - LAYOUT HORIZONTAL */
          .label {
            width: ${labelWidth}mm;
            height: ${labelHeight}mm;
            margin-right: ${gapHorizontal}mm;
            padding: 2mm 1.5mm 1mm 1.5mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            overflow: hidden;
            background: white;
            border: 0.2mm solid #e0e0e0;
            border-radius: 0.5mm;
          }

          .label:nth-child(3) {
            margin-right: 0;
          }

          .label.empty {
            border: 0.2mm dashed #ddd;
            background: #fafafa;
          }

          /* Nome do produto + tamanho - NO TOPO */
          .product-name {
            font-size: 10pt;
            font-weight: bold;
            text-align: center;
            line-height: 1.1;
            width: 100%;
            max-height: 5mm;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            color: #000;
            margin-bottom: 1.5mm;
            flex-shrink: 0;
          }

          /* Container do código de barras - HORIZONTAL */
          .barcode-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 0;
          }

          /* SVG do código de barras - FORÇAR HORIZONTAL */
          .barcode-container svg {
            width: 32mm !important;
            max-width: 32mm !important;
            height: 16mm !important;
            max-height: 16mm !important;
          }

          /* Instruções (só na tela) */
          .instructions {
            padding: 16px 20px;
            margin: 0 auto 20px auto;
            max-width: 500px;
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 2px solid #f59e0b;
            border-radius: 12px;
            font-size: 13px;
            color: #92400e;
          }

          .instructions h3 {
            margin-bottom: 12px;
            font-weight: bold;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .instructions ol {
            margin-left: 20px;
            line-height: 1.6;
          }

          .instructions li {
            margin-bottom: 4px;
          }

          .instructions strong {
            color: #78350f;
          }

          .instructions .info {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid rgba(245, 158, 11, 0.3);
            font-size: 12px;
            display: flex;
            justify-content: space-between;
          }

          .print-btn {
            display: block;
            margin: 0 auto 20px auto;
            padding: 16px 40px;
            background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(236, 72, 153, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
          }

          .print-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(236, 72, 153, 0.5);
          }

          .print-btn:active {
            transform: translateY(0);
          }

          .summary {
            text-align: center;
            margin-bottom: 20px;
            color: #666;
            font-size: 14px;
          }

          .summary strong {
            color: #ec4899;
            font-size: 18px;
          }
        </style>
      </head>
      <body>
        <div class="preview-container no-print">
          <div class="instructions">
            <h3>⚙️ Configuração para Elgin L42 Pro</h3>
            <ol>
              <li>Clique em <strong>"Imprimir Etiquetas"</strong></li>
              <li>Selecione a impressora <strong>Elgin L42 Pro</strong></li>
              <li>Papel: <strong>${pageWidth}mm × ${pageHeight}mm</strong></li>
              <li>Margens: <strong>Nenhuma (0mm)</strong></li>
              <li>Escala: <strong>100%</strong></li>
              <li>Cabeçalhos/Rodapés: <strong>Desativado</strong></li>
            </ol>
            <div class="info">
              <span>Etiqueta: ${labelWidth}×${labelHeight}mm</span>
              <span>3 colunas por linha</span>
            </div>
          </div>
          
          <div class="summary">
            <strong id="total-count">0</strong> etiquetas em <strong id="row-count">0</strong> linhas
          </div>
          
          <button class="print-btn" onclick="window.print()">🖨️ Imprimir Etiquetas</button>
        </div>

        <div class="labels-container" id="labels"></div>

        <script>
          var labels = ${JSON.stringify(expandedLabels.map(l => ({ 
            productName: l.productName, 
            size: l.size, 
            barcode: l.barcode 
          })))};
          var container = document.getElementById('labels');
          var columnsPerRow = ${columns};
          var totalLabels = labels.length;
          var totalRows = Math.ceil(totalLabels / columnsPerRow);

          // Atualizar contadores
          document.getElementById('total-count').textContent = totalLabels;
          document.getElementById('row-count').textContent = totalRows;

          // Gerar linhas de etiquetas
          for (var i = 0; i < totalLabels; i += columnsPerRow) {
            var row = document.createElement('div');
            row.className = 'row';

            for (var j = 0; j < columnsPerRow; j++) {
              var labelData = labels[i + j];
              var labelDiv = document.createElement('div');
              
              if (labelData) {
                labelDiv.className = 'label';
                var displayText = labelData.productName + ' - ' + labelData.size;
                labelDiv.innerHTML = 
                  '<div class="product-name">' + displayText + '</div>' +
                  '<div class="barcode-container"><svg id="barcode-' + (i + j) + '"></svg></div>';
              } else {
                labelDiv.className = 'label empty';
              }
              
              row.appendChild(labelDiv);
            }

            container.appendChild(row);
          }

          // Renderizar códigos de barras com JsBarcode
          labels.forEach(function(label, idx) {
            var svg = document.getElementById('barcode-' + idx);
            if (label.barcode && svg) {
              try {
                JsBarcode(svg, label.barcode, {
                  format: 'EAN13',
                  width: 1.6,
                  height: 55,
                  displayValue: true,
                  fontSize: 11,
                  margin: 0,
                  textMargin: 2,
                  background: 'transparent',
                  lineColor: '#000000',
                  fontOptions: 'bold',
                  flat: false
                });
              } catch(e) {
                try {
                  JsBarcode(svg, label.barcode, {
                    format: 'CODE128',
                    width: 1.4,
                    height: 55,
                    displayValue: true,
                    fontSize: 11,
                    margin: 0,
                    textMargin: 2,
                    background: 'transparent',
                    lineColor: '#000000',
                    fontOptions: 'bold',
                    flat: false
                  });
                } catch(e2) {
                  svg.parentElement.innerHTML = '<span style="font-size:7pt;color:#999;">Código inválido</span>';
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
    toast.success('Preparando ' + totalLabels + ' etiquetas para impressão...');
  };

  // Abrir app em nova aba (para permitir USB)
  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
    toast.info('Abra a página em nova aba e tente USB novamente');
    setShowPrintFallback(false);
  };

  // ============================================
  // IMPRESSÃO USB DIRETA - ZPL para Elgin L42 Pro
  // Etiqueta: 34.1mm x 24mm
  // ============================================
  const handleDirectPrintUSB = async () => {
    if (selections.length === 0) {
      toast.error('Selecione pelo menos um produto!');
      return;
    }

    // Verificar se está em iframe (bloqueio de segurança)
    if (isInIframe) {
      setPrintError('A impressão USB não está disponível dentro do editor da Lovable.\n\nPara usar USB direto:\n1. Clique em "Abrir em Nova Aba" abaixo\n2. Na nova aba, clique novamente em "USB Direto"\n\nAlternativa: Use "Imprimir PDF" que funciona em qualquer lugar.');
      setShowPrintFallback(true);
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

      // Solicitar acesso ao dispositivo USB
      const device = await nav.usb.requestDevice({
        filters: [
          { vendorId: 0x0DD4 }, // Elgin
          { vendorId: 0x0A5F }, // Zebra
          { vendorId: 0x04B8 }, // Epson
          { vendorId: 0x0745 }, // Argox
          { classCode: 7 },     // Classe de impressora
        ]
      });

      console.log('[Impressão USB] Dispositivo selecionado:', device.productName);
      await device.open();
      console.log('[Impressão USB] Dispositivo aberto');

      if (device.configuration === null) {
        await device.selectConfiguration(1);
        console.log('[Impressão USB] Configuração selecionada');
      }

      // Encontrar interface de impressora
      const printerInterface = device.configuration?.interfaces.find(
        (iface: any) => iface.alternate.interfaceClass === 7
      );

      if (!printerInterface) {
        throw new Error('Interface de impressora não encontrada.');
      }

      console.log('[Impressão USB] Interface encontrada:', printerInterface.interfaceNumber);
      await device.claimInterface(printerInterface.interfaceNumber);

      // Encontrar endpoint de saída
      const outEndpoint = printerInterface.alternate.endpoints.find(
        (ep: any) => ep.direction === 'out'
      );

      if (!outEndpoint) {
        throw new Error('Endpoint de saída não encontrado.');
      }

      // Calcular dimensões em dots (203 DPI)
      const labelWidthDots = Math.round(LABEL_CONFIG.labelWidth * DOTS_PER_MM);   // ~273 dots
      const labelHeightDots = Math.round(LABEL_CONFIG.labelHeight * DOTS_PER_MM); // ~192 dots
      
      // Gerar comandos ZPL
      let zplCommands = '';
      
      expandedLabels.forEach((label) => {
        // Truncar nome se muito longo
        const displayText = `${label.productName} - ${label.size}`;
        const truncatedText = displayText.length > 20 ? displayText.substring(0, 20) + '..' : displayText;
        
        zplCommands += '^XA';                                    // Início
        zplCommands += `^PW${labelWidthDots}`;                   // Largura
        zplCommands += `^LL${labelHeightDots}`;                  // Altura
        zplCommands += '^LH0,0';                                 // Origem
        
        // Nome do produto + tamanho (centralizado no topo)
        zplCommands += `^FO5,8^A0N,22,22^FB${labelWidthDots - 10},1,0,C,0^FD${truncatedText}^FS`;
        
        // Código de barras EAN13 (centralizado)
        const barcodeWidth = 180;
        const barcodeX = Math.round((labelWidthDots - barcodeWidth) / 2);
        zplCommands += `^FO${barcodeX},35^BY2,2.5,70^BCN,70,Y,N,N^FD${label.barcode}^FS`;
        
        zplCommands += '^XZ';                                    // Fim
      });

      const encoder = new TextEncoder();
      const data = encoder.encode(zplCommands);

      console.log('[Impressão USB] Enviando', data.byteLength, 'bytes');
      await device.transferOut(outEndpoint.endpointNumber, data);

      await device.releaseInterface(printerInterface.interfaceNumber);
      await device.close();
      console.log('[Impressão USB] Impressão concluída');

      toast.success(`${totalLabels} etiquetas enviadas para a impressora!`);
    } catch (error: any) {
      console.error('[Impressão USB] Erro:', error);

      let errorMessage = '';
      let showFallback = true;

      if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhuma impressora foi selecionada.';
        showFallback = false;
        toast.warning('Nenhuma impressora selecionada');
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Permissão negada para acessar a impressora USB.';
      } else if (error.message?.includes('claimed')) {
        errorMessage = 'A impressora está em uso por outro programa. Feche outros aplicativos e tente novamente.';
      } else {
        errorMessage = `Erro: ${error.message || 'Falha na conexão USB'}`;
      }

      if (showFallback) {
        setPrintError(errorMessage);
        setShowPrintFallback(true);
      }
    }
  };

  // Impressão via navegador (fallback)
  const handleBrowserPrint = () => {
    if (selections.length === 0) {
      toast.error('Selecione pelo menos um produto!');
      return;
    }
    handleGeneratePDF();
    setShowPrintFallback(false);
  };

  return (
    <MainLayout title="Etiquetas" subtitle="Elgin L42 Pro - 110x30mm">
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

        {/* Coluna Central/Direita: Selecionados e Ações */}
        <div className="lg:col-span-7 flex flex-col md:flex-row lg:grid lg:grid-cols-7 gap-3 lg:gap-4 min-h-0 lg:h-full">

          {/* Selecionados */}
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
                          <div className="flex items-center gap-0.5 lg:gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-5 w-5 lg:h-6 lg:w-6"
                              onClick={() => updateQuantity(sel.sizeId, -1)}
                              disabled={sel.quantity <= 1}
                            >
                              <Minus className="w-2.5 lg:w-3 h-2.5 lg:h-3" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              max={sel.stockQuantity}
                              value={sel.quantity}
                              onChange={(e) => setQuantity(sel.sizeId, parseInt(e.target.value) || 1)}
                              className="h-5 lg:h-6 w-8 lg:w-10 text-center text-[10px] lg:text-xs px-0.5 lg:px-1"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-5 w-5 lg:h-6 lg:w-6"
                              onClick={() => updateQuantity(sel.sizeId, 1)}
                              disabled={sel.quantity >= sel.stockQuantity}
                            >
                              <Plus className="w-2.5 lg:w-3 h-2.5 lg:h-3" />
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

          {/* Preview e Ações */}
          <Card variant="elevated" className="md:w-[280px] lg:w-auto lg:col-span-3 flex flex-col shrink-0">
            <CardHeader className="pb-2 shrink-0 px-3 lg:px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm lg:text-base flex items-center gap-2">
                  <Printer className="w-4 h-4 text-pink-primary" />
                  Impressão
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowPrintHelp(true)}
                >
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col px-3 lg:px-4 pt-0 pb-3 lg:pb-4">
              {/* Info do formato */}
              <div className="bg-muted/50 rounded-lg p-2 mb-3 text-center">
                <p className="text-[10px] lg:text-xs text-muted-foreground">
                  Página: {LABEL_CONFIG.pageWidth}×{LABEL_CONFIG.pageHeight}mm
                </p>
                <p className="text-[10px] lg:text-xs text-muted-foreground">
                  Etiqueta: {LABEL_CONFIG.labelWidth}×{LABEL_CONFIG.labelHeight}mm • 3/linha
                </p>
              </div>

              {/* Preview */}
              <div className="bg-muted/30 rounded-lg p-2 lg:p-3 mb-3 lg:mb-4">
                <p className="text-[9px] lg:text-[10px] text-muted-foreground text-center mb-2">
                  Preview (1 linha = 3 etiquetas)
                </p>
                <LabelRowPreview labels={expandedLabels.slice(0, 3)} />
              </div>

              {/* Total */}
              <div className="text-center mb-3 lg:mb-4">
                <p className="text-lg lg:text-xl font-bold text-pink-primary">{totalLabels}</p>
                <p className="text-[10px] lg:text-xs text-muted-foreground">
                  etiquetas • {Math.ceil(totalLabels / 3)} linhas
                </p>
              </div>

              {/* Botões de impressão */}
              <div className="space-y-2 mt-auto">
                <Button
                  className="w-full h-9 lg:h-10 text-xs lg:text-sm font-medium"
                  variant="pink"
                  onClick={handleGeneratePDF}
                  disabled={selections.length === 0}
                >
                  <FileDown className="w-4 h-4 mr-1.5" />
                  Imprimir PDF
                </Button>
                <Button
                  className="w-full h-8 lg:h-9 text-[10px] lg:text-xs"
                  variant="outline"
                  onClick={handleDirectPrintUSB}
                  disabled={selections.length === 0}
                >
                  <Usb className="w-3.5 h-3.5 mr-1.5" />
                  USB Direto (ZPL)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de ajuda */}
      <Dialog open={showPrintHelp} onOpenChange={setShowPrintHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-pink-primary" />
              Configuração de Impressão
            </DialogTitle>
            <DialogDescription>
              Para a Elgin L42 Pro com etiquetas de 3 colunas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="bg-muted/50 p-3 rounded-lg">
              <h4 className="font-medium mb-2">Formato atual:</h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Página: {LABEL_CONFIG.pageWidth}mm × {LABEL_CONFIG.pageHeight}mm</li>
                <li>• Etiqueta: {LABEL_CONFIG.labelWidth}mm × {LABEL_CONFIG.labelHeight}mm</li>
                <li>• 3 colunas por linha</li>
                <li>• Gap horizontal: {LABEL_CONFIG.gapHorizontal}mm</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Imprimir PDF:</h4>
              <ol className="text-xs space-y-1 text-muted-foreground list-decimal list-inside">
                <li>Configure papel personalizado: 110×30mm</li>
                <li>Margens: Nenhuma (0mm)</li>
                <li>Escala: 100%</li>
                <li>Desative cabeçalhos/rodapés</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium mb-2">USB Direto:</h4>
              <p className="text-xs text-muted-foreground">
                Envia comandos ZPL diretamente. Requer Chrome/Edge e impressora conectada via USB.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de erro USB */}
      <AlertDialog open={showPrintFallback} onOpenChange={setShowPrintFallback}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Problema na Impressão USB
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {printError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            {isInIframe && (
              <Button
                variant="outline"
                onClick={handleOpenInNewTab}
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir em Nova Aba
              </Button>
            )}
            <AlertDialogAction onClick={handleBrowserPrint}>
              <FileDown className="w-4 h-4 mr-2" />
              Usar Impressão PDF
            </AlertDialogAction>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
