import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SheetHeader } from '@/components/ui/sheet';
import { Play, Pause } from 'lucide-react';

interface ChatHeaderProps {
  lead: any;
  isAiPaused: boolean;
  sending: boolean;
  onSendCommand: (cmd: string) => void;
}

export const ChatHeader = ({ lead, isAiPaused, sending, onSendCommand }: ChatHeaderProps) => {
  return (
    <SheetHeader className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-row items-center justify-between gap-4 space-y-0">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-slate-700">
          <AvatarFallback className="bg-indigo-600 text-white font-bold">
            {lead?.nombre?.substring(0, 2).toUpperCase() || 'CL'}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-bold truncate max-w-[200px] flex items-center gap-2">
            {lead?.nombre || 'Cliente'}
            <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500 h-4 px-1">
              {lead?.platform || 'WhatsApp'}
            </Badge>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">{lead?.telefono}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isAiPaused ? (
          <Button
            size="sm"
            className="h-7 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold"
            onClick={() => onSendCommand('#START')}
            disabled={sending}
          >
            <Play className="w-3 h-3 mr-1" /> #START
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-[10px] font-bold"
            onClick={() => onSendCommand('#STOP')}
            disabled={sending}
          >
            <Pause className="w-3 h-3 mr-1" /> #STOP
          </Button>
        )}
      </div>
    </SheetHeader>
  );
};