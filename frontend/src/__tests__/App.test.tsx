import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '../test/utils';
import authReducer from '../store/authSlice';
import App from '../App';

vi.mock('../api/auth', () => ({
  getProfile: vi.fn().mockResolvedValue({}),
}));

vi.mock('../components/common/Layout', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    default: () => (
      <div>
        <span>Mock Layout</span>
        <actual.Outlet />
      </div>
    ),
  };
});

vi.mock('../pages/Dashboard', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('../pages/Middleware', () => ({ default: () => <div>Packages Page</div> }));
vi.mock('../pages/Certificates', () => ({ default: () => <div>Certificates Page</div> }));
vi.mock('../pages/Servers', () => ({ default: () => <div>Servers Page</div> }));
vi.mock('../pages/NginxConfig', () => ({ default: () => <div>Nginx Config Page</div> }));
vi.mock('../pages/Deployments', () => ({ default: () => <div>Deployments Page</div> }));

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nginx packages page at correct route', async () => {
    window.history.pushState({}, '', '/middleware/nginx/packages');

    const store = configureStore({
      reducer: { auth: authReducer },
      preloadedState: {
        auth: {
          user: { id: 1, username: 'admin', created_at: '', updated_at: '' },
          token: 'token',
          isAuthenticated: true,
        },
      },
    });

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Packages Page')).toBeInTheDocument();
    });
  });
});
