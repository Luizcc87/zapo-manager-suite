interface PollMessageProps {
  pollMessage: {
    name: string;
    options: { optionName: string }[];
  };
  fromMe: boolean;
}

function PollMessage({ pollMessage, fromMe }: PollMessageProps) {
  if (!pollMessage?.name) return null;

  return (
    <div
      className={`-m-2 mb-1 flex min-w-[220px] flex-col gap-2 rounded-lg p-3 ${
        fromMe ? "bg-[#b2ece0] text-black dark:bg-[#082720] dark:text-white" : "bg-[#d2e2e2] dark:bg-[#0f1413]"
      }`}>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">📊 Enquete</div>
      <div className="text-md font-medium">{pollMessage.name}</div>
      <div className="flex flex-col gap-1">
        {pollMessage.options?.map((opt, idx) => (
          <div key={`${opt.optionName}-${idx}`} className="rounded border border-current/20 px-2 py-1 text-sm">
            {opt.optionName}
          </div>
        ))}
      </div>
    </div>
  );
}

export { PollMessage };
