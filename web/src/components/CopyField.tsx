import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="copy-field">
      <span className="label">{label}</span>
      <code>{value}</code>
      <button type="button" className="btn btn-small" onClick={() => void copy()}>
        {copied ? t('dashboard.copied') : t('dashboard.copy')}
      </button>
    </div>
  );
}
