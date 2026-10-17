import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Clock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PlaceholderModulePageProps {
  title: string;
  description: string;
  targetPhase: string;
}

export function PlaceholderModulePage({
  title,
  description,
  targetPhase,
}: PlaceholderModulePageProps) {
  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </Button>
        </Link>
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            <Badge variant="secondary" className="gap-1.5 py-1 px-3">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              Scheduled for {targetPhase}
            </Badge>
          </div>
          <CardDescription className="text-sm mt-1">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="p-6 rounded-xl border border-dashed border-border/80 bg-accent/20 text-center space-y-3">
            <p className="text-sm font-medium text-foreground">Module Boundary Reserved</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              In accordance with Phase 0 design rules, business functionality, mock financial data,
              and authentication forms are intentionally omitted until the underlying domain models
              and database migrations are established in subsequent phases.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
