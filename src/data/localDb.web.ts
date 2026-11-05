import type { Equipment, Reading } from '../domain/types';

let equipment: Equipment[] = [
  { id: 'P-101', name: 'Bomba de recirculación', area: 'Línea hidráulica', enabled: 1, temperature: 46.8, maxTemp: 65, updatedAt: new Date().toISOString() },
  { id: 'M-204', name: 'Motor transportador', area: 'Línea de montaje', enabled: 1, temperature: 58.4, maxTemp: 70, updatedAt: new Date().toISOString() },
  { id: 'A-003', name: 'Nodo ambiental', area: 'Área de control', enabled: 1, temperature: 24.3, maxTemp: 36, updatedAt: new Date().toISOString() },
];

let readings: Reading[] = [];
let nextReadingId = 1;

export async function findEquipment(filter: string): Promise<Equipment[]> {
  const text = filter.trim().toLowerCase();
  const rows = text
    ? equipment.filter((e) => e.name.toLowerCase().includes(text) || e.id.toLowerCase().includes(text))
    : equipment;
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

export async function saveEquipmentState(id: string, enabled: boolean): Promise<void> {
  equipment = equipment.map((e) => (e.id === id ? { ...e, enabled: enabled ? 1 : 0 } : e));
}

export async function updateMaxTemp(id: string, maxTemp: number): Promise<void> {
  equipment = equipment.map((e) =>
    e.id === id ? { ...e, maxTemp, updatedAt: new Date().toISOString() } : e
  );
}

export async function findReadings(equipmentId: string, limit = 10): Promise<Reading[]> {
  return readings
    .filter((r) => r.equipmentId === equipmentId)
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

export async function recordReading(id: string, temperature: number, source: string): Promise<void> {
  const stamp = new Date().toISOString();
  equipment = equipment.map((e) => (e.id === id ? { ...e, temperature, updatedAt: stamp } : e));
  readings.push({ id: nextReadingId++, equipmentId: id, temperature, source, createdAt: stamp });
}
