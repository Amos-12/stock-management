import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HeatmapData {
  day: number; // 0-6 (Dim-Sam)
  hour: number; // 0-23
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapData[];
  title?: string;
  maxValue?: number;
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const HeatmapChart = ({ 
  data, 
  title = "Carte de chaleur des ventes",
  maxValue: propMaxValue,
}: HeatmapChartProps) => {
  const maxValue = propMaxValue || Math.max(...data.map(d => d.value), 1);
  
  const getColor = (value: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return 'bg-muted';
    if (intensity < 0.25) return 'bg-primary/20';
    if (intensity < 0.5) return 'bg-primary/40';
    if (intensity < 0.75) return 'bg-primary/60';
    return 'bg-primary';
  };

  const getValue = (day: number, hour: number) => {
    const item = data.find(d => d.day === day && d.hour === hour);
    return item?.value || 0;
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}h`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="overflow-x-auto">
          <div className="min-w-[320px] sm:min-w-[500px]">
            {/* Hours header */}
            <div className="flex mb-1">
              <div className="w-8 sm:w-12" />
              {HOURS.filter((_, i) => i % 4 === 0).map(hour => (
                <div 
                  key={hour} 
                  className="flex-1 text-center text-[10px] sm:text-xs text-muted-foreground"
                  style={{ minWidth: '16px' }}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* Grid */}
            <TooltipProvider>
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="flex items-center gap-0.5 mb-0.5">
                  <div className="w-8 sm:w-12 text-[10px] sm:text-xs text-muted-foreground font-medium">
                    {day}
                  </div>
                  {HOURS.map(hour => {
                    const value = getValue(dayIndex, hour);
                    return (
                      <Tooltip key={`${dayIndex}-${hour}`}>
                        <TooltipTrigger asChild>
                          <div 
                            className={`flex-1 h-4 sm:h-6 rounded-sm cursor-pointer transition-all hover:ring-1 sm:hover:ring-2 hover:ring-primary hover:ring-offset-1 ${getColor(value)}`}
                            style={{ minWidth: '8px' }}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="p-1.5 sm:p-2">
                          <p className="font-medium text-xs sm:text-sm">{day} {formatHour(hour)}</p>
                          <p className="text-[10px] sm:text-sm text-muted-foreground">
                            {value} vente{value !== 1 ? 's' : ''}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </TooltipProvider>

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 mt-3 sm:mt-4">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Moins</span>
              <div className="flex gap-0.5">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-muted" />
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-primary/20" />
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-primary/40" />
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-primary/60" />
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-primary" />
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Plus</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
