interface StickerPackMessageProps {
  stickerPackMessage: {
    name: string;
    publisher: string;
  };
  fromMe: boolean;
}

function StickerPackMessage({ stickerPackMessage, fromMe }: StickerPackMessageProps) {
  if (!stickerPackMessage?.name) return null;

  return (
    <div
      className={`-m-2 mb-1 flex flex-col gap-1 rounded-lg p-3 ${
        fromMe ? "bg-[#b2ece0] text-black dark:bg-[#082720] dark:text-white" : "bg-[#d2e2e2] dark:bg-[#0f1413]"
      }`}>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">🎨 Pacote de figurinhas</div>
      <div className="text-md font-medium">{stickerPackMessage.name}</div>
      <div className="text-sm text-muted-foreground">{stickerPackMessage.publisher}</div>
    </div>
  );
}

export { StickerPackMessage };
