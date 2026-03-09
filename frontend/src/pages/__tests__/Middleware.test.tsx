import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import Middleware from '../Middleware';
import * as packageApi from '../../api/package';

vi.mock('../../api/package', () => ({
  getPackageList: vi.fn(),
  uploadPackage: vi.fn(),
  deletePackage: vi.fn(),
}));

describe('Middleware Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(packageApi.getPackageList).mockResolvedValue({
      packages: [],
      total: 0,
      page: 1,
      page_size: 10,
    });
  });

  it('loads nginx packages only', async () => {
    renderWithProviders(<Middleware />);

    await waitFor(() => {
      expect(packageApi.getPackageList).toHaveBeenCalledWith({
        name: 'nginx',
        page: 1,
        page_size: 1000,
      });
    });
  });
});
