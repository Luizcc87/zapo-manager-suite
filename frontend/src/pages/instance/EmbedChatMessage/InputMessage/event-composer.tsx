import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { useSendEvent } from "@/lib/queries/chat/sendMessage";

interface EventComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remoteJid: string;
}

function EventComposer({ open, onOpenChange, remoteJid }: EventComposerProps) {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { sendEvent } = useSendEvent();

  const [name, setName] = useState("");
  const [datetime, setDatetime] = useState("");
  const [description, setDescription] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!instance?.name || !instance?.token || !remoteJid) return;
    if (!name.trim() || !datetime) {
      toast.error(t("chat.event.missingFields"));
      return;
    }
    const startTime = Math.floor(new Date(datetime).getTime() / 1000);
    if (Number.isNaN(startTime)) {
      toast.error(t("chat.event.invalidDate"));
      return;
    }

    setIsSending(true);
    await sendEvent(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { number: remoteJid, name, startTime, description: description || undefined },
      },
      {
        onSuccess: () => {
          setName("");
          setDatetime("");
          setDescription("");
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
          <DialogTitle>{t("chat.event.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder={t("chat.event.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          <Textarea placeholder={t("chat.event.description")} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSending || !name || !datetime} onClick={handleSend}>
            {t("chat.event.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { EventComposer };
