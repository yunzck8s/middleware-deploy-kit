import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../test/utils';
import Login from '../Login';
import * as authApi from '../../api/auth';

// Mock the auth API
vi.mock('../../api/auth', () => ({
  login: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form correctly', () => {
    renderWithProviders(<Login />);

    expect(screen.getByText('中间件部署平台')).toBeInTheDocument();
    expect(screen.getByText('Middleware Deploy Kit')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登.*录/ })).toBeInTheDocument();
    expect(screen.getByText('默认账号: admin / admin123')).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const submitButton = screen.getByRole('button', { name: /登.*录/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeInTheDocument();
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
    });
  });

  it('successfully logs in with valid credentials', async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      user: {
        id: 1,
        username: 'admin',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      token: 'mock-token-123',
    };

    vi.mocked(authApi.login).mockResolvedValue(mockLoginResponse);

    const { store } = renderWithProviders(<Login />);

    // Fill in the form
    const usernameInput = screen.getByPlaceholderText('用户名');
    const passwordInput = screen.getByPlaceholderText('密码');
    const submitButton = screen.getByRole('button', { name: /登.*录/ });

    await user.type(usernameInput, 'admin');
    await user.type(passwordInput, 'admin123');
    await user.click(submitButton);

    // Wait for API call
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        username: 'admin',
        password: 'admin123',
      });
    });

    // Check that credentials were stored in Redux
    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.user).toEqual(mockLoginResponse.user);
      expect(state.auth.token).toEqual(mockLoginResponse.token);
    });

    // Check navigation
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows error message when login fails', async () => {
    const user = userEvent.setup();
    const errorMessage = '用户名或密码错误';

    vi.mocked(authApi.login).mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<Login />);

    const usernameInput = screen.getByPlaceholderText('用户名');
    const passwordInput = screen.getByPlaceholderText('密码');
    const submitButton = screen.getByRole('button', { name: /登.*录/ });

    await user.type(usernameInput, 'wrong');
    await user.type(passwordInput, 'wrong');
    await user.click(submitButton);

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalled();
    });

    // The component should remain on login page
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('disables submit button while logging in', async () => {
    const user = userEvent.setup();

    // Create a promise that we can control
    let resolveLogin: (value: any) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });

    vi.mocked(authApi.login).mockReturnValue(loginPromise as any);

    renderWithProviders(<Login />);

    const usernameInput = screen.getByPlaceholderText('用户名');
    const passwordInput = screen.getByPlaceholderText('密码');
    const submitButton = screen.getByRole('button', { name: /登.*录/ });

    await user.type(usernameInput, 'admin');
    await user.type(passwordInput, 'admin123');
    await user.click(submitButton);

    // Button should show loading state
    await waitFor(() => {
      expect(submitButton).toHaveClass('ant-btn-loading');
    });

    // Resolve the login
    resolveLogin!({
      user: { id: 1, username: 'admin' },
      token: 'token',
    });

    // Button should not be loading anymore
    await waitFor(() => {
      expect(submitButton).not.toHaveClass('ant-btn-loading');
    });
  });

  it('validates required username field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const passwordInput = screen.getByPlaceholderText('密码');
    const submitButton = screen.getByRole('button', { name: /登.*录/ });

    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeInTheDocument();
    });

    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('validates required password field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const usernameInput = screen.getByPlaceholderText('用户名');
    const submitButton = screen.getByRole('button', { name: /登.*录/ });

    await user.type(usernameInput, 'admin');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
    });

    expect(authApi.login).not.toHaveBeenCalled();
  });
});
