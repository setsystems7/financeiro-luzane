import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SupportButton, type SupportSection } from './SupportButton';

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  supportContent?: {
    moduleName: string;
    sections: SupportSection[];
  };
}

export function MainLayout({ children, title, subtitle, supportContent }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-16 lg:pt-6">
          {children}
        </main>
      </div>
      {supportContent && (
        <SupportButton
          moduleName={supportContent.moduleName}
          sections={supportContent.sections}
        />
      )}
    </div>
  );
}
