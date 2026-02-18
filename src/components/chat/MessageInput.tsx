import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send, ShieldAlert } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  sending: boolean;
  isAiPaused: boolean;
}

export const MessageInput = ({ onSendMessage, sending, isAiPaused }: MessageInputProps) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage('');
  };

  return (
    <div className="p-3 bg-slate-900 border-t border-slate-800">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="bg-slate-950 border-slate-700 text-sm h-10 focus-visible:ring-indigo-500"
          placeholder="Escribe un mensaje..."
          disabled={sending}
        />
        <Button type="submit" size="icon" className="bg-indigo-600 hover:bg-indigo-700 shrink-0" disabled={sending || !message.trim()}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
      {isAiPaused && (
        <div className="mt-2 text-[10px] text-red-400 flex items-center justify-center gap-1 opacity-80">
          <ShieldAlert className="w-3 h-3" /> IA DETENIDA (#STOP)
        </div>
      )}
    </div>
  );
};