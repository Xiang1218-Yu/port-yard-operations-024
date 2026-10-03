import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Dashboard = { activeVoyages: number; berthMoves: number; yardUtilization: number; gateQueue: number; pendingTasks: number; blockedTasks: number; reeferAlerts: number; hazmatHolds: number; lateVessels: number };
type Voyage = { id: string; vessel: string; service: string; eta: string; etd: string; status: string; berth: string; movesPlanned: number; movesDone: number; lateRisk: string };
type Container = { id: string; voyageId: string; size: '20'|'40'|'45'; isoType: string; direction: 'import'|'export'|'transshipment'; status: string; weightT: number; reefer: boolean; temperature?: number; hazmatClass?: string; customs: 'released'|'inspection'|'hold'; priority: string; yardSlot: string; appointmentId?: string; lastEvent: string };
type Block = { id: string; zone: string; capacity: number; occupied: number; reeferPlugs: number; usedPlugs: number; hazmatAllowed: boolean; heat: number; utilization: number; freeSlots: number; pressure: string };
type ConflictParty = { appointmentId: string; containerId: string; truckNo: string; type: 'pickup'|'dropoff'; windowStart: string; windowEnd: string; lane: 'north'|'south'|'rail'; status: string };
type ConflictKind = 'truck-overlap'|'lane-overlap'|'customs-blocked';
type Conflict = { id: string; kind: ConflictKind; severity: string; appointmentId: string; otherAppointmentId?: string; lane?: 'north'|'south'|'rail'; truckNo?: string; customs?: 'released'|'inspection'|'hold'; reason: string; primary: ConflictParty; other?: ConflictParty };
type AdjustPreviewPartyContainer = { id: string; customs: 'released'|'inspection'|'hold'; customsLabel: string };
type AdjustPreview = { target: ConflictParty; targetContainer?: AdjustPreviewPartyContainer; affected?: ConflictParty; affectedContainer?: AdjustPreviewPartyContainer; requested: { windowStart?: string; windowEnd?: string; lane?: 'north'|'south'|'rail' }; conflictKind?: ConflictKind; beforeConflicts: Conflict[]; afterConflicts: Conflict[]; newConflicts: Conflict[]; remainingConflictIds: string[]; resolvesConflict: boolean; customsBlocked: boolean; notes: string[] };
type AdjustState = { conflict: Conflict; windowStart: string; windowEnd: string; lane: 'north'|'south'|'rail'; preview?: AdjustPreview; loading: boolean; saving: boolean; notice: string; error: string };
type Appointment = { id: string; containerId: string; truckNo: string; driver: string; type: 'pickup'|'dropoff'; windowStart: string; windowEnd: string; lane: 'north'|'south'|'rail'; status: string; exception?: string };
type Task = { id: string; kind: string; containerId: string; from: string; to: string; equipmentId?: string; priority: number; score: number; status: string; blockingReasons: string[]; estimatedMinutes: number; scheduledAt: string };
type Equipment = { id: string; name: string; kind: string; status: string; location: string; battery: number; queue: number; movesPerHour: number };
type Section = 'control'|'containers'|'gate'|'yard'|'tasks';
type Editor = { entity: 'container'|'appointment'|'task'; mode: 'create'|'edit'; id?: string; values: Record<string, string|boolean> };

