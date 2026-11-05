import axios from 'axios';
import { api } from './client';

export interface ChallengeFile {
  fileId: number;
  originalName: string;
  mimeType: string;
  size: number;
}

interface FileListResponse {
  status: number;
  files: ChallengeFile[];
}

export async function getChallengeFiles(challengeId: number): Promise<ChallengeFile[]> {
  const { data } = await api.get<FileListResponse>(`/file/list/${challengeId}`);
  return data.files ?? [];
}

export async function uploadChallengeFile(
  challengeId: number,
  file: File,
): Promise<{ status: number; fileId: number; originalName: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('challengeId', String(challengeId));

  const { data } = await api.post('/file/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return data;
}

export async function deleteChallengeFile(fileId: number): Promise<{ status: number }> {
  const { data } = await api.post(`/file/delete/${fileId}`);
  return data;
}

export async function downloadChallengeFile(file: ChallengeFile): Promise<void> {
  const response = await api.get<Blob>(`/file/download/${file.fileId}`, {
    responseType: 'blob',
    timeout: 120000,
  });

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.originalName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' ? message : fallback;
}
