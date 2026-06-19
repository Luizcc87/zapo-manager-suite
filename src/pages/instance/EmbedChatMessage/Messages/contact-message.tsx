import { useEffect, useState } from "react";

interface ContactMessageProps {
  contactMessage: {
    vcard: string;
  };
  fromMe?: boolean;
}

function ContactMessage({ contactMessage, fromMe }: ContactMessageProps) {
  const [contactInfo, setContactInfo] = useState({
    name: "",
    number: "",
  });

  useEffect(() => {
    if (!contactMessage?.vcard) return;
    const { name, number } = extractContactInfo(contactMessage.vcard);
    setContactInfo({ name, number });
  }, [contactMessage?.vcard]);

  if (!contactMessage?.vcard) {
    return null;
  }

  const extractContactInfo = (vcard: string) => {
    const vcardArray = vcard.split("\n"); // Separa o vcard em um array quebrando por \n

    const nameLine = vcardArray.find((item) => item.startsWith("FN:")); // Encontra a linha que começa com FN:
    const name = nameLine ? nameLine.split(":")[1] : ""; // Pega o valor da linha que começa com FN:

    const numberLine = vcardArray.find((item) => item.startsWith("TEL;")); // Encontra a linha que começa com TEL:
    const number = numberLine ? numberLine.split(":")[1] : ""; // Pega o valor da linha que começa com TEL:

    return { name, number };
  };

  return (
    <div
      className={`-m-2 mb-1 flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-all ${
        fromMe ? "bg-[#b2ece0] text-black hover:bg-[#a4ecde] dark:bg-[#082720] dark:text-white dark:hover:bg-[#071f19]" : "bg-[#d2e2e2] hover:bg-[#c2d2d2] dark:bg-[#0f1413] dark:hover:bg-[#141a18]"
      }`}>
      <img src={`https://ui-avatars.com/api/?name=${contactInfo.name.charAt(0)}&background=random&size=64`} alt={contactInfo.name} className="h-10 w-10 rounded-full" />
      <div>
        <div className="text-md font-medium">{contactInfo.name}</div>
        <div className="text-sm text-muted-foreground">{contactInfo.number}</div>
      </div>
    </div>
  );
}

export { ContactMessage };
