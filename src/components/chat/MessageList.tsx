import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, User, MessageCircle, AlertCircle, StickyNote, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: any[];
  loading: boolean;
}

export const MessageList = ({ messages, loading }: MessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderMessageContent = (msg: any) => {
    let text = msg.mensaje || '';
    let imageUrl = null;
    let docUrl = null;
    let docName = null;

    const imgMatch = text.match(/\[IMG:\s*(.+?)\]/i);
    if (imgMatch) {
      imageUrl = imgMatch[1];
      text = text.replace(imgMatch[0], '').trim();
    } 
    else if (msg.metadata?.mediaUrl) {
      if (msg.metadata.mediaType === 'image') {
        imageUrl = msg.metadata.mediaUrl;
      } else {
        docUrl = msg.metadata.mediaUrl;
        docName = msg.metadata.fileName || 'Documento adjunto';
      }
      text = text.replace(/\[ARCHIVO:\s*.*?\]/i, '').trim();
    }

    return (
      <div className="flex flex-col gap-2">
        {imageUrl && (
          <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
            <img 
              src={imageUrl} 
              alt="Imagen adjunta" 
              className="w-full max-w-[240px] sm:max-w-[300px] h-auto max-h-64 object-cover rounded-lg border border-white/10 hover:opacity-80 transition-opacity" 
              loading="lazy"
            />
          </a>
        )}
        
        {docUrl && (
          <a href={docUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 bg-slate-950/30 rounded-lg border border-white/10 hover:bg-slate-950/60 transition-colors">
            <FileText className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="text-xs truncate font-medium underline underline-offset-2">{docName}</span>
          </a>
        )}

        {text && <p className="whitespace-pre-wrap leading-relaxed break-words">{text}</p>}
      </div>
    );
  };

  return (
    <ScrollArea className="flex-1 p-4 bg-slate-950">
      {loading ? (
        <div className="flex h-full items-center justify-center text-slate-500 text-xs gap-2">
           <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Sincronizando...
        </div>
      ) : messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-center text-slate-600 flex-col gap-2">
           <MessageCircle className="w-10 h-10 opacity-20" />
           <p className="text-xs uppercase tracking-widest font-bold">Sin mensajes aún</p>
        </div>
      ) : (
        <div className="space-y-6 pb-4">
          {messages.map((msg) => {
             const emisor = (msg.emisor || '').toUpperCase();
             const isClient = emisor === 'CLIENTE';
             const isAI = emisor === 'IA' || emisor === 'SAMURAI';
             const isHuman = emisor === 'HUMANO';
             const isNote = emisor === 'NOTA';
             const isError = msg.platform === 'ERROR';

             if (isNote) {
               return (
                 <div key={msg.id} className="flex justify-center animate-in fade-in duration-300">
                   <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-500/20 text-amber-400 text-[10px] px-3 py-1.5 rounded-full max-w-[80%] shadow-sm">
                     <StickyNote className="w-3 h-3 shrink-0" />
                     <span className="italic">{msg.mensaje}</span>
                   </div>
                 </div>
               );
             }

             if (isError) {
               return (
                 <div key={msg.id} className="flex justify-center animate-in fade-in duration-300">
                   <div className="flex items-start gap-2 bg-red-900/20 border border-red-500/30 text-red-400 text-[10px] px-3 py-2 rounded-lg max-w-[90%] shadow-sm">
                     <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                     <span className="font-mono leading-relaxed">{msg.mensaje}</span>
                   </div>
                 </div>
               );
             }

             const align = isClient ? 'justify-start' : 'justify-end';
             
             return (
              <div key={msg.id} className={cn("flex w-full animate-in fade-in duration-300", align)}>
                <div className={cn("max-w-[85%] flex flex-col", isClient ? "items-start" : "items-end")}>
                   <div className={cn(
                      "p-3.5 rounded-2xl text-sm border shadow-md",
                      isClient ? "bg-slate-800 border-slate-700 text-slate-100 rounded-bl-none" : 
                      isAI ? "bg-indigo-900/80 border-indigo-500/50 text-indigo-50 rounded-br-none" : 
                      "bg-emerald-900/80 border-emerald-500/50 text-emerald-50 rounded-br-none"
                   )}>
                      {renderMessageContent(msg)}
                   </div>
                   <div className="flex items-center gap-1.5 mt-1.5 px-1 opacity-70">
                      {isAI && <Bot className="w-3 h-3 text-indigo-400" />}
                      {isHuman && <User className="w-3 h-3 text-emerald-400" />}
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                         {isAI ? 'Samurai AI' : isHuman ? 'Vendedor' : 'Cliente'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                   </div>
                </div>
              </div>
          )})}
          <div ref={scrollRef} />
        </div>
      )}
    </ScrollArea>
  );
};