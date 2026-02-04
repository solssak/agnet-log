import type { Message } from "../types";
import { MessageRenderer } from "./MessageRenderer";
import { getMessageText } from "../utils/message";

type Props = {
  messages: Message[];
};

export const MessageList = ({ messages }: Props) => {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg, idx) => (
        <div
          key={msg.uuid || idx}
          className={`max-w-[85%] min-w-0 px-4 py-3 rounded-2xl overflow-hidden ${
            msg.message?.role === "user"
              ? "self-end bg-zinc-700 text-white rounded-br-sm dark:bg-zinc-600"
              : "self-start bg-white dark:bg-zinc-800 rounded-bl-sm border border-zinc-200 dark:border-zinc-700"
          }`}
        >
          <div className="flex justify-between items-center gap-3 mb-1.5">
            <span
              className={`text-xs font-semibold uppercase opacity-70 ${
                msg.message?.role === "user"
                  ? "text-white/80"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {msg.message?.role}
            </span>
            <span
              className={`text-[10px] opacity-60 ${
                msg.message?.role === "user" ? "text-white/70" : ""
              }`}
            >
              {msg.timestamp
                ? new Date(msg.timestamp).toLocaleTimeString()
                : ""}
            </span>
          </div>
          <div className="text-sm leading-relaxed min-w-0">
            <MessageRenderer content={getMessageText(msg)} />
          </div>
        </div>
      ))}
    </div>
  );
};
