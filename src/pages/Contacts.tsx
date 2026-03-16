import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Contact, Search, Loader2, MapPin, Mail, ShieldCheck, 
  AlertTriangle, Phone, ExternalLink, UserPlus, CreditCard, Tag
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const Contacts = () => {
  const { user, isAdmin } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    fetchContacts();
    supabase.from('profiles').select('id, full_name').then(({data}) => {
       if (data) {
          const map: any = {};
          data.forEach(d => map[d.id] = d.full_name);
          setAgentsMap(map);
       }
    });

    const channel = supabase.channel('contacts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchContacts())
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!isAdmin) {
       query = query.eq('assigned_to', user?.id);
    }
    const { data, error } = await query;
    if (error) {
        toast.error("Error cargando contactos");
    } else {
        setContacts(data || []);
    }
    setLoading(false);
  };

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
        c.nombre?.toLowerCase().includes(term) || 
        c.apellido?.toLowerCase().includes(term) || 
        c.telefono?.includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.ciudad?.toLowerCase().includes(term) ||
        (c.tags && c.tags.some((t: string) => t.toLowerCase().includes(term)))
    );
  });

  const getIntentBadge = (intent: string) => {
     const i = (intent || 'BAJO').toUpperCase();
     if (i === 'COMPRADO') return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase">Ganado</Badge>;
     if (i === 'PERDIDO') return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] uppercase">Perdido</Badge>;
     if (i === 'ALTO') return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] uppercase">Cierre</Badge>;
     if (i === 'MEDIO') return <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] uppercase">Seducción</Badge>;
     return <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[9px] uppercase">Data Hunting</Badge>;
  };

  const getPaymentBadge = (status: string) => {
     if (status === 'VALID') return <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold"><ShieldCheck className="w-3 h-3"/> APROBADO ($1,500)</span>;
     if (status === 'INVALID') return <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold"><AlertTriangle className="w-3 h-3"/> RECHAZADO</span>;
     if (status === 'DOUBTFUL') return <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold"><AlertTriangle className="w-3 h-3"/> REVISIÓN</span>;
     return <span className="flex items-center gap-1 text-[10px] text-slate-500"><CreditCard className="w-3 h-3"/> Pendiente</span>;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                    <Contact className="w-6 h-6 text-indigo-400" />
                </div>
                Directorio de Contactos
             </h1>
             <p className="text-slate-400">Consulta los datos, estatus y transacciones de tu cartera de clientes.</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
             <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg rounded-xl h-10 px-6 font-bold text-xs uppercase tracking-widest">
                <UserPlus className="w-4 h-4 mr-2" /> Nuevo Contacto
             </Button>

             <div className="relative w-full md:w-72">
               <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
               <Input 
                  placeholder="Buscar nombre, tel, ciudad, etiqueta..." 
                  className="pl-10 bg-slate-900/50 border-slate-800 text-slate-200 rounded-xl focus:border-indigo-500 h-10 text-xs" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
               />
             </div>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-950/40 py-4">
             <CardTitle className="text-slate-200 text-xs flex items-center justify-between uppercase tracking-widest font-bold">
                <span>Mi Cartera ({filteredContacts.length})</span>
                {isAdmin && <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-900/10">VISTA GLOBAL DE ADMINISTRADOR</Badge>}
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-900/20">
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider pl-6">Cliente</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Información</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Etapa CRM</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Transacciones</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider text-right pr-6">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow><TableCell colSpan={5} className="text-center h-40"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filteredContacts.length === 0 ? (
                   <TableRow><TableCell colSpan={5} className="text-center h-40 text-slate-500 text-xs italic">No tienes contactos registrados o que coincidan con la búsqueda.</TableCell></TableRow>
                ) : filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <TableCell className="pl-6">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 font-bold uppercase shrink-0">
                             {contact.nombre?.substring(0, 2) || 'CL'}
                          </div>
                          <div className="flex flex-col gap-0.5">
                             <span className="font-bold text-slate-100">{contact.nombre || 'Desconocido'} {contact.apellido || ''}</span>
                             <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><Phone className="w-2.5 h-2.5"/> {contact.telefono}</span>
                             {contact.assigned_to && agentsMap[contact.assigned_to] && isAdmin && (
                                <span className="text-[8px] text-purple-400 mt-0.5">Asignado a: {agentsMap[contact.assigned_to].split(' ')[0]}</span>
                             )}
                          </div>
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1.5">
                          {contact.email ? (
                              <span className="text-[10px] text-slate-300 flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-500"/> {contact.email}</span>
                          ) : (
                              <span className="text-[10px] text-slate-600 flex items-center gap-1.5 italic"><Mail className="w-3 h-3"/> Sin correo</span>
                          )}
                          
                          {contact.ciudad ? (
                              <span className="text-[10px] text-slate-300 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-500"/> {contact.ciudad} {contact.estado ? `, ${contact.estado}` : ''}</span>
                          ) : (
                              <span className="text-[10px] text-slate-600 flex items-center gap-1.5 italic"><MapPin className="w-3 h-3"/> Sin ubicación</span>
                          )}

                          {contact.tags && contact.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-1">
                                {contact.tags.map((t: string) => (
                                    <Badge key={t} variant="outline" className="text-[8px] h-4 px-1.5 bg-slate-950 text-slate-400 border-slate-700">
                                        <Tag className="w-2 h-2 mr-1" /> {t}
                                    </Badge>
                                ))}
                            </div>
                          )}
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col items-start gap-1">
                           {getIntentBadge(contact.buying_intent)}
                           <span className="text-[9px] text-slate-500">Score: <strong className="text-indigo-400">{contact.lead_score || 0}</strong></span>
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 inline-flex">
                          {getPaymentBadge(contact.payment_status)}
                       </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                       <Button 
                          size="sm" 
                          variant="secondary" 
                          className="bg-indigo-900/20 text-indigo-400 hover:bg-indigo-900/40 border border-indigo-500/20 h-8 text-[10px] uppercase font-bold tracking-widest rounded-lg" 
                          onClick={() => { setSelectedContact(contact); setIsChatOpen(true); }}
                       >
                          <ExternalLink className="w-3 h-3 mr-1.5" /> Ficha
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchContacts} />}
        {selectedContact && <ChatViewer lead={selectedContact} open={isChatOpen} onOpenChange={setIsChatOpen} />}
      </div>
    </Layout>
  );
};

export default Contacts;