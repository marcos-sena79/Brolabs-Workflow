import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db';

declare global {
  namespace Express {
    interface Request {
      memberId?: string;
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} não definida. Copie .env.example para .env e configure.`
    );
  }
  return value;
}

const JWT_SECRET = requireEnv('JWT_SECRET');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

/** Gera um hash bcrypt para a senha em texto puro */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/** Compara senha em texto puro com um hash armazenado */
export async function comparePassword(
  plainPassword: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

/** Gera um JWT assinado contendo o id do membro */
export function generateToken(memberId: string): string {
  return jwt.sign({ memberId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any }) as string;
}

/** Verifica e decodifica um JWT. Retorna o payload ou null se inválido */
export function verifyToken(token: string): { memberId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { memberId: string };
    return decoded;
  } catch {
    return null;
  }
}

/** Middleware Express: exige token válido no header Authorization ou cookie */
export function authenticateToken(
  req: any,
  res: any,
  next: any
): void {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;
  const tokenFromCookie = req.cookies?.token;

  const token = tokenFromHeader || tokenFromCookie;

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado. Token ausente.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }

  req.memberId = payload.memberId;
  next();
}

/** Busca membro pelo email no banco de dados */
export async function findMemberByEmail(email: string): Promise<any | null> {
  const res = await query('SELECT * FROM members WHERE email = $1', [email]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

/** Busca membro pelo id no banco de dados */
export async function findMemberById(memberId: string): Promise<any | null> {
  const res = await query('SELECT * FROM members WHERE id = $1', [memberId]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

/** Atualiza o último login do membro */
export async function updateLastLogin(memberId: string): Promise<void> {
  await query(
    'UPDATE members SET last_login_at = NOW() WHERE id = $1',
    [memberId]
  );
}
