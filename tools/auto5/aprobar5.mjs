#!/usr/bin/env node
// Lo corre el autor, no el agente: node tools/auto5/aprobar5.mjs R5
// Cambia solo `aprobacion` a "aprobado" y registra la fecha. Sin dependencias.
import { readFileSync, writeFileSync } from 'node:fs';

const id = process.argv[2];
const f = 'tools/auto5/PLAN.json';
const plan = JSON.parse(readFileSync(f, 'utf8'));
const p = plan.pasos.find((x) => x.id === id);
if (!p) { console.error(`paso inexistente: ${id}`); process.exit(1); }
if (p.aprobacion !== 'a_aprobar') { console.error(`${id}: aprobacion=${p.aprobacion}, nada que aprobar`); process.exit(1); }
p.aprobacion = 'aprobado';
p.aprobadoEn = new Date().toISOString().slice(0, 10);
writeFileSync(f, JSON.stringify(plan, null, 1) + '\n');
console.log(`${id} aprobado ${p.aprobadoEn}`);
