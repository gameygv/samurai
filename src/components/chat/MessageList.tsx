import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, StickyNote, FileText, Mic } from 'lucide-react';
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

  const formatMessageTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return ''; 
      
      const today = new Date();
      const isToday = date.getDate() === today.getDate() && 
                      date.getMonth() === today.getMonth() && 
                      date.getFullYear() === today.getFullYear();
      
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return timeStr;
      return `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${timeStr}`;
    } catch (e) {
      return '';
    }
  };

  const renderMessageContent = (msg: any) => {
    let text = msg.mensaje || '';
    let imageUrl = null;
    let docUrl = null;
    let audioUrl = null;
    let docName = null;

    text = text.replace(/\[(Imagen|Video|Audio|Documento|Sticker)\]/gi, '').trim();

    if (msg.metadata?.mediaUrl) {
      if (msg.metadata.mediaType === 'image' || msg.metadata.mediaType === 'sticker') {
        imageUrl = msg.metadata.mediaUrl;
      } else if (msg.metadata.mediaType === 'audio') {
        audioUrl = msg.metadata.mediaUrl;
      } else {
        docUrl = msg.metadata.mediaUrl;
        docName = msg.metadata.fileName || 'Archivo adjunto';
      }
    }

    let isTranscription = false;
    let cleanText = text;
    if (text.includes('[TRANSCRIPCIÓN DE NOTA DE VOZ]:')) {
       isTranscription = true;
       cleanText = text.replace('[TRANSCRIPCIÓN DE NOTA DE VOZ]:', '').trim();
       if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
          cleanText = cleanText.substring(1, cleanText.length - 1);
       }
    }

    return (
      <div className="flex flex-col gap-2">
        {imageUrl && (
          <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
            <img src={imageUrl} alt="Adjunto" className="w-full max-w-[280px] h-auto max-h-80 object-contain rounded-lg border border-white/10" loading="lazy" />
          </a>
        )}
        
        {audioUrl && (
          <audio controls className="h-10 w-full max-w-[250px] rounded-md outline-none">
            <source src={audioUrl} type="audio/ogg" />
            <source src={audioUrl} type="audio/mpeg" />
            Tu navegador no soporta el elemento de audio.
          </audio>
        )}

        {docUrl && !audioUrl && (
          <a href={docUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-slate-950/40 rounded-xl border border-white/10">
            <FileText className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="text-xs truncate underline">{docName}</span>
          </a>
        )}

        {isTranscription && cleanText && (
           <div className="mt-1 p-2.5 bg-indigo-950/30 border border-indigo-500/30 rounded-lg text-indigo-200">
              <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1 mb-1">
                 <Mic className="w-3 h-3" /> Transcripción IA
              </p>
              <p className="text-xs italic leading-relaxed">"{cleanText}"</p>
           </div>
        )}

        {!isTranscription && text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>}
      </div>
    );
  };

  return (
    <ScrollArea className="flex-1 w-full h-full p-6 bg-[#0a0a0c]">
      {loading ? (
        <div className="flex h-full items-center justify-center text-slate-500 text-xs gap-2">
           <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Sincronizando...
        </div>
      ) : messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-slate-600 text-xs uppercase font-bold tracking-widest">Sin mensajes</div>
      ) : (
        <div className="space-y-6 pb-4">
          {messages.map((msg) => {
             const emisor = (msg.emisor || '').toUpperCase();
             const isClient = emisor === 'CLIENTE';
             const isNote = emisor === 'NOTA';
             const isHuman = emisor === 'HUMANO';
             const isAI = !isClient && !isNote && !isHuman;

             if (isNote) {
               return (
                 <div key={msg.id} className="flex justify-center my-4 animate-in fade-in">
                   <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-900/50 text-amber-400 text-[11px] px-4 py-2 rounded-xl italic">
                     <StickyNote className="w-3.5 h-3.5" /> {msg.mensaje}
                   </div>
                 </div>
               );
             }

             return (
              <div key={msg.id} className={cn("flex w-full animate-in fade-in", isClient ? "justify-start" : "justify-end")}>
                <div className={cn("max-w-[85%] flex flex-col", isClient ? "items-start" : "items-end")}>
                   <div className={cn(
                      "p-4 rounded-3xl border shadow-lg",
                      isClient ? "bg-[#161618] border-[#222225] text-slate-100 rounded-bl-sm" : 
                      isAI ? "bg-indigo-900/30 border-indigo-500/30 text-indigo-100 rounded-br-sm" : 
                      "bg-emerald-900/30 border-emerald-500/30 text-emerald-100 rounded-br-sm"
                   )}>
                      {renderMessageContent(msg)}
                   </div>
                   <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mt-2 px-2">
                      {isClient ? 'CLIENTE' : isAI ? 'SAMURAI AI' : 'VENDEDOR'} • {formatMessageTime(msg.created_at)}
                   </span>
                </div>
              </div>
          )})}
          <div ref={scrollRef} />
        </div>
      )}
    </ScrollArea>
  );
};