import { useState } from 'react';
import { Box, Button, Checkbox, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { db } from '../../db/schema';
import { useT } from '../../i18n';
import { LabeledField } from '../LabeledField';
import { proxyTransport, type ProxyConfig } from '../../services/network/transports';

type TestResult = 'ok' | 'fail' | 'testing' | 'noFeed';

/** 1 件の接続テスト: 登録済みの番組フィードを 1 つ、このプロキシだけで取る */
async function testProxy(cfg: ProxyConfig): Promise<TestResult> {
  const podcast = await db.podcasts.orderBy('sortOrder').first();
  if (!podcast) return 'noFeed';
  try {
    const res = await fetch(proxyTransport(cfg).buildRequest(podcast.feedUrl, {}));
    return res.ok ? 'ok' : 'fail';
  } catch {
    return 'fail';
  }
}

/** ヘッダーを「名前: 値」の行で編集する */
const headersToText = (h?: Record<string, string>) => Object.entries(h ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n');
function textToHeaders(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return Object.keys(out).length ? out : undefined;
}

/** ヘッダーの欄。打っている途中の文字を崩さないよう、文字はこの中で持ち、変わるたびに解析して渡す */
function HeadersField(p: { initial?: Record<string, string>, onChange: (h: Record<string, string> | undefined) => void }) {
  const t = useT();
  const [text, setText] = useState(() => headersToText(p.initial));
  return (
    <LabeledField
      label={t('proxy.headers')}
      multiline
      minRows={1}
      placeholder="Authorization: Bearer xxx"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        p.onChange(textToHeaders(e.target.value));
      }}
    />
  );
}

/** 設定の「ネットワーク」: CORS プロキシの一覧（追加・編集・削除・並べ替え・有効/無効・接続テスト, F-4-3） */
export function ProxyList({ value, onChange }: { value: ProxyConfig[]; onChange: (v: ProxyConfig[]) => void }) {
  const t = useT();
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const patch = (id: string, p: Partial<ProxyConfig>) => onChange(value.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => {
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  const add = () => onChange([...value, { id: crypto.randomUUID(), name: '', urlTemplate: '', enabled: true }]);
  const test = async (cfg: ProxyConfig) => {;
    setResults((r) => ({ ...r, [cfg.id]: 'testing' }));
    const result = await testProxy(cfg);
    setResults((r) => ({ ...r, [cfg.id]: result }));
  };

  return (
    <Box sx={{ gridColumn: '1 / -1' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('proxy.help')}
      </Typography>
      <Stack spacing={1.5}>
        {value.map((p, i) => {
          const invalid = !!p.urlTemplate && !p.urlTemplate.includes('{url}');
          const result = results[p.id];
          return (
            <Box key={p.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Tooltip title={t('proxy.enabled')}>
                  <Checkbox size="small" checked={p.enabled} onChange={(e) => patch(p.id, { enabled: e.target.checked })} slotProps={{ input: { 'aria-label': t('proxy.enabled') } }} />
                </Tooltip>
                <TextField size="small" placeholder={t('proxy.name')} value={p.name} onChange={(e) => patch(p.id, { name: e.target.value })} sx={{ flex: 1 }} slotProps={{ htmlInput: { 'aria-label': t('proxy.name') } }} />
                <IconButton size="small" aria-label={t('queue.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                  <FontAwesomeIcon icon={faArrowUp} fixedWidth />
                </IconButton>
                <IconButton size="small" aria-label={t('queue.moveDown')} disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                  <FontAwesomeIcon icon={faArrowDown} fixedWidth />
                </IconButton>
                <IconButton size="small" aria-label={t('proxy.remove')} onClick={() => onChange(value.filter((x) => x.id !== p.id))}>
                  <FontAwesomeIcon icon={faTrash} fixedWidth />
                </IconButton>
              </Stack>
              <LabeledField
                label={t('proxy.urlTemplate')}
                placeholder="https://proxy.example.workers.dev/?url={url}"
                value={p.urlTemplate}
                error={invalid}
                helperText={invalid ? t('proxy.urlTemplateInvalid') : undefined}
                onChange={(e) => patch(p.id, { urlTemplate: e.target.value.trim() })}
              />
              <HeadersField initial={p.headers} onChange={(headers) => patch(p.id, { headers })} />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                <Button size="small" variant="outlined" disabled={!p.urlTemplate || invalid || result === 'testing'} onClick={() => void test(p)}>
                  {t('proxy.test')}
                </Button>
                {result && result !== 'testing' && (
                  <Typography variant="body2" color={result === 'ok' ? 'success.main' : 'error'}>
                    {t(`proxy.test.${result}`)}
                  </Typography>
                )}
              </Stack>
            </Box>
          )
        })}
      </Stack>
      <Button size="small" startIcon={<FontAwesomeIcon icon={faPlus} />} onClick={add} sx={{ mt: 1.5 }}>
        {t('proxy.add')}
      </Button>
    </Box>
  );
}
