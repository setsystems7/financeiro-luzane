import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Lightbulb, CheckCircle2, AlertTriangle, ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SupportStep {
  text: string;
  tip?: string;
}

export interface SupportSection {
  title: string;
  content: string;
  icon?: LucideIcon;
  steps?: SupportStep[];
  tips?: string[];
  warning?: string;
  tag?: 'essencial' | 'avançado' | 'dica';
}

interface SupportButtonProps {
  moduleName: string;
  sections: SupportSection[];
}

function StepList({ steps }: { steps: SupportStep[] }) {
  return (
    <div className="space-y-3 mt-3">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mt-0.5">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-relaxed">{step.text}</p>
            {step.tip && (
              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-primary bg-primary/5 rounded-md px-2 py-1.5">
                <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{step.tip}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TipsList({ tips }: { tips: string[] }) {
  return (
    <div className="mt-3 space-y-2">
      {tips.map((tip, i) => (
        <div key={i} className="flex items-start gap-2 text-sm bg-accent/50 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
          <span className="text-muted-foreground">{tip}</span>
        </div>
      ))}
    </div>
  );
}

function WarningBox({ text }: { text: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 text-sm bg-warning/10 border border-warning/20 rounded-lg px-3 py-2.5">
      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
      <span className="text-foreground">{text}</span>
    </div>
  );
}

const tagStyles = {
  essencial: 'bg-primary/10 text-primary border-primary/20',
  avançado: 'bg-accent text-accent-foreground border-border',
  dica: 'bg-success/10 text-success border-success/20',
};

const tagLabels = {
  essencial: 'Essencial',
  avançado: 'Avançado',
  dica: 'Dica',
};

export function SupportButton({ moduleName, sections }: SupportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-6 right-6 z-50 gap-2 shadow-lg rounded-full px-4 py-2 bg-card border-border hover:bg-accent"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="w-4 h-4" />
        Ajuda
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              Guia — {moduleName}
            </SheetTitle>
            <p className="text-sm text-muted-foreground text-left">
              Aprenda a usar cada funcionalidade passo a passo
            </p>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-140px)] mt-4 pr-2">
            <Accordion type="single" collapsible className="w-full space-y-2">
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="border rounded-lg px-1 data-[state=open]:bg-accent/30"
                  >
                    <AccordionTrigger className="text-sm font-medium text-left py-3 hover:no-underline">
                      <span className="flex items-center gap-2 flex-1">
                        {Icon && (
                          <div className="p-1 rounded-md bg-primary/10 flex-shrink-0">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <span className="flex-1">{section.title}</span>
                        {section.tag && (
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 ml-1", tagStyles[section.tag])}>
                            {tagLabels[section.tag]}
                          </Badge>
                        )}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-1 px-1">
                      {/* Main description */}
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {section.content}
                      </p>

                      {/* Numbered steps */}
                      {section.steps && section.steps.length > 0 && (
                        <StepList steps={section.steps} />
                      )}

                      {/* Tips list */}
                      {section.tips && section.tips.length > 0 && (
                        <TipsList tips={section.tips} />
                      )}

                      {/* Warning */}
                      {section.warning && (
                        <WarningBox text={section.warning} />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {/* Footer help */}
            <div className="mt-6 p-4 rounded-lg bg-accent/30 border">
              <p className="text-xs text-muted-foreground text-center">
                Precisa de mais ajuda? Entre em contato pelo WhatsApp ou e-mail disponível nas Configurações.
              </p>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
