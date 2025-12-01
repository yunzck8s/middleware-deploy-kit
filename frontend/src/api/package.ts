import client from './client';
import type { MiddlewarePackage, ApiResponse, PackageMetadata } from '../types';

export interface PackageListParams {
  name?: string;
  os_type?: string;
  page?: number;
  page_size?: number;
}

export interface PackageListResponse {
  packages: MiddlewarePackage[];
  total: number;
  page: number;
  page_size: number;
}

export interface UploadPackageData {
  name: string;
  version: string;
  display_name?: string;
  description?: string;
  os_type: string;
  os_version: string;
  file: File;
}

// 获取离线包列表
export const getPackageList = async (params: PackageListParams = {}): Promise<PackageListResponse> => {
  const response = await client.get<ApiResponse<PackageListResponse>>('/packages', { params });
  return (response as unknown as ApiResponse<PackageListResponse>).data!;
};

// 获取离线包详情
export const getPackageDetail = async (id: number): Promise<MiddlewarePackage> => {
  const response = await client.get<ApiResponse<MiddlewarePackage>>(`/packages/${id}`);
  return (response as unknown as ApiResponse<MiddlewarePackage>).data!;
};

// 上传离线包
export const uploadPackage = async (data: UploadPackageData): Promise<MiddlewarePackage> => {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('version', data.version);
  formData.append('os_type', data.os_type);
  formData.append('os_version', data.os_version);
  if (data.display_name) formData.append('display_name', data.display_name);
  if (data.description) formData.append('description', data.description);
  formData.append('file', data.file);

  const response = await client.post<ApiResponse<MiddlewarePackage>>('/packages', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return (response as unknown as ApiResponse<MiddlewarePackage>).data!;
};

// 删除离线包
export const deletePackage = async (id: number): Promise<void> => {
  await client.delete<ApiResponse<void>>(`/packages/${id}`);
};

// 获取离线包元数据
export const getPackageMetadata = async (id: number): Promise<PackageMetadata> => {
  const response = await client.get<ApiResponse<PackageMetadata>>(`/packages/${id}/metadata`);
  return (response as unknown as ApiResponse<PackageMetadata>).data!;
};
