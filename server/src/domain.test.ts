import test from 'node:test'; import assert from 'node:assert/strict'; import { containerPlan, dashboard, gateConflicts, gateConflictsList, previewGateConflictResolution, resolveGateConflict, GateConflictError, prioritizeTasks } from './domain.js';
test('dashboard aggregates berth, yard, gate and exception signals', () => { const data = dashboard(); assert.equal(data.activeVoyages, 2); assert.ok(data.yardUtilization > 0.7); assert.ok(data.blockedTasks >= 1); });
test('gate conflict engine detects same truck overlap', () => { const conflicts = gateConflicts(); assert.ok(conflicts.some(item => item.appointmentId === 'APT-9001' || item.appointmentId === 'APT-9004')); });
test('structured conflict engine distinguishes truck overlap, lane contention and customs pickup hold', () => {
  const conflicts = gateConflictsList();
  const truck = conflicts.find(item => item.kind === 'truck-overlap' && item.parties.some(p => p.appointmentId === 'APT-9004'));
  assert.ok(truck, 'APT-9001/9004 同车重叠应被识别为 truck-overlap');
  assert.equal(truck!.availableActions.some(a => a.kind === 'switch-lane'), false);
  assert.equal(truck!.availableActions.some(a => a.appointmentId === 'APT-9004' && a.kind === 'move-window'), true);
  assert.equal(truck!.availableActions.some(a => a.appointmentId === 'APT-9001'), false, '已签到预约不允许快捷改窗口');
  const customs = conflicts.find(item => item.kind === 'customs-pickup-hold' && item.parties.some(p => p.appointmentId === 'APT-9005'));
  assert.ok(customs, 'APT-9005 海关查验中提箱应单列 customs-pickup-hold');
  assert.equal(customs!.resolvableByDispatch, false);
  assert.deepEqual(customs!.availableActions, []);
  const lane = conflicts.find(item => item.kind === 'lane-contention' && item.parties.some(p => p.appointmentId === 'APT-9003') && item.parties.some(p => p.appointmentId === 'APT-9005'));
  assert.ok(lane, 'APT-9003/9005 同车道重叠应识别为 lane-contention');
  assert.equal(lane!.availableActions.some(a => a.appointmentId === 'APT-9005'), false, '海关未放行预约不提供看似可行的改车道/窗口操作');
  assert.ok(lane!.availableActions.some(a => a.appointmentId === 'APT-9003' && a.kind === 'switch-lane'));
});
test('conflict preview blocks customs-held pickup reschedule and previews affected counterparty', () => {
  assert.throws(() => previewGateConflictResolution('APT-9005', { lane: 'south' }), (error: unknown) => error instanceof GateConflictError && error.code === 'CUSTOMS_BLOCKED');
  const preview = previewGateConflictResolution('APT-9004', { windowStart: new Date(Date.now() + 4 * 3600000).toISOString(), windowEnd: new Date(Date.now() + 4 * 3600000 + 18 * 60000).toISOString() }, gateConflictsList().find(c => c.kind === 'truck-overlap' && c.parties.some(p => p.appointmentId === 'APT-9004'))!.id);
  assert.ok(preview.resolvedConflictIds.length >= 1, '后移窗口应化解同车重叠');
  assert.ok(preview.affectedParties.some(p => p.appointmentId === 'APT-9001'), '预检结果应展示受影响的另一条预约 APT-9001');
});
test('conflict resolve rejects stale conflicts and saves valid adjustment', () => {
  assert.throws(() => resolveGateConflict('APT-9004', { lane: 'rail' }, 'truck-overlap:APT-9004|APT-000000'), (error: unknown) => error instanceof GateConflictError && error.code === 'CONFLICT_STALE', '已不存在的冲突应被拒绝并带回最新数据');
  const target = gateConflictsList().find(c => c.kind === 'lane-contention' && c.parties.some(p => p.appointmentId === 'APT-9003') && c.parties.some(p => p.appointmentId === 'APT-9002'));
  assert.ok(target);
  const result = resolveGateConflict('APT-9003', { lane: 'south' }, target!.id);
  assert.equal(result.appointment.lane, 'south');
  assert.ok(!gateConflictsList().some(c => c.id === target!.id), '保存后该冲突应消失');
  resolveGateConflict('APT-9003', { lane: 'north' });
});
test('yard planner respects reefer and hazmat constraints', () => { const plan = containerPlan('TGHU-9831204'); assert.equal(plan?.recommendedBlock?.hazmatAllowed, true); assert.ok(plan?.reasons.some(reason => reason.includes('危险品'))); });
test('priority queue promotes customs inspection work', () => { const tasks = prioritizeTasks(); assert.equal(tasks[0].containerId, 'TGHU-9831204'); });

test('container create, update and delete form a complete audited CRUD cycle', async () => {
  const { createContainer, updateContainer, deleteContainer, containers } = await import('./domain.js');
  const created = createContainer({ id: 'TEST-CRUD-0001', voyageId: 'VOY-AX7', size: '20', isoType: '22G1', direction: 'import', status: 'in-yard', weightT: 10, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R11-T1' });
  assert.equal(created.id, 'TEST-CRUD-0001');
  assert.equal(updateContainer(created.id, { weightT: 12 })?.weightT, 12);
  assert.equal(deleteContainer(created.id)?.id, 'TEST-CRUD-0001');
  assert.equal(containers.some(item => item.id === 'TEST-CRUD-0001'), false);
});

test('appointment and task domain operations support create, update and delete', async () => {
  const { createGateAppointment, editGateAppointment, deleteGateAppointment, createYardTask, updateYardTask, deleteYardTask } = await import('./domain.js');
  const appointment = createGateAppointment({ containerId: 'MSCU-4829017', truckNo: 'TEST-CRUD-01', driver: '测试司机', type: 'pickup', windowStart: new Date(Date.now()+3600000).toISOString(), windowEnd: new Date(Date.now()+7200000).toISOString(), lane: 'north' });
  assert.equal(editGateAppointment(appointment.id, { driver: '更新司机' })?.driver, '更新司机');
  assert.equal(deleteGateAppointment(appointment.id)?.id, appointment.id);
  const task = createYardTask({ kind: 'deliver', containerId: 'MSCU-4829017', from: 'A01-R01-T1', to: '南闸口', priority: 40, scheduledAt: new Date().toISOString(), estimatedMinutes: 12 });
  assert.equal(updateYardTask(task.id, { to: '北闸口' })?.to, '北闸口');
  assert.equal(deleteYardTask(task.id)?.id, task.id);
});
