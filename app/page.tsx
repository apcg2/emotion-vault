'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { LogDetail } from '@/components/log-detail';
import {
  chooseLogFile,
  localLogFile,
  supportsLocalFiles,
  fileError,
} from '@/lib/local-file';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

type Emotion = {
  name: string;
  category: string;
  before: number;
  after: number;
};
type Response = { text: string; belief: number };
type Log = {
  id: string;
  ts: string;
  situation: string;
  emotions: Emotion[];
  thoughts: string;
  distortions: string[];
  responses: Response[];
};
type View = 'home' | 'log' | 'history' | 'analysis';
const GROUPS = [
  ['悲伤', ['忧郁', '沮丧', '消沉', '难过']],
  ['焦虑', ['担忧', '惊恐', '紧张', '害怕']],
  ['愧疚', ['悔过', '感觉不好', '羞愧']],
  ['自卑', ['无价值感', '无能', '有缺陷', '无竞争力']],
  ['孤独', ['不被爱', '被排斥', '被拒绝', '寂寞', '被抛弃']],
  ['尴尬', ['愚蠢', '受辱', '害羞']],
  ['无望', ['没有干劲', '悲观', '绝望']],
  ['沮丧', ['受阻', '受挫', '挫败感']],
  ['愤怒', ['抓狂', '仇恨', '恼怒', '易发火', '局促不安', '狂怒']],
  ['其他', []],
] as const;
const DISTORTIONS = [
  [
    '非黑即白',
    '「全有或全无」地看待事情，看不到中间地带。',
    '这次没考满分，我就是个彻底的失败者。',
  ],
  [
    '过度概括',
    '把一次偶然的失败当成永久的、普遍的定律。',
    '我总是把事情搞砸，每次都是这样。',
  ],
  [
    '心理过滤',
    '只盯着负面细节，自动过滤掉所有正面信息。',
    '收到 10 条好评和 1 条差评，整晚只想着那条差评。',
  ],
  [
    '否定正面',
    '把好事硬说成「不算数」，否定自己的成绩与优点。',
    '这次成功只是运气好，根本说明不了什么。',
  ],
  [
    '妄下结论',
    '没有确凿证据就急于下判断，包括读心术与消极预测。',
    '他没回消息，肯定是不想理我了。',
  ],
  [
    '放大与缩小',
    '把问题无限放大，把优点缩小到忽略不计。',
    '这点小失误太可怕了，天都要塌了。',
  ],
  [
    '情绪化推理',
    '把「我感觉」当成「事实」，用情绪代替证据。',
    '我觉得自己很没用，所以我肯定很没用。',
  ],
  ['应该句式', '用「应该 / 必须」苛责自己或他人。', '我就应该每次都做到最好。'],
  ['贴标签', '给自己或别人贴上以偏概全的负面标签。', '我太笨了。'],
  [
    '揽责上身',
    '把与自己无关的负面结果都归咎于自己。',
    '同事不开心，一定是我的错。',
  ],
] as const;
const TIPS = [
  [
    '如果法',
    '想想最坏情况真的发生会怎样，评估真实后果与应对力。',
    '即使最坏的情况真的发生了，我也能应付，因为……',
  ],
  [
    '同情法',
    '用安慰好友的方式安慰自己。',
    '如果好朋友遇到同样的事，我会安慰他说：……',
  ],
  [
    '真相法',
    '分别列出支持与反对这个想法的客观证据。',
    '支持这个想法的证据是……；反对的证据是……。更符合事实的说法是……',
  ],
  [
    '量化法',
    '把担忧写成概率，别用模糊的「可能」。',
    '这件事真实发生的概率大约是……%，而我能够应对的可能性是……',
  ],
  [
    '幽默法',
    '用夸张荒诞的方式重复灾难化的念头。',
    '如果把这个念头当成一个夸张的笑话来看，它听起来像是……',
  ],
  [
    '换框法',
    '寻找事件另一面或成长点，重新框定意义。',
    '这件事有没有另一面？有没有可能……',
  ],
  [
    '利弊法',
    '计算坚持这个想法的代价与放下的收益。',
    '坚持这个想法会让我失去……；放下它能让我得到……',
  ],
  ['行动法', '设计一个小实验去检验想法。', '我可以做一个小的验证实验：……'],
] as const;
const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (v = new Date()) =>
  `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
const dayStart = (v: Date) =>
  new Date(v.getFullYear(), v.getMonth(), v.getDate());
const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);
const avg = (v: number[]) =>
  v.length
    ? Math.round((v.reduce((s, n) => s + n, 0) / v.length) * 10) / 10
    : 0;
const blank = () => ({
  situation: '',
  thoughts: '',
  emotions: [] as Emotion[],
  distortions: [] as string[],
  responses: [{ text: '', belief: 50 }] as Response[],
});
export default function Home() {
  const [logs, setLogs] = useState<Log[]>(() => localLogFile.logs);
  const [view, setView] = useState<View>('home');
  const [name, setName] = useState(localLogFile.name);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selecting = useRef(false);
  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent) => {
      if (localLogFile.isBusy || selecting.current) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', leaving);
    return () => window.removeEventListener('beforeunload', leaving);
  }, []);
  async function selectFile(create: boolean) {
    if (selecting.current) return;
    selecting.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const handle = await chooseLogFile(create);
      const loaded = await (create
        ? localLogFile.create(handle)
        : localLogFile.open(handle));
      setLogs(loaded);
      setName(localLogFile.name);
      setMessage(
        create
          ? '已创建空白日志文件，可以开始记录。'
          : '已打开日志文件。后续保存和删除将写入此文件。',
      );
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError'))
        setError(fileError(e));
    } finally {
      selecting.current = false;
      setBusy(false);
    }
  }
  const copy = () => {
    try {
      const url = URL.createObjectURL(
        new Blob([localLogFile.exportText()], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `emotion-logs-copy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage('已发起明文副本下载，请确认文件保存成功。');
      setError('');
    } catch (e) {
      setError(fileError(e));
    }
  };
  return (
    <main className="min-h-screen bg-[#F5F3EF] text-[#1F2937]">
      <div className="app-shell">
        {view !== 'home' && (
          <button className="back-link" onClick={() => setView('home')}>
            <ChevronLeft size={18} /> 返回首页
          </button>
        )}
        {view === 'home' && (
          <HomePage
            logs={logs}
            onLog={() => {
              if (!name) {
                setError(
                  '请先点击“新建日志文件”，或打开以前保存的 JSON 文件。',
                );
                return;
              }
              setView('log');
            }}
            onHistory={() => setView('history')}
            onAnalysis={() => setView('analysis')}
            filePanel={
              <section className="file-panel" aria-label="本地日志文件">
                <strong>
                  {name ? `当前文件：${name}` : '开始前，选择本地日志文件'}
                </strong>
                <p>
                  首次点击“新建日志文件”，可保存在 HTML
                  旁边。以后每次打开网页，选择“打开日志文件”继续使用。
                </p>
                <div className="file-actions">
                  <Button
                    variant="outline"
                    onClick={() => void selectFile(true)}
                    disabled={busy}
                  >
                    新建日志文件
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void selectFile(false)}
                    disabled={busy}
                  >
                    打开日志文件
                  </Button>
                  {name && (
                    <Button variant="outline" onClick={copy} disabled={busy}>
                      下载副本
                    </Button>
                  )}
                </div>
                {!supportsLocalFiles() && (
                  <p className="file-error" role="alert">
                    当前浏览器不支持直接读写文件，请使用最新版桌面 Chrome 或
                    Edge。不会改用浏览器存储。
                  </p>
                )}
                {busy && <output>正在处理文件，请勿关闭网页…</output>}
                {message && <output className="file-status">{message}</output>}
                {error && (
                  <p className="file-error" role="alert">
                    {error}
                  </p>
                )}
              </section>
            }
          />
        )}
        {view === 'log' && (
          <LogPage
            onSave={async (record) => {
              const saved = await localLogFile.append(record);
              setLogs(saved);
              setMessage('日志已保存到本地文件。');
              setError('');
              setView('home');
            }}
          />
        )}
        {view === 'history' && (
          <HistoryPage
            logs={logs}
            onDelete={async (id) => {
              setLogs(await localLogFile.remove(id));
              setMessage('删除已保存到本地文件。');
            }}
          />
        )}
        {view === 'analysis' && <AnalysisPage logs={logs} />}
      </div>
    </main>
  );
}

