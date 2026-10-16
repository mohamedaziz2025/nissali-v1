'use client';
// Messagerie de la praticienne (façon Messenger) : conversations à gauche, échange à droite.
// Photos, réponses citées, réactions, « Vu », « écrit… », blocage et signalement. Rafraîchissement automatique.
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icons';
import { Avatar, Empty, Modal, useToast } from '@/components/ui';
import { api } from '@/lib/api';

const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🤲'];
const MORE_EMOJIS = ['😍', '🥰', '😊', '🙂', '😉', '🤗', '😇', '🥹', '😅', '🤣', '😁', '😎', '🤔', '😔', '😭', '😱', '🙏', '👏', '🙌', '💪', '👌', '✌️', '🤝', '💯', '🔥', '✨', '⭐', '🌙', '🌸', '🌹', '🎉', '☕', '💕', '💖', '💜', '🤍', '✅', '❌', '❓', '👀', '🫶', '👍🏽'];
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(new Date(d).getHours())}:${pad(new Date(d).getMinutes())}`;
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function shortWhen(d) {
  const date = new Date(d);
  const now = new Date();
  if (sameDay(date, now)) return hhmm(date);
  if (sameDay(date, new Date(now - 86_400_000))) return 'hier';
  if (now - date < 7 * 86_400_000) return DAYS[date.getDay()];
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
function dayLabel(d) {
  const date = new Date(d);
  const now = new Date();
  if (sameDay(date, now)) return 'Aujourd’hui';
  if (sameDay(date, new Date(now - 86_400_000))) return 'Hier';
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function ConversationList({ items, active, onOpen, q, setQ }) {
  const list = items.filter((c) => !q.trim() || c.other.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <aside className="chat-list">
      <div className="chat-list-head">
        <h2>Messages</h2>
        <div className="search" style={{ display: 'block', width: '100%' }}>
          <Icon name="search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une cliente" aria-label="Rechercher" />
        </div>
      </div>
      <div className="chat-list-items">
        {list.map((c) => (
          <button key={c.id} className={`chat-item ${active === c.id ? 'on' : ''} ${c.unread ? 'unread' : ''}`} onClick={() => onOpen(c.id)}>
            <Avatar name={c.other.name} size={48} />
            <span className="grow">
              <span className="chat-item-top">
                <strong>{c.other.name}</strong>
                <time>{c.last ? shortWhen(c.last.at) : ''}</time>
              </span>
              <span className="chat-item-bottom">
                <span className="preview">{c.blocked ? 'Conversation bloquée' : c.last ? `${c.last.mine ? 'Vous : ' : ''}${c.last.text}` : ''}</span>
                {c.unread ? <span className="count">{c.unread}</span> : null}
              </span>
            </span>
          </button>
        ))}
        {!items.length ? <Empty icon="mail" title="Aucune conversation">Les messages de tes clientes apparaîtront ici.</Empty> : null}
      </div>
    </aside>
  );
}

function Bubble({ m, otherName, onReply, onReact, onOpenImage, onDelete, first, last, status }) {
  const [picker, setPicker] = useState(false);
  const [more, setMore] = useState(false);
  const [del, setDel] = useState(false);
  if (m.deleted) {
    return (
      <div className={`msg ${m.mine ? 'mine' : 'theirs'} ${first ? 'first' : ''} ${last ? 'last' : ''}`}>
        <div className="msg-col">
          <div className="bubble deleted">🚫 {m.mine ? 'Vous avez retiré un message' : 'Message supprimé'}</div>
        </div>
      </div>
    );
  }
  const grouped = Object.entries((m.reactions || []).reduce((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] || 0) + 1 }), {}));
  return (
    <div className={`msg ${m.mine ? 'mine' : 'theirs'} ${first ? 'first' : ''} ${last ? 'last' : ''} ${m.pending ? 'pending' : ''}`} onMouseLeave={() => { setPicker(false); setMore(false); setDel(false); }}>
      <div className="msg-col">
        <div className={`bubble ${m.image && !m.text ? 'photo' : ''}`}>
          {m.reply ? (
            <div className="quote">
              <strong>Réponse à {m.reply.mine ? 'vous' : otherName}</strong>
              <span>{m.reply.text || (m.reply.hasImage ? '📷 Photo' : '')}</span>
            </div>
          ) : null}
          {m.image ? <img src={m.image.local || m.image.url} alt="Photo envoyée" onClick={() => onOpenImage(m)} /> : null}
          {m.text ? <p>{m.text}</p> : null}
          {grouped.length ? (
            <span className="reactions" title={(m.reactions || []).map((r) => `${r.mine ? 'Vous' : otherName} ${r.emoji}`).join(', ')}>
              {grouped.map(([e, n]) => (
                <span key={e}>
                  {e}
                  {n > 1 ? <small>{n}</small> : null}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        {status ? <span className={`msg-status ${status.seen ? 'seen' : ''}`}>{status.label}</span> : null}
      </div>
      {!m.pending ? (
        <div className="msg-actions">
          <button onClick={() => setPicker((v) => !v)} aria-label="Réagir" title="Réagir"><Icon name="smile" /></button>
          <button onClick={() => onReply(m)} aria-label="Répondre" title="Répondre"><Icon name="reply" /></button>
          <button onClick={() => setDel((v) => !v)} aria-label="Supprimer" title="Supprimer"><Icon name="trash" /></button>
          {picker ? (
            <div className={`react-picker ${more ? 'more' : ''}`}>
              {(more ? [...REACTIONS, ...MORE_EMOJIS] : REACTIONS).map((e) => (
                <button key={e} onClick={() => { onReact(m, e); setPicker(false); setMore(false); }} className={(m.reactions || []).some((r) => r.mine && r.emoji === e) ? 'on' : ''} aria-label={`Réagir ${e}`}>{e}</button>
              ))}
              {!more ? <button onClick={() => setMore(true)} aria-label="Plus d’emojis" title="Plus d’emojis">＋</button> : null}
            </div>
          ) : null}
          {del ? (
            <div className="del-menu">
              {m.mine ? <button onClick={() => { setDel(false); onDelete(m, 'all'); }} className="danger">Retirer pour tout le monde</button> : null}
              <button onClick={() => { setDel(false); onDelete(m, 'me'); }}>Supprimer pour moi</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Chat({ id, onChanged }) {
  const toast = useToast();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [report, setReport] = useState(null);
  const [sending, setSending] = useState(false);
  const since = useRef(null);
  const lastTyping = useRef(0);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  const merge = useCallback((incoming, removed = []) => {
    if (!incoming.length && !removed.length) return;
    setMessages((list) => {
      const map = new Map(list.filter((m) => !m.pending && !removed.includes(m.id)).map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m });
      return [...map.values(), ...list.filter((m) => m.pending)].sort((a, b) => new Date(a.at) - new Date(b.at));
    });
  }, []);
  const applyMeta = (r) => setMeta({ otherReadAt: r.otherReadAt, otherDeliveredAt: r.otherDeliveredAt, otherTyping: r.otherTyping, blocked: r.blocked, blockedByMe: r.blockedByMe });

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setConv(null);
    setReply(null);
    Promise.all([api.get(`/messages/conversations/${id}?as=pro`), api.get(`/messages/conversations/${id}/messages?as=pro`)])
      .then(([c, r]) => {
        if (cancelled) return;
        setConv(c);
        setMessages(r.items);
        setHasMore(r.hasMore);
        applyMeta(r);
        since.current = r.serverTime;
        onChanged();
        setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 50);
      })
      .catch((e) => toast(e.message, 'error'));
    const t = setInterval(async () => {
      if (!since.current) return;
      try {
        const r = await api.get(`/messages/conversations/${id}/messages?as=pro&since=${encodeURIComponent(since.current)}`);
        if (r.items.some((m) => !m.mine)) setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
        merge(r.items, r.removed || []);
        applyMeta(r);
        since.current = r.serverTime;
      } catch {
        // réseau
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadOlder = async () => {
    const r = await api.get(`/messages/conversations/${id}/messages?as=pro&before=${encodeURIComponent(messages[0].at)}`);
    setHasMore(r.hasMore);
    setMessages((list) => [...r.items, ...list]);
  };

  const send = async (payload) => {
    const tmp = { id: `tmp-${Date.now()}`, mine: true, from: 'pro', text: payload.text || '', at: new Date().toISOString(), pending: true, reply: reply ? { mine: reply.mine, text: reply.text, hasImage: Boolean(reply.image) } : null, image: payload.local ? { local: payload.local } : null };
    setMessages((l) => [...l, tmp]);
    const replyTo = reply?.id;
    setReply(null);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30);
    try {
      const saved = await api.post(`/messages/conversations/${id}/messages?as=pro`, { as: 'pro', text: payload.text || '', ...(payload.photo ? { photo: payload.photo, width: payload.width, height: payload.height } : {}), ...(replyTo ? { replyTo } : {}) });
      setMessages((l) => l.map((m) => (m.id === tmp.id ? saved : m)));
      onChanged();
    } catch (e) {
      setMessages((l) => l.filter((m) => m.id !== tmp.id));
      toast(e.message, 'error');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    send({ text: t });
  };

  const onType = (v) => {
    setText(v);
    if (v && Date.now() - lastTyping.current > 3000) {
      lastTyping.current = Date.now();
      api.post(`/messages/conversations/${id}/typing?as=pro`, { as: 'pro' }).catch(() => {});
    }
  };

  const sendPhoto = async (file) => {
    if (!file) return;
    setSending(true);
    try {
      const dims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({});
        img.src = URL.createObjectURL(file);
      });
      const fd = new FormData();
      fd.append('image', file);
      const { photo } = await api.upload(`/messages/conversations/${id}/photos?as=pro`, fd);
      await send({ text: text.trim(), photo, local: URL.createObjectURL(file), ...dims });
      setText('');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const react = async (m, emoji) => {
    try {
      merge([await api.post(`/messages/conversations/${id}/messages/${m.id}/react?as=pro`, { as: 'pro', emoji })]);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const removeMsg = async (m, scope) => {
    if (scope === 'all' && !window.confirm('Retirer ce message pour tout le monde ?')) return;
    if (scope === 'all') setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, deleted: true, text: '', image: null, reactions: [] } : x)));
    else setMessages((l) => l.filter((x) => x.id !== m.id));
    try {
      await api.post(`/messages/conversations/${id}/messages/${m.id}/delete?as=pro`, { as: 'pro', for: scope });
      onChanged();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const statusOf = (m) => {
    if (m.pending) return { label: 'Envoi…' };
    const at = new Date(m.at);
    if (meta.otherReadAt && new Date(meta.otherReadAt) >= at) return { label: `${hhmm(m.at)} · ✓✓ Vu`, seen: true };
    if (meta.otherDeliveredAt && new Date(meta.otherDeliveredAt) >= at) return { label: `${hhmm(m.at)} · ✓✓ Reçu` };
    return { label: `${hhmm(m.at)} · ✓ Envoyé` };
  };

  const toggleBlock = async () => {
    if (!meta.blockedByMe && !window.confirm('Bloquer cette conversation ? Plus aucun message ne pourra être envoyé.')) return;
    const r = await api.post(`/messages/conversations/${id}/block?as=pro`, { as: 'pro', blocked: !meta.blockedByMe });
    setMeta((x) => ({ ...x, blocked: r.blocked, blockedByMe: r.blockedByMe }));
    onChanged();
  };

  const sendReport = async () => {
    try {
      await api.post(`/messages/conversations/${id}/report?as=pro`, { as: 'pro', reason: report });
      setReport(null);
      toast('Signalement envoyé à l’équipe Nissali');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const rows = useMemo(() => {
    const out = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      if (!prev || !sameDay(prev.at, m.at)) out.push({ type: 'day', key: `d-${m.id}`, at: m.at });
      const gap = (a, b) => Math.abs(new Date(a.at) - new Date(b.at)) > 5 * 60_000;
      out.push({ type: 'msg', key: m.id, m, first: !prev || prev.from !== m.from || gap(prev, m) || !sameDay(prev.at, m.at), last: !next || next.from !== m.from || gap(m, next) || !sameDay(next.at, m.at) });
    });
    return out;
  }, [messages]);
  const other = conv?.other || { name: '…' };

  return (
    <section className="chat-pane">
      <header className="chat-head">
        <Avatar name={other.name} size={42} />
        <div className="grow">
          <strong>{other.name}</strong>
          <span className={meta.otherTyping ? 'typing' : ''}>{meta.otherTyping ? 'écrit…' : other.subtitle || 'Cliente'}</span>
        </div>
        {other.id ? <a className="btn sm outline" href={`/pro/clientes/${other.id}`}>Fiche cliente</a> : null}
        <button className="btn sm ghost" onClick={toggleBlock}>{meta.blockedByMe ? 'Débloquer' : 'Bloquer'}</button>
        <button className="btn sm ghost" onClick={() => setReport('')}>Signaler</button>
      </header>
      <div className="chat-body">
        {hasMore ? <button className="btn sm ghost" style={{ alignSelf: 'center' }} onClick={loadOlder}>Messages précédents</button> : null}
        <div className="chat-notice"><Icon name="lock" /> Rappel : pas d’informations médicales sensibles par message.</div>
        {rows.map((r) => (r.type === 'day' ? <div key={r.key} className="chat-day">{dayLabel(r.at)} · {hhmm(r.at)}</div> : <Bubble key={r.key} m={r.m} first={r.first} last={r.last} otherName={other.name} onReply={(m) => { setReply(m); inputRef.current?.focus(); }} onReact={react} onOpenImage={setViewer} onDelete={removeMsg} status={r.m.mine && r.last && !r.m.deleted ? statusOf(r.m) : null} />))}
        {meta.otherTyping ? <div className="msg theirs"><div className="bubble typing-dots">•••</div></div> : null}
        <div ref={endRef} />
      </div>
      {meta.blocked ? (
        <div className="chat-blocked">{meta.blockedByMe ? 'Vous avez bloqué cette conversation.' : 'Cette conversation n’est plus disponible.'}</div>
      ) : (
        <form className="chat-composer" onSubmit={submit}>
          {reply ? (
            <div className="reply-bar">
              <div className="grow">
                <strong>Réponse à {reply.mine ? 'vous' : other.name}</strong>
                <span>{reply.text || '📷 Photo'}</span>
              </div>
              <button type="button" className="btn sm ghost" onClick={() => setReply(null)} aria-label="Annuler la réponse">×</button>
            </div>
          ) : null}
          <div className="composer-row">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => sendPhoto(e.target.files?.[0])} />
            <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} disabled={sending} aria-label="Envoyer une photo" title="Envoyer une photo">
              <Icon name="image" />
            </button>
            <input ref={inputRef} className="input" value={text} onChange={(e) => onType(e.target.value)} placeholder="Écrire un message…" maxLength={2000} aria-label="Message" />
            <button className="btn" disabled={!text.trim()} aria-label="Envoyer">
              <Icon name="send" />
            </button>
          </div>
        </form>
      )}
      <Modal open={Boolean(viewer)} onClose={() => setViewer(null)} title="Photo">
        {viewer ? <img src={viewer.image?.local || viewer.image?.url} alt="" style={{ width: '100%', borderRadius: 12 }} /> : null}
      </Modal>
      <Modal open={report !== null} onClose={() => setReport(null)} title="Signaler la conversation" footer={<><button className="btn ghost" onClick={() => setReport(null)}>Annuler</button><button className="btn" onClick={sendReport} disabled={(report || '').trim().length < 3}>Envoyer</button></>}>
        <textarea className="textarea" rows={4} value={report || ''} onChange={(e) => setReport(e.target.value)} placeholder="Explique en quelques mots ce qui pose problème" />
      </Modal>
    </section>
  );
}

function MessagesInner() {
  const params = useSearchParams();
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(params.get('c'));
  const [q, setQ] = useState('');
  const load = useCallback(() => api.get('/messages/conversations?as=pro').then(setItems).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!active && items.length && window.innerWidth > 900) setActive(items[0].id);
  }, [items, active]);
  return (
    <div className={`chat ${active ? 'has-active' : ''}`}>
      <ConversationList items={items} active={active} onOpen={setActive} q={q} setQ={setQ} />
      {active ? (
        <Chat id={active} onChanged={load} />
      ) : (
        <section className="chat-pane chat-empty">
          <Empty icon="mail" title="Choisis une conversation">Les échanges avec tes clientes apparaissent ici.</Empty>
        </section>
      )}
    </div>
  );
}

export default function ProMessages() {
  return (
    <Suspense>
      <MessagesInner />
    </Suspense>
  );
}
