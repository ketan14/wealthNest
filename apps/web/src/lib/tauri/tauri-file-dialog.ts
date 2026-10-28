import { isTauri } from './tauri-runtime';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface SaveFileOptions {
  defaultPath?: string;
  filters?: FileFilter[];
  content: string;
}

export interface SaveFileResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface OpenFileOptions {
  filters?: FileFilter[];
}

export interface OpenFileResult {
  success: boolean;
  content?: string;
  filePath?: string;
  error?: string;
}

/**
 * Saves text content to disk using Native OS File Dialog in Tauri,
 * or browser Blob download link in Web environments.
 */
export async function saveTextFile(options: SaveFileOptions): Promise<SaveFileResult> {
  if (isTauri()) {
    try {
      // Dynamic import to avoid bundling issues in pure browser builds
      const dialog = (window as unknown as {
        __TAURI__?: {
          dialog?: {
            save: (opts: unknown) => Promise<string | null>;
          };
          fs?: {
            writeTextFile: (path: string, data: string) => Promise<void>;
          };
        };
      }).__TAURI__;

      if (dialog?.dialog?.save && dialog?.fs?.writeTextFile) {
        const filePath = await dialog.dialog.save({
          defaultPath: options.defaultPath,
          filters: options.filters,
        });

        if (!filePath) {
          return { success: false, error: 'User cancelled save dialog' };
        }

        await dialog.fs.writeTextFile(filePath, options.content);
        return { success: true, filePath };
      }
    } catch (err) {
      console.error('Tauri native save dialog failed, falling back to browser download:', err);
    }
  }

  // Web Browser Fallback: Blob URL download
  try {
    const blob = new Blob([options.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options.defaultPath || 'wealthnest_portfolio_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, filePath: a.download };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Opens and reads a text file from disk using Native OS File Dialog in Tauri,
 * or dynamic input file picker in Web environments.
 */
export async function openTextFile(options?: OpenFileOptions): Promise<OpenFileResult> {
  if (isTauri()) {
    try {
      const tauri = (window as unknown as {
        __TAURI__?: {
          dialog?: {
            open: (opts: unknown) => Promise<string | null>;
          };
          fs?: {
            readTextFile: (path: string) => Promise<string>;
          };
        };
      }).__TAURI__;

      if (tauri?.dialog?.open && tauri?.fs?.readTextFile) {
        const selected = await tauri.dialog.open({
          multiple: false,
          directory: false,
          filters: options?.filters,
        });

        if (!selected) {
          return { success: false, error: 'User cancelled file selection' };
        }

        const content = await tauri.fs.readTextFile(selected);
        return { success: true, content, filePath: selected };
      }
    } catch (err) {
      console.error('Tauri native open dialog failed, falling back to browser picker:', err);
    }
  }

  // Web Browser Fallback: Dynamic file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options?.filters?.length) {
      input.accept = options.filters
        .flatMap((f) => f.extensions.map((ext) => `.${ext}`))
        .join(',');
    }

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ success: false, error: 'No file selected' });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          success: true,
          content: e.target?.result as string,
          filePath: file.name,
        });
      };
      reader.onerror = () => {
        resolve({ success: false, error: 'Failed to read file' });
      };
      reader.readAsText(file);
    };

    input.click();
  });
}
