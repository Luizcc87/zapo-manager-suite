import { toast } from "react-toastify";

export const copyToClipboard = (text: string): void => {
  navigator.clipboard.writeText(text);
  toast.success("Copiado para a área de transferência");
};
