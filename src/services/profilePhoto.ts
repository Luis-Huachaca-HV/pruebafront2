import { getAuthHeaders } from '@/lib/authUtils';

const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;

/**
 * Sube una foto de perfil (el backend la procesa y guarda en Supabase Storage).
 * El servidor guarda el archivo en el bucket 'profiles' y actualiza automáticamente el avatar_url del usuario.
 * Retorna la URL pública.
 */
export const uploadProfilePhoto = async (
    file: File,
    userId: string,
    accessToken: string
): Promise<string> => {
    const formData = new FormData();
    const fileExt = file.name.split('.').pop() || 'jpg';
    const newFileName = `${userId}_avatar_${Date.now()}.${fileExt}`;
    formData.append('file', file, newFileName);

    const response = await fetch(`${API_BASE}/users/me/upload-photo`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.detail || 'Error al subir la foto');
    }

    const { url } = await response.json();
    return url;
};

/**
 * Convert a base64 data URI (from Capacitor Camera) to a File object.
 */
export const base64ToFile = (base64: string, fileName: string): File => {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], fileName, { type: mime });
};
