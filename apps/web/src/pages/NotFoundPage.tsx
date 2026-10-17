import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertCircle, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center border-border/80">
        <CardHeader className="flex flex-col items-center pb-2">
          <div className="w-12 h-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mb-2">
            <AlertCircle className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold">404 — Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The requested route does not exist or has not been configured in the WealthNest
            application shell.
          </p>
          <Link to="/" className="inline-block">
            <Button className="gap-2">
              <Home className="w-4 h-4" />
              Return to System Overview
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
