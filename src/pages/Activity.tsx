import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity as ActivityIcon, MessageSquare, DollarSign, 
  UserPlus, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';

const Activity = () => {
  // Simulated activity stream
  const activities = [
    { id: 1, type: 'SALE', title: 'Nueva Venta Cerrada', desc: 'Cliente "Laura M." completó pago de $4,500', time: 'Hace 5 min', user: 'Samurai IA' },
    { id: 2, type: 'LEAD', title: 'Nuevo Lead Calificado', desc: 'Usuario "Carlos Ruiz" etiquetado como [PRAGMATICO]', time: 'Hace 12 min', user: 'Samurai IA' },
    { id: 3, type: 'CHAT', title: 'Intervención Humana', desc: 'Anahí tomó control del chat #8821', time: 'Hace 35 min', user: 'Anahí' },
    { id: 4, type: 'ERROR', title: '#CORREGIRIA Reportado', desc: 'IA alucinó precio en moneda incorrecta', time: 'Hace 1 hora', user: 'Edith' },
    { id: 5, type: 'SYSTEM', title: 'Deploy v5.2 Exitoso', desc: 'Nuevos prompts de "Ojo de Halcón" activos', time: 'Hace 2 horas', user: 'Gamey' },
    { id: 6, type: 'SALE', title: 'Promesa de Pago', desc: 'Cliente agendó pago para mañana 10:00 AM', time: 'Hace 3 horas', user: 'Samurai IA' },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <ActivityIcon className="w-8 h-8 text-indigo-500" />
              Feed de Actividad
            </h1>
            <p className="text-slate-400">Pulso del negocio en tiempo real.</p>
          </div>
        </div>

        <div className="relative border-l border-slate-800 ml-4 space-y-8 py-4">
          {activities.map((item) => (
            <div key={item.id} className="relative pl-8 group">
              {/* Timeline dot */}
              <div className={`
                absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full border border-slate-950 
                ${item.type === 'SALE' ? 'bg-green-500' : 
                  item.type === 'ERROR' ? 'bg-red-500' : 
                  item.type === 'LEAD' ? 'bg-blue-500' : 
                  item.type === 'CHAT' ? 'bg-orange-500' : 'bg-slate-500'}
              `}></div>

              <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex items-start gap-4">
                    <div className={`
                      p-2 rounded-lg mt-1 sm:mt-0
                      ${item.type === 'SALE' ? 'bg-green-500/10 text-green-500' : 
                        item.type === 'ERROR' ? 'bg-red-500/10 text-red-500' : 
                        item.type === 'LEAD' ? 'bg-blue-500/10 text-blue-500' : 
                        item.type === 'CHAT' ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-800 text-slate-400'}
                    `}>
                      {item.type === 'SALE' && <DollarSign className="w-5 h-5" />}
                      {item.type === 'LEAD' && <UserPlus className="w-5 h-5" />}
                      {item.type === 'CHAT' && <MessageSquare className="w-5 h-5" />}
                      {item.type === 'ERROR' && <AlertCircle className="w-5 h-5" />}
                      {item.type === 'SYSTEM' && <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-white font-medium flex items-center gap-2">
                        {item.title}
                        {item.type === 'SALE' && <Badge className="bg-green-900 text-green-300 border-green-800 h-5 text-[10px]">$$$</Badge>}
                      </h4>
                      <p className="text-slate-400 text-sm">{item.desc}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 sm:hidden">
                        <Clock className="w-3 h-3" />
                        {item.time} • por {item.user}
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:text-right sm:block">
                    <p className="text-sm font-medium text-slate-300">{item.time}</p>
                    <p className="text-xs text-slate-500">por {item.user}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Activity;