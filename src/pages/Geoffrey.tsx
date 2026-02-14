import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Geoffrey = () => {
  const [frases, setFrases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFrase, setNewFrase] = useState('');
  const [newCat, setNewCat] = useState('SALUDO');

  useEffect(() => {
    fetchFrases();
  }, []);

  const fetchFrases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('frases_geoffrey')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setFrases(data || []);
    } catch (err) {
      console.error('Error fetching phrases:', err);
    } finally {
      setLoading(false);
    }
  };

  const addFrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFrase.trim()) return;
    
    try {
      const { error } = await supabase.from('frases_geoffrey').insert({
          frase: newFrase,
          categoria: newCat,
          active: true
      });

      if (error) throw error;
      
      toast.success('Frase añadida al repertorio');
      setNewFrase('');
      fetchFrases();
    } catch (error) {
      toast.error('Error al guardar la frase');
    }
  };

  const deleteFrase = async (id: string) => {
    try {
      const { error } = await supabase.from('frases_geoffrey').delete().eq('id', id);
      if (error) throw error;
      toast.success('Frase eliminada');
      fetchFrases();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-500/20 rounded-full text-indigo-400">
                <Sparkles className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-3xl font-bold text-white">Geoffrey Manager</h1>
                <p className="text-slate-400">Personalidad auxiliar y frases de cortesía.</p>
             </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
           <CardHeader>
              <CardTitle className="text-white">Añadir Nueva Frase</CardTitle>
           </CardHeader>
           <CardContent>
              <form onSubmit={addFrase} className="flex flex-col md:flex-row gap-4 items-end">
                 <div className="flex-1 space-y-2 w-full">
                    <Label>Frase</Label>
                    <Input 
                        value={newFrase}
                        onChange={e => setNewFrase(e.target.value)}
                        className="bg-slate-950 border-slate-800"
                        placeholder="Ej: Permítame verificar en los archivos..."
                    />
                 </div>
                 <div className="w-full md:w-[180px] space-y-2">
                    <Label>Categoría</Label>
                    <Select value={newCat} onValueChange={setNewCat}>
                        <SelectTrigger className="bg-slate-950 border-slate-800">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                           <SelectItem value="SALUDO">Saludo</SelectItem>
                           <SelectItem value="DESPEDIDA">Despedida</SelectItem>
                           <SelectItem value="ESPERA">Espera</SelectItem>
                           <SelectItem value="ERROR">Error</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 <Button type="submit" className="bg-indigo-600 w-full md:w-auto">
                    <Plus className="w-4 h-4 mr-2" /> Añadir
                 </Button>
              </form>
           </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
           <CardContent className="p-0">
              <Table>
                 <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-slate-900">
                       <TableHead className="text-slate-400">Frase</TableHead>
                       <TableHead className="text-slate-400 w-[150px]">Categoría</TableHead>
                       <TableHead className="text-slate-400 w-[100px] text-right">Acción</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {loading ? (
                       <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                    ) : frases.length === 0 ? (
                       <TableRow><TableCell colSpan={3} className="text-center h-24 text-slate-500">No hay frases registradas.</TableCell></TableRow>
                    ) : frases.map(f => (
                       <TableRow key={f.id} className="border-slate-800 hover:bg-slate-800/50">
                          <TableCell className="font-medium text-slate-300 italic">"{f.frase}"</TableCell>
                          <TableCell>
                             <Badge variant="outline" className="text-slate-400 border-slate-700">{f.categoria}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                             <Button variant="ghost" size="sm" className="text-slate-500 hover:text-red-500" onClick={() => deleteFrase(f.id)}>
                                <Trash2 className="w-4 h-4" />
                             </Button>
                          </TableCell>
                       </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Geoffrey;