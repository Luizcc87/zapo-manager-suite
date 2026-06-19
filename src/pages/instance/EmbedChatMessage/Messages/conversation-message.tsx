import { Message } from "@/types/evolution.types";

import { InteractiveButton } from "./interactive-button";
import { MarkdownWrapper } from "./markdown-wrapper";

interface ButtonType {
  name: string;
  buttonParamsJSON: string;
}

interface ConversationMessageProps {
  message: Message;
}

export function ConversationMessage({ message }: ConversationMessageProps) {
  // Resposta de botão normal
  if (message.message?.buttonsResponseMessage) {
    return <MarkdownWrapper>{message.message.buttonsResponseMessage.Response.SelectedDisplayText}</MarkdownWrapper>;
  }

  // Resposta de botão template
  if (message.message?.templateButtonReplyMessage) {
    return <MarkdownWrapper>{message.message.templateButtonReplyMessage.selectedDisplayText}</MarkdownWrapper>;
  }

  // Mensagem interativa
  if (message.message?.viewOnceMessage?.message?.interactiveMessage?.InteractiveMessage) {
    const title = message.message?.viewOnceMessage?.message?.interactiveMessage.body.text.split("\n")[0];
    const body = message.message?.viewOnceMessage?.message?.interactiveMessage.body.text.split("\n\n")[1];
    const footer = message.message?.viewOnceMessage?.message?.interactiveMessage.footer?.text;
    const buttons = message.message?.viewOnceMessage?.message?.interactiveMessage?.InteractiveMessage?.NativeFlowMessage?.buttons;

    return (
      <div className="flex flex-col gap-2">
        <MarkdownWrapper>{title}</MarkdownWrapper>
        <MarkdownWrapper>{body}</MarkdownWrapper>
        <MarkdownWrapper>{footer}</MarkdownWrapper>
        {buttons?.map((button: ButtonType, index: number) => {
          const buttonParams = JSON.parse(button.buttonParamsJSON);

          return <InteractiveButton button={button} buttonParams={buttonParams} key={index} />;
        })}
      </div>
    );
  }

  // Mensagem de texto simples
  return <MarkdownWrapper>{message.message.conversation}</MarkdownWrapper>;
}
