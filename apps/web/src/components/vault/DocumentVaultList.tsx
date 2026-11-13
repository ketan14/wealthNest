import { formatFileSize } from '@wealthnest/domain';
import { FamilyDocumentDto } from '@wealthnest/application';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Calendar, Download, FileText, FolderLock, Trash2 } from 'lucide-react';
import { getDocumentCategoryLabel } from './documents-demo-data';

interface DocumentVaultListProps {
  readonly isLoading: boolean;
  readonly filteredDocs: readonly FamilyDocumentDto[];
  readonly memberNameMap: ReadonlyMap<string, string>;
  readonly nowMs: number;
  readonly thirtyDaysMs: number;
  readonly isSupportModeActive: boolean;
  readonly onOpenUploadModal: () => void;
  readonly onDownload: (doc: FamilyDocumentDto) => void;
  readonly onRequestDelete: (doc: FamilyDocumentDto) => void;
}

/**
 * Renders the Family Document Vault document cards grid with expiry badges and download/delete actions.
 */
export function DocumentVaultList({
  isLoading,
  filteredDocs,
  memberNameMap,
  nowMs,
  thirtyDaysMs,
  isSupportModeActive,
  onOpenUploadModal,
  onDownload,
  onRequestDelete,
}: DocumentVaultListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-slate-400">
          Loading Family Document Vault...
        </CardContent>
      </Card>
    );
  }

  if (filteredDocs.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-3">
          <FolderLock className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-base font-medium text-slate-200">No documents found</div>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Upload PAN cards, HUF deeds, CAS statements, or insurance policies to keep your family
            records organized and protected.
          </p>
          <Button
            onClick={onOpenUploadModal}
            disabled={isSupportModeActive}
            className="mt-2"
          >
            Upload First Document
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredDocs.map((doc) => {
        const memberName = doc.memberId ? memberNameMap.get(doc.memberId) : undefined;
        const expiryMs = doc.expiryDate ? new Date(doc.expiryDate).getTime() : null;
        const isExpired = expiryMs !== null && !Number.isNaN(expiryMs) && expiryMs < nowMs;
        const isExpiringSoon =
          expiryMs !== null &&
          !Number.isNaN(expiryMs) &&
          expiryMs >= nowMs &&
          expiryMs - nowMs <= thirtyDaysMs;

        return (
          <Card key={doc.id} className="hover:border-slate-700 transition-colors">
            <CardContent className="p-5 flex flex-col justify-between gap-4 h-full">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-slate-800 text-emerald-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{doc.title}</h3>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {doc.fileName} · {formatFileSize(doc.fileSizeBytes)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="default">{getDocumentCategoryLabel(doc.category)}</Badge>
                  {memberName && <Badge variant="secondary">{memberName}</Badge>}
                  {!memberName && <Badge variant="default">Household</Badge>}
                  {isExpired && <Badge variant="destructive">Expired</Badge>}
                  {isExpiringSoon && <Badge variant="outline">Renewal Soon</Badge>}
                </div>

                {doc.notes && (
                  <p className="text-xs text-slate-400 line-clamp-2">{doc.notes}</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  {doc.documentDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {doc.documentDate}
                    </span>
                  )}
                  {doc.expiryDate && (
                    <span
                      className={
                        isExpired ? 'text-rose-400' : isExpiringSoon ? 'text-amber-400' : ''
                      }
                    >
                      Exp: {doc.expiryDate}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDownload(doc)}
                    aria-label={`Download ${doc.title}`}
                    className="h-8 px-2.5 text-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSupportModeActive}
                    onClick={() => onRequestDelete(doc)}
                    aria-label={`Delete ${doc.title}`}
                    className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

