import { Result, ok } from '@wealthnest/shared';

export interface SystemStatusDto {
  readonly appName: string;
  readonly architecture: string;
  readonly phase: string;
  readonly layers: readonly {
    readonly name: string;
    readonly status: 'initialized' | 'pending';
    readonly description: string;
  }[];
}

export class GetSystemStatusUseCase {
  execute(): Result<SystemStatusDto> {
    return ok({
      appName: 'WealthNest',
      architecture: 'Clean Monorepo (npm workspaces)',
      phase: 'Phase 0 (Foundation Scaffold)',
      layers: [
        {
          name: 'Domain Layer (@wealthnest/domain)',
          status: 'initialized',
          description:
            'Framework-independent financial types, money value objects, and business rules.',
        },
        {
          name: 'Application Layer (@wealthnest/application)',
          status: 'initialized',
          description: 'Use cases and port contracts for repository/auth abstraction.',
        },
        {
          name: 'Shared Layer (@wealthnest/shared)',
          status: 'initialized',
          description: 'Reusable Result pattern, branded types, and format utilities.',
        },
        {
          name: 'Web Frontend (@wealthnest/web)',
          status: 'initialized',
          description: 'Vite + React + Tailwind + TanStack Query application shell.',
        },
      ],
    });
  }
}
