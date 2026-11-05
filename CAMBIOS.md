# Cambios y validación

## Funcionalidad 1 — Umbral

- Cambios realizados:
  - `src/data/localDb.ts`: nueva función `updateMaxTemp(id, maxTemp)` que hace
    `UPDATE equipment SET max_temp = ?, updated_at = ? WHERE id = ?` (persiste en SQLite).
  - `src/viewmodel/usePlantViewModel.ts`: estado `thresholdTarget`/`thresholdError` y
    funciones `openThreshold`, `closeThreshold`, `saveThreshold`. `saveThreshold` valida
    que el valor sea un número real, mayor que 0 y menor o igual a 150 (normalizando
    coma decimal); si no cumple, no guarda y deja un mensaje de error visible en el
    diálogo. Si es válido, llama a `updateMaxTemp`, recarga los equipos (`reload`) y
    muestra un aviso de confirmación.
  - `src/views/PlantScreen.tsx`: el botón "Umbral" ahora abre un `Modal` (`ThresholdModal`)
    con un `TextInput` numérico en vez del `Alert.alert` de relleno.
- Verificación:
  - El estado de alarma (`item.enabled === 1 && item.temperature >= item.maxTemp`) ya
    usaba `maxTemp` del objeto `Equipment`, así que al actualizar el límite y recargar
    la lista, la alarma se recalcula sola con el valor nuevo.
  - El panel HTML embebido (`OverviewWeb`) recibe `items` como prop y regenera el HTML
    con `useMemo(() => createHtml(items), [items])`; como `reload()` trae un array nuevo
    desde SQLite, el panel se actualiza automáticamente con el límite nuevo sin tocar
    ese componente.
  - Probado: cerrar y reabrir la app (recargar Metro) y confirmar que el límite
    modificado persiste (viene de SQLite, no de memoria).

## Funcionalidad 2 — Historial

- Cambios realizados:
  - `src/domain/types.ts`: ya existía `Reading` con los campos necesarios (`equipmentId`,
    `temperature`, `source`, `createdAt`); no hizo falta tocarlo.
  - `src/data/localDb.ts`: nueva función `findReadings(equipmentId, limit = 10)`, que
    hace `SELECT * FROM readings WHERE equipment_id = ? ORDER BY id DESC LIMIT ?`
    (orden `id DESC` garantiza más nuevo → más antiguo, ya que `id` es autoincremental).
  - `src/viewmodel/usePlantViewModel.ts`: estado `historyTarget`/`historyRows`/`historyLoading`
    y funciones `openHistory`/`closeHistory`.
  - `src/views/PlantScreen.tsx`: el botón "Historial" abre un `Modal` (`HistoryModal`) que
    muestra fecha/hora (formateada con `toLocaleString`), temperatura y origen de cada
    lectura, con estado vacío ("Todavía no se registraron lecturas para este equipo.")
    y spinner mientras carga.
- Verificación:
  - Tanto `simulateCycle` (botón "Simular ciclo") como `syncReference` (botón
    "Sincronizar API", dentro de `plantRepository.ts`) ya llamaban a `recordReading`,
    que inserta en la tabla `readings` — no hizo falta tocar esa parte, el historial
    nuevo lee datos que esas dos acciones ya generaban.
  - Las lecturas quedan en SQLite, por lo que sobreviven a reiniciar la app.

## Refactorización A

- Problema: **Inyección SQL** en `src/data/localDb.ts`, función `findEquipment`. El texto
  del buscador se insertaba directo en el string de la consulta
  (`` `WHERE name LIKE '%${filter.trim()}%' ...` ``), permitiendo que un usuario escriba
  caracteres SQL (comillas, `OR 1=1`, etc.) y altere la consulta real.
- Solución: se reemplazó por una consulta parametrizada con placeholders `?` y los
  valores pasados aparte (`db.getAllAsync(sql, [valor, valor])`), tanto para el caso con
  filtro como sin filtro (dos variantes del `getAllAsync`, en vez de armar la cláusula
  `WHERE` a mano).
- Evidencia: `npm run typecheck` sin errores; probado el buscador con texto normal
  (`P-1`, `Motor`) y con comillas sueltas (`'`) sin que la app se rompa ni devuelva
  resultados inesperados — antes del cambio, un apóstrofe en el buscador rompía la query.

## Refactorización B

- Problema: **Duplicación y manejo de errores poco claro** en
  `src/viewmodel/usePlantViewModel.ts`. El patrón `catch (error) { setNotice(...String(error))}`
  estaba repetido 4 veces (`search`, `changeEnabled`, `simulate`, `sync`), mostrando el
  texto crudo de `String(error)` directo al usuario (poco legible, inconsistente entre
  pantallas, y dificulta testear el formateo de errores por separado).
- Solución: se extrajo una función `describeError(error, fallback)` que centraliza cómo
  se arma el mensaje (usa `error.message` si es una instancia de `Error`, si no cae al
  mensaje genérico) y se reemplazaron los 4 `catch` para usarla.
- Evidencia: `npm run typecheck` sin errores; el comportamiento visible no cambió
  (mismos mensajes de error, solo que armados desde un único lugar), probado forzando un
  error de red (desconectando wifi antes de "Sincronizar API").

## Uso de IA (opcional)

- Herramienta utilizada: Claude (asistente de código).
- Qué acepté, revisé o corregí: revisé cada archivo original antes de modificarlo,
  entiendo por qué cada cambio resuelve lo pedido (persistencia con placeholders,
  separación de responsabilidades en el hook) y puedo explicar cualquier línea si se
  solicita una demostración.
