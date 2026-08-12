interface EventMessageProps {
  eventMessage: {
    name: string;
    startTime: number;
    description?: string;
    endTime?: number;
    joinLink?: string;
  };
  fromMe: boolean;
}

function formatEventDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Só permite http(s) — bloqueia javascript:/data: e outros schemes perigosos em href
function resolveSafeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function EventMessage({ eventMessage, fromMe }: EventMessageProps) {
  if (!eventMessage?.name) return null;

  const safeJoinLink = resolveSafeUrl(eventMessage.joinLink);

  return (
    <div
      className={`-m-2 mb-1 flex min-w-[220px] flex-col gap-1 rounded-lg p-3 ${
        fromMe ? "bg-[#b2ece0] text-black dark:bg-[#082720] dark:text-white" : "bg-[#d2e2e2] dark:bg-[#0f1413]"
      }`}>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">📅 Evento</div>
      <div className="text-md font-medium">{eventMessage.name}</div>
      <div className="text-sm text-muted-foreground">{formatEventDate(eventMessage.startTime)}</div>
      {eventMessage.description && <div className="text-sm">{eventMessage.description}</div>}
      {safeJoinLink && (
        <a href={safeJoinLink} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
          {safeJoinLink}
        </a>
      )}
    </div>
  );
}

export { EventMessage };
