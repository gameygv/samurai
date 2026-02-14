import React from 'react';

const Index = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-block p-4 rounded-full bg-slate-900 border border-slate-800 mb-4">
          <span className="text-4xl">侍</span>
        </div>
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
          PROYECTO SAMURAI
        </h1>
        <p className="text-xl text-slate-400">
          Panel de Control del Agente
        </p>
        <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-lg text-left">
          <p className="text-sm text-slate-300 font-mono">
            <span className="text-green-500">➜</span> Sistema inicializado...<br/>
            <span className="text-green-500">➜</span> Esperando conexión a Supabase...<br/>
            <span className="text-yellow-500">⚠</span> Falta ANON_KEY<br/>
            <span className="text-blue-500">➜</span> Esperando primer prompt de instrucciones...
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;