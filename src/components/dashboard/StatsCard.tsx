import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  variant?: 'default' | 'pink';
  className?: string;
}

export function StatsCard({ title, value, icon, trend, description, variant = 'default', className }: StatsCardProps) {
  return (
    <Card className={cn("group hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-3 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 md:space-y-2 min-w-0 flex-1">
            <p className="text-xs md:text-sm font-medium text-muted-foreground leading-tight">{title}</p>
            <p className="text-base md:text-2xl font-bold text-foreground break-words leading-tight">{value}</p>
            {description && (
              <p className="text-[10px] md:text-xs text-muted-foreground leading-tight line-clamp-2">{description}</p>
            )}
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.isPositive ? "text-green-500" : "text-red-500"
              )}>
                {trend.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{trend.value}% vs mês anterior</span>
              </div>
            )}
          </div>
          <div className={cn(
            "w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shrink-0",
            variant === 'pink' ? "bg-pink-100 dark:bg-pink-900/30" : "bg-primary/10"
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
