import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Target, Plus, Hash, DollarSign, Sparkles, Trash2 } from 'lucide-react';

interface WooCommerceTabProps {
  getValue: (key: string) => string;
  onChange: (key: string, value: string, category: string) => void;
  wcProducts: any[];
  onAddProduct: () => void;
  onUpdateProduct: (id: string, field: string, value: string) => void;
  onRemoveProduct: (id: string) => void;
}

export const WooCommerceTab = ({
  getValue, onChange, wcProducts, onAddProduct, onUpdateProduct, onRemoveProduct
}: WooCommerceTabProps) => {
  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-pink-600 shadow-xl">
        <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-pink-600" /> Integración Tienda</CardTitle>
            <CardDescription>Conexión base con tu e-commerce.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label>URL Base de la Tienda</Label><Input value={getValue('wc_url')} onChange={e => onChange('wc_url', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950" placeholder="https://tutienda.com" /></div>
            <div className="space-y-2"><Label>Ruta de Checkout (Slug)</Label><Input value={getValue('wc_checkout_path') || '/checkout/'} onChange={e => onChange('wc_checkout_path', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950" placeholder="/checkout/" /></div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
            <div>
                <CardTitle className="text-white flex items-center gap-2 text-sm"><Target className="w-5 h-5 text-amber-500" /> Catálogo de Productos y Prompts de Venta</CardTitle>
                <CardDescription className="text-xs mt-1">La IA leerá esta lista para saber qué link enviar dependiendo de lo que pida el cliente.</CardDescription>
            </div>
            <Button onClick={onAddProduct} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 h-9 text-xs rounded-xl shadow-lg">
                <Plus className="w-4 h-4 mr-2" /> Añadir Producto
            </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
            {wcProducts.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 italic text-xs">
                    No hay productos configurados. El bot no podrá enviar links de pago.
                </div>
            ) : wcProducts.map((prod, index) => (
                <div key={prod.id} className="p-5 bg-slate-950 border border-slate-800 rounded-xl relative group">
                    <Button variant="ghost" size="icon" onClick={() => onRemoveProduct(prod.id)} className="absolute top-2 right-2 text-slate-500 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-900/50 text-indigo-300 text-xs font-bold">{index + 1}</span>
                        <h4 className="text-sm font-bold text-slate-300">Configuración de Producto</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Hash className="w-3 h-3"/> WooCommerce ID</Label>
                          <Input value={prod.wc_id} onChange={e => onUpdateProduct(prod.id, 'wc_id', e.target.value)} placeholder="Ej: 1483" className="bg-slate-900 border-slate-700 h-10 font-mono text-amber-500 font-bold" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Nombre Interno (Contexto)</Label>
                          <Input value={prod.title} onChange={e => onUpdateProduct(prod.id, 'title', e.target.value)} placeholder="Ej: Taller Cuencos Monterrey" className="bg-slate-900 border-slate-700 h-10 text-white" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-slate-500">Precio (Monto)</Label>
                          <div className="relative">
                              <DollarSign className="absolute left-2 top-3 h-4 w-4 text-emerald-500" />
                              <Input value={prod.price} onChange={e => onUpdateProduct(prod.id, 'price', e.target.value)} placeholder="1500" className="pl-7 bg-slate-900 border-slate-700 h-10 text-emerald-400 font-bold" />
                          </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5"/> Prompt / Condición de Venta (Instrucción para IA)
                        </Label>
                        <Textarea 
                          value={prod.prompt} 
                          onChange={e => onUpdateProduct(prod.id, 'prompt', e.target.value)} 
                          placeholder="Escribe cuándo y cómo el Bot debe ofrecer este producto..." 
                          className="bg-slate-900 border-slate-700 text-xs min-h-[80px] leading-relaxed focus:border-indigo-500" 
                        />
                        <p className="text-[9px] text-slate-500 italic">Ej: "Ofrecer este enlace exclusivamente cuando el cliente confirme que desea asegurar su lugar para el Retiro en Tulum."</p>
                    </div>
                </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
};