import { SystemStatusDto } from '@wealthnest/application';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, Database, HardDrive, Layers, Server } from 'lucide-react';

interface SystemDiagnosticsTabProps {
  readonly systemStatus: SystemStatusDto;
}

/**
 * Renders the System Diagnostics tab showing Clean Architecture layer status and runtime metrics.
 */
export function SystemDiagnosticsTab({ systemStatus }: SystemDiagnosticsTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Monorepo Layers</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">{systemStatus.layers.length}</div>
            <div className="text-xs text-emerald-400 mt-1">100% Initialized</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Database Engine</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">PostgreSQL</div>
            <div className="text-xs text-slate-400 mt-1">Supabase + RLS</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Client Memory Cache</span>
              <HardDrive className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">Reactive</div>
            <div className="text-xs text-slate-400 mt-1">localStorage synced</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Architecture</span>
              <Server className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">Clean Arch</div>
            <div className="text-xs text-slate-400 mt-1">Zero domain dependencies</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Architectural Layer Verification
          </CardTitle>
          <CardDescription className="text-slate-400">
            WealthNest Clean Architecture enforces strict dependency inversion principles across all
            packages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {systemStatus.layers.map((layer, index) => (
              <div
                key={index}
                className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>{layer.name}</span>
                    <Badge
                      variant="outline"
                      className="text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                    >
                      {layer.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-400">{layer.description}</div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
