import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

export type ConflictKind = 'truck-overlap' | 'lane-contention' | 'customs-pickup-hold';
export interface ConflictParty {
  appointmentId: string; containerId: string; truckNo: string;
  windowStart: string; windowEnd: string; lane: 'north' | 'south' | 'rail';
  status: string; customs?: 'released' | 'inspection' | 'hold';
}
export interface ConflictAction { kind: 'move-window' | 'switch-lane'; label: string; appointmentId: string; }
export interface Conflict {
  id: string; kind: ConflictKind; severity: 'critical' | 'warning'; reason: string;
  parties: ConflictParty[]; availableActions: ConflictAction[];
  resolvableByDispatch: boolean; suggestion: string;
}
export interface AppointmentAdjustment { windowStart?: string; windowEnd?: string; lane?: 'north' | 'south' | 'rail'; }
export interface ConflictPreview {
  conflictId: string | null;
  appointment: { id: string; containerId: string; truckNo: string; driver: string; type: 'pickup' | 'dropoff'; windowStart: string; windowEnd: string; lane: 'north' | 'south' | 'rail'; status: string };
  change: AppointmentAdjustment;
  beforeConflicts: Conflict[]; afterConflicts: Conflict[];
  resolvedConflictIds: string[]; remainingConflictIds: string[]; createdConflictIds: string[];
  affectedParties: ConflictParty[];
  suggestion?: AppointmentAdjustment & { label: string };
  customsBlocked: boolean;
}
export interface ConflictResolveResult extends ConflictPreview { conflicts: Conflict[]; }

export interface ApiConflictError extends Error { code?: string; fresh?: { conflicts: Conflict[]; appointment?: ConflictPreview['appointment'] } }

export const laneLabel: Record<'north' | 'south' | 'rail', string> = { north: '北闸口', south: '南闸口', rail: '铁路闸口' };
const kindLabel: Record<ConflictKind, string> = {
  'truck-overlap': '同车时间冲突',
  'lane-contention': '同窗车道占用',
  'customs-pickup-hold': '海关未放行提箱'
};
const customsText = (customs?: string) => customs === 'inspection' ? '海关查验中' : customs === 'hold' ? '海关扣留' : '';
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const toLocalInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function PartyRow({ party, onLocate }: { party: ConflictParty; onLocate: (id: string) => void }) {
  const customs = customsText(party.customs);
  return <div className="conflict-party">
    <span className="party-id"><b>{party.appointmentId}</b><small>{party.containerId} · {party.truckNo}</small></span>
    <span className="party-window">{time(party.windowStart)}—{time(party.windowEnd)}<small>{laneLabel[party.lane]} · {party.status}</small></span>
    {customs && <span className={`party-customs ${party.customs}`}>{customs}</span>}
    <button type="button" className="locate-action" onClick={() => onLocate(party.appointmentId)}>定位预约 ↓</button>
  </div>;
}

export function ConflictCard({ conflict, onLocate, onResolve }: {
  conflict: Conflict;
  onLocate: (appointmentId: string) => void;
  onResolve: (conflict: Conflict, appointmentId: string, mode: 'window' | 'lane') => void;
}) {
  const isCustoms = conflict.kind === 'customs-pickup-hold';
  const actionsByAppointment = new Map<string, ConflictAction[]>();
  conflict.availableActions.forEach(action => {
    actionsByAppointment.set(action.appointmentId, [...(actionsByAppointment.get(action.appointmentId) ?? []), action]);
  });

  return <div className={`conflict-card ${conflict.severity} ${isCustoms ? 'is-customs' : ''}`}>
    <div className="conflict-card-head">
      <span className={`conflict-kind ${conflict.kind}`}>{kindLabel[conflict.kind]}</span>
      <b className="conflict-title">{conflict.reason}</b>
      <span className={`conflict-sev ${conflict.severity}`}>{conflict.severity === 'critical' ? '需立即处理' : '风险提示'}</span>
    </div>
    <div className="conflict-parties">
      {conflict.parties.map(party => <PartyRow key={party.appointmentId} party={party} onLocate={onLocate} />)}
    </div>
    {isCustoms
      ? <div className="customs-blocked-note"><strong>海关监管限制 · 不提供改时隙/改车道操作</strong><span>{conflict.suggestion}</span></div>
      : <div className="conflict-card-foot">
        <span className="conflict-hint">{conflict.kind === 'truck-overlap' ? '同车冲突只能错峰窗口，切换车道无效。' : conflict.suggestion}</span>
        <span className="conflict-quick-actions">
          {[...actionsByAppointment.entries()].map(([appointmentId, actions]) =>
            <span className="quick-group" key={appointmentId}>
              <small>{appointmentId}</small>
              {actions.map(action =>
                <button key={action.kind} type="button" className="quick-action"
                  onClick={() => onResolve(conflict, appointmentId, action.kind === 'switch-lane' ? 'lane' : 'window')}>
                  {action.kind === 'move-window' ? '⏱ 调整窗口' : '↔ 切换车道'}
                </button>)}
            </span>)}
        </span>
      </div>}
  </div>;
}

