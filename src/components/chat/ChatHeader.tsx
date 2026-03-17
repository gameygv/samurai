import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SheetHeader } from '@/components/ui/sheet';
import { Play, Pause, Target, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface ChatHeaderProps {
  lead: any;
  isAiPaused: boolean;
  sending: boolean;
  onSendCommand: (cmd: string) => void;
}

export const ChatHeader = ({ lead, isAiPaused, sending, onSendCommand }: ChatHeaderProps) => {
  const { isManager } = useAuth();
  const initials = (lead?.nombre?.substring(0, 2) || 'CL').toUpperCase();

  const getIntentBadge = (intent: string) => {
     const i = (intent || 'BAJO').toUpperCase();
     if (i === 'COMPRADO') return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase h-5"><Target className="w-2.5 h-2.5 mr-1"/> Ganado</Badge>;
     if (i === 'PERDIDO') return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] uppercase h-5"><Target className="w-2.5 h-2.5 mr-1"/> Perdido</Badge>;
     if (i === 'ALTO') return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] uppercase h-5"><Target className="w-2.5 h-2.5 mr-1"/> Cierre</Badge>;
     if (i === 'MEDIO') return <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] uppercase h-5"><Target className="w-2.5 h-2.5 mr-1"/> Seducción</Badge>;
     return <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[9px] uppercase h-5"><Target className="w-2.5 h-2.5 mr-1"/> Data Hunting</Badge>;
  };

  return (
    <SheetHeader className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-row items-center justify-between gap-4 space-y-0">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-slate-700">
          <AvatarFallback className="bg-indigo-600 text-white font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <div className="text-sm font-bold truncate max-w-[250px] flex items-center gap-2">
            {lead?.nombre || 'Cliente'}
            <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500 h-4 px-1 uppercase hidden sm:inline-flex">
              {lead?.platform || 'WhatsApp'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
             <span className="text-[10px] text-slate-500 font-mono">{lead?.telefono}</span>
             <div className="hidden sm:flex items-center gap-1.5 ml-2">
                {getIntentBadge(lead?.buying_intent)}
                {isManager && lead?.payment_status === 'VALID' && (
                   <Badge className="bg-emerald-900/30 text-emerald-400 border-emerald-500/30 text-[9px] uppercase h-5"><ShieldCheck className="w-2.5 h-2.5 mr-1"/> Pago OK</Badge>
                )}
             </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isAiPaused ? (
          <Button
            size="sm"
            className="h-8 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-500 border border-emerald-500/50 text-[10px] font-bold uppercase tracking-widest rounded-lg"
            onClick={() => onSendCommand('#START')}
            disabled={sending}
          >
            <Play className="w-3 h-3 sm:mr-2" /> <span className="hidden sm:inline">Activar IA</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            className="h-8 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 text-[10px] font-bold uppercase tracking-widest rounded-lg"
            onClick={() => onSendCommand('#STOP')}
            disabled={sending}
          >
            <Pause className="w-3 h-3 sm:mr-2" /> <span className="hidden sm:inline">Pausar IA</span>
          </Button>
        )}
      </div>
    </SheetHeader>
  );
};