function HomePage({
  logs,
  onLog,
  onHistory,
  onAnalysis,
  filePanel,
}: {
  logs: { ts: string }[];
  onLog: () => void;
  onHistory: () => void;
  onAnalysis: () => void;
  filePanel: React.ReactNode;
}) {
  const [mode, setMode] = useState<'week' | 'month'>('week'),
    [offset, setOffset] = useState(0);
  const today = dayStart(new Date());
  const period = useMemo(() => {
    const cells: (Date | null)[] = [];
    let title = '';
    if (mode === 'week') {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - offset * 7);
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        cells.push(d);
      }
      const anchor = new Date(monday);
      anchor.setDate(anchor.getDate() + 3);
      const first = new Date(anchor.getFullYear(), 0, 1);
      title = `${anchor.getFullYear()}年第${Math.ceil(((anchor.getTime() - first.getTime()) / 86400000 + 1) / 7)}周`;
    } else {
      const first = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      title = `${first.getFullYear()}年${first.getMonth() + 1}月`;
      for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells.push(null);
      const end = new Date(
        first.getFullYear(),
        first.getMonth() + 1,
        0,
      ).getDate();
      for (let i = 1; i <= end; i++)
        cells.push(new Date(first.getFullYear(), first.getMonth(), i));
    }
    return { cells, title };
  }, [mode, offset, today]);
  const dots = (d: Date) =>
    logs.filter((l) => sameDay(new Date(l.ts), d)).length;
  return (
    <>
      <header className="brand">
        <div className="brand-mark">~</div>
        <div>
          <h1>情绪知了</h1>
          <p>记录情绪，观察变化</p>
        </div>
      </header>
      {filePanel}
      <button className="entry-card" onClick={onLog}>
        <span>记录情绪日志</span>
        <span>→</span>
      </button>
      <button className="entry-card" onClick={onAnalysis}>
        <span>情绪分析</span>
        <span>→</span>
      </button>
      <section className="card calendar-card">
        <div className="calendar-top">
          <div className="tabs">
            <button
              className={mode === 'week' ? 'active' : ''}
              onClick={() => {
                setMode('week');
                setOffset(0);
              }}
            >
              周视图
            </button>
            <button
              className={mode === 'month' ? 'active' : ''}
              onClick={() => {
                setMode('month');
                setOffset(0);
              }}
            >
              月视图
            </button>
          </div>
          <div className="calendar-nav">
            <button onClick={() => setOffset(offset + 1)} aria-label="上一周期">
              <ChevronLeft size={17} />
            </button>
            <span>{period.title}</span>
            <button
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 1))}
              aria-label="下一周期"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className={`calendar ${mode}`}>
          {mode === 'month' &&
            ['一', '二', '三', '四', '五', '六', '日'].map((d) => (
              <div className="weekday" key={d}>
                {d}
              </div>
            ))}
          {period.cells.map((d, i) =>
            d ? (
              <div className="calendar-day" key={d.toISOString()}>
                {mode === 'week' && (
                  <small className="calendar-weekday">
                    {['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}
                  </small>
                )}
                <span
                  className={`calendar-number ${sameDay(d, today) ? 'today' : ''}`}
                  aria-current={sameDay(d, today) ? 'date' : undefined}
                >
                  {d.getDate()}
                </span>
                <i>
                  {Array.from({ length: dots(d) })
                    .slice(0, 5)
                    .map((_, j) => (
                      <b key={j} />
                    ))}
                </i>
              </div>
            ) : (
              <div key={i} />
            ),
          )}
        </div>
        <button className="history-link" onClick={onHistory}>
          历史记录 <span>→</span>
        </button>
      </section>
      <footer className="storage-footer">
        <p>
          日志明文保存在你选择的 JSON
          文件中，不使用浏览器存储。请定期备份，勿将日志上传到 GitHub。
        </p>
      </footer>
    </>
  );
}

