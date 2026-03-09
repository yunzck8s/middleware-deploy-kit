import { describe, it, expect, vi } from 'vitest';
import { Routes, Route, MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../../store/authSlice';
import MainLayout from '../Layout';
import { render, screen } from '../../../test/utils';

vi.mock('../../../api/auth', () => ({
  logout: vi.fn(),
}));

const createStore = () => configureStore({
  reducer: { auth: authReducer },
  preloadedState: {
    auth: {
      user: { id: 1, username: 'admin', created_at: '', updated_at: '' },
      token: 'token',
      isAuthenticated: true,
    },
  },
});

describe('MainLayout', () => {
  it('shows only nginx navigation entries', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/middleware/nginx/packages']}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route path="middleware/nginx/packages" element={<div>Packages Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Nginx 运维控制台')).toBeInTheDocument();
    expect(screen.getByText('概览')).toBeInTheDocument();
    expect(screen.getByText('Nginx 运维控制台')).toBeInTheDocument();
    expect(screen.queryByText('Redis')).not.toBeInTheDocument();
    expect(screen.queryByText('OpenSSH')).not.toBeInTheDocument();
  });
});
