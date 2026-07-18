const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;

export interface DocumentResponse {
    id: string;
    owner_type: 'user' | 'vehicle' | 'trip';
    owner_id: string;
    file_type: string;
    file_url: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    created_at: string;
}

const handleResponse = async <T>(response: Response): Promise<T> => {
    const result = await response.json();
    if (response.ok) return result as T;
    throw new Error(result?.detail || result?.error?.message || result?.message || 'Error en la petición');
};

const authHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1',
});

// 1. Upload file to Local Backend Storage
export const uploadDocumentFile = async (
    file: File,
    userId: string,
    docType: string,
    token: string
): Promise<string> => {
    const formData = new FormData();
    // Rename file to avoid collisions and append doctype context
    const fileExt = file.name.split('.').pop() || 'tmp';
    const newFileName = `${userId}_${docType}_${Date.now()}.${fileExt}`;
    // Use the native file but with a specialized name in backend
    formData.append('file', file, newFileName);

    const response = await fetch(`${API_BASE}/documents/upload-document`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': '1',
        },
        body: formData,
    });

    const result = await handleResponse<{ url: string }>(response);
    return result.url;
};

// 2. Create document record in backend
export const createDocumentRecord = async (
    token: string,
    ownerType: 'user' | 'vehicle' | 'trip',
    ownerId: string,
    fileType: string,
    fileUrl: string
): Promise<DocumentResponse> => {
    const response = await fetch(`${API_BASE}/documents/`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
            owner_type: ownerType,
            owner_id: ownerId,
            file_type: fileType,
            file_url: fileUrl,
        }),
    });
    return handleResponse<DocumentResponse>(response);
};
