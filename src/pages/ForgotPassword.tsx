import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import BrandHeader from '@/components/BrandHeader';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSuccess(true);
    toast({
      title: "Correo enviado",
      description: "Revisa tu bandeja de entrada",
    });

    setIsLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#F4F8FC] flex flex-col items-center justify-center px-6 py-8">

        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 text-center">

          <div className="w-16 h-16 bg-[#F97316] rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-slate-800">¡Correo enviado!</h1>

          <p className="text-slate-400 text-sm mt-2 mb-6">
            Enviamos un enlace a <br />
            <strong className="text-slate-700">{email}</strong>
          </p>

          <Button
            onClick={() => navigate('/login')}
            className="w-full py-6 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-bold"
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F8FC] flex flex-col items-center justify-center px-6 py-8">
      <BrandHeader subtitle="Recupera tu acceso" className="mb-8" />

      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">¿Olvidaste tu contraseña?</h2>
          <p className="text-slate-400 text-sm mt-1">
            Ingresa tu correo y te enviaremos un enlace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 ml-1">
              Correo electrónico
            </label>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="email"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11 py-6 bg-slate-50 border-none rounded-2xl"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full py-6 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl text-lg font-bold"
          >
            {isLoading ? 'Enviando...' : 'Enviar enlace'}
          </Button>

        </form>

        <button
          onClick={() => navigate('/login')}
          className="mt-6 text-sm text-slate-400 hover:text-[#F97316] transition-colors"
        >
          ← Volver al login
        </button>

      </div>
    </div>
  );
};

export default ForgotPassword;
