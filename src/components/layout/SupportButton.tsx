import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle, type LucideIcon } from 'lucide-react';

export interface SupportSection {
  title: string;
  content: string;
  icon?: LucideIcon;
}

interface SupportButtonProps {
  moduleName: string;
  sections: SupportSection[];
}

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
        Suporte
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Ajuda - {moduleName}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-2">
            <Accordion type="single" collapsible className="w-full">
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-sm font-medium text-left">
                      <span className="flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
                        {section.title}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                        {section.content}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
