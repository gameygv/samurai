import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Target, Plus, Hash, DollarSign, Sparkles, Trash2, Key, Zap, Loader2 } from 'lucide-react';

interface WooCommerceTabProps {
  getValue: (key: string) => string;
  onChange: (key: string, value: string, category: string) => void;
  wcProducts: any[];
  onAddProduct: () => void;
  onUpdateProduct: (id: string, field: string, value: string) => void;
  onRemoveProduct: (id: string) => void;
  onTestConnection: () => void;
  isTesting: boolean;
}

export const WooCommerceTab = ({
  getValue, onChange, wcProducts, onAddProduct, onUpdateProduct, onRemoveProduct, onTestConnection, isTesting
}: WooCommerceTabProps) => {
  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-pink-600 shadow-xl">
        <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-pink-600" /> Integración Tienda</CardTitle>
            <CardDescription>Conexión base con tu e-commerce y validación automática.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label>URL Base de la Tienda</Label><Input value={getValue('wc_url')} onChange={e => onChange('wc_url', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950" placeholder="https://tutienda.com" /></div>
                <div className="space-y-2"><Label>Ruta de Checkout (Slug)</Label><Input value={getValue('wc_checkout_path') || '/checkout/'} onChange={e => onChange('wc_checkout_path', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950" placeholder="/checkout/" /></div>
            </div>
            
            <div className="pt-4 border-t border-slate-800">
               <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Key className="w-4 h-4" /> API REST (Validación)</h4>
                  <Button onClick={onTestConnection} disabled={isTesting} variant="outline" className="border-pink-500/30 text-pink-500 hover:bg-pink-500/10 h-8 text-[10px] font-bold uppercase tracking-widest">
                     {isTesting ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <Zap className="w-3 h-3 mr-2"/>} Probar Conexión
                  </Button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase text-slate-500">Consumer Key (ck_...)</Label>
                     <Input type="password" value={getValue('wc_consumer_key')} onChange={e => onChange('wc_consumer_key', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950 font-mono" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase text-slate-500">Consumer Secret (cs_...)</Label>
                     <Input type="password" value={getValue('wc_consumer_secret')} onChange={e => onChange('wc_consumer_secret', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950 font-mono" />
                  </div>
               </div>
               <p className="text-[9px] text-slate-600 mt-2 italic">Sam revisará cada 30 min si los leads en etapa de cierre ya realizaron su compra usando estas llaves.</p>
            </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
            <div>
                <CardTitle className="text-white flex items-center gap-2 text-sm"><Target className="w-5 h-5 text-amber-500" /> Catálogo de Productos</CardTitle>
            </div>
            <Button onClick={onAddProduct} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 h-9 text-xs rounded-xl shadow-lg">
                <Plus className="w-4 h-4 mr-2" /> Añadir Producto
            </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
            {wcProducts.map((prod, index) => (
                <div key={prod.id} className="p-5 bg-slate-950 border border-slate-800 rounded-xl relative group">
                    <Button variant="ghost" size="icon" onClick={() => onRemoveProduct(prod.id)} className="absolute top-2 right-2 text-slate-500 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-slate-500">WC ID</Label><Input value={prod.wc_id} onChange={e => onUpdateProduct(prod.id, 'wc_id', e.target.value)} className="bg-slate-900 border-slate-700 h-10 font-mono text-amber-500" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-slate-500">Nombre</Label><Input value={prod.title} onChange={e => onUpdateProduct(prod.id, 'title', e.target.value)} className="bg-slate-900 border-slate-700 h-10 text-white" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold text-slate-500">Precio</Label><Input value={prod.price} onChange={e => onUpdateProduct(prod.id, 'price', e.target.value)} className="bg-slate-900 border-slate-700 h-10 text-emerald-400" /></div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-indigo-400">Instrucción para IA</Label>
                        <Textarea value={prod.prompt} onChange={e => onUpdateProduct(prod.id, 'prompt', e.target.value)} placeholder="Ej: Ofrece este producto SOLO si el cliente dice que tiene problemas para dormir..." className="bg-slate-900 border-slate-700 text-xs min-h-[80px]" />
                    </div>
                </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
};