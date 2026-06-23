import { Avatar, AvatarFallback, AvatarImage } from "@evoapi/design-system/avatar";
import { Button } from "@evoapi/design-system/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useInstance } from "@/contexts/InstanceContext";
import { useFindContacts } from "@/lib/queries/contact/findContacts";
import { NewConversationDialog } from "@/components/NewConversationDialog";

const formatPhone = (jid: string) => jid.split("@")[0];

function Contacts() {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: contacts = [], isLoading } = useFindContacts({ instanceName: instance?.name });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const name = (c.name || c.notify || "").toLowerCase();
      const phone = formatPhone(c.id);
      return name.includes(q) || phone.includes(q);
    });
  }, [contacts, search]);

  const startChat = (jid: string) => {
    const id = instanceId ?? instance?.id;
    navigate(`/manager/instance/${id}/chat/${encodeURIComponent(jid)}`);
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("sidebar.contacts")}</h1>
          {!isLoading && (
            <span className="text-sm text-muted-foreground">({filtered.length} / {contacts.length})</span>
          )}
        </div>
        <Button onClick={() => setModalOpen(true)} size="sm">
          {t("newConversation.button")}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t("chat.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Carregando...
        </div>
      )}

      {!isLoading && contacts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Users className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum contato sincronizado.</p>
          <p className="text-xs opacity-70">Ative <code>SAVE_DATA_CONTACTS=true</code> no backend.</p>
        </div>
      )}

      {!isLoading && contacts.length > 0 && filtered.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Nenhum contato encontrado para "{search}".
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border">
            {filtered.map((contact) => {
              const displayName = contact.name || contact.notify || formatPhone(contact.id);
              const initials = displayName.slice(0, 2).toUpperCase();
              return (
                <div key={contact.id} className="flex items-center gap-3 py-2.5 px-1 hover:bg-accent/50 rounded-md transition-colors">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    {contact.imgUrl && <AvatarImage src={contact.imgUrl} alt={displayName} />}
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{formatPhone(contact.id)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-shrink-0 gap-1.5"
                    onClick={() => startChat(contact.id)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Conversar</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <NewConversationDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        instanceId={instanceId ?? instance?.id ?? ""}
      />
    </div>
  );
}

export { Contacts };
