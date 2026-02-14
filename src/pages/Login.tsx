import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, AlertCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Construir email interno para Supabase Auth
    const email = `${username.toLowerCase().trim()}@samurai.local`;

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
          description: `Login exitoso: ${username}`,
          status: 'OK',
          metadata: { userId: data.user.id }
        });
        
        toast.success(`Bienvenido, ${username}`);
        navigate('/');
      }
    } catch (error: any) {
      console.error(error);
      let msg = error.message;
      if (error.message.includes("Invalid login credentials")) {
        msg = "Usuario o contraseña incorrectos";
      }
      toast.error(msg);
      
      await logActivity({
        action: 'ERROR',
        resource: 'AUTH',
        description: `Login fallido: ${username}`,
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
            Acceso exclusivo personal autorizado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Ej: gamey"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:border-red-600/50 transition-colors"
                  required
                  autoFocus
                />
              </div>
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
            
            <div className="text-xs text-slate-500 bg-slate-950/50 p-3 rounded border border-slate-800/50">
              <span className="font-semibold text-slate-400">Usuarios Default:</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>User: <span className="text-indigo-400 font-mono">gamey</span></div>
                <div>Pass: <span className="text-slate-400 font-mono">Febrero26</span></div>
                <div>User: <span className="text-indigo-400 font-mono">josue</span></div>
                <div>Pass: <span className="text-slate-400 font-mono">Febrero26</span></div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
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
            Sistema monitoreado. IP registrada.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;