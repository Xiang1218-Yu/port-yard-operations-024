export type ContainerStatus = 'in-transit' | 'at-gate' | 'in-yard' | 'on-quay' | 'released' | 'hold';
export type EquipmentKind = 'quay-crane' | 'yard-crane' | 'terminal-truck' | 'reach-stacker';
export type TaskStatus = 'queued' | 'assigned' | 'executing' | 'blocked' | 'done';
export type AppointmentStatus = 'booked' | 'checked-in' | 'completed' | 'cancelled' | 'exception';

export interface Voyage { id: string; vessel: string; imo: string; service: string; eta: string; etd: string; status: 'approaching' | 'berthed' | 'loading' | 'departed'; berth: string; movesPlanned: number; movesDone: number; lateRisk: 'low' | 'medium' | 'high'; }
export interface Container { id: string; voyageId: string; size: '20' | '40' | '45'; isoType: string; direction: 'import' | 'export' | 'transshipment'; status: ContainerStatus; weightT: number; reefer: boolean; temperature?: number; hazmatClass?: string; customs: 'released' | 'inspection' | 'hold'; priority: 'normal' | 'hot' | 'reefer' | 'hazmat'; yardSlot: string; appointmentId?: string; lastEvent: string; }
export interface YardBlock { id: string; zone: string; rows: number; tiers: number; capacity: number; occupied: number; reeferPlugs: number; usedPlugs: number; hazmatAllowed: boolean; equipment: EquipmentKind[]; heat: number; }
export interface GateAppointment { id: string; containerId: string; truckNo: string; driver: string; type: 'pickup' | 'dropoff'; windowStart: string; windowEnd: string; lane: 'north' | 'south' | 'rail'; status: AppointmentStatus; sealVerified: boolean; weightVerified: boolean; exception?: string; }
export interface Equipment { id: string; name: string; kind: EquipmentKind; status: 'available' | 'working' | 'maintenance' | 'offline'; location: string; battery: number; queue: number; movesPerHour: number; }
export interface YardTask { id: string; kind: 'receive' | 'deliver' | 'rehandle' | 'load' | 'discharge' | 'inspect'; containerId: string; from: string; to: string; equipmentId?: string; priority: number; status: TaskStatus; scheduledAt: string; blockingReasons: string[]; estimatedMinutes: number; }
export interface AuditEvent { id: string; actor: string; action: string; entity: string; entityId: string; at: string; details: string; }

