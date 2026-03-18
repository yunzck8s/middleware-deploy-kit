import type { MiddlewareInstance } from '../types';

// 从实例中提取安装目录（优先 install_path，其次 deploy_params）
export function getInstallDir(instance: MiddlewareInstance): string {
  if (instance.install_path) return instance.install_path;
  if (!instance.deploy_params) return '';
  try {
    const params = typeof instance.deploy_params === 'string'
      ? JSON.parse(instance.deploy_params)
      : instance.deploy_params;
    return params.NGINX_INSTALL_DIR || params.REDIS_INSTALL_DIR || params.OPENSSH_INSTALL_DIR || params.install_dir || '';
  } catch {
    return '';
  }
}

// 环境标签翻译
export const envLabels: Record<string, string> = {
  prod: '生产',
  test: '测试',
  dev: '开发',
};

export const envColors: Record<string, string> = {
  prod: 'red',
  test: 'orange',
  dev: 'blue',
};
