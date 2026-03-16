import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, StickyNote, FileText } from 'lucide-react';
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

        {text && <p className="whitespace-pre-wrap text-sm leading-relaxed break-words">{text}</p>}
      </div>
    );
  };

  return (
    <ScrollArea className="flex-1 p-6 bg-[#0a0a0c]">
      {loading ? (
        <div className="flex h-full items-center justify-center text-slate-500 text-xs gap-2">
           <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Sincronizando...
        </div>
      ) : messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-center text-slate-600 flex-col gap-2">
           <p className="text-xs uppercase tracking-widest font-bold">Sin mensajes aún</p>
        </div>
      ) : (
        <div className="space-y-6 pb-4">
          {messages.map((msg) => {
             const emisor = (msg.emisor || '').toUpperCase();
             const isClient = emisor === 'CLIENTE';
             const isNote = emisor === 'NOTA';
             const isError = msg.platform === 'ERROR';
             const isHuman = emisor === 'HUMANO';
             
             // Si no es cliente, ni nota, ni error, ni humano -> Asumimos que es el BOT (IA)
             // Esto previene el error si WhatsApp envía el nombre de la empresa como emisor.
             const isAI = !isClient && !isNote && !isError && !isHuman;

             if (isNote) {
               return (
                 <div key={msg.id} className="flex justify-center my-4 animate-in fade-in duration-300">
                   <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-900 text-amber-400 text-xs px-4 py-2 rounded-xl max-w-[80%] shadow-sm">
                     <StickyNote className="w-4 h-4 shrink-0" />
                     <span className="italic font-medium">{msg.mensaje}</span>
                   </div>
                 </div>
               );
             }

             const align = isClient ? 'justify-start' : 'justify-end';
             
             return (
              <div key={msg.id} className={cn("flex w-full animate-in fade-in duration-300", align)}>
                <div className={cn("max-w-[85%] flex flex-col", isClient ? "items-start" : "items-end")}>
                   <div className={cn(
                      "p-4 rounded-3xl border shadow-md",
                      isClient ? "bg-slate-900 border-slate-700 text-slate-100 rounded-bl-sm" : 
                      isAI ? "bg-indigo-950/40 border-indigo-900/60 text-indigo-50 rounded-br-sm" : 
                      "bg-emerald-950/40 border-emerald-900/60 text-emerald-50 rounded-br-sm"
                   )}>
                      {renderMessageContent(msg)}
                   </div>
                   <div className="flex items-center gap-1.5 mt-2 px-2">
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">
                         {isClient ? 'CLIENTE' : isAI ? 'SAMURAI AI' : 'VENDEDOR'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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