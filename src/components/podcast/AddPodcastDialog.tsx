import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { enterToSubmit } from 'pevenmui';
import { useT } from '../../i18n';
import { LabeledField } from '../LabeledField';
import { subscribe } from '../../services/feed/syncPodcast';
import { errorMessage } from '../../services/errorMessage';
import { openSettings } from '../../store/uiStore';

/** RSS の URL を入れて購読する */
export function AddPodcastDialog(p: { open: boolean; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; proxy: boolean } | null>(null);

  const close = () => {
    if (busy) return;
    setUrl('');
    setError(null);
    p.onClose();
  };

  const submit = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const podcast = await subscribe(url);
      setUrl('');
      p.onClose();
      navigate(`/podcast/${podcast.id}`);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={p.open} onClose={close} fullWidth maxWidth="sm" onKeyDown={enterToSubmit(() => void submit())}>
      <DialogTitle>{t('add.title')}</DialogTitle>
      <DialogContent>
        <LabeledField
          autoFocus
          type="url"
          label={t('add.url')}
          placeholder="https://example.com/feed.xml"
          value={url}
          disabled={busy}
          onChange={(e) => setUrl(e.target.value)}
        />
        {error && (
          <Alert
            severity="error"
            sx={{ mt: 1 }}
            action={
              error.proxy && (
                <Button color="inherit" size="small" onClick={() => openSettings('network')}>
                  {t('error.openProxySettings')}
                </Button>
              )
            }
          >
            {error.text}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || !url.trim()}>
          {busy ? t('add.adding') : t('add.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