const start = Date.now(); const iso = (minutes: number) => new Date(start + minutes * 60000).toISOString();
export const voyages: Voyage[] = [
  { id: 'VOY-AX7', vessel: 'MSC Aurora', imo: 'IMO9382014', service: 'AE-3', eta: iso(-90), etd: iso(350), status: 'berthed', berth: 'B07', movesPlanned: 1240, movesDone: 886, lateRisk: 'medium' },
  { id: 'VOY-QF2', vessel: 'Ever Quartz', imo: 'IMO9721103', service: 'TP9', eta: iso(190), etd: iso(890), status: 'approaching', berth: 'B04', movesPlanned: 760, movesDone: 0, lateRisk: 'high' },
  { id: 'VOY-RD8', vessel: 'ONE Redwood', imo: 'IMO9812340', service: 'PNW', eta: iso(-700), etd: iso(-330), status: 'departed', berth: 'B02', movesPlanned: 520, movesDone: 520, lateRisk: 'low' }
];
export const blocks: YardBlock[] = [
  { id: 'A01', zone: 'North Import', rows: 14, tiers: 5, capacity: 280, occupied: 247, reeferPlugs: 18, usedPlugs: 16, hazmatAllowed: false, equipment: ['yard-crane', 'terminal-truck'], heat: 78 },
  { id: 'B07', zone: 'Central Transshipment', rows: 18, tiers: 5, capacity: 360, occupied: 302, reeferPlugs: 24, usedPlugs: 19, hazmatAllowed: true, equipment: ['yard-crane', 'reach-stacker', 'terminal-truck'], heat: 91 },
  { id: 'C03', zone: 'Export Pre-staging', rows: 12, tiers: 4, capacity: 192, occupied: 128, reeferPlugs: 8, usedPlugs: 3, hazmatAllowed: false, equipment: ['yard-crane', 'terminal-truck'], heat: 54 },
  { id: 'D05', zone: 'Inspection & Hold', rows: 8, tiers: 3, capacity: 96, occupied: 72, reeferPlugs: 5, usedPlugs: 4, hazmatAllowed: true, equipment: ['reach-stacker'], heat: 63 }
];
export const containers: Container[] = [
  { id: 'MSCU-4829017', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'import', status: 'in-yard', weightT: 22.4, reefer: false, customs: 'released', priority: 'hot', yardSlot: 'A01-R07-T3', lastEvent: '卸船完成 08:42' },
  { id: 'EISU-1288420', voyageId: 'VOY-AX7', size: '40', isoType: '45R1', direction: 'import', status: 'in-yard', weightT: 27.8, reefer: true, temperature: -18, customs: 'released', priority: 'reefer', yardSlot: 'B07-R03-T2', lastEvent: '温度回传正常 08:51' },
  { id: 'TGHU-9831204', voyageId: 'VOY-AX7', size: '20', isoType: '22K2', direction: 'transshipment', status: 'hold', weightT: 19.7, reefer: false, hazmatClass: '3', customs: 'inspection', priority: 'hazmat', yardSlot: 'D05-R02-T1', lastEvent: '海关查验挂起' },
  { id: 'OOLU-7734201', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'export', status: 'at-gate', weightT: 24.1, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R06-T1', appointmentId: 'APT-9001', lastEvent: '南闸口已称重' },
  { id: 'CMAU-6001722', voyageId: 'VOY-QF2', size: '40', isoType: '45G1', direction: 'import', status: 'in-transit', weightT: 23.5, reefer: false, customs: 'released', priority: 'hot', yardSlot: 'B07-R10-T1', lastEvent: '船期 ETA +35min' },
  { id: 'FCIU-9920310', voyageId: 'VOY-QF2', size: '20', isoType: '22G1', direction: 'export', status: 'in-yard', weightT: 12.2, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R04-T2', lastEvent: '待装船' },
  { id: 'TEMU-1774029', voyageId: 'VOY-AX7', size: '40', isoType: '45R1', direction: 'import', status: 'in-yard', weightT: 26.3, reefer: true, temperature: 4, customs: 'inspection', priority: 'reefer', yardSlot: 'D05-R05-T1', appointmentId: 'APT-9005', lastEvent: '待海关查验' }
];
export const appointments: GateAppointment[] = [
  { id: 'APT-9001', containerId: 'OOLU-7734201', truckNo: '沪A·7K229', driver: '陈海', type: 'dropoff', windowStart: iso(-14), windowEnd: iso(16), lane: 'south', status: 'checked-in', sealVerified: true, weightVerified: true },
  { id: 'APT-9002', containerId: 'MSCU-4829017', truckNo: '苏E·66218', driver: '王建国', type: 'pickup', windowStart: iso(34), windowEnd: iso(64), lane: 'north', status: 'booked', sealVerified: false, weightVerified: false },
  { id: 'APT-9003', containerId: 'EISU-1288420', truckNo: '沪B·02891', driver: '赵晨', type: 'pickup', windowStart: iso(38), windowEnd: iso(68), lane: 'north', status: 'booked', sealVerified: false, weightVerified: false },
  { id: 'APT-9004', containerId: 'FCIU-9920310', truckNo: '沪A·7K229', driver: '陈海', type: 'pickup', windowStart: iso(4), windowEnd: iso(22), lane: 'south', status: 'booked', sealVerified: false, weightVerified: false, exception: '同一车辆相邻窗口过短' },
  { id: 'APT-9005', containerId: 'TEMU-1774029', truckNo: '沪D·90312', driver: '孙磊', type: 'pickup', windowStart: iso(52), windowEnd: iso(80), lane: 'north', status: 'booked', sealVerified: false, weightVerified: false, exception: '提箱海关未放行' }
];
export const equipment: Equipment[] = [
  { id: 'QC-07', name: '岸桥 QC-07', kind: 'quay-crane', status: 'working', location: 'B07 / MSC Aurora', battery: 96, queue: 4, movesPerHour: 31 },
  { id: 'YC-12', name: '场桥 YC-12', kind: 'yard-crane', status: 'working', location: 'B07-R03', battery: 72, queue: 9, movesPerHour: 24 },
  { id: 'YC-05', name: '场桥 YC-05', kind: 'yard-crane', status: 'available', location: 'C03-R06', battery: 88, queue: 3, movesPerHour: 27 },
  { id: 'TT-31', name: '集卡 TT-31', kind: 'terminal-truck', status: 'working', location: '南闸口', battery: 61, queue: 2, movesPerHour: 8 },
  { id: 'RS-02', name: '正面吊 RS-02', kind: 'reach-stacker', status: 'maintenance', location: 'D05', battery: 34, queue: 0, movesPerHour: 14 }
];
export const tasks: YardTask[] = [
  { id: 'TASK-101', kind: 'deliver', containerId: 'MSCU-4829017', from: 'A01-R07-T3', to: '南闸口', equipmentId: 'YC-12', priority: 92, status: 'assigned', scheduledAt: iso(12), blockingReasons: [], estimatedMinutes: 18 },
  { id: 'TASK-102', kind: 'rehandle', containerId: 'EISU-1288420', from: 'B07-R03-T2', to: 'D05-R05-T1', equipmentId: 'YC-12', priority: 88, status: 'queued', scheduledAt: iso(24), blockingReasons: ['查验区插件余量接近阈值'], estimatedMinutes: 26 },
  { id: 'TASK-103', kind: 'inspect', containerId: 'TGHU-9831204', from: 'D05-R02-T1', to: 'D05-R02-T1', priority: 125, status: 'blocked', scheduledAt: iso(4), blockingReasons: ['RS-02 维护中', '待海关查验窗口'], estimatedMinutes: 32 },
  { id: 'TASK-104', kind: 'load', containerId: 'FCIU-9920310', from: 'C03-R04-T2', to: 'B07 / VOY-QF2', equipmentId: 'YC-05', priority: 75, status: 'queued', scheduledAt: iso(76), blockingReasons: [], estimatedMinutes: 21 }
];
export const auditEvents: AuditEvent[] = [{ id: 'AUD-500', actor: '中控调度员', action: 'REPLAN', entity: 'voyage', entityId: 'VOY-AX7', at: new Date(start - 20 * 60000).toISOString(), details: '因 QC-07 瞬时降速，重新计算 14 个高优先级作业' }];

function parseSlot(slot: string) { const match = slot.match(/^([A-Z]\d\d)-/); return match?.[1]; }
export function dashboard() {
  const activeVoyages = voyages.filter(v => v.status !== 'departed');
  const yardCapacity = blocks.reduce((sum, block) => sum + block.capacity, 0); const yardOccupied = blocks.reduce((sum, block) => sum + block.occupied, 0);
  return { activeVoyages: activeVoyages.length, berthMoves: activeVoyages.reduce((sum, v) => sum + v.movesPlanned - v.movesDone, 0), yardUtilization: yardOccupied / yardCapacity, gateQueue: appointments.filter(a => a.status === 'checked-in').length + 7, pendingTasks: tasks.filter(t => t.status !== 'done').length, blockedTasks: tasks.filter(t => t.status === 'blocked').length, reeferAlerts: containers.filter(c => c.reefer && (c.customs === 'inspection' || (c.temperature ?? 0) > 5)).length, hazmatHolds: containers.filter(c => c.hazmatClass && c.customs !== 'released').length, lateVessels: activeVoyages.filter(v => v.lateRisk === 'high').length };
}
export type GateConflictKind = 'truck-overlap' | 'lane-contention' | 'customs-pickup-hold';
export interface GateConflictParty { appointmentId: string; containerId: string; truckNo: string; windowStart: string; windowEnd: string; lane: GateAppointment['lane']; status: AppointmentStatus; customs?: Container['customs']; }
export interface GateConflictAction { kind: 'move-window' | 'switch-lane'; label: string; appointmentId: string; }
export interface GateConflict {
  id: string;
  kind: GateConflictKind;
  severity: 'critical' | 'warning';
  reason: string;
  parties: GateConflictParty[];
  availableActions: GateConflictAction[];
  resolvableByDispatch: boolean;
  suggestion: string;
}

export const laneLabels: Record<GateAppointment['lane'], string> = { north: '北闸口', south: '南闸口', rail: '铁路闸口' };
const laneLanes: GateAppointment['lane'][] = ['north', 'south', 'rail'];

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(bStart).getTime() < new Date(aEnd).getTime();
}

function partyOf(appointment: GateAppointment): GateConflictParty {
  const container = containers.find(item => item.id === appointment.containerId);
  return {
    appointmentId: appointment.id, containerId: appointment.containerId, truckNo: appointment.truckNo,
    windowStart: appointment.windowStart, windowEnd: appointment.windowEnd, lane: appointment.lane,
    status: appointment.status, customs: container?.customs
  };
}

/** 一条未放行提箱预约即使改到任何时隙/车道都不能进场，快捷改时隙对它没有意义。 */
export function isCustomsBlockedPickup(appointment: GateAppointment) {
  const container = containers.find(item => item.id === appointment.containerId);
  return Boolean(container && appointment.type === 'pickup' && container.customs !== 'released');
}

/**
 * 冲突引擎，输出结构化冲突：
 * - truck-overlap：同一车辆两个窗口重叠（critical），只能靠改窗口化解，改车道无效
 * - lane-contention：不同车辆同窗同车道占用（warning），改车道或改窗口都可
 * - customs-pickup-hold：提箱海关未放行（warning），值班员不能用改时隙解决，需等待海关放行/查验
 */
export function gateConflictsList(overrides: GateAppointment[] = appointments as GateAppointment[]): GateConflict[] {
  const list = overrides.filter(item => item.status !== 'cancelled' && item.status !== 'completed');
  const result: GateConflict[] = [];

  for (let index = 0; index < list.length; index += 1) {
    const a = list[index];
    for (const b of list.slice(index + 1)) {
      if (!overlaps(a.windowStart, a.windowEnd, b.windowStart, b.windowEnd)) continue;
      const movable = (item: GateAppointment) => item.status === 'booked' && !isCustomsBlockedPickup(item);
      if (a.truckNo === b.truckNo) {
        const parties = [partyOf(a), partyOf(b)].sort((p, q) => +new Date(p.windowStart) - +new Date(q.windowStart));
        const availableActions: GateConflictAction[] = [];
        for (const item of [a, b]) {
          if (movable(item)) availableActions.push({ kind: 'move-window', label: '调整预约窗口', appointmentId: item.id });
        }
        const blockedNote = isCustomsBlockedPickup(a) || isCustomsBlockedPickup(b) ? '（其中含海关未放行提箱，不可改时隙）' : '';
        result.push({
          id: `truck-overlap:${parties.map(party => party.appointmentId).join('|')}`,
          kind: 'truck-overlap', severity: 'critical',
          reason: `车辆 ${a.truckNo} 的 ${a.id} 与 ${b.id} 窗口重叠，同一车辆无法同时出现在两个闸口${blockedNote}`,
          parties, availableActions,
          resolvableByDispatch: availableActions.length > 0,
          suggestion: '将其中一条 booked 预约前移或后移到无重叠窗口；改车道不能化解同车冲突。'
        });
      } else if (a.lane === b.lane) {
        const parties = [partyOf(a), partyOf(b)].sort((p, q) => +new Date(p.windowStart) - +new Date(q.windowStart));
        const availableActions: GateConflictAction[] = [];
        for (const item of [a, b]) {
          if (!movable(item)) continue;
          availableActions.push({ kind: 'switch-lane', label: '切换空闲车道', appointmentId: item.id });
          availableActions.push({ kind: 'move-window', label: '错峰调整窗口', appointmentId: item.id });
        }
        result.push({
          id: `lane-contention:${parties.map(party => party.appointmentId).join('|')}`,
          kind: 'lane-contention', severity: 'warning',
          reason: `${laneLabels[a.lane]} 在重叠时段同时承载 ${a.id}（${a.truckNo}）与 ${b.id}（${b.truckNo}），存在排队/抢道风险`,
          parties, availableActions,
          resolvableByDispatch: availableActions.length > 0,
          suggestion: `优先把其中一条预约切到其余空闲车道，或将窗口错开到 ${laneLabels[a.lane]} 空闲时段。`
        });
      }
    }
  }

  list.filter(item => item.status === 'booked').forEach(item => {
    const container = containers.find(entry => entry.id === item.containerId);
    if (container && item.type === 'pickup' && container.customs !== 'released') {
      result.push({
        id: `customs-pickup-hold:${item.id}`,
        kind: 'customs-pickup-hold', severity: 'warning',
        reason: `提箱预约 ${item.id}（箱 ${item.containerId}）海关状态为 ${container.customs === 'inspection' ? '查验中' : '扣留'}，未放行前不能提箱；调整时隙或车道都无法解除`,
        parties: [partyOf(item)],
        availableActions: [],
        resolvableByDispatch: false,
        suggestion: container.customs === 'inspection'
          ? '等待海关查验结论并放行；可联系查验区确认窗口，放行前不要给车队改约时间。'
          : '箱已被海关扣留，需先完成处置流程；调度侧仅可定位预约并通知车队暂缓到场。'
      });
    }
  });

  return result;
}

// 旧接口保持兼容：驾驶舱/简单列表只需要严重级别与文案
export function gateConflicts() {
  return gateConflictsList().map(item => ({ severity: item.severity, appointmentId: item.parties[0].appointmentId, reason: item.reason }));
}

export type AppointmentAdjustment = { windowStart?: string; windowEnd?: string; lane?: GateAppointment['lane']; };
export type GateConflictPreview = {
  conflictId: string | null;
  appointment: GateAppointment;
  change: AppointmentAdjustment;
  beforeConflicts: GateConflict[];
  afterConflicts: GateConflict[];
  resolvedConflictIds: string[];
  remainingConflictIds: string[];
  createdConflictIds: string[];
  affectedParties: GateConflictParty[];
  suggestion?: AppointmentAdjustment & { label: string };
  customsBlocked: boolean;
};

export class GateConflictError extends Error {
  code: 'CONFLICT_STALE' | 'APPOINTMENT_CHANGED' | 'CUSTOMS_BLOCKED' | 'INVALID_INPUT' | 'NOT_FOUND';
  fresh?: { conflicts: GateConflict[]; appointment?: GateAppointment };
  constructor(code: GateConflictError['code'], message: string, fresh?: GateConflictError['fresh']) { super(message); this.code = code; this.fresh = fresh; }
}

function validateAdjustment(appointment: GateAppointment | undefined, change: AppointmentAdjustment): asserts appointment {
  if (!appointment) throw new GateConflictError('NOT_FOUND', '预约不存在或已被删除');
  if (appointment.status !== 'booked') {
    throw new GateConflictError('APPOINTMENT_CHANGED', `预约 ${appointment.id} 当前状态为 ${appointment.status}，已不能由冲突卡片直接调整`, { conflicts: gateConflictsList(), appointment });
  }
  if (isCustomsBlockedPickup(appointment)) {
    throw new GateConflictError('CUSTOMS_BLOCKED', `箱 ${appointment.containerId} 海关未放行，改时隙/车道都不能让提箱进场，请等待放行或转查验处理`, { conflicts: gateConflictsList(), appointment });
  }
  const nextStart = change.windowStart ?? appointment.windowStart;
  const nextEnd = change.windowEnd ?? appointment.windowEnd;
  if (new Date(nextEnd) <= new Date(nextStart)) throw new GateConflictError('INVALID_INPUT', '预约结束时间必须晚于开始时间');
  if (change.lane && !laneLanes.includes(change.lane)) throw new GateConflictError('INVALID_INPUT', '车道不合法');
}

function simulate(appointment: GateAppointment, change: AppointmentAdjustment): GateAppointment[] {
  return appointments.map(item => item.id === appointment.id
    ? { ...item, windowStart: change.windowStart ?? item.windowStart, windowEnd: change.windowEnd ?? item.windowEnd, lane: change.lane ?? item.lane }
    : item);
}

function smartSuggestion(conflict: GateConflict | undefined, appointment: GateAppointment, change: AppointmentAdjustment) {
  const duration = new Date(appointment.windowEnd).getTime() - new Date(appointment.windowStart).getTime();
  if (change.windowStart === undefined && change.windowEnd === undefined && change.lane) {
    const other = laneLanes.find(lane => lane !== appointment.lane && !appointments.some(item =>
      item.id !== appointment.id && item.status !== 'cancelled' && item.status !== 'completed'
      && item.lane === lane && overlaps(item.windowStart, item.windowEnd, appointment.windowStart, appointment.windowEnd)));
    return other ? { lane: other, label: `切换到空闲车道：${laneLabels[other]}` } : undefined;
  }
  const targetConflict = conflict ?? gateConflictsList().find(entry => entry.parties.some(party => party.appointmentId === appointment.id) && entry.kind !== 'customs-pickup-hold');
  if (!targetConflict) return undefined;
  const others = appointments.filter(item => item.id !== appointment.id && item.status !== 'cancelled' && item.status !== 'completed'
    && targetConflict.parties.some(party => party.appointmentId === item.id));
  const sorted = others.map(item => [new Date(item.windowStart).getTime(), new Date(item.windowEnd).getTime()] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const pad = 15 * 60000;
  const candidateStarts: number[] = [];
  sorted.forEach(([start, end], index) => {
    if (index === 0) candidateStarts.push(start - pad - duration);
    const nextStart = sorted[index + 1]?.[0];
    if (nextStart === undefined || nextStart - (end + pad) >= duration) candidateStarts.push(end + pad);
  });
  if (!sorted.length) return undefined;
  const baseStart = new Date(appointment.windowStart).getTime();
  const shift = candidateStarts
    .map(start => start - baseStart)
    .filter(value => Math.abs(value) >= 5 * 60000)
    .sort((a, b) => Math.abs(a) - Math.abs(b))[0];
  if (shift === undefined) return undefined;
  const windowStart = new Date(baseStart + shift).toISOString();
  const windowEnd = new Date(baseStart + shift + duration).toISOString();
  return { windowStart, windowEnd, label: `建议窗口 ${new Date(windowStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(windowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}（偏移 ${Math.round(shift / 60000)} 分钟）` };
}

function buildPreview(id: string, change: AppointmentAdjustment, conflictId?: string) {
  const appointment = appointments.find(item => item.id === id);
  validateAdjustment(appointment, change);
  const beforeConflicts = gateConflictsList();
  const conflict = conflictId ? beforeConflicts.find(item => item.id === conflictId) : undefined;
  if (conflictId && !conflict) {
    throw new GateConflictError('CONFLICT_STALE', '该冲突已被其他值班员处理或数据已变化，请按最新冲突列表继续操作', { conflicts: beforeConflicts, appointment });
  }
  const afterConflicts = gateConflictsList(simulate(appointment, change));
  const beforeIds = new Set(beforeConflicts.map(item => item.id));
  const afterIds = new Set(afterConflicts.map(item => item.id));
  const resolvedConflictIds = [...beforeIds].filter(identity => !afterIds.has(identity));
  const createdConflictIds = [...afterIds].filter(identity => !beforeIds.has(identity));
  const remainingConflictIds = [...beforeIds].filter(identity => afterIds.has(identity));
  const touchedIds = new Set([...resolvedConflictIds, ...createdConflictIds]
    .flatMap(identity => (afterConflicts.find(item => item.id === identity) ?? beforeConflicts.find(item => item.id === identity))?.parties.map(party => party.appointmentId) ?? []));
  touchedIds.delete(id);
  const affectedParties = appointments.filter(item => touchedIds.has(item.id)).map(partyOf);
  const suggestion = smartSuggestion(conflict, appointment, change);
  return {
    conflictId: conflictId ?? null, appointment, change, beforeConflicts, afterConflicts,
    resolvedConflictIds, remainingConflictIds, createdConflictIds, affectedParties, suggestion,
    customsBlocked: false
  } satisfies GateConflictPreview;
}

/** 预检：不落库，返回调整后仍存在/新产生/已化解的冲突与受影响的对方预约。 */
export function previewGateConflictResolution(id: string, change: AppointmentAdjustment, conflictId?: string) {
  return buildPreview(id, change, conflictId);
}

/** 保存冲突调整：冲突已被他人处理、预约状态已变或海关未放行时拒绝并带回最新数据。 */
export function resolveGateConflict(id: string, change: AppointmentAdjustment, conflictId?: string) {
  const preview = buildPreview(id, change, conflictId);
  Object.assign(preview.appointment, preview.change);
  recordAudit('RESOLVE_CONFLICT', 'appointment', id, `冲突处置：${conflictId ?? '手动'} 调整 ${JSON.stringify(change)}；化解 ${preview.resolvedConflictIds.length} 项，新增 ${preview.createdConflictIds.length} 项`);
  return { ...preview, appointment: appointments.find(item => item.id === id)!, conflicts: gateConflictsList() };
}
export function yardHeatmap() { return blocks.map(block => ({ ...block, utilization: block.occupied / block.capacity, freeSlots: block.capacity - block.occupied, pressure: block.heat > 85 ? 'critical' : block.heat > 65 ? 'warning' : 'normal' })); }
export function containerPlan(containerId: string) {
  const container = containers.find(c => c.id === containerId); if (!container) return undefined;
  const reasons: string[] = []; const candidates = blocks.filter(block => block.capacity > block.occupied && (!container.hazmatClass || block.hazmatAllowed) && (!container.reefer || block.reeferPlugs > block.usedPlugs));
  if (container.customs !== 'released' && container.status === 'in-yard') reasons.push('海关未放行，必须保持在查验/监管区');
  const ranked = candidates.map(block => ({ block, score: (block.capacity - block.occupied) * 2 - block.heat - (container.reefer && block.reeferPlugs - block.usedPlugs < 3 ? 18 : 0) - (container.hazmatClass && !block.hazmatAllowed ? 100 : 0) })).sort((a, b) => b.score - a.score);
  if (!ranked.length) reasons.push('没有同时满足危险品、冷藏电源与容量约束的区块');
  const selected = ranked[0]?.block; if (container.reefer && selected) reasons.push(`需要占用 ${selected.reeferPlugs - selected.usedPlugs} 个剩余冷插位中的 1 个`);
  if (container.hazmatClass) reasons.push(`危险品 ${container.hazmatClass} 级，只能进入有隔离资质的区块`);
  return { container, recommendedBlock: selected, alternatives: ranked.slice(1, 3).map(item => item.block), reasons };
}
export function prioritizeTasks() { return tasks.map(task => ({ ...task, score: task.priority + (task.blockingReasons.length ? -20 : 10) + (task.kind === 'inspect' ? 12 : 0) })).sort((a, b) => b.score - a.score); }
export function createAppointment(input: Omit<GateAppointment, 'id' | 'status' | 'sealVerified' | 'weightVerified'>) {
  const container = containers.find(item => item.id === input.containerId); if (!container) throw new Error('箱号不存在');
  if (container.customs !== 'released' && input.type === 'pickup') throw new Error('海关未放行，不能预约提箱');
  const item: GateAppointment = { ...input, id: `APT-${Date.now()}`, status: 'booked', sealVerified: false, weightVerified: false }; appointments.unshift(item); container.appointmentId = item.id; return item;
}
export function updateAppointment(id: string, patch: Partial<Pick<GateAppointment, 'status' | 'sealVerified' | 'weightVerified' | 'exception'>>) { const item = appointments.find(a => a.id === id); if (!item) return undefined; Object.assign(item, patch); const container = containers.find(c => c.id === item.containerId); if (item.status === 'checked-in' && container) container.status = 'at-gate'; if (item.status === 'completed' && container) container.status = item.type === 'pickup' ? 'released' : 'in-yard'; auditEvents.unshift({ id: `AUD-${Date.now()}`, actor: '闸口值班员', action: 'GATE_UPDATE', entity: 'appointment', entityId: id, at: new Date().toISOString(), details: JSON.stringify(patch) }); return item; }
export function assignTask(id: string, equipmentId: string) { const task = tasks.find(item => item.id === id); const machine = equipment.find(item => item.id === equipmentId); if (!task || !machine) return undefined; const blockingReasons = [...task.blockingReasons]; if (machine.status === 'maintenance' || machine.status === 'offline') blockingReasons.push(`${machine.name} 当前不可用`); if (task.kind === 'inspect' && machine.kind !== 'reach-stacker') blockingReasons.push('查验作业需要正面吊或专用设备'); task.equipmentId = equipmentId; task.status = blockingReasons.length ? 'blocked' : 'assigned'; task.blockingReasons = blockingReasons; auditEvents.unshift({ id: `AUD-${Date.now()}`, actor: '中控调度员', action: 'ASSIGN_TASK', entity: 'yard-task', entityId: id, at: new Date().toISOString(), details: `${equipmentId} -> ${task.containerId}` }); return task; }
export function containerDetail(id: string) { const container = containers.find(item => item.id === id); if (!container) return undefined; return { container, voyage: voyages.find(v => v.id === container.voyageId), appointment: appointments.find(a => a.id === container.appointmentId), plan: containerPlan(id), tasks: tasks.filter(t => t.containerId === id) }; }

export type ContainerInput = Omit<Container, 'lastEvent' | 'appointmentId'> & { appointmentId?: string };
export type AppointmentInput = Pick<GateAppointment, 'containerId' | 'truckNo' | 'driver' | 'type' | 'windowStart' | 'windowEnd' | 'lane'>;
export type TaskInput = Pick<YardTask, 'kind' | 'containerId' | 'from' | 'to' | 'priority' | 'scheduledAt' | 'estimatedMinutes'> & { equipmentId?: string };

function recordAudit(action: string, entity: string, entityId: string, details: string) {
  auditEvents.unshift({ id: `AUD-${Date.now()}`, actor: '中控调度员', action, entity, entityId, at: new Date().toISOString(), details });
}

export function createContainer(input: ContainerInput) {
  const id = input.id.trim().toUpperCase();
  if (!id) throw new Error('箱号不能为空');
  if (containers.some(item => item.id === id)) throw new Error(`箱号 ${id} 已存在`);
  if (!voyages.some(item => item.id === input.voyageId)) throw new Error('关联航次不存在');
  const blockId = parseSlot(input.yardSlot);
  if (blockId && !blocks.some(block => block.id === blockId)) throw new Error('堆位所属区块不存在');
  if (input.hazmatClass && blockId && !blocks.find(block => block.id === blockId)?.hazmatAllowed) throw new Error('危险品不能进入当前堆场区块');
  if (input.reefer && blockId) {
    const block = blocks.find(item => item.id === blockId);
    if (block && block.reeferPlugs <= block.usedPlugs) throw new Error('当前区块没有可用冷藏插座');
  }
  const item: Container = { ...input, id, lastEvent: `人工建档 ${new Date().toLocaleString()}` };
  containers.unshift(item);
  recordAudit('CREATE', 'container', item.id, '新增集装箱台账记录');
  return item;
}

export function updateContainer(id: string, patch: Partial<Omit<Container, 'id' | 'lastEvent'>>) {
  const item = containers.find(container => container.id === id);
  if (!item) return undefined;
  if (patch.voyageId && !voyages.some(voyage => voyage.id === patch.voyageId)) throw new Error('关联航次不存在');
  const next = { ...item, ...patch };
  const blockId = parseSlot(next.yardSlot);
  if (blockId && !blocks.some(block => block.id === blockId)) throw new Error('堆位所属区块不存在');
  if (next.hazmatClass && blockId && !blocks.find(block => block.id === blockId)?.hazmatAllowed) throw new Error('危险品不能进入当前堆场区块');
  Object.assign(item, patch, { lastEvent: `台账更新 ${new Date().toLocaleString()}` });
  recordAudit('UPDATE', 'container', id, '更新集装箱台账字段');
  return item;
}

export function deleteContainer(id: string) {
  const index = containers.findIndex(item => item.id === id);
  if (index < 0) return undefined;
  const [item] = containers.splice(index, 1);
  const removedAppointments = appointments.filter(appointment => appointment.containerId === id);
  for (const appointment of removedAppointments) appointments.splice(appointments.indexOf(appointment), 1);
  const removedTasks = tasks.filter(task => task.containerId === id);
  for (const task of removedTasks) tasks.splice(tasks.indexOf(task), 1);
  recordAudit('DELETE', 'container', id, `删除箱务记录，并级联清理 ${removedAppointments.length} 条预约、${removedTasks.length} 条未完成任务`);
  return item;
}

export function createGateAppointment(input: AppointmentInput) {
  const container = containers.find(item => item.id === input.containerId);
  if (!container) throw new Error('箱号不存在');
  if (input.type === 'pickup' && container.customs !== 'released') throw new Error('海关未放行，不能预约提箱');
  if (new Date(input.windowEnd) <= new Date(input.windowStart)) throw new Error('预约结束时间必须晚于开始时间');
  const item: GateAppointment = { ...input, id: `APT-${Date.now()}`, status: 'booked', sealVerified: false, weightVerified: false };
  appointments.unshift(item);
  container.appointmentId = item.id;
  recordAudit('CREATE', 'appointment', item.id, `为 ${item.containerId} 创建闸口预约`);
  return item;
}

export function editGateAppointment(id: string, patch: Partial<AppointmentInput & Pick<GateAppointment, 'status' | 'sealVerified' | 'weightVerified' | 'exception'>>) {
  const item = appointments.find(appointment => appointment.id === id);
  if (!item) return undefined;
  if (patch.containerId && !containers.some(container => container.id === patch.containerId)) throw new Error('箱号不存在');
  if (patch.windowStart && patch.windowEnd && new Date(patch.windowEnd) <= new Date(patch.windowStart)) throw new Error('预约结束时间必须晚于开始时间');
  const previousContainer = containers.find(container => container.id === item.containerId);
  Object.assign(item, patch);
  const nextContainer = containers.find(container => container.id === item.containerId);
  if (previousContainer && previousContainer.id !== nextContainer?.id && previousContainer.appointmentId === id) previousContainer.appointmentId = undefined;
  if (nextContainer) nextContainer.appointmentId = id;
  if (item.status === 'checked-in' && nextContainer) nextContainer.status = 'at-gate';
  if (item.status === 'completed' && nextContainer) nextContainer.status = item.type === 'pickup' ? 'released' : 'in-yard';
  recordAudit('UPDATE', 'appointment', id, `更新预约状态/时隙：${JSON.stringify(patch)}`);
  return item;
}

export function deleteGateAppointment(id: string) {
  const index = appointments.findIndex(item => item.id === id);
  if (index < 0) return undefined;
  const [item] = appointments.splice(index, 1);
  const container = containers.find(entry => entry.id === item.containerId);
  if (container?.appointmentId === id) container.appointmentId = undefined;
  recordAudit('DELETE', 'appointment', id, `取消并删除 ${item.containerId} 的闸口预约`);
  return item;
}

export function createYardTask(input: TaskInput) {
  if (!containers.some(container => container.id === input.containerId)) throw new Error('关联箱号不存在');
  if (input.priority < 1 || input.priority > 100) throw new Error('优先级范围为 1–100');
  if (input.estimatedMinutes <= 0) throw new Error('预计作业时长必须大于 0');
  const item: YardTask = { ...input, id: `TASK-${Date.now()}`, status: input.equipmentId ? 'assigned' : 'queued', blockingReasons: [], scheduledAt: input.scheduledAt };
  tasks.unshift(item);
  recordAudit('CREATE', 'yard-task', item.id, `创建 ${input.kind} 任务，关联 ${input.containerId}`);
  return item;
}

export function updateYardTask(id: string, patch: Partial<TaskInput & Pick<YardTask, 'status' | 'blockingReasons'>>) {
  const item = tasks.find(task => task.id === id);
  if (!item) return undefined;
  if (patch.containerId && !containers.some(container => container.id === patch.containerId)) throw new Error('关联箱号不存在');
  if (patch.priority !== undefined && (patch.priority < 1 || patch.priority > 100)) throw new Error('优先级范围为 1–100');
  Object.assign(item, patch);
  recordAudit('UPDATE', 'yard-task', id, `更新场内作业任务：${JSON.stringify(patch)}`);
  return item;
}

export function deleteYardTask(id: string) {
  const index = tasks.findIndex(item => item.id === id);
  if (index < 0) return undefined;
  const [item] = tasks.splice(index, 1);
  recordAudit('DELETE', 'yard-task', id, `删除 ${item.containerId} 的场内任务`);
  return item;
}
