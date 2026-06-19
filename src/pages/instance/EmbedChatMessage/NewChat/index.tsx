import { useTranslation } from "react-i18next";
import { useSearchParams, useNavigate } from "react-router-dom";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { NewChatForm } from "./new-chat-form";

type NewChatSchema = {
  remoteJid: string;
};

interface NewChatProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

function NewChat({ isOpen, setIsOpen }: NewChatProps) {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const navigate = useNavigate();

  const handleSuccess = (data: NewChatSchema) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("remoteJid", data.remoteJid);
    navigate(`/manager/embed-chat?${newSearchParams.toString()}`);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("chat.newChat.title")}</DialogTitle>
          <DialogDescription>{t("chat.newChat.description")}</DialogDescription>
        </DialogHeader>
        <NewChatForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}

export { NewChat };
