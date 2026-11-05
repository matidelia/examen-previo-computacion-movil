import * as SQLite from 'expo-sqlite';
import type { Equipment, Reading } from '../domain/types';

type EquipmentRow = {
  id: string;
  name: string;
  area: string;
  enabled: number;
  temperature: number;
  max_temp: number;
  updated_at: string;
};

type ReadingRow = {
  id: number;
  equipment_id: string;
  temperature: number;
  source: string;
  created_at: string;
};

let connection: Promise<SQLite.SQLiteDatabase> | null = null;

export function openPlantDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (connection) return connection;
  connection = (async () => {
    const db = await SQLite.openDatabaseAsync('planta_iiot.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS equipment (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        area TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        temperature REAL NOT NULL DEFAULT 0,
        max_temp REAL NOT NULL DEFAULT 60,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id TEXT NOT NULL,
        temperature REAL NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    const initial = [
      ['P-101', 'Bomba de recirculación', 'Línea hidráulica', 1, 46.8, 65],
      ['M-204', 'Motor transportador', 'Línea de montaje', 1, 58.4, 70],
      ['A-003', 'Nodo ambiental', 'Área de control', 1, 24.3, 36],
    ] as const;
    for (const row of initial) {
      await db.runAsync(
        `INSERT OR IGNORE INTO equipment (id, name, area, enabled, temperature, max_temp, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [...row, new Date().toISOString()]
      );
    }
    return db;
  })().catch((error: unknown) => {
    connection = null;
    throw error;
  });
  return connection;
}

function toEquipment(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    enabled: row.enabled,
    temperature: row.temperature,
    maxTemp: row.max_temp,
    updatedAt: row.updated_at,
  };
}

export async function findEquipment(filter: string): Promise<Equipment[]> {
  const db = await openPlantDatabase();
  const text = filter.trim();
  const rows = text
    ? await db.getAllAsync<EquipmentRow>(
        'SELECT * FROM equipment WHERE name LIKE ? OR id LIKE ? ORDER BY id ASC',
        [`%${text}%`, `%${text}%`]
      )
    : await db.getAllAsync<EquipmentRow>('SELECT * FROM equipment ORDER BY id ASC');
  return rows.map(toEquipment);
}

export async function saveEquipmentState(id: string, enabled: boolean): Promise<void> {
  const db = await openPlantDatabase();
  await db.runAsync('UPDATE equipment SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id);
}

export async function updateMaxTemp(id: string, maxTemp: number): Promise<void> {
  const db = await openPlantDatabase();
  await db.runAsync(
    'UPDATE equipment SET max_temp = ?, updated_at = ? WHERE id = ?',
    maxTemp,
    new Date().toISOString(),
    id
  );
}

function toReading(row: ReadingRow): Reading {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    temperature: row.temperature,
    source: row.source,
    createdAt: row.created_at,
  };
}

export async function findReadings(equipmentId: string, limit = 10): Promise<Reading[]> {
  const db = await openPlantDatabase();
  const rows = await db.getAllAsync<ReadingRow>(
    'SELECT * FROM readings WHERE equipment_id = ? ORDER BY id DESC LIMIT ?',
    [equipmentId, limit]
  );
  return rows.map(toReading);
}

export async function recordReading(
  id: string,
  temperature: number,
  source: string
): Promise<void> {
  const db = await openPlantDatabase();
  const stamp = new Date().toISOString();
  await db.runAsync(
    'UPDATE equipment SET temperature = ?, updated_at = ? WHERE id = ?',
    temperature,
    stamp,
    id
  );
  await db.runAsync(
    'INSERT INTO readings (equipment_id, temperature, source, created_at) VALUES (?, ?, ?, ?)',
    id,
    temperature,
    source,
    stamp
  );
}
