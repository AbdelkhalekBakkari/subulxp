'use strict';
const { badRequest } = require('./errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalise a phone number to E.164-ish digits (keeps a leading +). */
function normalizePhone(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const digits = s.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (digits.replace(/\D/g, '').length < 8 || digits.replace(/\D/g, '').length > 15) return undefined;
  return digits.startsWith('+') ? digits : (digits.startsWith('00') ? '+' + digits.slice(2) : digits);
}

/**
 * Validate an object against a tiny schema. Each rule: { type, required, max, min, enum, pattern }.
 * Unknown keys are dropped (mass-assignment protection). Returns the cleaned object.
 */
function validate(body, schema, { partial = false } = {}) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Corps de requête invalide');
  const out = {};
  const errors = {};
  for (const [key, rule] of Object.entries(schema)) {
    let v = body[key];
    const present = Object.prototype.hasOwnProperty.call(body, key);
    if (!present) {
      if (rule.required && !partial) errors[key] = 'Champ obligatoire';
      continue;
    }
    if (v === '' || v === null) {
      if (rule.required) { errors[key] = 'Champ obligatoire'; continue; }
      out[key] = rule.type === 'array' ? [] : null;
      continue;
    }
    switch (rule.type) {
      case 'string':
        if (typeof v !== 'string') { errors[key] = 'Doit être une chaîne'; continue; }
        v = v.trim();
        if (rule.required && !v) { errors[key] = 'Champ obligatoire'; continue; }
        if (rule.max && v.length > rule.max) { errors[key] = `Maximum ${rule.max} caractères`; continue; }
        if (rule.min && v.length < rule.min) { errors[key] = `Minimum ${rule.min} caractères`; continue; }
        if (rule.pattern && v && !rule.pattern.test(v)) { errors[key] = rule.message || 'Format invalide'; continue; }
        if (rule.enum && v && !rule.enum.includes(v)) { errors[key] = 'Valeur non autorisée'; continue; }
        break;
      case 'email':
        if (typeof v !== 'string') { errors[key] = 'Email invalide'; continue; }
        v = v.trim().toLowerCase();
        if (!EMAIL_RE.test(v) || v.length > 254) { errors[key] = 'Email invalide'; continue; }
        break;
      case 'phone': {
        const p = normalizePhone(v);
        if (p === undefined) { errors[key] = 'Numéro invalide'; continue; }
        v = p;
        break;
      }
      case 'int':
        if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) v = Number(v);
        if (!Number.isInteger(v)) { errors[key] = 'Doit être un entier'; continue; }
        if (rule.min != null && v < rule.min) { errors[key] = `Minimum ${rule.min}`; continue; }
        if (rule.max != null && v > rule.max) { errors[key] = `Maximum ${rule.max}`; continue; }
        break;
      case 'bool':
        if (typeof v === 'string') v = v === 'true' || v === '1';
        if (typeof v === 'number') v = v === 1;
        if (typeof v !== 'boolean') { errors[key] = 'Doit être un booléen'; continue; }
        break;
      case 'date':
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) { errors[key] = 'Date invalide (AAAA-MM-JJ)'; continue; }
        break;
      case 'datetime':
        if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) { errors[key] = 'Date/heure invalide'; continue; }
        v = new Date(v).toISOString();
        break;
      case 'array':
        if (!Array.isArray(v)) { errors[key] = 'Doit être une liste'; continue; }
        if (rule.enum) {
          const bad = v.filter((x) => !rule.enum.includes(x));
          if (bad.length) { errors[key] = 'Valeur non autorisée : ' + bad.join(', '); continue; }
        }
        v = [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
        break;
      default:
        throw new Error('Unknown rule type ' + rule.type);
    }
    out[key] = v;
  }
  if (Object.keys(errors).length) throw badRequest('Données invalides', errors);
  return out;
}

function parseId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Identifiant invalide');
  return n;
}

module.exports = { validate, parseId, normalizePhone, EMAIL_RE };
