import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { useSendPoll } from "@/lib/queries/chat/sendMessage";

interface PollComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remoteJid: string;
}

function PollComposer({ open, onOpenChange, remoteJid }: PollComposerProps) {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { sendPoll } = useSendPoll();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isSending, setIsSending] = useState(false);

  const updateOption = (idx: number, value: string) => {
    setOptions((prev) => prev.map((opt, i) => (i === idx ? value : opt)));
  };

  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (idx: number) => setOptions((prev) => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (!instance?.name || !instance?.token || !remoteJid) return;
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) {
      toast.error(t("chat.poll.missingFields"));
      return;
    }

    setIsSending(true);
    await sendPoll(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { number: remoteJid, name: question, options: validOptions },
      },
      {
        onSuccess: () => {
          setQuestion("");
          setOptions(["", ""]);
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
          <DialogTitle>{t("chat.poll.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder={t("chat.poll.question")} value={question} onChange={(e) => setQuestion(e.target.value)} />
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input placeholder={`${t("chat.poll.option")} ${idx + 1}`} value={opt} onChange={(e) => updateOption(idx, e.target.value)} />
              {options.length > 2 && (
                <Button type="button" size="icon" variant="ghost" onClick={() => removeOption(idx)}>
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="ghost" className="gap-1" onClick={addOption}>
            <PlusIcon className="h-4 w-4" />
            {t("chat.poll.addOption")}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSending || !question} onClick={handleSend}>
            {t("chat.poll.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { PollComposer };
