// Destino de registros que acumula en memoria y entrega un JSON Lines (una línea JSON por registro).
// No envía nada por red. La descarga usa Blob y un <a download> (SIN VERIFICAR en un navegador real).
import { RegistroTurnos, exigirRegistroTurno } from './registroTurnos.js';

export class ExportacionArchivo extends RegistroTurnos {
  #registros = [];

  /** Valida y acumula una copia. Rechaza si el registro no es válido. */
  async guardar(registro) {
    exigirRegistroTurno(registro);
    this.#registros.push(structuredClone(registro));
  }

  get cantidad() {
    return this.#registros.length;
  }

  /** Registros acumulados (copias). */
  registros() {
    return this.#registros.map((r) => structuredClone(r));
  }

  /** JSON Lines: una línea JSON válida por registro, cada una terminada en "\n". Vacío si no hay registros. */
  aJsonLines() {
    return this.#registros.map((r) => `${JSON.stringify(r)}\n`).join('');
  }

  /** Descarga el archivo en el navegador. `entorno`: { document, URL, Blob } (por defecto los globales). */
  descargar(nombre = 'registros.jsonl', entorno = globalThis) {
    const blob = new entorno.Blob([this.aJsonLines()], { type: 'application/x-ndjson' });
    const url = entorno.URL.createObjectURL(blob);
    const a = entorno.document.createElement('a');
    a.href = url;
    a.download = nombre;
    entorno.document.body.append(a);
    a.click();
    a.remove();
    entorno.URL.revokeObjectURL(url);
  }
}
