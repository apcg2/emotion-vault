import { useEffect, useId, useRef, useState } from 'react';
import { Download, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BACKUP_MAX_BYTES,
  canRestoreBackup,
  exportEncryptedBackup,
  restoreEncryptedBackup,
  vaultError,
} from '@/lib/encrypted-vault';

export function BackupDialog({
  onClose,
  onRestored,
}: {
  onClose: () => void;
  onRestored: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [canRestore, setCanRestore] = useState(() => {
    try {
      return canRestoreBackup(localStorage);
    } catch {
      return false;
    }
  });
  const active = useRef(true);
  const inFlight = useRef(false);
  const id = useId();
  useEffect(() => {
    active.current = true;
    const cancel = () => {
      active.current = false;
    };
    window.addEventListener('pagehide', cancel);
    return () => {
      active.current = false;
      window.removeEventListener('pagehide', cancel);
    };
  }, []);
  const close = () => {
    active.current = false;
    onClose();
  };
  const download = () => {
    setError('');
    setMessage('');
    try {
      const backup = exportEncryptedBackup(localStorage);
      const url = URL.createObjectURL(
        new Blob([backup], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `emotion-vault-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage('已发起加密备份下载。请确认文件已保存，并妥善保管原密码。');
    } catch (e) {
      setError(vaultError(e));
    }
  };
  const restore = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || !file) return;
    setError('');
    setMessage('');
    if (file.size > BACKUP_MAX_BYTES) {
      setError('备份文件不能超过 16 MB。');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const count = await restoreEncryptedBackup(
        localStorage,
        await file.text(),
        pin,
        () => active.current,
      );
      if (active.current) {
        setCanRestore(false);
        setFile(null);
        setMessage(
          `已恢复 ${count} 条日志。查看历史或分析时，请使用备份原来的密码。`,
        );
        onRestored();
      }
    } catch (e) {
      if (active.current) setError(vaultError(e));
    } finally {
      inFlight.current = false;
      if (active.current) {
        setPin('');
        setBusy(false);
      }
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="privacy-dialog backup-dialog"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>备份与恢复</DialogTitle>
          <DialogDescription>
            日志在此浏览器里，不在 HTML
            文件中。移动文件、更换浏览器或更新前，请先下载加密备份。
          </DialogDescription>
        </DialogHeader>
        <section className="backup-section" aria-label="下载备份">
          <h3>
            <Download size={17} /> 下载加密备份
          </h3>
          <p>备份不包含明文日志或密码。恢复需要原密码；忘记密码无法找回。</p>
          <Button variant="outline" onClick={download} disabled={busy}>
            下载加密备份
          </Button>
        </section>
        <section className="backup-section" aria-label="恢复备份">
          <h3>
            <FolderOpen size={17} /> 从备份恢复
          </h3>
          {canRestore ? (
            <form className="privacy-form" onSubmit={restore}>
              <p>
                仅向空白环境恢复。先验证密码和全部记录，再保存；不会覆盖已有数据。
              </p>
              <label htmlFor={`${id}-file`}>选择加密备份（JSON）</label>
              <input
                id={`${id}-file`}
                className="backup-file"
                type="file"
                accept=".json,application/json"
                required
                disabled={busy}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError('');
                }}
              />
              <label htmlFor={`${id}-pin`}>备份原密码</label>
              <Input
                id={`${id}-pin`}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="[0-9]{4}"
                minLength={4}
                maxLength={4}
                required
                value={pin}
                disabled={busy}
                placeholder="原来的四位数字密码"
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, '').slice(0, 4))
                }
              />
              <Button type="submit" disabled={busy || !file}>
                {busy ? '正在校验并恢复…' : '验证密码并恢复'}
              </Button>
            </form>
          ) : (
            <p>
              当前已有数据或密码，不能导入覆盖。请先备份当前数据；如需恢复另一份备份，请在未使用过的独立浏览器资料中打开本页面，不要清除原数据。
            </p>
          )}
        </section>
        {error && (
          <p className="privacy-error" role="alert">
            {error}
          </p>
        )}
        {message && <output className="backup-status">{message}</output>}
        <Button variant="outline" onClick={close}>
          {busy ? '取消并关闭' : '关闭'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
