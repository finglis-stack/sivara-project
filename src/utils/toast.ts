import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

export const showConfirm = (title: string, description?: string): Promise<boolean> => {
  return new Promise((resolve) => {
    toast(title, {
      description,
      action: {
        label: 'Confirmer',
        onClick: () => resolve(true),
      },
      cancel: {
        label: 'Annuler',
        onClick: () => resolve(false),
      },
    });
  });
};