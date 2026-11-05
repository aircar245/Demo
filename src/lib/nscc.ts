import { requestNsccTicket } from '@/lib/api/auth';

export const NSCC_ORIGIN = process.env.NEXT_PUBLIC_NSCC_ORIGIN;
export const isPlaceholderNscc = NSCC_ORIGIN?.replace(/\/+$/, '') === 'https://example.com';

export function launchNscc(): Promise<void> {
  if (!NSCC_ORIGIN) return Promise.reject(new Error('NSCC 地址尚未配置'));
  if (isPlaceholderNscc) return Promise.reject(new Error('演示环境尚未连接 NSCC'));

  const nsccWindow = window.open(
    `${NSCC_ORIGIN}/auth/login/external`,
    'nscc',
  );
  if (!nsccWindow) return Promise.reject(new Error('浏览器拦截了 NSCC 窗口'));

  return new Promise((resolve, reject) => {
    let exchanging = false;
    const receiveReady = async (event: MessageEvent) => {
      if (event.origin !== NSCC_ORIGIN || event.source !== nsccWindow) return;
      if (
        event.data?.type !== 'NSCC_LOGIN_READY' ||
        typeof event.data.nonce !== 'string' ||
        exchanging
      ) {
        return;
      }

      exchanging = true;
      try {
        const ticket = await requestNsccTicket();
        nsccWindow.postMessage(
          {
            type: 'NSCC_EXTERNAL_TOKEN',
            nonce: event.data.nonce,
            accessToken: ticket,
          },
          NSCC_ORIGIN,
        );
        window.removeEventListener('message', receiveReady);
        resolve();
      } catch (error) {
        window.removeEventListener('message', receiveReady);
        reject(error);
      }
    };

    window.addEventListener('message', receiveReady);
  });
}
