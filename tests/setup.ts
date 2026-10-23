// Roda antes de todos os testes. O Pool do pg é lazy, então nunca conecta —
// mas módulos importados (db.ts) exigem DATABASE_URL no import. Dummy basta.
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/brolabs-unit-test';
process.env.JWT_SECRET ||= 'unit-test-secret';
