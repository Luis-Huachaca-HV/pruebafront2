import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    children: React.ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
    const { isAuthenticated, isLoading } = useAuth();

    // Mientras carga sesión (evita parpadeos / redirecciones raras)
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin w-6 h-6 border-2 border-[#0F2A4D] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    //  Si NO está autenticado → login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    //  Si está autenticado → pasa
    return <>{children}</>;
};

export default ProtectedRoute;