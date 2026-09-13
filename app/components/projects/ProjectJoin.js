'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AuthGate from '../AuthGate';
import MeguMark from '../MeguMark';
import { useCopy } from '../../copy';
import styles from './projectInvitation.module.css';

export default function ProjectJoin({ token }) {
	const { t } = useCopy(); const p = t.projects;
	const [auth,setAuth] = useState('loading');
	const [result,setResult] = useState(null);
	const [busy,setBusy] = useState(false);
	const [error,setError] = useState('');
	const active = useRef(null);
	const load = useCallback(async (method = 'GET') => {
		active.current?.abort();
		const controller = new AbortController();
		active.current = controller;
		setBusy(true); setError('');
		try {
			const response = await fetch('/api/megu/projects/join/' + encodeURIComponent(token), {
				method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
			});
			if (controller.signal.aborted) return;
			if (response.status === 401) { setAuth('signed-out'); setResult(null); return; }
			const body = await response.json();
			if (controller.signal.aborted) return;
			if (!response.ok) throw body;
			setAuth('ready'); setResult(body);
		} catch (problem) {
			if (controller.signal.aborted) return;
			// Recover an uncertain POST with GET, never an automatic resubmit.
			setAuth('error'); setResult(null);
			setError(p.errors[problem?.code] || p.joinFailed);
		} finally {
			if (!controller.signal.aborted) setBusy(false);
		}
	}, [token, p]);
	useEffect(() => {
		setAuth('loading'); setResult(null);
		load();
		return () => active.current?.abort();
	}, [load]);
	if(auth === 'signed-out') return <AuthGate title={p.requestJoinTitle} lede={p.requestJoinHint} action={p.requestJoin} href={'/api/auth/login?returnTo='+encodeURIComponent('/projects/join/'+token)} />;
	const message = result?.status === 'pending' ? p.joinPending : result?.status === 'rejected' ? p.joinRejected : result?.status === 'removed' ? p.joinRemoved : result?.status === 'approved' ? p.joinApproved : p.requestJoinHint;
	return <main className={styles.page}><section className={styles.panel} aria-busy={busy || auth === 'loading'}>
		<MeguMark size={58} /><h1>{p.requestJoinTitle}</h1><p role="status">{message}</p>
		<div className={styles.action}>
			{error && <p role="alert" className={styles.error}>{error}</p>}
			{result?.status === 'approved' && result.project ? <Link className="btn btn-primary" href={'/p/' + result.project.code}>{p.backToProject}</Link> :
				<button type="button" className="btn btn-primary" disabled={busy || auth === 'loading'} onClick={() => load(result?.status === 'eligible' ? 'POST' : 'GET')}>
					{busy || auth === 'loading' ? p.loadingMore : error ? p.retry : result?.status === 'eligible' ? p.requestJoin : p.checkJoin}
				</button>}
		</div>
	</section></main>;
}
