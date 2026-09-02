'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isValidPin } from '@/lib/privacy-pin';
import {
  encryptionMode,
  unlockVault,
  vaultError,
  type VaultSession,
} from '@/lib/encrypted-vault';

export function PrivacyPinDialog({
  destination,
  onCancel,
  onUnlock,
}: {
  destination: string;
  onCancel: () => void;
  onUnlock: (session: VaultSession) => void;
}) {
  const [mode] = useState<'setup' | 'unlock' | 'unavailable'>(() => {
    try {
      return encryptionMode(localStorage);
    } catch {
      return 'unavailable';
    }
  });
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const id = useId();
  useEffect(() => {
    mounted.current = true;
    const deactivate = () => {
      mounted.current = false;
    };
    window.addEventListener('pagehide', deactivate);
    return () => {
      mounted.current = false;
      window.removeEventListener('pagehide', deactivate);
    };
  }, []);
  const cancel = () => {
    mounted.current = false;
    onCancel();
  };

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || mode === 'unavailable') return;
    if (!isValidPin(pin)) {
      setError('请输入四位数字密码');
      return;
    }
    if (mode === 'setup' && pin !== confirmation) {
      setError('两次输入的密码不一致');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const session = await unlockVault(
        localStorage,
        pin,
        mode,
        () => mounted.current,
      );
      if (mounted.current) {
        setPin('');
        setConfirmation('');
        onUnlock(session);
      }
    } catch (e) {
      if (mounted.current) {
        setPin('');
        setError(vaultError(e));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <DialogContent className="privacy-dialog" showCloseButton={false}>
        <DialogHeader>
          <div className="privacy-icon">
            <LockKeyhole size={22} />
          </div>
          <DialogTitle>
            {mode === 'setup' ? '设置四位数字密码' : '请输入四位数字密码'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'setup'
              ? '首次启用本地加密。设置后可直接写新日志，重新打开网页时查看历史或分析仍需验证。'
              : `验证后进入${destination}；如有旧日志，会先将其加密迁移。本次打开期间无需重复输入。`}
          </DialogDescription>
        </DialogHeader>
        {mode === 'unavailable' ? (
          <>
            <p className="privacy-error" role="alert">
              暂时无法启用加密或读取已有数据。请用最新版 Chrome 或 Edge 打开
              HTML，并检查本地存储权限。请勿清除原有数据。
            </p>
            <Button variant="outline" onClick={cancel}>
              返回首页
            </Button>
          </>
        ) : (
          <form className="privacy-form" onSubmit={submit}>
            <label htmlFor={`${id}-pin`}>
              {mode === 'setup' ? '设置密码' : '查看密码'}
            </label>
            <Input
              id={`${id}-pin`}
              className="privacy-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              minLength={4}
              required
              autoComplete={
                mode === 'setup' ? 'new-password' : 'current-password'
              }
              value={pin}
              disabled={busy}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              placeholder="四位数字"
            />
            {mode === 'setup' && (
              <>
                <label htmlFor={`${id}-confirm`}>再次确认密码</label>
                <Input
                  id={`${id}-confirm`}
                  className="privacy-input"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  minLength={4}
                  required
                  autoComplete="new-password"
                  disabled={busy}
                  value={confirmation}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => {
                    setConfirmation(
                      event.target.value.replace(/\D/g, '').slice(0, 4),
                    );
                    setError('');
                  }}
                  placeholder="再次输入四位数字"
                />
              </>
            )}
            {error && (
              <p id={`${id}-error`} className="privacy-error" role="alert">
                {error}
              </p>
            )}
            <div className="privacy-actions">
              <Button type="button" variant="outline" onClick={cancel}>
                取消
              </Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? '正在解锁 / 加密…'
                  : mode === 'setup'
                    ? '设置并进入'
                    : '解锁并进入'}
              </Button>
            </div>
            <p className="privacy-note">
              内容加密保存在此浏览器，日历日期仍可见。密码遗忘后无法恢复；四位数字仅适合基础隐私保护，无法抵御专业离线破解。请在首页定期下载加密备份，清除浏览器数据会丢失日志。
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
