import * as Tooltip from "@radix-ui/react-tooltip";
import { ReactNode } from "react";

interface TooltipWrapperProps {
  content: ReactNode; // o texto que vai aparecer no tooltip
  children: ReactNode; // o trigger (qualquer elemento)
  side?: "top" | "right" | "bottom" | "left"; // posição opcional
}

export function TooltipWrapper({ content, children, side = "top" }: TooltipWrapperProps) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
             className="
              rounded px-3 py-1.5 text-sm z-50 border shadow-lg
            bg-gray-100 text-gray-900 border-gray-300
            dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700
            "
          >
            {content}
            <Tooltip.Arrow className="fill-gray-100 dark:fill-gray-800" width={18} height={9} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
