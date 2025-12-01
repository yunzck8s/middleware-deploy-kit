import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, logout, getProfile, changePassword } from '../auth';
import client from '../client';
import { mockApiResponse } from '../../test/utils';

// Mock the axios client
vi.mock('../client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('successfully logs in with valid credentials', async () => {
      const mockLoginData = {
        username: 'admin',
        password: 'admin123',
      };

      const mockResponse = mockApiResponse({
        token: 'mock-jwt-token',
        user: {
          id: 1,
          username: 'admin',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      });

      vi.mocked(client.post).mockResolvedValue(mockResponse);

      const result = await login(mockLoginData);

      expect(client.post).toHaveBeenCalledWith('/auth/login', mockLoginData);
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.username).toBe('admin');
    });

    it('throws error when credentials are invalid', async () => {
      const mockLoginData = {
        username: 'admin',
        password: 'wrong',
      };

      const mockError = {
        code: 401,
        message: '用户名或密码错误',
      };

      vi.mocked(client.post).mockRejectedValue(mockError);

      await expect(login(mockLoginData)).rejects.toEqual(mockError);
      expect(client.post).toHaveBeenCalledWith('/auth/login', mockLoginData);
    });

    it('handles network errors', async () => {
      const mockLoginData = {
        username: 'admin',
        password: 'admin123',
      };

      const networkError = {
        code: 500,
        message: '网络错误，请稍后重试',
      };

      vi.mocked(client.post).mockRejectedValue(networkError);

      await expect(login(mockLoginData)).rejects.toEqual(networkError);
    });
  });

  describe('logout', () => {
    it('successfully logs out', async () => {
      vi.mocked(client.post).mockResolvedValue({});

      await logout();

      expect(client.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('handles logout errors', async () => {
      const mockError = {
        code: 500,
        message: '登出失败',
      };

      vi.mocked(client.post).mockRejectedValue(mockError);

      await expect(logout()).rejects.toEqual(mockError);
    });
  });

  describe('getProfile', () => {
    it('successfully retrieves user profile', async () => {
      const mockUser = {
        id: 1,
        username: 'admin',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockResponse = mockApiResponse({ user: mockUser });

      vi.mocked(client.get).mockResolvedValue(mockResponse);

      const result = await getProfile();

      expect(client.get).toHaveBeenCalledWith('/auth/profile');
      expect(result).toEqual(mockUser);
      expect(result.username).toBe('admin');
    });

    it('handles unauthorized access', async () => {
      const mockError = {
        code: 401,
        message: '未授权',
      };

      vi.mocked(client.get).mockRejectedValue(mockError);

      await expect(getProfile()).rejects.toEqual(mockError);
    });
  });

  describe('changePassword', () => {
    it('successfully changes password', async () => {
      const mockPasswordData = {
        old_password: 'oldpass123',
        new_password: 'newpass123',
      };

      const mockResponse = mockApiResponse({ message: '密码修改成功' });

      vi.mocked(client.put).mockResolvedValue(mockResponse);

      await changePassword(mockPasswordData);

      expect(client.put).toHaveBeenCalledWith('/auth/password', mockPasswordData);
    });

    it('handles incorrect old password', async () => {
      const mockPasswordData = {
        old_password: 'wrongpass',
        new_password: 'newpass123',
      };

      const mockError = {
        code: 400,
        message: '原密码错误',
      };

      vi.mocked(client.put).mockRejectedValue(mockError);

      await expect(changePassword(mockPasswordData)).rejects.toEqual(mockError);
    });

    it('handles weak new password', async () => {
      const mockPasswordData = {
        old_password: 'oldpass123',
        new_password: '123',
      };

      const mockError = {
        code: 400,
        message: '密码长度不能少于6位',
      };

      vi.mocked(client.put).mockRejectedValue(mockError);

      await expect(changePassword(mockPasswordData)).rejects.toEqual(mockError);
    });
  });
});
