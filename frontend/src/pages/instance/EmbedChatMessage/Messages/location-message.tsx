interface LocationMessageProps {
  locationMessage: {
    address: string;
    degreesLatitude: number;
    degreesLongitude: number;
    name: string;
  };
  fromMe: boolean;
}

function LocationMessage({ locationMessage, fromMe }: LocationMessageProps) {
  const { address, degreesLatitude, degreesLongitude, name } = locationMessage;

  return (
    <div
      className={`-m-2 mb-1 flex cursor-pointer flex-col gap-2 rounded-lg p-2 transition-all ${
        fromMe ? "bg-[#b2ece0] text-black hover:bg-[#a4ecde] dark:bg-[#082720] dark:text-white dark:hover:bg-[#071f19]" : "bg-[#d2e2e2] hover:bg-[#c2d2d2] dark:bg-[#0f1413] dark:hover:bg-[#141a18]"
      }`}>
      <div className="text-md font-medium">{name}</div>
      <div className="text-sm text-muted-foreground">{address}</div>
      <div className="text-sm text-muted-foreground">
        {degreesLatitude}, {degreesLongitude}
      </div>
    </div>
  );
}

export { LocationMessage };
