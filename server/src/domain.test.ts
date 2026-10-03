import test from 'node:test'; import assert from 'node:assert/strict'; import { containerPlan, dashboard, gateConflicts, previewAppointmentAdjustment, resolveGateConflict, GateAdjustmentError, prioritizeTasks } from './domain.js';
test('dashboard aggregates berth, yard, gate and exception signals', () => { const data = dashboard(); assert.equal(data.activeVoyages, 2); assert.ok(data.yardUtilization > 0.7); assert.ok(data.blockedTasks >= 1); });
test('gate conflict engine separates truck overlap, lane overlap and customs blocks', () => {
  const conflicts = gateConflicts();
  const truck = conflicts.find(item => item.kind === 'truck-overlap');
  assert.ok(truck && truck.severity === 'critical' && truck.otherAppointmentId, '同车重叠应返回双方预约');
  const customs = conflicts.find(item => item.kind === 'customs-blocked' && item.appointmentId === 'APT-9005');
  assert.ok(customs && customs.customs === 'inspection', '海关未放行提箱必须单独标识');
  assert.ok(conflicts.findIndex(item => item.kind === 'truck-overlap') < conflicts.findIndex(item => item.kind === 'customs-blocked'));
});
test('conflict preview shows affected appointment and whether a reslot resolves the conflict', () => {
  const overlap = gateConflicts().find(item => item.kind === 'truck-overlap');
  assert.ok(overlap);
  const targetId = overlap.appointmentId;
  const shifted = new Date(Date.now() + 10 * 60000).toISOString();
  const stillOverlaps = previewAppointmentAdjustment(targetId, { windowStart: shifted, windowEnd: new Date(Date.now() + 40 * 60000).toISOString(), lane: overlap.primary.lane });
  assert.equal(stillOverlaps.affected?.appointmentId, overlap.otherAppointmentId);
  assert.equal(stillOverlaps.resolvesConflict, false);
  const far = new Date(Date.now() + 300 * 60000).toISOString();
  const resolved = previewAppointmentAdjustment(targetId, { windowStart: far, windowEnd: new Date(Date.now() + 330 * 60000).toISOString(), lane: overlap.primary.lane });
  assert.equal(resolved.resolvesConflict, true);
  assert.equal(resolved.remainingConflictIds.length, 0);
});
test('customs blocked pickup cannot be cleared by slot or lane changes', () => {
  const preview = previewAppointmentAdjustment('APT-9005', { lane: 'north', windowStart: new Date(Date.now() + 300 * 60000).toISOString(), windowEnd: new Date(Date.now() + 330 * 60000).toISOString() });
  assert.equal(preview.customsBlocked, true);
  assert.equal(preview.resolvesConflict, false);
  assert.throws(() => resolveGateConflict('APT-9005', 'customs-blocked:APT-9005', { lane: 'north' }), (error: unknown) => error instanceof GateAdjustmentError && error.code === 'customs-hold');
});
test('saving an already handled conflict is rejected with conflict-changed', () => {
  const overlap = gateConflicts().find(item => item.kind === 'truck-overlap');
  assert.ok(overlap);
  assert.throws(
    () => resolveGateConflict(overlap.appointmentId, 'truck-overlap:APT-0000|APT-9999', {}),
    (error: unknown) => error instanceof GateAdjustmentError && error.code === 'conflict-changed'
  );
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
