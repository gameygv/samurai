import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Webhook, Send } from 'lucide-react';
import { toast } from 'sonner';
import { sendEvolutionMessage } from '@/utils/messagingService';

interface MessagingTabProps {
  getValue: (key: string) => string;
  onChange: (key: string, value: string, category: string) => void;
}

export const MessagingTab = ({ getValue, onChange }: MessagingTabProps) => {
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  const handleTestMessage = async () => {
    if (!testPhone) return toast.error("Ingresa un número de teléfono.");
    setTesting(true);
    // Pasamos un string vacío como leadId para usar el canal por defecto en la prueba
    const res = await sendEvolutionMessage(testPhone, "Hola, prueba de Samurai Kernel.", "");
    if (res) toast.success("Mensaje enviado.");
    setTesting(false);
  };

  return (
    <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-green-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Webhook className="w-5 h-5 text-green-600" /> Conexión Evolution API (Legacy)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>URL del Endpoint (sendText)</Label>
          <Input 
            value={getValue('evolution_api_url')} 
            onChange={e => onChange('evolution_api_url', e.target.value, 'EVOLUTION')} 
            className="bg-slate-950 font-mono" 
          />
        </div>
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input 
            type="password" 
            value={getValue('evolution_api_key')} 
            onChange={e => onChange('evolution_api_key', e.target.value, 'EVOLUTION')} 
            className="bg-slate-950 font-mono" 
          />
        </div>
      </CardContent>
      <CardFooter className="bg-slate-950/50 border-t border-slate-800 p-4 flex items-center gap-4">
        <Input 
          value={testPhone} 
          onChange={e => setTestPhone(e.target.value)} 
          placeholder="Tu # de WhatsApp" 
          className="bg-slate-900 border-slate-700 w-48 h-9 text-xs" 
        />
        <Button onClick={handleTestMessage} disabled={testing} variant="outline" className="border-green-500/30 text-green-500">
          <Send className="w-3 h-3 mr-2" /> Probar Conexión
        </Button>
      </CardFooter>
    </Card>
  );
};