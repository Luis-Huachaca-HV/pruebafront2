import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    children: React.ReactNode;
}

const PublicRoute = ({ children }: Props) => {
    const { isAuthenticated, isLoading } = useAuth();

    // Evita glitch mientras carga
    if (isLoading) {
        return null;
    }

    // Si ya está logeado → NO puede ver login/index
    if (isAuthenticated) {
        return <Navigate to="/search" replace />;
    }

    return <>{children}</>;
};

export default PublicRoute;