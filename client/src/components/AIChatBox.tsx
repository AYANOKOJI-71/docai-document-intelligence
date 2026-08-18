import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

export type Message = { role: "system" | "user" | "assistant"; content: string };

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
  renderAssistantFooter?: (message: Message, index: number) => React.ReactNode;
};

export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Ask a question about your documents…",
  className,
  height = "620px",
  emptyStateMessage = "Ask a grounded question when you are ready.",
  suggestedPrompts,
  renderAssistantFooter,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages.length, isLoading]);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;
    onSendMessage(question);
    setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <div className={cn("glass-panel flex flex-col overflow-hidden rounded-[1.35rem] border border-white/85", className)} style={{ height }}>
      <div ref={scrollAreaRef} className="min-h-0 flex-1">
        {messages.filter(message => message.role !== "system").length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center sm:p-10">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Sparkles className="size-6" /></div>
            <p className="mt-5 max-w-sm text-sm font-semibold text-[#283653]">{emptyStateMessage}</p>
            <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">Answers will be grounded in your indexed passages and presented with transparent source excerpts.</p>
            {suggestedPrompts && <div className="mt-7 flex max-w-xl flex-wrap justify-center gap-2">{suggestedPrompts.map(prompt => <button key={prompt} type="button" onClick={() => onSendMessage(prompt)} disabled={isLoading} className="pressable rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50">{prompt}</button>)}</div>}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-7 p-5 sm:p-7">
              {messages.filter(message => message.role !== "system").map((message, index) => (
                <div key={`${message.role}-${index}`} className={cn("flex items-start gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                  {message.role === "assistant" && <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Sparkles className="size-3.5" /></div>}
                  <div className={cn("max-w-[88%] rounded-2xl px-4 py-3.5 text-sm leading-6 sm:max-w-[82%]", message.role === "user" ? "rounded-tr-md bg-[#263866] text-white shadow-sm shadow-indigo-900/10" : "rounded-tl-md border border-slate-100 bg-white/90 text-slate-700 shadow-sm shadow-slate-900/[0.03]")}>{message.role === "assistant" ? <><div className="prose prose-sm max-w-none prose-p:my-0 prose-headings:mt-0 prose-headings:mb-2 prose-strong:text-[#263866]"><Streamdown>{message.content}</Streamdown></div>{renderAssistantFooter?.(message, index)}</> : <p className="whitespace-pre-wrap">{message.content}</p>}</div>
                  {message.role === "user" && <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600"><User className="size-3.5" /></div>}
                </div>
              ))}
              {isLoading && <div className="flex items-start gap-3"><div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Sparkles className="size-3.5" /></div><div className="rounded-2xl rounded-tl-md border border-slate-100 bg-white px-4 py-3"><Loader2 className="size-4 animate-spin text-indigo-500" /></div></div>}
            </div>
          </ScrollArea>
        )}
      </div>
      <form onSubmit={submit} className="flex items-end gap-3 border-t border-slate-100 bg-white/65 p-3.5 sm:p-4">
        <Textarea ref={textareaRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) submit(event); }} placeholder={placeholder} rows={1} className="min-h-11 max-h-32 resize-none rounded-xl border-slate-200 bg-white px-3.5 py-3 text-sm shadow-none focus-visible:ring-indigo-300" />
        <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="pressable size-11 shrink-0 rounded-xl bg-[#263866] text-white hover:bg-[#344a83]"><Send className="size-4" /></Button>
      </form>
    </div>
  );
}
