import DashboardLayout from "@/components/DashboardLayout";
import { AIChatBox, type Message as ChatMessage } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BookOpenText, ChevronRight, CircleHelp, Clock3, FileText, FolderOpen, Loader2, MessageSquareText, Plus, Quote, Search, ShieldCheck, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PAGE_META = {
  "/documents": { eyebrow: "Knowledge library", title: "Your source material, made searchable.", description: "Upload text-based PDFs or TXT files. Each document is securely stored and segmented into passages for grounded retrieval." },
  "/ask": { eyebrow: "Grounded Q&A", title: "Ask with context. Verify with sources.", description: "DocAI retrieves relevant passages before generating an answer, so you can inspect the evidence behind it." },
  "/history": { eyebrow: "Conversation history", title: "Return to any line of inquiry.", description: "Every question, answer, and its source excerpts are kept in your private workspace." },
  "/about": { eyebrow: "About DocAI", title: "A deliberate way to work with documents.", description: "A secure document intelligence workspace built around retrieval, provenance, and clear answers." },
} as const;

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  return <DashboardLayout><Workspace /></DashboardLayout>;
}

function Workspace() {
  const [location, setLocation] = useLocation();
  const path = location in PAGE_META ? location as keyof typeof PAGE_META : "/documents";
  const meta = PAGE_META[path];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const documentsQuery = trpc.documents.list.useQuery();
  const conversationsQuery = trpc.chat.conversations.useQuery();
  const conversationQuery = trpc.chat.conversation.useQuery({ conversationId: activeConversationId ?? "unselected" }, { enabled: Boolean(activeConversationId) });
  const upload = trpc.documents.upload.useMutation({
    onSuccess: () => { toast.success("Document indexed and ready to ask about."); utils.documents.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const removeDocument = trpc.documents.delete.useMutation({
    onSuccess: () => { toast.success("Document removed from this workspace."); setSelectedDocumentId(null); utils.documents.list.invalidate(); utils.chat.conversations.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const ask = trpc.chat.ask.useMutation({
    onSuccess: result => { setActiveConversationId(result.conversationId); utils.chat.conversations.invalidate(); utils.chat.conversation.invalidate({ conversationId: result.conversationId }); },
    onError: error => toast.error(error.message),
  });

  const documents = documentsQuery.data ?? [];
  const messages = (conversationQuery.data?.messages ?? []) as ChatMessage[];
  const readyDocuments = documents.filter(document => document.status === "ready");
  const totalChunks = documents.reduce((sum, document) => sum + document.chunkCount, 0);

  useEffect(() => {
    if (location === "/") setLocation("/documents");
  }, [location, setLocation]);

  const suggestedPrompts = useMemo(() => ["What are the main conclusions?", "Summarize the key decisions.", "Which risks are mentioned?"], []);

  const beginUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(pdf|txt)$/i.test(file.name)) { toast.error("Please choose a PDF or TXT file."); return; }
    if (file.size > 7 * 1024 * 1024) { toast.error("Files must be smaller than 7 MB."); return; }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("This file could not be read."));
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.readAsDataURL(file);
    }).catch(error => { toast.error(error instanceof Error ? error.message : "File read failed."); return ""; });
    if (base64) upload.mutate({ fileName: file.name, base64 });
  };

  const sendQuestion = (question: string) => {
    ask.mutate({ question, conversationId: activeConversationId ?? undefined, documentId: selectedDocumentId ?? undefined });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="enter-up mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mono mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-indigo-600">{meta.eyebrow}</p>
          <h1 className="serif-display text-4xl leading-[1.05] tracking-[-0.03em] text-[#1c2947] sm:text-5xl">{meta.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">{meta.description}</p>
        </div>
        {path === "/documents" && <Button onClick={() => fileInputRef.current?.click()} disabled={upload.isPending} className="pressable h-11 rounded-xl bg-[#263866] px-4 font-bold hover:bg-[#344a83]">{upload.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}Add document</Button>}
      </div>
      <input ref={fileInputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={beginUpload} className="hidden" />
      {path === "/documents" && <DocumentsView documents={documents} totalChunks={totalChunks} loading={documentsQuery.isLoading} uploading={upload.isPending} onUpload={() => fileInputRef.current?.click()} onDelete={documentId => removeDocument.mutate({ documentId })} deletingId={removeDocument.variables?.documentId} />}
      {path === "/ask" && <AskView documents={readyDocuments} selectedDocumentId={selectedDocumentId} setSelectedDocumentId={setSelectedDocumentId} messages={messages} conversationMessages={conversationQuery.data?.messages ?? []} onAsk={sendQuestion} isAsking={ask.isPending} onNewConversation={() => setActiveConversationId(null)} suggestedPrompts={suggestedPrompts} />}
      {path === "/history" && <HistoryView conversations={conversationsQuery.data ?? []} loading={conversationsQuery.isLoading} activeConversationId={activeConversationId} onOpen={conversationId => { setActiveConversationId(conversationId); setLocation("/ask"); }} />}
      {path === "/about" && <AboutView />}
    </div>
  );
}

function DocumentsView({ documents, totalChunks, loading, uploading, onUpload, onDelete, deletingId }: { documents: Array<{ id: string; title: string; originalName: string; fileType: "pdf" | "txt"; fileSize: number; chunkCount: number; createdAt: Date; status: "processing" | "ready" | "failed" }>; totalChunks: number; loading: boolean; uploading: boolean; onUpload: () => void; onDelete: (documentId: string) => void; deletingId?: string }) {
  return <div className="enter-up-delay space-y-6">
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Indexed documents" value={String(documents.length)} icon={FolderOpen} />
      <StatCard label="Searchable passages" value={String(totalChunks)} icon={Search} />
      <StatCard label="Workspace access" value="Private" icon={ShieldCheck} />
    </div>
    <div className="glass-panel overflow-hidden rounded-[1.5rem] border border-white/85">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div><h2 className="font-extrabold tracking-[-0.025em] text-[#273553]">Document library</h2><p className="mt-1 text-xs text-slate-500">PDF and TXT files are securely stored, then segmented for retrieval.</p></div><button onClick={onUpload} disabled={uploading} className="pressable inline-flex items-center gap-2 self-start rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"><UploadCloud className="size-3.5" />{uploading ? "Indexing document…" : "Upload file"}</button></div>
      {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="size-5 animate-spin text-indigo-500" /></div> : documents.length === 0 ? <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><FileText className="size-6" /></div><h3 className="mt-5 text-sm font-extrabold text-[#2b3855]">Begin with a source document</h3><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">Upload a text-based PDF or TXT file to create a private, searchable knowledge base.</p><Button onClick={onUpload} className="pressable mt-6 rounded-xl bg-[#263866] text-xs font-bold hover:bg-[#344a83]"><Plus className="mr-1.5 size-3.5" />Upload document</Button></div> : <div className="divide-y divide-slate-100">{documents.map(document => <div key={document.id} className="group flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-indigo-50/35 sm:flex-row sm:items-center sm:px-7"><div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", document.fileType === "pdf" ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-600")}><FileText className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-[#273553]">{document.title}</p><span className="mono rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-500">{document.fileType}</span>{document.status === "ready" && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600"><span className="size-1.5 rounded-full bg-emerald-500" />Indexed</span>}</div><p className="mt-1.5 text-xs text-slate-500">{formatDate(document.createdAt)} · {formatSize(document.fileSize)} · {document.chunkCount} passages</p></div><button onClick={() => onDelete(document.id)} disabled={deletingId === document.id} className="pressable inline-flex items-center gap-1.5 self-start rounded-lg px-2.5 py-2 text-xs font-bold text-slate-400 opacity-100 hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-50"><Trash2 className="size-3.5" />{deletingId === document.id ? "Removing" : "Remove"}</button></div>)}</div>}
    </div>
  </div>;
}

function AskView({ documents, selectedDocumentId, setSelectedDocumentId, messages, conversationMessages, onAsk, isAsking, onNewConversation, suggestedPrompts }: { documents: Array<{ id: string; title: string }>; selectedDocumentId: string | null; setSelectedDocumentId: (value: string | null) => void; messages: ChatMessage[]; conversationMessages: Array<{ role: "user" | "assistant"; content: string; citations: Array<{ id: string; documentName: string; excerpt: string }> }>; onAsk: (question: string) => void; isAsking: boolean; onNewConversation: () => void; suggestedPrompts: string[] }) {
  if (!documents.length) return <div className="enter-up glass-panel flex min-h-[440px] flex-col items-center justify-center rounded-[1.5rem] border border-white/85 p-8 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><FolderOpen className="size-6" /></div><h2 className="mt-5 text-lg font-extrabold text-[#273553]">A source is needed first</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Add a text-based PDF or TXT file in Documents before asking questions. Answers are grounded in your private source material.</p></div>;
  return <div className="enter-up space-y-5"><div className="glass-panel flex flex-col gap-3 rounded-[1.3rem] border border-white/85 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Search className="size-4" /></div><div><p className="text-xs font-extrabold text-[#273553]">Retrieval scope</p><p className="mt-0.5 text-[11px] text-slate-500">Choose one document or search your full library.</p></div></div><div className="flex items-center gap-2"><Select value={selectedDocumentId ?? "all"} onValueChange={value => setSelectedDocumentId(value === "all" ? null : value)}><SelectTrigger className="h-9 w-full min-w-52 rounded-xl border-slate-200 bg-white text-xs font-semibold shadow-none sm:w-60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All indexed documents</SelectItem>{documents.map(document => <SelectItem key={document.id} value={document.id}>{document.title}</SelectItem>)}</SelectContent></Select><button onClick={onNewConversation} className="pressable hidden rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 sm:inline-flex">New chat</button></div></div>
    <AIChatBox messages={messages} onSendMessage={onAsk} isLoading={isAsking} suggestedPrompts={suggestedPrompts} emptyStateMessage="What would you like to know?" renderAssistantFooter={(message, index) => { if (message.role !== "assistant") return null; const citations = conversationMessages[index]?.citations ?? []; if (!citations.length) return null; return <div className="mt-4 border-t border-indigo-50 pt-3"><p className="mono mb-2 text-[9px] font-medium uppercase tracking-[0.16em] text-indigo-500">Source excerpts</p><div className="space-y-2">{citations.map(citation => <div key={citation.id} className="rounded-xl bg-indigo-50/70 p-2.5"><p className="flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-700"><Quote className="size-3" />{citation.documentName}</p><p className="mt-1 line-clamp-3 text-[11px] leading-4 text-slate-600">{citation.excerpt}</p></div>)}</div></div>; }} />
  </div>;
}

function HistoryView({ conversations, loading, activeConversationId, onOpen }: { conversations: Array<{ id: string; title: string; documentTitle: string | null; updatedAt: Date }>; loading: boolean; activeConversationId: string | null; onOpen: (id: string) => void }) {
  return <div className="enter-up glass-panel overflow-hidden rounded-[1.5rem] border border-white/85">{loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="size-5 animate-spin text-indigo-500" /></div> : conversations.length === 0 ? <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><MessageSquareText className="size-6" /></div><h2 className="mt-5 text-base font-extrabold text-[#273553]">No conversations yet</h2><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">Questions and cited answers will appear here once you begin asking about your documents.</p></div> : <div className="divide-y divide-slate-100">{conversations.map((conversation, index) => <button key={conversation.id} onClick={() => onOpen(conversation.id)} className={cn("group flex w-full items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-indigo-50/45 sm:px-7", activeConversationId === conversation.id && "bg-indigo-50/70")}><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><MessageSquareText className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#2a3856]">{conversation.title}</p><p className="mt-1 text-xs text-slate-500">{conversation.documentTitle ?? "Full knowledge base"} · {formatDate(conversation.updatedAt)}</p></div><ChevronRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" /></button>)}</div>}</div>;
}

function AboutView() {
  const pillars = [{ icon: ShieldCheck, title: "Private by design", text: "Documents, conversations, and source records are scoped to your signed-in workspace." }, { icon: Search, title: "Grounded retrieval", text: "Relevant document passages are identified before an answer is generated." }, { icon: Quote, title: "Visible provenance", text: "Each answer includes the precise document excerpts used as evidence." }];
  return <div className="enter-up grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="glass-panel overflow-hidden rounded-[1.6rem] border border-white/85 p-7 sm:p-10"><div className="flex size-11 items-center justify-center rounded-2xl bg-[#263866] text-white shadow-md shadow-indigo-900/15"><BookOpenText className="size-5" /></div><p className="mono mt-8 text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-600">The DocAI approach</p><h2 className="serif-display mt-4 max-w-xl text-4xl leading-[1.06] text-[#1d2b49]">Less searching. More certainty about what your documents actually say.</h2><p className="mt-6 max-w-xl text-sm leading-7 text-slate-600">DocAI transforms uploaded source material into structured passages, retrieves the most relevant evidence for a question, and generates a concise response constrained to that evidence. The result is a more transparent starting point for reviewing complex documents.</p><div className="mt-9 flex items-center gap-2 text-xs font-bold text-indigo-700"><Sparkles className="size-4" />Designed for careful, source-aware thinking.</div></div><div className="space-y-4">{pillars.map((pillar, index) => <div key={pillar.title} className="glass-panel rounded-[1.35rem] border border-white/85 p-5"><div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><pillar.icon className="size-4" /></div><div><p className="text-sm font-extrabold text-[#283654]">0{index + 1} · {pillar.title}</p><p className="mt-1.5 text-xs leading-5 text-slate-500">{pillar.text}</p></div></div></div>)}</div></div>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FolderOpen }) { return <div className="glass-panel rounded-[1.25rem] border border-white/85 p-5"><div className="flex items-start justify-between"><p className="mono text-[9px] font-medium uppercase tracking-[0.15em] text-slate-500">{label}</p><div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Icon className="size-3.5" /></div></div><p className="mt-5 text-2xl font-extrabold tracking-[-0.05em] text-[#263553]">{value}</p></div>; }
