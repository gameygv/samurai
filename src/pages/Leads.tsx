import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Target, UserPlus } from 'lucide-react';
import { LeadRow } from '@/components/leads/LeadRow';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import ChatViewer from '@/components/ChatViewer';

const Leads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('last_message_at', { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  };

  const filtered = leads.filter(l => 
    l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.telefono?.includes(searchTerm)
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              Radar Leads <Target className="w-6 h-6 text-amber-500 animate-pulse" />
            </h1>
            <p className="text-slate-500 text-sm">Monitoreo de inteligencia en tiempo real.</p>
          </div>
          <div className="flex gap-4">
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
              <Input placeholder="Buscar por nombre..." className="pl-10 glass-panel h-10 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => setIsCreateOpen(true)} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 p-2.5 rounded-xl shadow-glow transition-all">
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <Card className="glass-panel overflow-hidden rounded-2xl">
          <Table>
            <TableHeader className="bg-slate-950/60">
              <TableRow className="border-slate-800">
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 pl-6">Prospecto</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Datos CAPI</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">IA Score</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Intención</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-right pr-6">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-40 text-center"><Loader2 className="animate-spin inline-block text-indigo-500" /></TableCell></TableRow>
              ) : filtered.map(lead => (
                <LeadRow key={lead.id} lead={lead} onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }} />
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchLeads} />
      {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
    </Layout>
  );
};

export default Leads;