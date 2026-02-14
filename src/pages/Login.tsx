import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await logActivity({
          action: 'LOGIN',
          resource: 'AUTH',
          description: `Login exitoso: ${email}`,
          status: 'OK',
          metadata: { userId: data.user.id }
        });
        
        toast.success('Bienvenido al Panel Samurai v5.1');
        navigate('/');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al iniciar sesión');
      await logActivity({
        action: 'ERROR',
        resource: 'AUTH',
        description: `Login fallido: ${email}`,
        status: 'ERROR',
        metadata: { error: error.message }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-600 flex items-center justify-center mb-2 shadow-lg shadow-red-900/50">
            <span className="text-white font-bold text-2xl">侍</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white">SAMURAI PANEL v5.1</CardTitle>
          <CardDescription className="text-slate-400">
            Sistema de Inteligencia Avanzada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@samurai.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:border-red-600/50 transition-colors"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:border-red-600/50 transition-colors"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Ingresar al Sistema
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Acceso restringido a personal autorizado
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;