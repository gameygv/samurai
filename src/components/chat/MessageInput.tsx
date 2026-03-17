import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Send, ShieldAlert, Paperclip, X, Image as ImageIcon, FileText, MessageCircle, Lock, Sparkles, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MessageInputProps {
  onSendMessage: (text: string, file?: File, isInternalNote?: boolean) => void;
  sending: boolean;
  isAiPaused: boolean;
  initialValue?: string;
  onAutoGenerate?: () => Promise<string | null>;
  toolbarAction?: React.ReactNode;
}

export const MessageInput = ({ onSendMessage, sending, isAiPaused, initialValue = '', onAutoGenerate, toolbarAction }: MessageInputProps) => {
  const [message, setMessage] = useState(initialValue);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'message' | 'note'>('message');
  const [generating, setGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessage(initialValue);
    if (initialValue) setMode('message');
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !file) return;
    onSendMessage(message, file || undefined, mode === 'note');
    setMessage('');
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setMode('message'); 
    }
  };

  const handleGenerateAI = async () => {
     if (!onAutoGenerate) return;
     setGenerating(true);
     try {
         const draft = await onAutoGenerate();
         if (draft) setMessage(draft);
     } catch(e: any) {
         toast.error("Fallo al generar sugerencia.");
     } finally {
         setGenerating(false);
     }
  };

  return (
    <div 
      className="relative flex flex-col gap-2 w-full mt-2"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => {
         e.preventDefault();
         setIsDragging(false);
         if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
            setMode('message');
         }
      }}
    >
      {isDragging && (
         <div className="absolute -inset-4 z-50 bg-indigo-900/80 border-2 border-dashed border-indigo-400 rounded-xl flex flex-col items-center justify-center backdrop-blur-sm shadow-2xl animate-in fade-in">
            <UploadCloud className="w-12 h-12 text-indigo-300 mb-2 animate-bounce" />
            <p className="text-white font-bold text-sm tracking-widest uppercase pointer-events-none">Suelta para Adjuntar al Chat</p>
         </div>
      )}

      <div className="flex items-center justify-between">
         <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="w-auto">
            <TabsList className="bg-slate-950 border border-slate-800 h-8 rounded-lg">
               <TabsTrigger value="message" className="text-[10px] uppercase font-bold tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                  <MessageCircle className="w-3 h-3 mr-1.5"/> WhatsApp
               </TabsTrigger>
               <TabsTrigger value="note" className="text-[10px] uppercase font-bold tracking-widest data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500">
                  <Lock className="w-3 h-3 mr-1.5"/> Nota Interna
               </TabsTrigger>
            </TabsList>
         </Tabs>
         
         <div className="flex items-center gap-3">
             {toolbarAction}
             {isAiPaused && mode === 'message' && (
               <div className="text-[9px] text-red-400 flex items-center gap-1 opacity-80 font-bold tracking-widest bg-red-900/10 px-2 py-1 rounded-md border border-red-500/20">
                 <ShieldAlert className="w-3 h-3" /> BOT PAUSADO
               </div>
             )}
         </div>
      </div>

      {file && mode === 'message' && (
        <div className="flex items-center justify-between bg-indigo-950/40 border border-indigo-500/30 p-2.5 rounded-xl animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3 overflow-hidden">
            {file.type.startsWith('image/') ? <ImageIcon className="w-5 h-5 text-indigo-400 shrink-0" /> : <FileText className="w-5 h-5 text-amber-500 shrink-0" />}
            <span className="text-xs font-bold text-indigo-100 truncate">{file.name}</span>
            <span className="text-[10px] font-mono text-indigo-300/60 shrink-0 bg-black/20 px-2 py-0.5 rounded">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-indigo-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg" onClick={() => setFile(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-center relative z-10">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,video/*,application/pdf,.doc,.docx" />
        
        {mode === 'message' && (
           <Button type="button" variant="ghost" size="icon" className="shrink-0 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={sending}>
             <Paperclip className="w-5 h-5" />
           </Button>
        )}
        
        <div className="relative flex-1">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={cn(
                 "h-12 rounded-xl focus-visible:ring-1 text-sm transition-colors pr-10 shadow-inner",
                 mode === 'note' 
                   ? "bg-amber-950/20 border-amber-900/50 text-amber-100 placeholder:text-amber-700/50 focus-visible:ring-amber-500" 
                   : "bg-slate-950 border-slate-800 text-slate-100 focus-visible:ring-indigo-500"
              )}
              placeholder={mode === 'note' ? "Escribe un apunte interno..." : (file ? "Añade un comentario a tu archivo..." : "Escribe o arrastra una imagen aquí...")}
              disabled={sending || generating}
            />
            {onAutoGenerate && mode === 'message' && (
                <Button 
                    type="button" variant="ghost" size="icon" 
                    onClick={handleGenerateAI} disabled={generating || sending}
                    className="absolute right-1.5 top-1.5 h-9 w-9 text-amber-500 hover:bg-amber-500/20 rounded-lg"
                    title="Autocompletar con IA"
                >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </Button>
            )}
        </div>
        
        <Button type="submit" size="icon" className={cn("shrink-0 h-12 w-12 rounded-xl shadow-lg transition-all active:scale-95", mode === 'note' ? "bg-amber-600 hover:bg-amber-700 text-slate-900" : "bg-indigo-600 hover:bg-indigo-700 text-white")} disabled={sending || (!message.trim() && !file) || generating}>
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'note' ? <Lock className="w-5 h-5" /> : <Send className="w-5 h-5 ml-0.5" />)}
        </Button>
      </form>
    </div>
  );
};