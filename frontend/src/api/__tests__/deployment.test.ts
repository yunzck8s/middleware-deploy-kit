import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDeploymentList,
  getDeploymentDetail,
  createDeployment,
  deleteDeployment,
  executeDeployment,
  getDeploymentLogs,
  rollbackDeployment,
} from '../deployment';
import client from '../client';
import { mockApiResponse } from '../../test/utils';
import type { Deployment, DeploymentLog } from '../../types';

// Mock the axios client
vi.mock('../client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Deployment API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDeploymentList', () => {
    it('fetches deployment list without filters', async () => {
      const mockDeployments: Deployment[] = [
        {
          id: 1,
          name: 'Deploy Nginx',
          description: 'Test deployment',
          type: 'nginx_config',
          server_id: 1,
          status: 'success',
          target_path: '/etc/nginx',
          backup_enabled: true,
          backup_path: '',
          restart_service: true,
          service_name: 'nginx',
          duration: 30,
          error_msg: '',
          can_rollback: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        } as Deployment,
      ];

      const mockResponse = mockApiResponse({
        deployments: mockDeployments,
        total: 1,
        page: 1,
        page_size: 10,
      });

      vi.mocked(client.get).mockResolvedValue(mockResponse);

      const result = await getDeploymentList();

      expect(client.get).toHaveBeenCalledWith('/deployments', { params: {} });
      expect(result.deployments).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('fetches deployment list with filters', async () => {
      const params = {
        status: 'success',
        type: 'nginx_config',
        page: 2,
        page_size: 20,
      };

      const mockResponse = mockApiResponse({
        deployments: [],
        total: 0,
        page: 2,
        page_size: 20,
      });

      vi.mocked(client.get).mockResolvedValue(mockResponse);

      await getDeploymentList(params);

      expect(client.get).toHaveBeenCalledWith('/deployments', { params });
    });

    it('handles empty results', async () => {
      const mockResponse = mockApiResponse({
        deployments: [],
        total: 0,
        page: 1,
        page_size: 10,
      });

      vi.mocked(client.get).mockResolvedValue(mockResponse);

      const result = await getDeploymentList();

      expect(result.deployments).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getDeploymentDetail', () => {
    it('fetches deployment details by id', async () => {
      const mockDeployment: Deployment = {
        id: 1,
        name: 'Deploy Nginx',
        description: 'Test deployment',
        type: 'nginx_config',
        server_id: 1,
        status: 'success',
        target_path: '/etc/nginx',
        backup_enabled: true,
        backup_path: '/backup/nginx.conf.bak.20240101',
        restart_service: true,
        service_name: 'nginx',
        duration: 30,
        error_msg: '',
        can_rollback: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as Deployment;

      const mockResponse = mockApiResponse(mockDeployment);

      vi.mocked(client.get).mockResolvedValue(mockResponse);

      const result = await getDeploymentDetail(1);

      expect(client.get).toHaveBeenCalledWith('/deployments/1');
      expect(result.id).toBe(1);
      expect(result.name).toBe('Deploy Nginx');
    });

    it('handles deployment not found', async () => {
      const mockError = {
        code: 404,
        message: '部署任务不存在',
      };

      vi.mocked(client.get).mockRejectedValue(mockError);

      await expect(getDeploymentDetail(999)).rejects.toEqual(mockError);
    });
  });

  describe('createDeployment', () => {
    it('creates a new deployment', async () => {
      const newDeployment = {
        name: 'New Deployment',
        description: 'Test',
        type: 'nginx_config' as const,
        server_id: 1,
        nginx_config_id: 1,
        target_path: '/etc/nginx',
        backup_enabled: true,
        restart_service: true,
        service_name: 'nginx',
      };

      const mockResponse = mockApiResponse({
        ...newDeployment,
        id: 1,
        status: 'pending',
        duration: 0,
        error_msg: '',
        can_rollback: false,
        backup_path: '',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as Deployment);

      vi.mocked(client.post).mockResolvedValue(mockResponse);

      const result = await createDeployment(newDeployment);

      expect(client.post).toHaveBeenCalledWith('/deployments', newDeployment);
      expect(result.name).toBe('New Deployment');
      expect(result.status).toBe('pending');
    });

    it('handles validation errors', async () => {
      const invalidDeployment = {
        name: '',
        type: 'nginx_config' as const,
        server_id: 0,
      };

      const mockError = {
        code: 400,
        message: '参数验证失败',
      };

      vi.mocked(client.post).mockRejectedValue(mockError);

      await expect(createDeployment(invalidDeployment)).rejects.toEqual(mockError);
    });
  });

  describe('deleteDeployment', () => {
    it('deletes a deployment by id', async () => {
      vi.mocked(client.delete).mockResolvedValue({});

      await deleteDeployment(1);

      expect(client.delete).toHaveBeenCalledWith('/deployments/1');
    });

    it('handles deletion errors', async () => {
      const mockError = {
        code: 400,
        message: '无法删除正在运行的部署',
      };

      vi.mocked(client.delete).mockRejectedValue(mockError);

      await expect(deleteDeployment(1)).rejects.toEqual(mockError);
    });
  });

  describe('executeDeployment', () => {
    it('executes a deployment', async () => {
      const mockResponse = mockApiResponse({
        message: '部署任务已开始执行',
      });

      vi.mocked(client.post).mockResolvedValue(mockResponse);

      const result = await executeDeployment(1);

      expect(client.post).toHaveBeenCalledWith('/deployments/1/execute');
      expect(result.message).toBe('部署任务已开始执行');
    });

    it('handles execution errors', async () => {
      const mockError = {
        code: 400,
        message: '该部署任务已在执行中',
      };

      vi.mocked(client.post).mockRejectedValue(mockError);

      await expect(executeDeployment(1)).rejects.toEqual(mockError);
    });
  });

  describe('getDeploymentLogs', () => {
    it('fetches deployment logs', async () => {
      const mockLogs: DeploymentLog[] = [
        {
          id: 1,
          deployment_id: 1,
          step: 1,
          action: 'SSH 连接',
          status: 'success',
          output: 'Connected successfully',
          error_msg: '',
          duration: 500,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          deployment_id: 1,
          step: 2,
          action: '上传配置',
          status: 'success',
          output: 'File uploaded',
          error_msg: '',
          duration: 1000,
          created_at: '2024-01-01T00:00:01Z',
        },
      ];

      const mockResponse = mockApiResponse(mockLogs);

      vi.mocked(client.get).mockResolvedValue(mockResponse);

      const result = await getDeploymentLogs(1);

      expect(client.get).toHaveBeenCalledWith('/deployments/1/logs');
      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('SSH 连接');
    });

    it('handles empty logs', async () => {
      const mockResponse = mockApiResponse([]);

      vi.mocked(client.get).mockResolvedValue(mockResponse);

      const result = await getDeploymentLogs(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('rollbackDeployment', () => {
    it('successfully rolls back a deployment', async () => {
      const mockRollbackDeployment: Deployment = {
        id: 2,
        name: 'Rollback: Deploy Nginx',
        description: '回滚部署 #1',
        type: 'nginx_config',
        server_id: 1,
        status: 'pending',
        target_path: '/etc/nginx',
        backup_enabled: false,
        backup_path: '',
        restart_service: true,
        service_name: 'nginx',
        duration: 0,
        error_msg: '',
        can_rollback: false,
        rolled_back_from: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as Deployment;

      const mockResponse = mockApiResponse({
        message: '回滚任务已创建并开始执行',
        deployment: mockRollbackDeployment,
      });

      vi.mocked(client.post).mockResolvedValue(mockResponse);

      const result = await rollbackDeployment(1);

      expect(client.post).toHaveBeenCalledWith('/deployments/1/rollback');
      expect(result.message).toBe('回滚任务已创建并开始执行');
      expect(result.deployment.rolled_back_from).toBe(1);
    });

    it('handles rollback errors when backup not available', async () => {
      const mockError = {
        code: 400,
        message: '该部署不支持回滚或备份文件不存在',
      };

      vi.mocked(client.post).mockRejectedValue(mockError);

      await expect(rollbackDeployment(1)).rejects.toEqual(mockError);
    });

    it('handles rollback errors when deployment not found', async () => {
      const mockError = {
        code: 404,
        message: '部署任务不存在',
      };

      vi.mocked(client.post).mockRejectedValue(mockError);

      await expect(rollbackDeployment(999)).rejects.toEqual(mockError);
    });
  });
});
