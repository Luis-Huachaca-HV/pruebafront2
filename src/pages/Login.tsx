import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
// import { loginWithGoogle } from '@/services/auth'; // Hidden: Google login not working
import BrandHeader from '@/components/BrandHeader';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo || '/search';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // VALIDACIONES BÁSICAS
    if (!email.trim() || !password.trim()) {
      toast({
        title: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 10) {
      toast({
        title: "La contraseña debe tener al menos 10 caracteres",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email.trim(), password.trimEnd());

      if (result.success) {
        toast({
          title: "¡Bienvenido!",
          description: "Has iniciado sesión correctamente",
        });
        navigate(redirectTo, { replace: true });
      } else {
        toast({
          title: result.error || "Credenciales incorrectas",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Problema al conectar con el servidor",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F8FC] flex flex-col items-center justify-center px-6 py-8">
      <BrandHeader subtitle="Comparte el viaje" className="mb-8" />

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">¡Hola de nuevo!</h2>
          <p className="text-slate-400 text-sm mt-1">Ingresa tus credenciales</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 ml-1">Correo</label>
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

          {/* Password */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-semibold text-slate-600">Contraseña</label>
              <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-[#F97316]">
                ¿Olvidé mi clave?
              </Link>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11 pr-11 py-6 bg-slate-50 border-none rounded-2xl"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          {/* Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full py-7 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl text-lg font-bold flex items-center justify-center gap-2"
          >
            {isLoading ? "Cargando..." : "Iniciar Sesión"}
            {!isLoading && <ArrowRight />}
          </Button>

        </form>

        {/* Separador — hidden while Google login is not working */}
        {/*
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-400 font-medium">O continúa con</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        {/* Google OAuth — hidden while not working */}
        {/*
        <Button
          type="button"
          onClick={loginWithGoogle}
          variant="outline"
          className="w-full py-6 rounded-2xl border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-3 font-semibold text-slate-700 hover:text-slate-700 active:text-slate-700 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M44.5 20H24v8.5h11.9C34.2 33.6 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.2-2.7-.5-4z" fill="#FFC107"/>
            <path d="M6.3 14.7l7 5.1C15.1 16.4 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.7 7.9 6.3 14.7z" fill="#FF3D00"/>
            <path d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.5C29.6 36 26.9 37 24 37c-5.6 0-10.2-3.4-12-8.3l-7 5.4C8.4 41 15.6 45 24 45z" fill="#4CAF50"/>
            <path d="M44.5 20H24v8.5h11.9c-.8 2.6-2.5 4.8-4.7 6.3l6.6 5.5C41.7 37.2 44.5 31 44.5 24c0-1.4-.2-2.7-.5-4z" fill="#1976D2"/>
          </svg>
          Continuar con Google
        </Button>
        */}
      </div>

      {/* Footer */}
      <p className="mt-8 text-sm text-slate-500">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-bold text-[#F97316] hover:underline">
          Crear cuenta
        </Link>
      </p>

    </div >
  );
};

export default Login;
