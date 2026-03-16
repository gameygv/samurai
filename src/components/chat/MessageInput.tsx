import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Send, ShieldAlert, Paperclip, X, Image as ImageIcon, FileText, MessageCircle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSendMessage: (text: string, file?: File, isInternalNote?: boolean) => void;
  sending: boolean;
  isAiPaused: boolean;
  initialValue?: string;
}

export const MessageInput = ({ onSendMessage, sending, isAiPaused, initialValue = '' }: MessageInputProps) => {
  const [message, setMessage] = useState(initialValue);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'message' | 'note'>('message');
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
      setMode('message'); // Si sube archivo, forzamos modo mensaje WA
    }
  };

  return (
    <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-col gap-2">
      
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
         
         {isAiPaused && mode === 'message' && (
           <div className="text-[9px] text-red-400 flex items-center gap-1 opacity-80 font-bold tracking-widest">
             <ShieldAlert className="w-3 h-3" /> BOT PAUSADO
           </div>
         )}
      </div>

      {file && mode === 'message' && (
        <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-2 rounded-lg animate-in fade-in">
          <div className="flex items-center gap-2 overflow-hidden">
            {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" /> : <FileText className="w-4 h-4 text-amber-500 shrink-0" />}
            <span className="text-xs text-slate-300 truncate">{file.name}</span>
            <span className="text-[10px] text-slate-500 shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-red-400" onClick={() => setFile(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
          accept="image/*,video/*,application/pdf,.doc,.docx"
        />
        
        {mode === 'message' && (
           <Button 
             type="button" 
             variant="ghost" 
             size="icon" 
             className="shrink-0 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl"
             onClick={() => fileInputRef.current?.click()}
             disabled={sending}
           >
             <Paperclip className="w-5 h-5" />
           </Button>
        )}
        
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={cn(
             "h-11 rounded-xl focus-visible:ring-1 text-sm transition-colors",
             mode === 'note' 
               ? "bg-amber-950/20 border-amber-900/50 text-amber-100 placeholder:text-amber-700/50 focus-visible:ring-amber-500" 
               : "bg-slate-950 border-slate-700 text-slate-100 focus-visible:ring-indigo-500"
          )}
          placeholder={
             mode === 'note' 
               ? "Escribe un apunte interno (el cliente no lo verá)..." 
               : (file ? "Añade un comentario al archivo (opcional)..." : "Escribe un mensaje de WhatsApp...")
          }
          disabled={sending}
        />
        
        <Button 
           type="submit" 
           size="icon" 
           className={cn(
              "shrink-0 h-11 w-11 rounded-xl shadow-lg transition-colors",
              mode === 'note' ? "bg-amber-600 hover:bg-amber-700 text-slate-900" : "bg-indigo-600 hover:bg-indigo-700 text-white"
           )} 
           disabled={sending || (!message.trim() && !file)}
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'note' ? <Lock className="w-5 h-5" /> : <Send className="w-5 h-5" />)}
        </Button>
      </form>
    </div>
  );
};