import { Button } from "@evoapi/design-system/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  instanceId,
}: NewConversationDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = phone.replace(/\D/g, "");

    if (clean.length < 10 || clean.length > 15 || clean.startsWith("0")) {
      setError(t("newConversation.invalidPhone"));
      return;
    }

    onOpenChange(false);
    setPhone("");
    navigate(`/manager/instance/${instanceId}/chat/${encodeURIComponent(clean + "@s.whatsapp.net")}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("newConversation.title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Input
                id="phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t("newConversation.placeholder")}
                autoFocus
              />
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("button.cancel")}
            </Button>
            <Button type="submit">{t("newConversation.confirm")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
