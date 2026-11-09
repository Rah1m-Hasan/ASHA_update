"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Switch } from "@/components/dashboard/Switch";
import { Button } from "@/components/ui/Button";
import { SendIcon, VolumeIcon } from "@/components/ui/icons";
import { askAsha, type ChatReply, type ChatTurn } from "@/features/assistant/askAsha";
import { usePerception } from "@/features/perception/PerceptionProvider";
import { useRequests } from "@/features/requests/RequestProvider";
import { sessionStore, useSession } from "@/features/session/store";
import { speak } from "@/features/speech/speak";
import { cn } from "@/lib/cn";

type Message = ChatTurn & { reply?: ChatReply };

export default function AssistantPage() {
  const cred = useSession((s) => s.patient);
  const settings = useSession((s) => s.settings);
  const { snapshot, state } = usePerception();
  const { propose } = useRequests();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi, I’m Asha. Ask me anything about the app, or tell me what you need." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const history = messages.slice(-6).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const reply = await askAsha(cred, {
        text,
        cloud: settings.cloud,
        history,
        language: settings.language,
        context: `Camera ${state === "on" ? "on" : "off"}; posture ${snapshot.posture?.label ?? "unavailable"}`,
      });
      setMessages((m) => [...m, { role: "assistant", text: reply.reply, reply }]);
      speak(reply.reply);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: (err as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Talk to Asha" description="Short, friendly answers. Asha can suggest a request, but you always confirm it." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Panel bodyClassName="flex h-[min(68vh,640px)] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                {m.role === "assistant" && <Image src="/assets/assets/images/asha-avatar.png" alt="" width={32} height={32} className="size-8 shrink-0 rounded-full" />}
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-3", m.role === "user" ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-wash text-ink")}>
                  <p>{m.text}</p>
                  {m.reply?.proposal && (
                    <Button size="sm" className="mt-3" onClick={() => propose(m.reply!.proposal!.kind, m.reply!.proposal!.text, "asha")}>
                      Ask caregiver: {m.reply.proposal.text}
                    </Button>
                  )}
                  {m.reply?.suggestedModule && (
                    <Link href={`/dashboard/patient/${m.reply.suggestedModule}`} className="mt-2 block text-sm font-medium text-brand">
                      Open {m.reply.suggestedModule}
                    </Link>
                  )}
                  {m.role === "assistant" && i > 0 && (
                    <button onClick={() => speak(m.text)} className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-ink" aria-label="Speak this reply">
                      <VolumeIcon size={14} /> Speak
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-sm text-muted">Asha is thinking…</p>}
            <div ref={end} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <label htmlFor="chat" className="sr-only">
              Message Asha
            </label>
            <input
              id="chat"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={600}
              placeholder="Type to Asha"
              className="h-12 flex-1 rounded-xl border border-line px-4 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
            />
            <Button type="submit" className="h-12 w-12 px-0" aria-label="Send" disabled={busy}>
              <SendIcon size={18} />
            </Button>
          </form>
        </Panel>
        <Panel title="Privacy">
          <Switch
            checked={settings.cloud}
            onChange={(cloud) => sessionStore.updateSettings({ cloud })}
            label="Cloud assistance"
            description="Your words and capability assessment are sent to Asha’s AI service. Camera video never is."
          />
        </Panel>
      </div>
    </>
  );
}