function findConflict(preview: ConflictPreview, id: string) {
  return preview.afterConflicts.find(item => item.id === id) ?? preview.beforeConflicts.find(item => item.id === id);
}

export function ConflictResolver({ conflict, appointmentId, initialMode, appointment, onClose, onSaved, onFailure, postJson }: {
  conflict: Conflict;
  appointmentId: string;
  initialMode: 'window' | 'lane';
  appointment: ConflictPreview['appointment'];
  onClose: () => void;
  onSaved: (result: ConflictResolveResult) => void;
  onFailure: (error: unknown) => Promise<void> | void;
  postJson: <T>(path: string, body: unknown) => Promise<T>;
}) {
  const supportsLane = conflict.kind === 'lane-contention';
  const [mode, setMode] = useState<'window' | 'lane'>(supportsLane ? initialMode : 'window');
  const [draftStart, setDraftStart] = useState(toLocalInput(appointment.windowStart));
  const [draftEnd, setDraftEnd] = useState(toLocalInput(appointment.windowEnd));
  const [lane, setLane] = useState<'north' | 'south' | 'rail'>(appointment.lane);
  const [preview, setPreview] = useState<ConflictPreview>();
  const [suggestion, setSuggestion] = useState<ConflictPreview['suggestion']>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const buildChange = (override?: AppointmentAdjustment): AppointmentAdjustment => {
    const change = override ?? (mode === 'window'
      ? { windowStart: new Date(draftStart).toISOString(), windowEnd: new Date(draftEnd).toISOString() }
      : { lane });
    // 去掉与当前预约一致的字段，保持预检语义干净
    const next: AppointmentAdjustment = {};
    if (change.windowStart && change.windowStart !== appointment.windowStart) next.windowStart = change.windowStart;
    if (change.windowEnd && change.windowEnd !== appointment.windowEnd) next.windowEnd = change.windowEnd;
    if (change.lane && change.lane !== appointment.lane) next.lane = change.lane;
    return next;
  };

  const runPreview = async (override?: AppointmentAdjustment) => {
    setLoading(true); setLocalError('');
    try {
      const change = override ?? buildChange();
      const result = await postJson<ConflictPreview>('/gate/conflicts/preview', { appointmentId, change, conflictId: conflict.id });
      setPreview(result); setSuggestion(result.suggestion);
      if (result.suggestion?.windowStart) setDraftStart(toLocalInput(result.suggestion.windowStart));
      if (result.suggestion?.windowEnd) setDraftEnd(toLocalInput(result.suggestion.windowEnd));
      if (result.suggestion?.lane) setLane(result.suggestion.lane);
    } catch (error) { await onFailure(error); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 打开时先取一次服务端建议；窗口模式自动套用建议时隙，车道模式默认一条备用车道
      try {
        const first = await postJson<ConflictPreview>('/gate/conflicts/preview', { appointmentId, change: {}, conflictId: conflict.id });
        if (cancelled) return;
        setSuggestion(first.suggestion);
        if (initialMode === 'window' && first.suggestion?.windowStart && first.suggestion.windowEnd) {
          const suggestedStart = first.suggestion.windowStart;
          const suggestedEnd = first.suggestion.windowEnd;
          const change: AppointmentAdjustment = { windowStart: suggestedStart, windowEnd: suggestedEnd };
          setDraftStart(toLocalInput(suggestedStart)); setDraftEnd(toLocalInput(suggestedEnd));
          const result = await postJson<ConflictPreview>('/gate/conflicts/preview', { appointmentId, change, conflictId: conflict.id });
          if (cancelled) return;
          setPreview(result);
        } else if (initialMode === 'lane') {
          const otherLane = (['north', 'south', 'rail'] as const).find(item => item !== appointment.lane)!;
          setLane(otherLane);
          const result = await postJson<ConflictPreview>('/gate/conflicts/preview', { appointmentId, change: { lane: otherLane }, conflictId: conflict.id });
          if (cancelled) return;
          setPreview(result);
        } else {
          setPreview(first);
        }
      } catch (error) { if (!cancelled) await onFailure(error); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    setSaving(true); setLocalError('');
    try {
      const result = await postJson<ConflictResolveResult>('/gate/conflicts/resolve', { appointmentId, change: preview.change, conflictId: conflict.id });
      onSaved(result);
    } catch (error) { await onFailure(error); }
    finally { setSaving(false); }
  };

  const applySuggestionAndPreview = async () => {
    if (!suggestion) return;
    if (suggestion.windowStart) setDraftStart(toLocalInput(suggestion.windowStart));
    if (suggestion.windowEnd) setDraftEnd(toLocalInput(suggestion.windowEnd));
    if (suggestion.lane) setLane(suggestion.lane);
    await runPreview({ ...(suggestion.windowStart ? { windowStart: suggestion.windowStart, windowEnd: suggestion.windowEnd } : {}), ...(suggestion.lane ? { lane: suggestion.lane } : {}) });
  };

  const renderConflictLine = (id: string, tone: 'resolved' | 'remaining' | 'created') => {
    const item = findConflict(preview!, id);
    return <li key={id} className={`diff-line ${tone}`}>
      <i>{tone === 'resolved' ? '✓ 化解' : tone === 'created' ? '! 新增' : '~ 仍存在'}</i>
      <span>{item ? `${kindLabel[item.kind]} · ${item.parties.map(p => p.appointmentId).join(' / ')}` : id}</span>
    </li>;
  };

  const clean = preview && preview.resolvedConflictIds.length > 0 && preview.remainingConflictIds.length === 0 && preview.createdConflictIds.length === 0;

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form className="editor-modal resolver-modal" onSubmit={submit}>
      <div className="modal-head">
        <div>
          <div className="eyebrow">CONFLICT RESOLUTION / {kindLabel[conflict.kind]}</div>
          <h2>处置 {conflict.parties.map(p => p.appointmentId).join(' × ')} 的冲突</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} disabled={saving}>×</button>
      </div>

      <div className="resolver-target">
        <b>{appointment.id}</b>
        <span>{appointment.containerId} · {appointment.truckNo} · {appointment.driver}</span>
        <small>当前 {time(appointment.windowStart)}—{time(appointment.windowEnd)} · {laneLabel[appointment.lane]}</small>
      </div>

      {supportsLane && <div className="resolver-mode">
        <button type="button" className={mode === 'lane' ? 'active' : ''} onClick={() => setMode('lane')}>切换车道</button>
        <button type="button" className={mode === 'window' ? 'active' : ''} onClick={() => setMode('window')}>错峰调整窗口</button>
      </div>}
      {!supportsLane && <div className="resolver-mode-note">同一车辆无法同时使用两条车道，本冲突只能通过错峰窗口化解。</div>}

      <div className="resolver-controls">
        {mode === 'window' ? <>
          <label>窗口开始<input type="datetime-local" required value={draftStart} onChange={e => setDraftStart(e.target.value)} /></label>
          <label>窗口结束<input type="datetime-local" required value={draftEnd} onChange={e => setDraftEnd(e.target.value)} /></label>
        </> : <label className="resolver-lane">调整到车道
          <select value={lane} onChange={e => { setLane(e.target.value as 'north' | 'south' | 'rail'); }}>
            <option value="north">北闸口</option><option value="south">南闸口</option><option value="rail">铁路闸口</option>
          </select>
        </label>}
        <button type="button" className="repreview-btn" disabled={loading} onClick={() => void runPreview()}>{loading ? '预检中…' : '重新预检'}</button>
      </div>

      {suggestion && <div className="resolver-suggestion">
        <span>系统建议：{suggestion.label}</span>
        <button type="button" onClick={() => void applySuggestionAndPreview()}>采用建议并预检</button>
      </div>}

      {localError && <div className="form-error">{localError}</div>}
      {loading && !preview && <div className="resolver-loading">正在计算调整后的冲突结果…</div>}

      {preview && <div className="resolver-preview">
        <div className="preview-section">
          <div className="eyebrow">AFFECTED COUNTERPARTIES / 受影响的另一条预约</div>
          {preview.affectedParties.length === 0
            ? <p className="preview-empty">没有其他预约受到影响</p>
            : preview.affectedParties.map(party => <PartyRow key={party.appointmentId} party={party} onLocate={() => undefined} />)}
        </div>
        <div className="preview-section">
          <div className="eyebrow">CONFLICT RESULT / 保存后的冲突结果</div>
          <ul className="conflict-diff">
            {preview.resolvedConflictIds.map(id => renderConflictLine(id, 'resolved'))}
            {preview.remainingConflictIds.map(id => renderConflictLine(id, 'remaining'))}
            {preview.createdConflictIds.map(id => renderConflictLine(id, 'created'))}
          </ul>
          <div className={`preview-verdict ${clean ? 'ok' : 'warn'}`}>
            {clean ? '本次调整可完全化解该冲突，且不产生新冲突。' : `保存后仍存在 ${preview.remainingConflictIds.length + preview.createdConflictIds.length} 项冲突${preview.createdConflictIds.length ? '（含新产生）' : ''}，请确认后再保存。`}
          </div>
        </div>
      </div>}

      <div className="modal-actions">
        <button type="button" onClick={onClose} disabled={saving}>取消</button>
        <button className="primary-action" disabled={saving || loading || !preview}>{saving ? '保存中…' : '确认保存调整'}</button>
      </div>
    </form>
  </div>;
}
