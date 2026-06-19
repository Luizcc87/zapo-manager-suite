import i18next from "i18next";
import { z } from "zod";

const t = i18next.t;

export const messageSchema = z.object({
  title: z.string().min(1, t("chat.buttons.form.validation.titleRequired")),
  description: z.string().min(1, t("chat.buttons.form.validation.descriptionRequired")),
  footer: z.string().optional(),
  buttons: z
    .array(
      z.object({
        type: z.enum(["reply", "copy", "url", "call"], {
          required_error: t("chat.buttons.form.validation.buttonTypeRequired"),
        }),
        displayText: z.string().min(1, t("chat.buttons.form.validation.buttonTextRequired")),
        id: z.string().optional(),
        copyCode: z.string().optional(),
        url: z.string().optional(),
        phoneNumber: z.string().optional(),
      }),
    )
    .min(1, t("chat.buttons.form.validation.minimumOneButton"))
    .superRefine((buttons, ctx) => {
      buttons.forEach((button, index) => {
        if (button.type === "reply" && !button.id) {
          ctx.addIssue({
            code: "custom",
            message: t("chat.buttons.form.validation.replyIdRequired"),
            path: [`${index}.id`],
          });
        }
        if (button.type === "copy" && !button.copyCode) {
          ctx.addIssue({
            code: "custom",
            message: t("chat.buttons.form.validation.copyTextRequired"),
            path: [`${index}.copyCode`],
          });
        }
        if (button.type === "url" && !button.url) {
          ctx.addIssue({
            code: "custom",
            message: t("chat.buttons.form.validation.urlRequired"),
            path: [`${index}.url`],
          });
        }
        if (button.type === "call" && !button.phoneNumber) {
          ctx.addIssue({
            code: "custom",
            message: t("chat.buttons.form.validation.phoneRequired"),
            path: [`${index}.phoneNumber`],
          });
        }
      });
    })
    .transform((buttons) => {
      return buttons.map((button) => {
        const baseButton = {
          type: button.type,
          displayText: button.displayText,
        };

        switch (button.type) {
          case "reply":
            return { ...baseButton, id: button.id };
          case "copy":
            return { ...baseButton, copyCode: button.copyCode };
          case "url":
            return { ...baseButton, url: button.url };
          case "call":
            return { ...baseButton, phoneNumber: button.phoneNumber };
          default:
            return baseButton;
        }
      });
    }),
});

export type MessageSchema = z.infer<typeof messageSchema>;
