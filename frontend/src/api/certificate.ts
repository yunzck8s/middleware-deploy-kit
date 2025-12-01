import client from './client';
import type { Certificate, ApiResponse } from '../types';

export interface CertificateListParams {
  status?: 'active' | 'expired';
  page?: number;
  page_size?: number;
}

export interface CertificateListResponse {
  certificates: Certificate[];
  total: number;
  page: number;
  page_size: number;
}

export interface UploadCertificateData {
  name: string;
  domain?: string;
  cert_file: File;
  key_file: File;
}

// 获取证书列表
export const getCertificateList = async (params: CertificateListParams = {}): Promise<CertificateListResponse> => {
  const response = await client.get<ApiResponse<CertificateListResponse>>('/certificates', { params });
  return (response as unknown as ApiResponse<CertificateListResponse>).data!;
};

// 获取证书详情
export const getCertificateDetail = async (id: number): Promise<Certificate> => {
  const response = await client.get<ApiResponse<Certificate>>(`/certificates/${id}`);
  return (response as unknown as ApiResponse<Certificate>).data!;
};

// 上传证书
export const uploadCertificate = async (data: UploadCertificateData): Promise<Certificate> => {
  const formData = new FormData();
  formData.append('name', data.name);
  if (data.domain) formData.append('domain', data.domain);
  formData.append('cert_file', data.cert_file);
  formData.append('key_file', data.key_file);

  const response = await client.post<ApiResponse<Certificate>>('/certificates', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return (response as unknown as ApiResponse<Certificate>).data!;
};

// 删除证书
export const deleteCertificate = async (id: number): Promise<void> => {
  await client.delete<ApiResponse<void>>(`/certificates/${id}`);
};

// 下载证书文件
export const downloadCertificateFile = async (id: number, type: 'cert' | 'key'): Promise<Blob> => {
  const response = await client.get(`/certificates/${id}/download`, {
    params: { type },
    responseType: 'blob',
  });
  return response as unknown as Blob;
};
