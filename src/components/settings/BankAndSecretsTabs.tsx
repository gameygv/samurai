import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Building2, Key } from 'lucide-react';

interface Props {
  getValue: (key: string) => string;
  onChange: (key: string, value: string, category: string) => void;
}

export const BankTab = ({ getValue, onChange }: Props) => (
  <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-blue-600">
    <CardHeader>
      <CardTitle className="text-white flex items-center gap-2">
        <Building2 className="w-5 h-5 text-blue-600" /> Datos para Depósito
      </CardTitle>
    </CardHeader>
    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label>Nombre del Banco</Label>
        <Input value={getValue('bank_name')} onChange={e => onChange('bank_name', e.target.value, 'BANK')} className="bg-slate-950" />
      </div>
      <div className="space-y-2">
        <Label>Titular de la Cuenta</Label>
        <Input value={getValue('bank_holder')} onChange={e => onChange('bank_holder', e.target.value, 'BANK')} className="bg-slate-950" />
      </div>
      <div className="space-y-2">
        <Label>Número de Cuenta</Label>
        <Input value={getValue('bank_account')} onChange={e => onChange('bank_account', e.target.value, 'BANK')} className="bg-slate-950" />
      </div>
      <div className="space-y-2">
        <Label>CLABE Interbancaria</Label>
        <Input value={getValue('bank_clabe')} onChange={e => onChange('bank_clabe', e.target.value, 'BANK')} className="bg-slate-950" />
      </div>
    </CardContent>
  </Card>
);

export const SecretsTab = ({ getValue, onChange }: Props) => (
  <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-red-600">
    <CardHeader>
      <CardTitle className="text-white flex items-center gap-2">
        <Key className="w-5 h-5 text-red-600" /> Secretos y API Keys
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Label>OpenAI API Key</Label>
        <Input 
          type="password" 
          value={getValue('openai_api_key')} 
          onChange={e => onChange('openai_api_key', e.target.value, 'SECRETS')} 
          className="bg-slate-950 font-mono" 
        />
      </div>
    </CardContent>
  </Card>
);