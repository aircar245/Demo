'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { requestNsccTicket } from '@/lib/api/auth';
import { tokenStore } from '@/lib/api/client';
import { isPlaceholderNscc, NSCC_ORIGIN } from '@/lib/nscc';

export default function NsccBridgePage() {
  const router = useRouter();
  const [message, setMessage] = useState('正在连接 NSCC...');

  useEffect(() => {
    if (isPlaceholderNscc) {
      setMessage('演示环境尚未连接 NSCC');
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const nsccOrigin = params.get('nscc_origin');
    const nonce = params.get('nscc_nonce');

    if (!NSCC_ORIGIN || nsccOrigin !== NSCC_ORIGIN || !nonce) {
      setMessage('NSCC 登录请求无效');
      return;
    }
    if (!window.opener) {
      setMessage('请从 NSCC 登录页面重新发起登录');
      return;
    }
    if (!tokenStore.getAccess()) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    let cancelled = false;
    void requestNsccTicket()
      .then((ticket) => {
        if (cancelled) return;
        window.opener.postMessage(
          {
            type: 'NSCC_EXTERNAL_TOKEN',
            nonce,
            accessToken: ticket,
          },
          NSCC_ORIGIN,
        );
        setMessage('认证成功，正在返回 NSCC...');
        window.setTimeout(() => window.close(), 300);
      })
      .catch(() => setMessage('认证失败，请返回招新平台重新登录'));

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-[calc(100dvh-3rem)] flex items-center justify-center px-4" style={{ background: 'var(--ow-bg)' }}>
      <div className="border px-8 py-6 text-center" style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' }}>
        <div className="ow-mono text-xs tracking-widest" style={{ color: 'var(--ow-text-dim)' }}>
          {message}
        </div>
      </div>
    </main>
  );
}
