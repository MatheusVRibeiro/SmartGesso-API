// Utilitário de secrets fail-closed — SEM dependências de módulos Nest
// (evita dependência circular auth ↔ core).
export function requireSecret(key: string): string {
  const v = process.env[key];
  if (!v || v.length < 16) {
    throw new Error(
      `[SECURITY] ${key} ausente ou curto demais no ambiente. ` +
        'Defina um secret forte (64+ chars) antes de iniciar a API.',
    );
  }
  return v;
}
