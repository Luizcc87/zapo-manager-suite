import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { useSendContact } from "@/lib/queries/chat/sendMessage";

interface ContactPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remoteJid: string;
}

function ContactPicker({ open, onOpenChange, remoteJid }: ContactPickerProps) {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { sendContact } = useSendContact();

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!instance?.name || !instance?.token || !remoteJid) return;
    if (!fullName.trim() || !phoneNumber.trim()) {
      toast.error(t("chat.contact.missingFields"));
      return;
    }

    setIsSending(true);
    await sendContact(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { number: remoteJid, contact: { fullName, phoneNumber } },
      },
      {
        onSuccess: () => {
          setFullName("");
          setPhoneNumber("");
          onOpenChange(false);
        },
        onError: () => toast.error(t("chat.toast.sendError")),
        onSettled: () => setIsSending(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("chat.contact.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder={t("chat.contact.fullName")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input placeholder={t("chat.contact.phoneNumber")} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSending || !fullName || !phoneNumber} onClick={handleSend}>
            {t("chat.contact.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ContactPicker };
