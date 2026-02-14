import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

const Logs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => 
    log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2">Logs del Sistema</h1>
             <p className="text-slate-400">Auditoría completa de acciones (Últimos 100 eventos)</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Buscar logs..." 
              className="pl-8 bg-slate-900 border-slate-800 text-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Registro de Actividad
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-900">
                  <TableHead className="text-slate-400">Timestamp</TableHead>
                  <TableHead className="text-slate-400">Usuario</TableHead>
                  <TableHead className="text-slate-400">Acción</TableHead>
                  <TableHead className="text-slate-400">Recurso</TableHead>
                  <TableHead className="text-slate-400 w-1/3">Descripción</TableHead>
                  <TableHead className="text-slate-400">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                         <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                         Cargando logs...
                      </TableCell>
                   </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                       No se encontraron registros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell className="font-mono text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-slate-300">
                        {log.username || 'System'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`
                          ${log.action === 'ERROR' ? 'border-red-500 text-red-500' : 
                            log.action === 'LOGIN' ? 'border-green-500 text-green-500' : 
                            log.action === 'UPDATE' ? 'border-blue-500 text-blue-500' : 
                            'border-slate-500 text-slate-500'}
                        `}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 font-mono">
                         {log.resource}
                      </TableCell>
                      <TableCell className="text-sm text-slate-300">
                        {log.description}
                      </TableCell>
                      <TableCell>
                        {log.status === 'OK' ? (
                           <span className="text-green-500 text-xs font-bold">● OK</span>
                        ) : (
                           <span className="text-red-500 text-xs font-bold">● ERROR</span>
                        )}
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

export default Logs;