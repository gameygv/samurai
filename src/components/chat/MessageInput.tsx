import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send, ShieldAlert, Paperclip, X, Image as ImageIcon, FileText } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string, file?: File) => void;
  sending: boolean;
  isAiPaused: boolean;
  initialValue?: string;
}

export const MessageInput = ({ onSendMessage, sending, isAiPaused, initialValue = '' }: MessageInputProps) => {
  const [message, setMessage] = useState(initialValue);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessage(initialValue);
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !file) return;
    onSendMessage(message, file || undefined);
    setMessage('');
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-col gap-2">
      {file && (
        <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-2 rounded-lg">
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
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          className="shrink-0 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
        >
          <Paperclip className="w-5 h-5" />
        </Button>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="bg-slate-950 border-slate-700 text-sm h-10 focus-visible:ring-indigo-500"
          placeholder={file ? "Añade un comentario (opcional)..." : "Escribe un mensaje..."}
          disabled={sending}
        />
        <Button type="submit" size="icon" className="bg-indigo-600 hover:bg-indigo-700 shrink-0" disabled={sending || (!message.trim() && !file)}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
      {isAiPaused && (
        <div className="mt-1 text-[10px] text-red-400 flex items-center justify-center gap-1 opacity-80 font-bold tracking-widest">
          <ShieldAlert className="w-3 h-3" /> IA DETENIDA (#STOP)
        </div>
      )}
    </div>
  );
};