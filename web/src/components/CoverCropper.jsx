'use client';
// 14 — Photo de couverture d'un article : choix du fichier, aperçu, recadrage 16:9 (zoom et position),
// téléversement en JPEG 1600 × 900, texte alternatif. Même ratio partout : aucune déformation dans les listes.
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Field, useToast } from './ui';

const W = 1600;
const H = 900;

export default function CoverCropper({ value, alt, credit, onChange }) {
  const toast = useToast();
  const [src, setSrc] = useState(null); // image choisie, pas encore recadrée
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    if (!src) return undefined;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
    return () => URL.revokeObjectURL(src);
  }, [src]);

  // Rectangle source (dans l'image d'origine) correspondant au cadre 16:9, au zoom et à la position choisis.
  const frame = () => {
    const scale = Math.max(W / img.width, H / img.height) * zoom;
    const sw = W / scale;
    const sh = H / scale;
    return { sx: (img.width - sw) * pos.x, sy: (img.height - sh) * pos.y, sw, sh };
  };
  useEffect(() => {
    if (!img || !canvas.current) return;
    const ctx = canvas.current.getContext('2d');
    const { sx, sy, sw, sh } = frame();
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, zoom, pos]);

  const pick = (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Image JPEG, PNG ou WebP attendue', 'error');
    setZoom(1);
    setPos({ x: 0.5, y: 0.5 });
    setSrc(URL.createObjectURL(file));
  };
  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, pos };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current || !img) return;
    const box = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - drag.current.x) / box.width;
    const dy = (e.clientY - drag.current.y) / box.height;
    const clamp = (v) => Math.min(1, Math.max(0, v));
    setPos({ x: clamp(drag.current.pos.x - dx * 1.5), y: clamp(drag.current.pos.y - dy * 1.5) });
  };
  const upload = async () => {
    setBusy(true);
    try {
      const blob = await new Promise((r) => canvas.current.toBlob(r, 'image/jpeg', 0.86));
      const fd = new FormData();
      fd.append('image', new File([blob], 'couverture.jpg', { type: 'image/jpeg' }));
      const r = await api.upload('/admin/upload-image', fd);
      onChange({ coverUrl: r.url });
      setSrc(null);
      setImg(null);
      toast('Photo recadrée et enregistrée');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {img ? (
        <>
          <div className="cover-frame" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)} title="Fais glisser pour cadrer">
            <canvas ref={canvas} width={W} height={H} />
          </div>
          <Field label={`Zoom (${zoom.toFixed(1).replace('.', ',')}×)`} hint="Fais glisser l’image pour choisir le cadrage.">
            <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </Field>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => { setSrc(null); setImg(null); }}>Annuler</button>
            <button type="button" className="btn" disabled={busy} onClick={upload}>{busy ? 'Envoi…' : 'Recadrer et enregistrer'}</button>
          </div>
        </>
      ) : value ? (
        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <img src={value} alt={alt || ''} className="cover-preview" />
          <div className="stack" style={{ gap: 6 }}>
            <img src={value} alt="" className="cover-thumb" />
            <span className="muted small">Miniature</span>
          </div>
        </div>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>Aucune photo : la vignette garde sa couleur.</p>
      )}
      {!img ? (
        <div className="row">
          <label className="btn outline sm" style={{ cursor: 'pointer' }}>
            {value ? 'Changer la photo' : 'Choisir une photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {value ? <button type="button" className="btn ghost sm" onClick={() => onChange({ coverUrl: '' })}>Retirer</button> : null}
        </div>
      ) : null}
      <Field label="Texte alternatif" hint="Décris la photo pour les lectrices malvoyantes (obligatoire avec une photo).">
        <input className="input" value={alt || ''} onChange={(e) => onChange({ coverAlt: e.target.value })} maxLength={200} required={Boolean(value)} placeholder="Ex. Bol de lentilles et d’épinards" />
      </Field>
      <Field label="Crédit photo (facultatif)">
        <input className="input" value={credit || ''} onChange={(e) => onChange({ coverCredit: e.target.value })} maxLength={160} placeholder="Photo : Prénom Nom / Unsplash" />
      </Field>
    </div>
  );
}
