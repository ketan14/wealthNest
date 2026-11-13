import { HoldingDetailDto } from '@wealthnest/application';
import { AddHoldingModal, NewHoldingFormValues } from '@/components/portfolio/AddHoldingModal';
import { EditHoldingModal, UpdateHoldingFormValues } from '@/components/portfolio/EditHoldingModal';
import { ImportCasModal } from '@/components/portfolio/ImportCasModal';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { DemoImportedHoldingInput } from './portfolio-calculations';

interface PortfolioModalsProps {
  readonly isAddOpen: boolean;
  readonly onCloseAdd: () => void;
  readonly onAddSubmit: (values: NewHoldingFormValues) => Promise<void>;
  readonly isAddLoading: boolean;
  readonly editingHolding: HoldingDetailDto | null;
  readonly onCloseEdit: () => void;
  readonly onEditSubmit: (values: UpdateHoldingFormValues) => Promise<void>;
  readonly isEditLoading: boolean;
  readonly isImportOpen: boolean;
  readonly onCloseImport: () => void;
  readonly onImportSuccess: (
    importedItems?: readonly DemoImportedHoldingInput[],
    memberId?: string,
    accountId?: string
  ) => void;
  readonly isManageFamilyOpen: boolean;
  readonly onCloseManageFamily: () => void;
  readonly holdingToDelete: HoldingDetailDto | null;
  readonly isDeleting: boolean;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
}

/**
 * Renders all modal dialogs for the Portfolio page (Add, Edit, CAS Import, Family Management, Delete Confirmation).
 */
export function PortfolioModals({
  isAddOpen,
  onCloseAdd,
  onAddSubmit,
  isAddLoading,
  editingHolding,
  onCloseEdit,
  onEditSubmit,
  isEditLoading,
  isImportOpen,
  onCloseImport,
  onImportSuccess,
  isManageFamilyOpen,
  onCloseManageFamily,
  holdingToDelete,
  isDeleting,
  onConfirmDelete,
  onCancelDelete,
}: PortfolioModalsProps) {
  return (
    <>
      <AddHoldingModal
        isOpen={isAddOpen}
        onClose={onCloseAdd}
        onSubmit={onAddSubmit}
        isLoading={isAddLoading}
      />

      <EditHoldingModal
        isOpen={Boolean(editingHolding)}
        holding={editingHolding}
        onClose={onCloseEdit}
        onSubmit={onEditSubmit}
        isLoading={isEditLoading}
      />

      <ImportCasModal isOpen={isImportOpen} onClose={onCloseImport} onSuccess={onImportSuccess} />

      <ManageFamilyModal isOpen={isManageFamilyOpen} onClose={onCloseManageFamily} />

      <ConfirmActionModal
        isOpen={Boolean(holdingToDelete)}
        title="Delete Holding"
        message={`Delete "${holdingToDelete?.name}" from your portfolio? This action cannot be undone.`}
        confirmLabel="Delete Holding"
        isLoading={isDeleting}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </>
  );
}

