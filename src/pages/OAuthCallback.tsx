import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Página de callback para Google OAuth.
 *
 * El backend redirige aquí tras autenticar al usuario con Google:
 *   /auth/callback?token=<jwt>
 *
 * Esta página:
 *  1. Lee el token de los query params.
 *  2. Lo guarda vía AuthContext (loginWithGoogleToken).
 *  3. Redirige al usuario a /search.
 *  4. Si hay error, redirige a /login con un toast.
 */
const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGoogleToken } = useAuth();
  const { toast } = useToast();
  useEffect(() => {
    let mounted = true;

    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error || !token) {
      toast({
        title: 'Error al autenticar con Google',
        description: 'Por favor intenta de nuevo.',
        variant: 'destructive',
      });
      navigate('/login', { replace: true });
      return;
    }

    loginWithGoogleToken(token)
      .then((result) => {
        if (!mounted) return;
        
        if (result.success) {
          toast({
            title: '¡Bienvenido!',
            description: 'Has iniciado sesión con Google correctamente.',
          });
          navigate('/search', { replace: true });
        } else {
          toast({
            title: result.error || 'Error al iniciar sesión',
            variant: 'destructive',
          });
          navigate('/login', { replace: true });
        }
      })
      .catch((err) => {
        if (!mounted) return;
        toast({
          title: 'Error al procesar la autenticación',
          variant: 'destructive',
        });
        navigate('/login', { replace: true });
      });

      return () => {
        mounted = false;
      };
  }, [searchParams, loginWithGoogleToken, navigate, toast]);

  return (
    <div className="min-h-screen bg-[#F4F8FC] flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 bg-[#F97316] rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
        <Car className="w-10 h-10 text-white" />
      </div>
      <p className="text-slate-600 font-medium text-lg">Completando inicio de sesión...</p>
    </div>
  );
};

export default OAuthCallback;