function LogPage({ onSave }: { onSave: (log: Log) => Promise<void> }) {
  const [draft, setDraft] = useState(blank);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null),
    [other, setOther] = useState(''),
    [tipsOpen, setTipsOpen] = useState(false),
    [notice, setNotice] = useState('');
  const toggle = (name: string, category: string) =>
    setDraft((c) => ({
      ...c,
      emotions: c.emotions.some((e) => e.name === name)
        ? c.emotions.filter((e) => e.name !== name)
        : [...c.emotions, { name, category, before: 80, after: 80 }],
    }));
  const update = (name: string, field: 'before' | 'after', value: number) =>
    setDraft((c) => ({
      ...c,
      emotions: c.emotions.map((e) =>
        e.name === name ? { ...e, [field]: value } : e,
      ),
    }));
  const addOther = () => {
    const name = other.trim();
    if (!name) return;
    toggle(name, '其他');
    setOther('');
  };
  const addTip = (text: string) => {
    setDraft((c) => {
      const r = [...c.responses],
        i = r.findIndex((x) => !x.text.trim());
      if (i >= 0) r[i] = { ...r[i], text };
      else if (r.length < 5) r.push({ text, belief: 50 });
      return { ...c, responses: r };
    });
    setTipsOpen(false);
  };
  const submit = async () => {
    if (savingRef.current) return;
    if (!draft.emotions.length) return setNotice('请至少选择一个情绪');
    savingRef.current = true;
    setSaving(true);
    setNotice('');
    try {
      await onSave({
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        situation: draft.situation.trim(),
        thoughts: draft.thoughts.trim(),
        emotions: draft.emotions,
        distortions: draft.distortions,
        responses: draft.responses.filter((r) => r.text.trim()),
      });
    } catch (e) {
      setNotice(fileError(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <div className="log-page">
      <section className="intro">
        <h1>📓 每日情绪日志</h1>
        <p>
          源自伯恩斯《伯恩斯焦虑自助疗法》：写下令你不快的事，识别背后的思维陷阱，再用积极想法改写它，重估情绪强度。
        </p>
      </section>
      {notice && <div className="notice">{notice}</div>}
      <Step
        number="1"
        title="情境事件"
        sub="发生了什么让你困扰的事？写得越具体越好。"
      >
        <textarea
          value={draft.situation}
          onChange={(e) => setDraft({ ...draft, situation: e.target.value })}
          placeholder="例如：开会时被当众指出错误"
        />
      </Step>
      <Step
        number="2"
        title="情绪与强度"
        sub="先点选情绪分类，再点选具体情绪（可多选），并为每项滑动 0–100% 强度。"
      >
        <div className="emotion-groups">
          {[0, 4, 8].map((start) => {
            const row = GROUPS.slice(start, start + 4);
            const expanded = row.find(([category]) => category === openGroup);
            return (
              <div className="emotion-group-row" key={start}>
                <div className="emotion-heads">
                  {row.map(([category]) => (
                    <Button
                      key={category}
                      variant="outline"
                      className={`emotion-head ${openGroup === category ? 'selected' : ''}`}
                      aria-expanded={openGroup === category}
                      aria-controls={`emotion-options-${start}`}
                      onClick={() =>
                        setOpenGroup(openGroup === category ? null : category)
                      }
                    >
                      {category}
                    </Button>
                  ))}
                </div>
                {expanded && (
                  <fieldset
                    className="emotion-options"
                    id={`emotion-options-${start}`}
                    aria-label={`${expanded[0]}的具体情绪`}
                  >
                    {expanded[0] === '其他' ? (
                      <div className="other-emotion">
                        <input
                          aria-label="自定义情绪"
                          value={other}
                          onChange={(e) => setOther(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addOther()}
                          placeholder="请描述你的情绪，例如：委屈"
                        />
                        <Button onClick={addOther}>添加</Button>
                      </div>
                    ) : (
                      expanded[1].map((name) => (
                        <Button
                          variant="outline"
                          className={`emotion-chip ${draft.emotions.some((e) => e.name === name) ? 'on' : ''}`}
                          aria-pressed={draft.emotions.some(
                            (e) => e.name === name,
                          )}
                          key={name}
                          onClick={() => toggle(name, expanded[0])}
                        >
                          {name}
                        </Button>
                      ))
                    )}
                  </fieldset>
                )}
              </div>
            );
          })}
        </div>
        {draft.emotions.map((e) => (
          <RangeRow
            key={e.name}
            label={`${e.category}·${e.name}`}
            value={e.before}
            onChange={(v) => update(e.name, 'before', v)}
          />
        ))}
      </Step>
      <Step
        number="3"
        title="自动思维"
        sub="当时你心里对自己说了什么？写下那个自动冒出来的念头。"
      >
        <textarea
          value={draft.thoughts}
          onChange={(e) => setDraft({ ...draft, thoughts: e.target.value })}
          placeholder="我告诉自己：我太差劲了"
        />
      </Step>
      <Step
        number="4"
        title="认知扭曲识别"
        sub="对照下面 10 种思维陷阱及示例，点选与你想法相符的（可多选）。"
      >
        <div className="distortions">
          {DISTORTIONS.map(([name, description, example], i) => (
            <div
              className={`distortion ${draft.distortions.includes(name) ? 'on' : ''}`}
              key={name}
            >
              <button
                className="distortion-select"
                aria-pressed={draft.distortions.includes(name)}
                onClick={() =>
                  setDraft({
                    ...draft,
                    distortions: draft.distortions.includes(name)
                      ? draft.distortions.filter((x) => x !== name)
                      : [...draft.distortions, name],
                  })
                }
              >
                <span className="distortion-name">
                  <i aria-hidden="true">
                    {draft.distortions.includes(name) ? '✓' : ''}
                  </i>
                  <strong>
                    {i + 1}. {name}
                  </strong>
                </span>
                <span className="distortion-description">{description}</span>
                <span className="distortion-example">
                  <span className="distortion-example-label">示例：</span>
                  {example}
                </span>
              </button>
            </div>
          ))}
        </div>
      </Step>
      <Step
        number="5"
        title="积极想法"
        sub="用更客观、平衡的语言改写刚才的想法；可添加多条（最多 5 条），每条可滑动相信程度。"
        action={
          <Popover open={tipsOpen} onOpenChange={setTipsOpen}>
            <PopoverTrigger
              render={<Button variant="ghost" className="tip-toggle" />}
            >
              <Lightbulb size={16} /> 改造思维小技巧
            </PopoverTrigger>
            <PopoverContent className="tips-panel" align="end" sideOffset={10}>
              <PopoverTitle>改造思维小技巧</PopoverTitle>
              <PopoverDescription>
                选择一个技巧，将提示句插入积极想法。
              </PopoverDescription>
              <div className="tips-list">
                {TIPS.map(([name, description, text]) => (
                  <button key={name} onClick={() => addTip(text)}>
                    <b>{name}</b>
                    <span>{description}</span>
                    <Plus size={16} />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        }
      >
        <div className="responses">
          {draft.responses.map((r, i) => (
            <div className="response" key={i}>
              <textarea
                value={r.text}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    responses: draft.responses.map((x, j) =>
                      j === i ? { ...x, text: e.target.value } : x,
                    ),
                  })
                }
                placeholder="较为积极的想法是：一次失误不代表我差劲"
              />
              {(r.text || draft.responses.length > 1) && (
                <div className="response-controls">
                  {r.text && (
                    <RangeRow
                      label="相信程度"
                      value={r.belief}
                      onChange={(v) =>
                        setDraft({
                          ...draft,
                          responses: draft.responses.map((x, j) =>
                            j === i ? { ...x, belief: v } : x,
                          ),
                        })
                      }
                    />
                  )}{' '}
                  {draft.responses.length > 1 && (
                    <button
                      className="delete-text"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          responses: draft.responses.filter((_, j) => j !== i),
                        })
                      }
                    >
                      删除
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {draft.responses.length < 5 && (
          <button
            className="add-response"
            onClick={() =>
              setDraft({
                ...draft,
                responses: [...draft.responses, { text: '', belief: 50 }],
              })
            }
          >
            <Plus size={17} /> 添加积极想法
          </button>
        )}
        <hr />
        <h3>重估情绪强度</h3>
        <p className="step-sub">
          写出积极想法之后，再为之前的情绪各滑动一次强度，看看改善了多少。
        </p>
        {draft.emotions.map((e) => (
          <div className="reestimate" key={e.name}>
            <RangeRow
              label={`${e.category}·${e.name}`}
              value={e.after}
              before={e.before}
              onChange={(v) => update(e.name, 'after', v)}
            />
            <small
              className={
                e.after < e.before
                  ? 'improve'
                  : e.after > e.before
                    ? 'worse'
                    : ''
              }
            >
              {e.after < e.before
                ? `改善 ${e.before - e.after}%`
                : e.after > e.before
                  ? `升高 +${e.after - e.before}%`
                  : '持平'}
            </small>
          </div>
        ))}
      </Step>
      <Button className="save-button" onClick={submit} disabled={saving}>
        <Save size={18} /> {saving ? '加密保存中…' : '保存日志'}
      </Button>
    </div>
  );
}
function Step({
  number,
  title,
  sub,
  children,
  action,
}: {
  number: string;
  title: string;
  sub: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="card step">
      <div className="step-title">
        <span>{number}</span>
        <h2>{title}</h2>
        {action && <div className="step-action">{action}</div>}
      </div>
      <p className="step-sub">{sub}</p>
      {children}
    </section>
  );
}
function RangeRow({
  label,
  value,
  onChange,
  before,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  before?: number;
}) {
  const id = useId();
  return (
    <div className="range-row">
      <label className="range-label" htmlFor={id}>
        {label}
        {before !== undefined && <small>之前 {before}%</small>}
      </label>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        style={{ '--range-progress': `${value}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id}>{value}%</output>
    </div>
  );
}

function HistoryPage({
  logs,
  onDelete,
}: {
  logs: Log[];
  onDelete: (id: string) => Promise<void>;
}) {
  const [target, setTarget] = useState<Log | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = logs.find((log) => log.id === selectedId);
  if (selected)
    return <LogDetail log={selected} onBack={() => setSelectedId(null)} />;
  return (
    <>
      <h1 className="page-title">历史记录</h1>
      {!logs.length ? (
        <p className="empty">还没有日志，先写第一篇吧</p>
      ) : (
        <div className="history-list">
          {logs.map((log) => (
            <article key={log.id}>
              <button
                className="history-main"
                onClick={() => setSelectedId(log.id)}
              >
                <time dateTime={log.ts}>
                  {new Intl.DateTimeFormat('zh-CN', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }).format(new Date(log.ts))}
                </time>
                <span>
                  查看详情 <ChevronRight size={16} aria-hidden="true" />
                </span>
              </button>
              <button
                className="icon-button"
                aria-label="删除日志"
                onClick={() => {
                  setDeleteError('');
                  setTarget(log);
                }}
              >
                <X size={20} />
              </button>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={!!target}
        onOpenChange={(open) => !open && !deleting && setTarget(null)}
      >
        <DialogContent className="delete-dialog">
          <DialogHeader>
            <DialogTitle>删除日志</DialogTitle>
            <DialogDescription>
              确定删除这条情绪日志吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="file-error">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setTarget(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!target || deleting) return;
                setDeleting(true);
                setDeleteError('');
                try {
                  await onDelete(target.id);
                  setTarget(null);
                } catch (e) {
                  setDeleteError(fileError(e));
                } finally {
                  setDeleting(false);
                }
              }}
            >
              <Trash2 /> {deleting ? '删除中…' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AnalysisPage({ logs }: { logs: Log[] }) {
  const today = dateKey(),
    [preset, setPreset] = useState('30d'),
    [custom, setCustom] = useState(false),
    [start, setStart] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return dateKey(d);
    }),
    [end, setEnd] = useState(today);
  const range = useMemo(() => {
    if (custom) return { start, end };
    if (preset === 'all')
      return {
        start: logs.length
          ? dateKey(new Date(logs.reduce((a, l) => (l.ts < a.ts ? l : a)).ts))
          : today,
        end: today,
      };
    const d = new Date();
    d.setDate(d.getDate() - (Number.parseInt(preset, 10) - 1));
    return { start: dateKey(d), end: today };
  }, [custom, preset, start, end, logs, today]);
  const filtered = logs.filter((l) => {
    const d = dateKey(new Date(l.ts));
    return d >= range.start && d <= range.end;
  });
  const report = useMemo(() => {
    const cats = new Map<string, number>(),
      dists = new Map<string, number>(),
      days = new Set<string>(),
      series = new Map<string, { before: number[]; after: number[] }>();
    filtered.forEach((l) => {
      const key = dateKey(new Date(l.ts));
      days.add(key);
      const before = avg(l.emotions.map((e) => e.before)),
        after = avg(l.emotions.map((e) => e.after)),
        row = series.get(key) || { before: [], after: [] };
      row.before.push(before);
      row.after.push(after);
      series.set(key, row);
      l.emotions.forEach((e) =>
        cats.set(
          e.category || '其他',
          (cats.get(e.category || '其他') || 0) + 1,
        ),
      );
      l.distortions.forEach((n) => dists.set(n, (dists.get(n) || 0) + 1));
    });
    const counts = (m: Map<string, number>) =>
      [...m].sort((a, b) => b[1] - a[1]);
    return {
      chart: [...series]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => ({
          label: key.slice(5).replace('-', '/'),
          before: avg(v.before),
          after: avg(v.after),
        })),
      cats: counts(cats),
      dists: counts(dists),
      total: filtered.length,
      days: days.size,
      load: avg(filtered.map((l) => avg(l.emotions.map((e) => e.before)))),
      improve: avg(
        filtered.map((l) => avg(l.emotions.map((e) => e.before - e.after))),
      ),
    };
  }, [filtered]);
  const bars = (items: [string, number][]) => {
    const total = items.reduce((s, [, n]) => s + n, 0),
      max = items[0]?.[1] || 1;
    return (
      <>
        {items.map(([name, count]) => (
          <div className="bar-row" key={name}>
            <div>
              <b>{name}</b>
              <span>
                {count} 次 · {Math.round((count / total) * 100)}%
              </span>
            </div>
            <i>
              <em style={{ width: `${(count / max) * 100}%` }} />
            </i>
          </div>
        ))}
      </>
    );
  };
  return (
    <>
      <h1 className="page-title">情绪分析</h1>
      <section className="card filters">
        <div>
          {[
            ['7d', '近7天'],
            ['30d', '近30天'],
            ['90d', '近90天'],
            ['all', '全部'],
          ].map(([k, label]) => (
            <button
              className={!custom && preset === k ? 'active' : ''}
              key={k}
              onClick={() => {
                setPreset(k);
                setCustom(false);
              }}
            >
              {label}
            </button>
          ))}
          <button
            className={custom ? 'active' : ''}
            onClick={() => setCustom(true)}
          >
            自定义
          </button>
        </div>
        {custom && (
          <p>
            <input
              type="date"
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
            />{' '}
            至{' '}
            <input
              type="date"
              value={end}
              min={start}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
            />
          </p>
        )}
      </section>
      {!filtered.length ? (
        <p className="empty">该时间段内暂无日志</p>
      ) : (
        <div className="analysis">
          <section className="card">
            <h2>汇总统计</h2>
            <div className="stats">
              {[
                ['日志条数', report.total],
                ['记录天数', report.days],
                ['平均情绪强度', `${report.load}%`],
                [
                  '平均改善',
                  `${report.improve >= 0 ? '+' : ''}${report.improve}%`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>情绪趋势</h2>
            <div className="legend">
              <span>
                <i />
                情绪强度
              </span>
              <span>
                <i />
                重估后强度
              </span>
            </div>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.chart}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="before"
                    name="情绪强度"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="after"
                    name="重估后强度"
                    stroke="#60A5FA"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="card">
            <h2>情绪类别分布</h2>
            <p className="muted">
              共 {report.cats.reduce((s, [, n]) => s + n, 0)} 次情绪记录
            </p>
            {bars(report.cats)}
          </section>
          <section className="card">
            <h2>认知扭曲频次</h2>
            <p className="muted">
              {report.dists.length
                ? `共 ${report.dists.reduce((s, [, n]) => s + n, 0)} 次勾选`
                : '该时间段内未记录认知扭曲'}
            </p>
            {bars(report.dists)}
          </section>
        </div>
      )}
    </>
  );
}
