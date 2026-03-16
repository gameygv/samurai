import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Contact, Search, Loader2, MapPin, Mail, Phone, ExternalLink, 
  UserPlus, Tag, Trash2, RefreshCw, Users
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Contacts = () => {
  const { user, isAdmin } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<any>(null);

  useEffect(() => {
    fetchContacts();
    const channel = supabase.channel('contacts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchContacts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    // Traemos de la tabla contacts, con join a leads para datos de intención/pago
    const { data, error } = await supabase
      .from('contacts')
      .select('*, leads(id, buying_intent, payment_status, lead_score, ai_paused, summary, telefono, nombre, apellido, email, ciudad, estado, cp, pais, tags)')
      .order('updated_at', { ascending: false });

    if (error) {
      // Si la tabla contacts no existe aún, fallback a leads
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      setContacts((leadsData || []).map(l => ({ ...l, lead_id: l.id, leads: l })));
    } else {
      setContacts(data || []);
    }
    setLoading(false);
  };

  const handleDeleteContact = async (contact: any) => {
    try {
      // Intentar borrar de tabla contacts primero
      const { error } = await supabase.from('contacts').delete().eq('id', contact.id);
      if (error) {
        // Fallback: borrar de leads si no existe tabla contacts
        await supabase.from('leads').delete().eq('id', contact.id);
      }
      toast.success(`Contacto "${contact.nombre}" eliminado permanentemente.`);
      setContactToDelete(null);
      fetchContacts();
    } catch (err: any) {
      toast.error("Error al eliminar: " + err.message);
    }
  };

  const handleOpenChat = async (contact: any) => {
    // Buscar el lead asociado para abrir el chat
    const leadId = contact.lead_id || contact.id;
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
    if (lead) {
      setSelectedLead(lead);
      setIsChatOpen(true);
    } else {
      toast.info("Este contacto no tiene conversaciones activas.");
    }
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

  const lead = (c: any) => c.leads || c;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              Directorio de Contactos
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Registro permanente. Los contactos persisten aunque se eliminen sus conversaciones.
            </p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <Button onClick={fetchContacts} variant="outline" className="border-slate-800 text-slate-400 h-10">
              <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 h-10 px-6 font-bold text-xs uppercase tracking-widest rounded-xl">
              <UserPlus className="w-4 h-4 mr-2" /> Nuevo Contacto
            </Button>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Buscar nombre, tel, ciudad..."
                className="pl-10 bg-slate-900/50 border-slate-800 text-slate-200 rounded-xl h-10 text-xs"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Contactos', value: contacts.length, color: 'text-slate-200' },
            { label: 'Con Email', value: contacts.filter(c => c.email).length, color: 'text-emerald-400' },
            { label: 'Con Ciudad', value: contacts.filter(c => c.ciudad).length, color: 'text-indigo-400' },
            { label: 'Sin Lead Activo', value: contacts.filter(c => !c.leads?.id && !c.lead_id).length, color: 'text-amber-500' },
          ].map((s, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-950/40 py-4">
            <CardTitle className="text-slate-200 text-xs uppercase tracking-widest font-bold flex items-center justify-between">
              <span>Directorio ({filteredContacts.length})</span>
              {isAdmin && <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-900/10">VISTA GLOBAL</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-900/20">
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold pl-6">Contacto</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Información</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Etiquetas</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Estado CRM</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold text-right pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="h-40 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-40 text-center text-slate-500 italic text-xs">No hay contactos registrados.</TableCell></TableRow>
                ) : filteredContacts.map((contact) => {
                  const l = lead(contact);
                  const intent = (l?.buying_intent || 'BAJO').toUpperCase();
                  return (
                    <TableRow key={contact.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 font-bold uppercase shrink-0 text-sm">
                            {contact.nombre?.substring(0, 2) || 'CL'}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-100">{contact.nombre || 'Desconocido'} {contact.apellido || ''}</span>
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" /> {contact.telefono}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <span className={cn("text-[10px] flex items-center gap-1.5", contact.email ? "text-emerald-400" : "text-slate-600 italic")}>
                            <Mail className="w-3 h-3" /> {contact.email || 'Sin email'}
                          </span>
                          <span className={cn("text-[10px] flex items-center gap-1.5", contact.ciudad ? "text-slate-300" : "text-slate-600 italic")}>
                            <MapPin className="w-3 h-3 text-slate-500" /> {contact.ciudad || 'Sin ciudad'}{contact.estado ? `, ${contact.estado}` : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(contact.tags || []).map((t: string) => (
                            <Badge key={t} variant="outline" className="text-[8px] h-4 px-1.5 bg-slate-950 text-slate-400 border-slate-700">
                              <Tag className="w-2 h-2 mr-1" />{t}
                            </Badge>
                          ))}
                          {(!contact.tags || contact.tags.length === 0) && <span className="text-[10px] text-slate-600 italic">Sin etiquetas</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {l?.buying_intent ? (
                          <Badge variant="outline" className={cn("text-[9px] uppercase font-bold",
                            intent === 'COMPRADO' ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" :
                            intent === 'ALTO' ? "border-amber-500/50 text-amber-400 bg-amber-500/10" :
                            intent === 'MEDIO' ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10" :
                            "border-slate-700 text-slate-500"
                          )}>{intent}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-600">SIN LEAD</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-8 text-[10px] text-indigo-400 hover:bg-indigo-900/20 border border-indigo-500/20 rounded-lg px-3"
                            onClick={() => handleOpenChat(contact)}>
                            <ExternalLink className="w-3 h-3 mr-1.5" /> Ver Chat
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-600 hover:text-red-500 hover:bg-red-900/20 rounded-lg"
                              onClick={() => setContactToDelete(contact)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialogo de confirmación de borrado */}
      <AlertDialog open={!!contactToDelete} onOpenChange={() => setContactToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">¿Eliminar contacto permanentemente?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Se eliminará <strong className="text-white">"{contactToDelete?.nombre}"</strong> del directorio. 
              Sus conversaciones y datos de CRM también serán eliminados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteContact(contactToDelete)}>
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchContacts} />}
      {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
    </Layout>
  );
};

export default Contacts;