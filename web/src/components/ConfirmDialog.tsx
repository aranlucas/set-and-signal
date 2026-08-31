import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export interface ConfirmDialogOptions {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t("common.confirm", "Confirm");
  const resolvedCancelLabel = cancelLabel ?? t("common.cancel", "Cancel");
  const confirm = async () => {
    onOpenChange(false);
    await onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{resolvedCancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={danger ? "destructive" : "default"} onClick={confirm}>
            {resolvedConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
