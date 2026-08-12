import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useEmbedInstance } from "@/contexts/EmbedInstanceContext";
import { useSendLocation } from "@/lib/queries/chat/sendMessage";

interface LocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remoteJid: string;
}

function LocationPicker({ open, onOpenChange, remoteJid }: LocationPickerProps) {
  const { t } = useTranslation();
  const { instance } = useEmbedInstance();
  const { sendLocation } = useSendLocation();

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!instance?.name || !instance?.token || !remoteJid) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error(t("chat.location.invalidCoordinates"));
      return;
    }

    setIsSending(true);
    await sendLocation(
      {
        instanceName: instance.name,
        token: instance.token,
        data: { number: remoteJid, latitude: lat, longitude: lng, name: name || undefined, address: address || undefined },
      },
      {
        onSuccess: () => {
          setLatitude("");
          setLongitude("");
          setName("");
          setAddress("");
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
          <DialogTitle>{t("chat.location.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder={t("chat.location.latitude")} value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          <Input placeholder={t("chat.location.longitude")} value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          <Input placeholder={t("chat.location.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder={t("chat.location.address")} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSending || !latitude || !longitude} onClick={handleSend}>
            {t("chat.location.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { LocationPicker };
