import { useCallback, useEffect, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import type { Equipment, Reading, SyncMode } from '../domain/types';
import { findEquipment, findReadings, saveEquipmentState, updateMaxTemp } from '../data/localDb';
import { simulateCycle, syncReference } from '../data/plantRepository';

const MIN_THRESHOLD = 0;
const MAX_THRESHOLD = 150;

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback}: ${error.message}`;
  return fallback;
}

export function usePlantViewModel() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('Cargando equipos locales…');
  const [mode, setMode] = useState<SyncMode>('inicial');
  const [humidity, setHumidity] = useState<number | null>(null);
  const [vibration, setVibration] = useState<number | null>(null);

  const [thresholdTarget, setThresholdTarget] = useState<Equipment | null>(null);
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  const [historyTarget, setHistoryTarget] = useState<Equipment | null>(null);
  const [historyRows, setHistoryRows] = useState<Reading[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const reload = useCallback(async (text: string) => {
    const rows = await findEquipment(text);
    setItems(rows);
  }, []);

  useEffect(() => {
    let alive = true;
    findEquipment('')
      .then((rows) => {
        if (alive) {
          setItems(rows);
          setNotice('Equipos locales listos.');
        }
      })
      .catch((error: unknown) => {
        if (alive) setNotice(describeError(error, 'No se pudieron cargar equipos'));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let subscription: { remove(): void } | undefined;
    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (available && active) {
          Accelerometer.setUpdateInterval(1000);
          subscription = Accelerometer.addListener(({ x, y, z }) => {
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            setVibration(Math.round(Math.abs(magnitude - 1) * 100) / 100);
          });
        }
      })
      .catch(() => setVibration(null));
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  const search = async (text: string) => {
    setFilter(text);
    try {
      await reload(text);
      setNotice('Listado actualizado.');
    } catch (error) {
      setNotice(describeError(error, 'Error al filtrar'));
    }
  };

  const changeEnabled = async (id: string, enabled: boolean) => {
    setItems((current) => current.map((item) =>
      item.id === id ? { ...item, enabled: enabled ? 1 : 0 } : item
    ));
    try {
      await saveEquipmentState(id, enabled);
      setNotice(`Comando local aplicado a ${id}.`);
    } catch (error) {
      setNotice(describeError(error, 'Error al guardar el estado'));
    }
  };

  const simulate = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const all = await findEquipment('');
      await simulateCycle(all);
      await reload(filter);
      setMode('simulado');
      setNotice('Lecturas simuladas registradas en SQLite.');
    } catch (error) {
      setNotice(describeError(error, 'No se pudo simular'));
    } finally {
      setLoading(false);
    }
  };

  const sync = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const all = await findEquipment('');
      await simulateCycle(all);
      const result = await syncReference();
      setHumidity(result.humidity);
      setMode('sincronizado');
      setNotice('Referencia ambiental recibida por HTTP y guardada.');
    } catch {
      setMode('simulado');
      setNotice('Sin conexión externa. Se registraron lecturas simuladas.');
    } finally {
      try {
        await reload(filter);
      } catch (error) {
        setNotice(describeError(error, 'No se pudo actualizar la vista'));
      }
      setLoading(false);
    }
  };

  const openThreshold = (equipment: Equipment) => {
    setThresholdError(null);
    setThresholdTarget(equipment);
  };

  const closeThreshold = () => {
    setThresholdTarget(null);
    setThresholdError(null);
  };

  const saveThreshold = async (rawValue: string) => {
    if (!thresholdTarget) return;
    const normalized = rawValue.trim().replace(',', '.');
    const value = Number(normalized);
    if (!normalized || Number.isNaN(value) || value <= MIN_THRESHOLD || value > MAX_THRESHOLD) {
      setThresholdError(`Ingresá un número mayor que ${MIN_THRESHOLD} y menor o igual a ${MAX_THRESHOLD}.`);
      return;
    }
    try {
      await updateMaxTemp(thresholdTarget.id, value);
      await reload(filter);
      setNotice(`Límite de ${thresholdTarget.id} actualizado a ${value.toFixed(1)} °C.`);
      closeThreshold();
    } catch (error) {
      setThresholdError(describeError(error, 'No se pudo guardar el nuevo límite'));
    }
  };

  const openHistory = async (equipment: Equipment) => {
    setHistoryTarget(equipment);
    setHistoryLoading(true);
    try {
      const rows = await findReadings(equipment.id, 10);
      setHistoryRows(rows);
    } catch (error) {
      setNotice(describeError(error, 'No se pudo cargar el historial'));
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryTarget(null);
    setHistoryRows([]);
  };

  return {
    items, filter, loading, notice, mode, humidity, vibration,
    search, changeEnabled, simulate, sync,
    thresholdTarget, thresholdError, openThreshold, closeThreshold, saveThreshold,
    historyTarget, historyRows, historyLoading, openHistory, closeHistory,
  };
}
