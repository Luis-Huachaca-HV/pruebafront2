const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;

export interface PublicAd {
    id: string;
    title: string;
    image_url: string;
    link_url?: string;
    position: string;
    target_audience: string;
    is_active: boolean;
}

const handleResponse = async <T>(response: Response): Promise<T> => {
    const result = await response.json();
    if (response.ok) return result as T;
    throw new Error(result?.detail || result?.error?.message || result?.message || 'Error en la petición');
};

export const getActiveAds = async (limit = 10): Promise<PublicAd[]> => {
    // Las ads activas son públicas, no requieren authHeaders necesariamente,
    // pero si el endpoint lo requiere, podemos usar token, asumiendo que es público:
    const response = await fetch(`${API_BASE}/ads/active?limit=${limit}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '1',
        },
    });
    return handleResponse<PublicAd[]>(response);
};
