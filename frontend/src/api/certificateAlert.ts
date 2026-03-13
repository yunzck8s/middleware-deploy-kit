import client from './client';
import type { ApiResponse } from '../types';

export interface CertificateAlertConfig {
  id: number;
  certificate_id: number;
  enabled: boolean;
  threshold_days: string;
  notify_internal: boolean;
  notify_email: boolean;
  notify_webhook: boolean;
  email_recipients: string;
  created_at: string;
  updated_at: string;
}

export interface AlertConfigRequest {
  certificate_id: number;
  enabled: boolean;
  threshold_days: string;
  notify_internal: boolean;
  notify_email: boolean;
  notify_webhook: boolean;
  email_recipients: string;
}

export const certificateAlertAPI = {
  createOrUpdate: async (data: AlertConfigRequest) => {
    const response = await client.post<ApiResponse<CertificateAlertConfig>>('/certificate-alerts', data);
    return (response as unknown as ApiResponse<CertificateAlertConfig>).data!;
  },

  get: async (certificateId: number) => {
    const response = await client.get<ApiResponse<CertificateAlertConfig>>(`/certificate-alerts/${certificateId}`);
    return (response as unknown as ApiResponse<CertificateAlertConfig>).data!;
  },
};
