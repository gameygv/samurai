import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  CreditCard, Search, Loader2, CheckCircle2, XCircle, 
  ExternalLink, Calendar, RefreshCw, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const Payments = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    if (!refreshing) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('media_assets')
        .select('*')
        .eq('type', 'IMAGE')
        .ilike('ai_instructions', '%OCR DATA%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err: any) {
      toast.error('Error cargando pagos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const extractOcrField = (instructions: string | null, field: string) => {
    if (!instructions) return 'N/A';
    const regex = new RegExp(`${field}:?\\s*([^\\n,]+)`, 'i');
    const match = instructions.match(regex);
    return match ? match[1].trim() : 'No detectado';
  };

  const handleValidate = async (id: string, title: string) => {
    try {
      toast.success(`Pago "${title}" validado correctamente.`);
      await logActivity({
        action: 'UPDATE',
        resource: 'SYSTEM',
        description: `Pago validado: ${title}`,
        status: 'OK'
      });
      fetchPayments();
    } catch (err: any) {
      toast.error('Fallo al validar');
    }
  };

  const filtered = payments.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.ai_instructions && p.ai_instructions.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-green-500" />
              Pagos & Ventas
            </h1>
            <p className="text-slate-400">Verificación de comprobantes detectados por el Samurai.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Buscar por referencia o banco..." 
              className="pl-10 bg-slate-900 border-slate-800 text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="bg-slate-900 border-slate-800 p-6 border-l-4 border-l-green-500">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ventas Hoy</p>
              <h3 className="text-3xl font-bold text-white mt-1">$4,500 <span className="text-xs text-slate-500 font-normal">MXN</span></h3>
           </Card>
           <Card className="bg-slate-900 border-slate-800 p-6 border-l-4 border-l-yellow-500">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pendientes</p>
              <h3 className="text-3xl font-bold text-white mt-1">{filtered.length}</h3>
           </Card>
           <Card className="bg-slate-900 border-slate-800 p-6 border-l-4 border-l-indigo-500">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Conversión</p>
              <h3 className="text-3xl font-bold text-white mt-1">12.5%</h3>
           </Card>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" /> Cola de Validación OCR
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setRefreshing(true); fetchPayments(); }} disabled={refreshing}>
               <RefreshCw className={`w-3 h-3 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-950/30">
                  <TableHead className="text-slate-400">Comprobante</TableHead>
                  <TableHead className="text-slate-400 text-center">Datos Extraídos (AI)</TableHead>
                  <TableHead className="text-slate-400 text-center">Monto</TableHead>
                  <TableHead className="text-slate-400 text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !refreshing ? (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500 italic">No se han detectado comprobantes nuevos.</TableCell></TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <TableCell>
                         <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded border border-slate-800 overflow-hidden bg-black flex items-center justify-center">
                               {p.url && <img src={p.url} className="w-full h-full object-cover opacity-60 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => window.open(p.url, '_blank')} />}
                            </div>
                            <div className="flex flex-col">
                               <span className="font-bold text-slate-200 text-sm">{p.title}</span>
                               <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {new Date(p.created_at).toLocaleDateString()}
                               </span>
                            </div>
                         </div>
                      </TableCell>
                      <TableCell>
                         <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-w-xs mx-auto">
                            <div className="text-right text-[10px] text-slate-500 font-bold uppercase">Banco:</div>
                            <div className="text-left text-[10px] text-indigo-400 font-mono">{extractOcrField(p.ai_instructions, 'Banco')}</div>
                            <div className="text-right text-[10px] text-slate-500 font-bold uppercase">Ref:</div>
                            <div className="text-left text-[10px] text-slate-300 font-mono">{extractOcrField(p.ai_instructions, 'referencia')}</div>
                         </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-green-500 font-mono">
                         {extractOcrField(p.ai_instructions, 'Monto')}
                      </TableCell>
                      <TableCell className="text-right">
                         <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10" title="Rechazar">
                               <XCircle className="w-4 h-4" />
                            </Button>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-[10px] font-bold" onClick={() => handleValidate(p.id, p.title)}>
                               VALIDAR PAGO <CheckCircle2 className="w-3 h-3 ml-2" />
                            </Button>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Payments;