const api = '/api';
const laneNames: Record<'north'|'south'|'rail', string> = { north: '北闸口', south: '南闸口', rail: '铁路闸口' };
const typeNames: Record<'pickup'|'dropoff', string> = { pickup: '提箱', dropoff: '进场' };
const customsBadge: Record<'released'|'inspection'|'hold', string> = { released: '海关已放行', inspection: '海关查验中', hold: '海关扣留' };
class ApiError extends Error { constructor(public code?: string) { super(); } }
const pct = (value: number) => `${Math.round(value * 100)}%`;
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const toLocalInput = (value?: string) => {
  const date = value ? new Date(value) : new Date(Date.now() + 30 * 60000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const defaultValues = (entity: Editor['entity']): Record<string, string|boolean> => {
  if (entity === 'container') return { id: '', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'import', status: 'in-yard', weightT: '20', reefer: false, temperature: '4', hazmatClass: '', customs: 'released', priority: 'normal', yardSlot: 'C03-R01-T1' };
  if (entity === 'appointment') return { containerId: '', truckNo: '', driver: '', type: 'pickup', windowStart: toLocalInput(), windowEnd: toLocalInput(new Date(Date.now() + 60 * 60000).toISOString()), lane: 'north' };
  return { kind: 'receive', containerId: '', from: '闸口', to: 'C03-R01-T1', equipmentId: '', priority: '50', scheduledAt: toLocalInput(), estimatedMinutes: '20', status: 'queued' };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${api}${path}`, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new ApiError(body.code); error.message = body.message || `请求失败 (${response.status})`; throw error; }
  return body as T;
}

function AppointmentChip({ party, container, target, adjusted }: { party: ConflictParty; container?: Container; target?: boolean; adjusted?: boolean }) {
  const customs = container?.customs;
  return <div className={`appt-chip${target ? ' target' : ''}${adjusted ? ' adjusted' : ''}`}>
    <div className="appt-chip-head"><b>{party.appointmentId}</b>{target && <span className="chip-flag">调整对象</span>}{adjusted && <span className="chip-flag ghost">调整后</span>}</div>
    <span className="appt-chip-line">{typeNames[party.type]} · 箱 {party.containerId}{customs && customs !== 'released' ? ` · ${customsBadge[customs]}` : ''}</span>
    <span className="appt-chip-line">{party.truckNo} · {laneNames[party.lane]}</span>
    <span className="appt-chip-line">{time(party.windowStart)}—{time(party.windowEnd)} · {party.status}</span>
  </div>;
}

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [tab, setTab] = useState<Section>('control');
  const [selectedVoyage, setSelectedVoyage] = useState('VOY-AX7');
  const [editor, setEditor] = useState<Editor>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState<AdjustState>();
  const [highlightId, setHighlightId] = useState('');
  const [customsRefreshing, setCustomsRefreshing] = useState('');
  const previewSeq = useRef(0);

  const load = useCallback(async () => {
    const [d, v, ctn, b, cf, a, t, e] = await Promise.all([
      request<Dashboard>('/dashboard'), request<Voyage[]>('/voyages'), request<Container[]>('/containers'),
      request<Block[]>('/yard/heatmap'), request<Conflict[]>('/gate/conflicts'), request<Appointment[]>('/gate/appointments'),
      request<Task[]>('/tasks'), request<Equipment[]>('/equipment')
    ]);
    setDashboard(d); setVoyages(v); setContainers(ctn); setBlocks(b); setConflicts(cf); setAppointments(a); setTasks(t); setEquipment(e);
  }, []);
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : '无法连接服务端')); }, [load]);

  const mutate = async (path: string, method: string, body?: unknown) => {
    setBusy(true); setError('');
    try {
      await request(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      await load(); setEditor(undefined); setMessage('操作已保存，作业台数据已刷新');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '操作失败'); }
    finally { setBusy(false); }
  };
  const openCreate = (entity: Editor['entity']) => { setError(''); setEditor({ entity, mode: 'create', values: defaultValues(entity) }); };
  const openEdit = (entity: Editor['entity'], id: string, values: Record<string, string|boolean>) => { setError(''); setEditor({ entity, mode: 'edit', id, values: { ...values } }); };
  const updateField = (key: string, value: string|boolean) => setEditor(current => current ? { ...current, values: { ...current.values, [key]: value } } : current);
  const saveEditor = async (event: FormEvent) => {
    event.preventDefault(); if (!editor) return;
    const { entity, mode, id, values } = editor;
    const payload: Record<string, unknown> = entity === 'container' ? {
      ...(mode === 'create' ? { id: values.id } : {}), voyageId: values.voyageId, size: values.size, isoType: values.isoType,
      direction: values.direction, status: values.status, weightT: Number(values.weightT), reefer: Boolean(values.reefer),
      ...(values.reefer ? { temperature: Number(values.temperature) } : {}), ...(values.hazmatClass ? { hazmatClass: values.hazmatClass } : {}),
      customs: values.customs, priority: values.priority, yardSlot: values.yardSlot
    } : entity === 'appointment' ? {
      containerId: values.containerId, truckNo: values.truckNo, driver: values.driver, type: values.type,
      windowStart: new Date(String(values.windowStart)).toISOString(), windowEnd: new Date(String(values.windowEnd)).toISOString(), lane: values.lane
    } : {
      kind: values.kind, containerId: values.containerId, from: values.from, to: values.to, priority: Number(values.priority),
      scheduledAt: new Date(String(values.scheduledAt)).toISOString(), estimatedMinutes: Number(values.estimatedMinutes),
      ...(values.equipmentId ? { equipmentId: values.equipmentId } : {}), ...(mode === 'edit' ? { status: values.status } : {})
    };
    await mutate(entity === 'container' ? `/containers${mode === 'edit' ? `/${id}` : ''}` : entity === 'appointment' ? `/gate/appointments${mode === 'edit' ? `/${id}` : ''}` : `/tasks${mode === 'edit' ? `/${id}` : ''}`, mode === 'create' ? 'POST' : 'PATCH', payload);
  };
  const remove = async (entity: Editor['entity'], id: string) => {
    if (!window.confirm(`确认删除 ${id}？相关数据的联动处理会写入审计记录。`)) return;
    const path = entity === 'container' ? `/containers/${id}` : entity === 'appointment' ? `/gate/appointments/${id}` : `/tasks/${id}`;
    await mutate(path, 'DELETE');
  };
  const updateAppointmentStatus = async (id: string, status: string) => mutate(`/gate/appointments/${id}`, 'PATCH', { status });
  const assign = async (id: string, equipmentId: string) => equipmentId ? mutate(`/tasks/${id}/assign`, 'PATCH', { equipmentId }) : mutate(`/tasks/${id}`, 'PATCH', { equipmentId: '', status: 'queued' });

  const locateAppointment = (id: string) => {
    setTab('gate');
    requestAnimationFrame(() => document.getElementById(`appointment-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    setHighlightId(id);
    window.setTimeout(() => setHighlightId(current => current === id ? '' : current), 4000);
  };
  const refreshPreview = useCallback(async (conflict: Conflict, windowStart: string, windowEnd: string, lane: 'north'|'south'|'rail') => {
    const seq = ++previewSeq.current;
    setAdjust(current => current ? { ...current, loading: true, error: '', notice: '' } : current);
    try {
      const preview = await request<AdjustPreview>(`/gate/appointments/${conflict.appointmentId}/adjust-preview`, {
        method: 'POST', body: JSON.stringify({ windowStart: new Date(windowStart).toISOString(), windowEnd: new Date(windowEnd).toISOString(), lane })
      });
      if (seq !== previewSeq.current) return;
      setAdjust(current => current ? { ...current, preview, loading: false } : current);
    } catch (reason) {
      if (seq !== previewSeq.current) return;
      setAdjust(current => current ? { ...current, loading: false, error: reason instanceof Error ? reason.message : '冲突预览失败' } : current);
    }
  }, []);
  const openConflictAdjust = (conflict: Conflict) => {
    const target = appointments.find(item => item.id === conflict.appointmentId);
    if (!target) return;
    setError('');
    const draft: AdjustState = { conflict, windowStart: toLocalInput(target.windowStart), windowEnd: toLocalInput(target.windowEnd), lane: target.lane, loading: true, saving: false, notice: '', error: '' };
    setAdjust(draft);
    void refreshPreview(conflict, draft.windowStart, draft.windowEnd, draft.lane);
  };
  const closeAdjust = () => { previewSeq.current++; setAdjust(undefined); };
  const shiftWindow = (minutes: number) => {
    if (!adjust) return;
    const windowStart = new Date(new Date(adjust.windowStart).getTime() + minutes * 60000);
    const windowEnd = new Date(new Date(adjust.windowEnd).getTime() + minutes * 60000);
    const next = { ...adjust, windowStart: toLocalInput(windowStart.toISOString()), windowEnd: toLocalInput(windowEnd.toISOString()) };
    setAdjust(next);
    void refreshPreview(next.conflict, next.windowStart, next.windowEnd, next.lane);
  };
  const changeAdjustField = (patch: Partial<Pick<AdjustState, 'windowStart'|'windowEnd'|'lane'>>) => {
    setAdjust(current => {
      if (!current) return current;
      const next = { ...current, ...patch };
      void refreshPreview(next.conflict, next.windowStart, next.windowEnd, next.lane);
      return next;
    });
  };
  const saveConflictAdjust = async () => {
    if (!adjust) return;
    setAdjust(current => current ? { ...current, saving: true, error: '', notice: '' } : current);
    try {
      const result = await request<{ preview: AdjustPreview }>(`/gate/appointments/${adjust.conflict.appointmentId}/resolve-conflict`, {
        method: 'POST',
        body: JSON.stringify({ expectedConflictId: adjust.conflict.id, windowStart: new Date(adjust.windowStart).toISOString(), windowEnd: new Date(adjust.windowEnd).toISOString(), lane: adjust.lane })
      });
      await load();
      const remaining = result.preview.afterConflicts.length;
      setAdjust(undefined);
      setMessage(remaining ? `预约 ${adjust.conflict.appointmentId} 已调整，该冲突已解除；当前还剩 ${remaining} 条其他冲突，可在列表中继续处理` : '冲突已解除，闸口冲突列表与预约数据已刷新');
    } catch (reason) {
      await load().catch(() => undefined);
      const code = reason instanceof ApiError ? reason.code : undefined;
      const detail = reason instanceof Error ? reason.message : '保存失败';
      if (code === 'conflict-changed') {
        setAdjust(undefined);
        setError(`${detail}。可在刷新后的冲突列表中重新选择处理；如冲突已消失，无需重复操作。`);
      } else if (code === 'customs-hold') {
        setAdjust(undefined);
        setError(`${detail}。该提箱预约不能改时隙，请等待海关放行后在冲突卡片上重新检测，或联系海关查验台。`);
      } else if (code === 'appointment-missing') {
        setAdjust(undefined);
        setError('目标预约可能已被其他值班员取消或删除，数据已重新读取；请按最新预约列表继续操作。');
      } else {
        setAdjust(current => current ? { ...current, saving: false, error: `${detail}。表单未关闭，可重试；如多次失败请刷新冲突数据后再处理。` } : current);
      }
    }
  };
  const recheckCustoms = async (conflict: Conflict) => {
    setCustomsRefreshing(conflict.appointmentId);
    setError('');
    try {
      const [latest] = await Promise.all([request<Conflict[]>('/gate/conflicts'), load()]);
      const gone = !latest.some(item => item.id === conflict.id);
      setMessage(gone ? `箱 ${conflict.primary.containerId} 已海关放行，该冲突已解除` : '已重新读取最新数据：该箱仍未海关放行，请等待放行后再处理');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重新读取数据失败，请稍后重试');
    } finally { setCustomsRefreshing(''); }
  };
  const selected = voyages.find(voyage => voyage.id === selectedVoyage);
  const remaining = selected ? selected.movesPlanned - selected.movesDone : 0;
  const maxHeat = useMemo(() => Math.max(...blocks.map(block => block.heat), 1), [blocks]);

  if (!dashboard && error) return <main className="connection-error"><div className="eyebrow">API CONNECTION ERROR</div><h1>无法连接港口作业服务</h1><p>{error}</p><p>请从项目根目录运行 <code>npm run dev</code>，确认前端 5178 和 API 4107 均已启动。</p><button onClick={() => { setError(''); void load().catch(reason => setError(reason instanceof Error ? reason.message : '无法连接服务端')); }}>重新连接</button></main>;
  if (!dashboard) return <div className="loading">正在连接码头实时作业中台…</div>;

  return <main>
    <header><div><div className="eyebrow">PORT OPS / YARD & GATE CONTROL</div><h1>HarborGrid <span>港口集装箱堆场协同与闸口调度</span></h1><p>把船期、箱务、堆场容量、危险品/冷藏约束、闸口预约与场内设备任务放在同一条作业链路上。</p></div><div className="header-right"><span className="live"><i/> TOS LINKED</span><span className="clock">LIVE · {new Date().toLocaleTimeString()}</span></div></header>
    {message && <div className="toast" onClick={() => setMessage('')}>{message} ×</div>}{error && <div className="form-error page-error">{error}<button onClick={() => setError('')}>关闭</button></div>}
    <section className="kpis"><div><small>ACTIVE VESSELS</small><b>{dashboard.activeVoyages}<em> 艘</em></b><span>{dashboard.lateVessels} 艘存在延误风险</span></div><div><small>YARD UTILIZATION</small><b>{pct(dashboard.yardUtilization)}</b><span>可用堆位 / 危险品隔离纳管</span></div><div><small>GATE QUEUE</small><b>{dashboard.gateQueue}<em> 车</em></b><span>预约、已进场与车道排队</span></div><div><small>EXCEPTIONS</small><b>{dashboard.blockedTasks + dashboard.reeferAlerts + dashboard.hazmatHolds}<em> 项</em></b><span>{dashboard.blockedTasks} 作业阻塞 · {dashboard.reeferAlerts} 冷藏告警</span></div></section>
    <nav className="tabs"><button className={tab==='control'?'active':''} onClick={() => setTab('control')}>作业驾驶舱</button><button className={tab==='containers'?'active':''} onClick={() => setTab('containers')}>箱务台账 / CRUD</button><button className={tab==='gate'?'active':''} onClick={() => setTab('gate')}>闸口预约</button><button className={tab==='yard'?'active':''} onClick={() => setTab('yard')}>堆场热区</button><button className={tab==='tasks'?'active':''} onClick={() => setTab('tasks')}>设备任务</button><span>最后同步 {new Date().toLocaleTimeString()}</span></nav>
    {tab === 'control' && <div className="layout"><section className="panel vessel-panel"><div className="panel-head"><div><div className="eyebrow">VESSEL WINDOW / 船期窗口</div><h2>泊位作业进度</h2></div><span className="muted">剩余作业动态计算</span></div>{voyages.map(voyage => <button key={voyage.id} className={`vessel ${selectedVoyage===voyage.id?'selected':''}`} onClick={() => setSelectedVoyage(voyage.id)}><span className={`vessel-dot ${voyage.status}`}/><span className="vessel-main"><b>{voyage.vessel}</b><small>{voyage.id} · {voyage.service} · {voyage.berth}</small><i><em style={{ width: `${Math.min(100, voyage.movesDone / voyage.movesPlanned * 100)}%` }}/></i></span><span className="vessel-move"><b>{voyage.movesDone.toLocaleString()}</b><small>/ {voyage.movesPlanned.toLocaleString()} moves</small></span><strong className={voyage.lateRisk}>{voyage.lateRisk==='high'?'HIGH':voyage.lateRisk==='medium'?'WATCH':'ON TIME'}</strong></button>)}</section><section className="panel focus-panel"><div className="panel-head"><div><div className="eyebrow">SELECTED VOYAGE / {selected?.id}</div><h2>{selected?.vessel}</h2></div><span className={`badge ${selected?.lateRisk}`}>{selected?.status}</span></div><div className="voyage-stats"><div><small>ETA</small><b>{selected&&time(selected.eta)}</b><span>预计靠泊</span></div><div><small>ETD</small><b>{selected&&time(selected.etd)}</b><span>计划离港</span></div><div><small>REMAINING</small><b>{remaining}</b><span>剩余翻箱</span></div></div><div className="berth-map"><div className="water"><span>岸线 / BERTH</span><i className="ship" style={{ left: `${selected?.berth==='B07'?50:24}%` }}>{selected?.vessel}</i><b>B01</b><b>B04</b><b>B07</b><b>B10</b></div></div><div className="callout"><strong>调度策略</strong><span>已把 {dashboard.blockedTasks} 个阻塞任务、{dashboard.gateQueue} 车闸口压力纳入当前窗口；优先保护冷藏与危险品安全约束。</span></div></section><section className="panel wide"><div className="panel-head"><h3>异常与联动信号</h3><span>{conflicts.length} gate conflicts detected</span></div><div className="signal-grid"><div><strong className="critical">{dashboard.blockedTasks}</strong><span>设备/约束阻塞</span><small>最高优先级：海关查验任务</small></div><div><strong className="warning">{conflicts.length}</strong><span>闸口预约冲突</span><small>同车重叠窗口需人工重排</small></div><div><strong className="warning">{dashboard.reeferAlerts}</strong><span>冷藏与温控风险</span><small>查验区电源余量接近阈值</small></div><div><strong className="ok">{equipment.filter(item => item.status==='available').length}</strong><span>可调度设备</span><small>场桥 / 正面吊 / 集卡</small></div></div></section></div>}
    {tab === 'containers' && <section className="panel wide"><div className="panel-head"><div><div className="eyebrow">CONTAINER REGISTER / CRUD</div><h2>箱务台账</h2><span className="muted">新增、查询、编辑、删除；危险品与冷藏箱受堆场约束校验</span></div><button className="primary-action" onClick={() => openCreate('container')}>＋ 新增箱务</button></div><div className="table container-table"><div className="tr th"><span>箱号 / 航次</span><span>尺寸 / 流向</span><span>箱况 / 海关</span><span>堆位</span><span>重量 / 属性</span><span>操作</span></div>{containers.map(container => <div className="tr" key={container.id}><span><b>{container.id}</b><small>{container.voyageId} · {container.lastEvent}</small></span><span>{container.size}ft · {container.direction}<small>{container.isoType}</small></span><span><b>{container.status}</b><small>海关：{container.customs}</small></span><span>{container.yardSlot}</span><span>{container.weightT}t<small>{container.reefer?`冷藏 ${container.temperature}°C`:container.hazmatClass?`危险品 ${container.hazmatClass} 类`:'普通箱'}</small></span><span className="row-actions"><button onClick={() => openEdit('container', container.id, { ...container, weightT: String(container.weightT), temperature: String(container.temperature ?? 4), hazmatClass: container.hazmatClass ?? '' })}>编辑</button><button className="danger-action" onClick={() => void remove('container', container.id)}>删除</button></span></div>)}</div></section>}
    {tab === 'gate' && <section className="panel wide"><div className="panel-head"><div><div className="eyebrow">GATE APPOINTMENT / SLOT CONTROL</div><h2>闸口预约与车道状态</h2><span className="muted">支持新增预约、编辑时隙、签到/完成和删除</span></div><button className="primary-action" onClick={() => openCreate('appointment')}>＋ 新增预约</button></div><div className="conflict-list-head"><div><div className="eyebrow">CONFLICT QUEUE / 待处理冲突</div><h3>闸口冲突处置 {conflicts.length > 0 && <em>{conflicts.length} 条</em>}</h3></div>{conflicts.length > 0 && <button type="button" onClick={() => void load().then(() => setMessage('冲突数据已重新读取'))} className="ghost-action">重新读取冲突</button>}</div>
{conflicts.length === 0 && <div className="conflict-empty">当前没有同车重叠、车道占用或海关未放行冲突</div>}
{conflicts.map(conflict => {
  const isCustoms = conflict.kind === 'customs-blocked';
  const parties = isCustoms ? [conflict.primary] : [conflict.primary, conflict.other].filter(Boolean) as ConflictParty[];
  return <div className={`conflict-card ${isCustoms ? 'customs' : conflict.severity}`} key={conflict.id}>
    <div className="conflict-top">
      <span className={`conflict-tag ${isCustoms ? 'tag-customs' : conflict.kind === 'truck-overlap' ? 'tag-truck' : 'tag-lane'}`}>{isCustoms ? '海关管制' : conflict.kind === 'truck-overlap' ? '同车时间重叠' : '同车道占用冲突'}</span>
      <p>{conflict.reason}</p>
    </div>
    <div className="conflict-parties">
      {parties.map(party => <AppointmentChip key={party.appointmentId} party={party} container={containers.find(c => c.id === party.containerId)} target={!isCustoms && party.appointmentId === conflict.appointmentId}/>)}
    </div>
    <div className="conflict-actions">
      {!isCustoms && <button type="button" className="primary-action" onClick={() => openConflictAdjust(conflict)}>快速调整（窗口 / 车道）</button>}
      <button type="button" className="ghost-action" onClick={() => locateAppointment(conflict.appointmentId)}>定位预约 {conflict.appointmentId}</button>
      {isCustoms && <button type="button" className="ghost-action" disabled={customsRefreshing === conflict.appointmentId} onClick={() => void recheckCustoms(conflict)}>{customsRefreshing === conflict.appointmentId ? '读取中…' : '重新检测海关状态'}</button>}
    </div>
    {isCustoms && <div className="customs-note">该箱未获海关放行：提供改时隙/车道只会让车辆空跑闸口，因此此处不提供重排操作；放行后点击“重新检测海关状态”即自动解除。</div>}
  </div>;
})}
<div className="table"><div className="tr th"><span>预约</span><span>箱号 / 车辆</span><span>窗口</span><span>车道</span><span>状态</span><span>操作</span></div>{appointments.map(appointment => <div className={`tr${highlightId===appointment.id?' appointment-flash':''}`} id={`appointment-row-${appointment.id}`} key={appointment.id}><span><b>{appointment.id}</b><small>{appointment.type}</small></span><span><b>{appointment.containerId}</b><small>{appointment.truckNo} · {appointment.driver}</small></span><span>{time(appointment.windowStart)}—{time(appointment.windowEnd)}</span><span>{laneNames[appointment.lane]}</span><span className={`pill ${appointment.status}`}>{appointment.status}</span><span className="row-actions">{appointment.status==='booked'?<button onClick={() => void updateAppointmentStatus(appointment.id, 'checked-in')}>签到</button>:appointment.status==='checked-in'?<button onClick={() => void updateAppointmentStatus(appointment.id, 'completed')}>完成</button>:null}<button onClick={() => openEdit('appointment', appointment.id, { ...appointment, windowStart: toLocalInput(appointment.windowStart), windowEnd: toLocalInput(appointment.windowEnd) })}>编辑</button><button className="danger-action" onClick={() => void remove('appointment', appointment.id)}>删除</button></span></div>)}</div></section>}
    {tab === 'yard' && <section className="panel wide"><div className="panel-head"><div><div className="eyebrow">YARD HEATMAP / STACK DENSITY</div><h2>堆场容量与安全约束</h2></div><span className="muted">实时区块压力</span></div><div className="yard-grid">{blocks.map(block => <div className={`block ${block.pressure}`} key={block.id}><div className="block-top"><b>{block.id}</b><strong>{pct(block.utilization)}</strong></div><span>{block.zone}</span><div className="heat"><i style={{ width: `${block.heat / maxHeat * 100}%` }}/></div><div className="block-stats"><span>空位 {block.freeSlots}</span><span>冷插 {block.usedPlugs}/{block.reeferPlugs}</span><span>{block.hazmatAllowed?'危险品可入':'普通区'}</span></div></div>)}</div><div className="yard-note"><span>堆位推荐会同时考虑容量、热区、危险品隔离、冷藏插座和设备可达性。</span><b>A01 → C03 重排建议可释放 21 个低热度堆位</b></div></section>}
    {tab === 'tasks' && <div className="layout"><section className="panel wide"><div className="panel-head"><div><div className="eyebrow">TASK DISPATCH / EQUIPMENT POOL</div><h2>场内任务优先级与设备指派</h2><span className="muted">支持新增、编辑、删除和设备指派</span></div><button className="primary-action" onClick={() => openCreate('task')}>＋ 新建任务</button></div><div className="table task-table"><div className="tr th"><span>任务</span><span>箱号</span><span>路径</span><span>优先级</span><span>状态</span><span>设备 / 操作</span></div>{tasks.map(task => <div className="tr" key={task.id}><span><b>{task.id}</b><small>{task.kind} · {task.estimatedMinutes}min</small></span><span>{task.containerId}</span><span>{task.from} → {task.to}</span><span className={task.score>95?'critical':''}>{task.score}</span><span><span className={`pill ${task.status}`}>{task.status}</span>{task.blockingReasons.length>0&&<small className="blocked-text">{task.blockingReasons[0]}</small>}</span><span className="task-actions"><select value={task.equipmentId??''} onChange={event => void assign(task.id, event.target.value)}><option value="">未指派</option>{equipment.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={() => openEdit('task', task.id, { kind: task.kind, containerId: task.containerId, from: task.from, to: task.to, equipmentId: task.equipmentId ?? '', priority: String(task.priority), estimatedMinutes: String(task.estimatedMinutes), scheduledAt: toLocalInput(task.scheduledAt), status: task.status })}>编辑</button><button className="danger-action" onClick={() => void remove('task', task.id)}>删除</button></span></div>)}</div></section><section className="panel"><div className="panel-head"><h3>设备池</h3><span>{equipment.length} assets</span></div>{equipment.map(item => <div className="equipment" key={item.id}><i className={`equip-dot ${item.status}`}/><div><b>{item.name}</b><small>{item.location} · 队列 {item.queue}</small></div><strong>{item.battery}%</strong></div>)}</section></div>}
    <footer>HarborGrid · 内存种子数据 + REST API · 箱务台账、闸口预约、场内任务提供完整增删改查操作</footer>
    {editor && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditor(undefined); }}><form className="editor-modal" onSubmit={saveEditor}><div className="modal-head"><div><div className="eyebrow">{editor.mode.toUpperCase()} / {editor.entity.toUpperCase()}</div><h2>{editor.mode==='create'?'创建':'编辑'}{editor.entity==='container'?'箱务记录':editor.entity==='appointment'?'闸口预约':'作业任务'}</h2></div><button type="button" className="icon-button" onClick={() => setEditor(undefined)}>×</button></div>
      {editor.entity === 'container' && <div className="form-grid">
        <label>集装箱号<input required disabled={editor.mode==='edit'} value={String(editor.values.id)} onChange={event => updateField('id', event.target.value.toUpperCase())}/></label>
        <label>关联航次<select value={String(editor.values.voyageId)} onChange={event => updateField('voyageId', event.target.value)}>{voyages.filter(voyage => voyage.status!=='departed').map(voyage => <option key={voyage.id} value={voyage.id}>{voyage.id} · {voyage.vessel}</option>)}</select></label>
        <label>尺寸<select value={String(editor.values.size)} onChange={event => updateField('size', event.target.value)}><option value="20">20 ft</option><option value="40">40 ft</option><option value="45">45 ft</option></select></label>
        <label>ISO 箱型<input required value={String(editor.values.isoType)} onChange={event => updateField('isoType', event.target.value)}/></label>
        <label>作业流向<select value={String(editor.values.direction)} onChange={event => updateField('direction', event.target.value)}><option value="import">进口</option><option value="export">出口</option><option value="transshipment">中转</option></select></label>
        <label>箱状态<select value={String(editor.values.status)} onChange={event => updateField('status', event.target.value)}>{['in-transit','at-gate','in-yard','on-quay','released','hold'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>重量 (吨)<input type="number" min="0.1" step="0.1" required value={String(editor.values.weightT)} onChange={event => updateField('weightT', event.target.value)}/></label>
        <label>海关状态<select value={String(editor.values.customs)} onChange={event => updateField('customs', event.target.value)}><option value="released">已放行</option><option value="inspection">查验中</option><option value="hold">扣留</option></select></label>
        <label>优先级<select value={String(editor.values.priority)} onChange={event => updateField('priority', event.target.value)}><option value="normal">普通</option><option value="hot">急箱</option><option value="reefer">冷藏</option><option value="hazmat">危险品</option></select></label>
        <label>堆位<input required placeholder="例如 B07-R03-T2" value={String(editor.values.yardSlot)} onChange={event => updateField('yardSlot', event.target.value.toUpperCase())}/></label>
        <label>危险品类别<input placeholder="非危险品留空" value={String(editor.values.hazmatClass)} onChange={event => updateField('hazmatClass', event.target.value)}/></label>
        <label className="check-label"><input type="checkbox" checked={Boolean(editor.values.reefer)} onChange={event => updateField('reefer', event.target.checked)}/>冷藏箱</label>
        {Boolean(editor.values.reefer) && <label>目标温度 (°C)<input type="number" step="0.1" value={String(editor.values.temperature)} onChange={event => updateField('temperature', event.target.value)}/></label>}
      </div>}
      {editor.entity === 'appointment' && <div className="form-grid">
        <label>集装箱<select required value={String(editor.values.containerId)} onChange={event => updateField('containerId', event.target.value)}><option value="">选择箱号</option>{containers.map(container => <option key={container.id} value={container.id}>{container.id} · {container.status}</option>)}</select></label>
        <label>预约类型<select value={String(editor.values.type)} onChange={event => updateField('type', event.target.value)}><option value="pickup">提箱</option><option value="dropoff">进场</option></select></label>
        <label>车牌号<input required value={String(editor.values.truckNo)} onChange={event => updateField('truckNo', event.target.value)}/></label><label>司机<input required value={String(editor.values.driver)} onChange={event => updateField('driver', event.target.value)}/></label>
        <label>窗口开始<input type="datetime-local" required value={String(editor.values.windowStart)} onChange={event => updateField('windowStart', event.target.value)}/></label><label>窗口结束<input type="datetime-local" required value={String(editor.values.windowEnd)} onChange={event => updateField('windowEnd', event.target.value)}/></label>
        <label>闸口车道<select value={String(editor.values.lane)} onChange={event => updateField('lane', event.target.value)}><option value="north">北闸口</option><option value="south">南闸口</option><option value="rail">铁路闸口</option></select></label>
      </div>}
      {editor.entity === 'task' && <div className="form-grid">
        <label>任务类型<select value={String(editor.values.kind)} onChange={event => updateField('kind', event.target.value)}>{['receive','deliver','rehandle','load','discharge','inspect'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>关联箱号<select required value={String(editor.values.containerId)} onChange={event => updateField('containerId', event.target.value)}><option value="">选择箱号</option>{containers.map(container => <option key={container.id} value={container.id}>{container.id}</option>)}</select></label>
        <label>起点<input required value={String(editor.values.from)} onChange={event => updateField('from', event.target.value)}/></label><label>终点<input required value={String(editor.values.to)} onChange={event => updateField('to', event.target.value)}/></label>
        <label>优先级 (1–100)<input type="number" min="1" max="100" required value={String(editor.values.priority)} onChange={event => updateField('priority', event.target.value)}/></label><label>预计时长 (分钟)<input type="number" min="1" required value={String(editor.values.estimatedMinutes)} onChange={event => updateField('estimatedMinutes', event.target.value)}/></label>
        <label>计划时间<input type="datetime-local" required value={String(editor.values.scheduledAt)} onChange={event => updateField('scheduledAt', event.target.value)}/></label><label>指派设备<select value={String(editor.values.equipmentId)} onChange={event => updateField('equipmentId', event.target.value)}><option value="">暂不指派</option>{equipment.map(item => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></label>
        {editor.mode==='edit' && <label>任务状态<select value={String(editor.values.status)} onChange={event => updateField('status', event.target.value)}>{['queued','assigned','executing','blocked','done'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
      </div>}
      {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" onClick={() => setEditor(undefined)}>取消</button><button className="primary-action" disabled={busy}>{busy?'保存中…':'保存'}</button></div>
    </form></div>}
    {adjust && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeAdjust(); }}>
      <div className="editor-modal adjust-modal">
        <div className="modal-head"><div><div className="eyebrow">CONFLICT RESOLUTION / 快速处置</div><h2>调整预约 {adjust.conflict.appointmentId}</h2></div><button type="button" className="icon-button" onClick={closeAdjust}>×</button></div>
        <div className="adjust-parties">
          <div><small>调整对象</small>{adjust.preview ? <AppointmentChip party={adjust.preview.target} container={containers.find(c => c.id === adjust.preview!.target.containerId)} target adjusted/> : <AppointmentChip party={adjust.conflict.primary} target/>}</div>
          {adjust.conflict.other && <div><small>受影响的另一条预约（不会被修改，仅随新窗口重新检测）</small><AppointmentChip party={adjust.preview?.affected ?? adjust.conflict.other} container={containers.find(c => c.id === (adjust.preview?.affected ?? adjust.conflict.other!)!.containerId)}/></div>}
          {adjust.preview?.targetContainer && adjust.preview.targetContainer.customs !== 'released' && <div className="customs-inline">箱 {adjust.preview.targetContainer.id} {adjust.preview.targetContainer.customsLabel}</div>}
        </div>
        <div className="form-grid">
          <label>窗口开始<input type="datetime-local" required value={adjust.windowStart} onChange={event => changeAdjustField({ windowStart: event.target.value })}/></label>
          <label>窗口结束<input type="datetime-local" required value={adjust.windowEnd} onChange={event => changeAdjustField({ windowEnd: event.target.value })}/></label>
          <label>车道<select value={adjust.lane} disabled={adjust.conflict.kind === 'truck-overlap'} onChange={event => changeAdjustField({ lane: event.target.value as AdjustState['lane'] })}>{(['north','south','rail'] as const).map(lane => <option key={lane} value={lane}>{laneNames[lane]}</option>)}</select>
            {adjust.conflict.kind === 'truck-overlap' && <small className="field-hint">同一车辆的时间重叠与车道无关，只能错开时隙</small>}
          </label>
          <div className="shift-buttons"><small>快速前后平移窗口</small><span>{[-60,-30,30,60].map(minutes => <button type="button" key={minutes} className="ghost-action" onClick={() => shiftWindow(minutes)}>{minutes > 0 ? `后移 ${minutes} 分` : `前移 ${-minutes} 分`}</button>)}</span></div>
        </div>
        <div className="adjust-preview">
          <div className="preview-head"><small>保存前冲突预演（实时重算）</small>
            {adjust.loading ? <span className="preview-state loading">正在重算…</span>
              : adjust.preview?.customsBlocked ? <span className="preview-state blocked">海关未放行：改时隙不可行</span>
              : adjust.preview?.resolvesConflict ? <span className="preview-state ok">可解除该冲突，且不引入新冲突</span>
              : <span className="preview-state warn">冲突仍存在或会引入新冲突</span>}
          </div>
          {adjust.preview && <div className="preview-body">
            <div className="preview-stat"><b>{adjust.preview.beforeConflicts.filter(c => c.appointmentId === adjust.conflict.appointmentId || c.otherAppointmentId === adjust.conflict.appointmentId).length}</b><small>该预约当前冲突</small></div>
            <div className="preview-stat"><b>{adjust.preview.remainingConflictIds.length}</b><small>调整后仍残留</small></div>
            <div className="preview-stat"><b>{adjust.preview.newConflicts.length}</b><small>新引入冲突</small></div>
          </div>}
          {adjust.preview?.newConflicts.map(item => <div className="preview-new" key={item.id}>⚠ 新冲突：{item.reason}</div>)}
          {adjust.preview && <ul className="preview-notes">{adjust.preview.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
        </div>
        {adjust.error && <div className="form-error">{adjust.error}</div>}
        <div className="modal-actions"><button type="button" onClick={closeAdjust}>取消</button>
          <button type="button" className="primary-action" disabled={adjust.saving || adjust.loading || !adjust.preview || !adjust.preview.resolvesConflict} title={adjust.preview && !adjust.preview.resolvesConflict ? '当前方案不能解除冲突，请继续调整窗口' : ''} onClick={() => void saveConflictAdjust()}>{adjust.saving ? '保存中…' : '保存调整并解除冲突'}</button>
        </div>
        {!adjust.preview?.resolvesConflict && !adjust.loading && !adjust.preview?.customsBlocked && <div className="adjust-hint">提示：保存按钮在方案确认能解除冲突后才会启用；可直接微调时间或使用前后平移按钮。</div>}
      </div>
    </div>}
  </main>;
}
