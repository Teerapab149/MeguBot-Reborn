'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import CustomSelect from '../CustomSelect';
import ProjectAvatar from './ProjectAvatar';
import styles from './projectManage.module.css';

const JOIN_ROLES = ['lead', 'member', 'viewer'];

export default function ProjectJoinSettings({ code, timezone, lang, p, onChanged }) {
	const [data,setData] = useState(null);
	const [link,setLink] = useState('');
	const [busy,setBusy] = useState(false);
	const [error,setError] = useState('');
	const [copied,setCopied] = useState(false);
	const [requestRoles,setRequestRoles] = useState({});
	const [loading,setLoading] = useState(true);
	const [confirmReplace,setConfirmReplace] = useState(false);
	const mutation = useRef(false);
	const confirmButton = useRef(null);
	const createButton = useRef(null);
	const load = useCallback(async (signal) => {
		setLoading(true);
		try {
			const r = await fetch('/api/megu/projects/'+encodeURIComponent(code)+'/join-requests', { cache: 'no-store', signal });
			const b = await r.json();
			if (signal?.aborted) return;
			if (!r.ok) throw b;
			setData(b);
			setRequestRoles(current => Object.fromEntries(b.requests.map(request => [request.id, current[request.id] || 'member'])));
			if (!b.link) setLink('');
		} finally { if (!signal?.aborted) setLoading(false); }
	},[code]);
	useEffect(() => {
		const controller = new AbortController();
		load(controller.signal).catch(e => { if (!controller.signal.aborted) setError(p.errors[e?.code] || p.joinFailed); });
		return () => controller.abort();
	},[load,p]);
	useEffect(() => { if (confirmReplace) confirmButton.current?.focus(); }, [confirmReplace]);
	const act = async (path,method,body) => {
		if (mutation.current) return;
		mutation.current = true;
		setBusy(true); setError('');
		try { const r = await fetch('/api/megu/projects/'+code+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body || {})}); const b = await r.json(); if(!r.ok) throw b;
			if(b.token) { setLink(window.location.origin+'/projects/join/'+b.token); setCopied(false); }
			if(method === 'DELETE') setLink('');
			setConfirmReplace(false);
			await load(); if(path.startsWith('/join-requests/')) await onChanged();
		} catch(e) { setError(p.errors[e?.code] || p.joinFailed); }
		finally { mutation.current = false; setBusy(false); }
	};
	const disabled = busy || loading;
	const expiresAt = data?.link?.expiresAt;
	const expiry = expiresAt && new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone || 'UTC' }).format(new Date(expiresAt));
	return <div className={styles.inviteArea} aria-busy={disabled}>
		<h3>{p.joinTitle}</h3><p>{p.joinHint}</p>
		{data?.link && <><p className={styles.joinStatus}>{p.joinActive}</p><p>{p.joinExpires}: <time dateTime={expiresAt}>{expiry}</time> ({timezone || 'UTC'})</p></>}
		{(link || data?.link) && <p>{p.joinCopyOnce}</p>}
		<div className={styles.joinActions}>
			<button ref={createButton} type="button" className="btn btn-primary" disabled={disabled || !data} onClick={() => data.link ? setConfirmReplace(true) : act('/join-link','POST')}>{data?.link ? p.replaceJoinLink : p.createJoinLink}</button>
			{data?.link && <button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => act('/join-link','DELETE')}>{p.revokeJoinLink}</button>}
		</div>
		{confirmReplace && <div role="group" aria-label={p.replaceJoinLink}>
			<p>{p.replaceJoinConfirm}</p>
			<button ref={confirmButton} type="button" className="btn btn-primary" disabled={disabled} onClick={() => act('/join-link','POST')}>{p.replaceJoinLink}</button>
			<button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => { setConfirmReplace(false); createButton.current?.focus(); }}>{p.cancel}</button>
		</div>}
		{link && <div className={styles.joinLink}><input aria-label={p.joinTitle} readOnly value={link} onFocus={e => e.target.select()} /><button type="button" className="btn btn-secondary" disabled={disabled} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError(p.joinFailed); } }}>{copied ? p.copied : p.copyLink}</button></div>}
		{error && <div><p role="alert" className={styles.alert}>{error}</p><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => { setError(''); load().catch(e => setError(p.errors[e?.code] || p.joinFailed)); }}>{p.retry}</button></div>}
		<div className={styles.pending}><h3>{p.joinRequests}</h3>
			{loading && <p role="status">{p.loadingMore}</p>}
			{data && !data.requests.length && <p>{p.noJoinRequests}</p>}
			{data?.requests.map(request => <div key={request.id} className={styles.pendingRow}>
				<div className={styles.pendingIdentity}><ProjectAvatar name={request.displayName} avatarUrl={request.avatarUrl} className={styles.avatar} /><strong>{request.displayName}</strong></div>
				<label className={styles.pendingRole}><span>{p.inviteRole}</span><CustomSelect size="compact" searchable={false} disabled={disabled} ariaLabel={`${request.displayName} ${p.inviteRole}`} value={requestRoles[request.id] || 'member'} onChange={role => setRequestRoles(current => ({ ...current, [request.id]: role }))} options={JOIN_ROLES.map(role => ({ value: role, label: p.role[role] }))} /></label>
				<div className={styles.pendingActions}><button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => act('/join-requests/'+request.id,'POST',{action:'approve',role:requestRoles[request.id] || 'member'})}>{p.approveJoin}</button><button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => act('/join-requests/'+request.id,'POST',{action:'reject'})}>{p.rejectJoin}</button></div>
			</div>)}
		</div>
	</div>;
}
