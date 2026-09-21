/**
 * AlphaFDE Studio — Audit Log SQL Repository
 */
import { DatabaseConnection } from "../db/connection";
import { SopLog, ConfirmLog } from "../types/schema";

export class AuditRepository {
  private conn: DatabaseConnection;

  constructor(conn?: DatabaseConnection) {
    this.conn = conn || DatabaseConnection.getInstance();
  }

  public recordSopAction(
    matchId: string,
    action: string,
    operator: string = "OP-01",
    oldStep?: number,
    newStep?: number,
    companyId?: string,
    note?: string
  ): void {
    const sql = `
      INSERT INTO sop_logs (match_id, company_id, action, old_step, new_step, operator, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    this.conn.execute(sql, [matchId, companyId || null, action, oldStep ?? null, newStep ?? null, operator, note || null]);
  }

  public recordConfirmAction(
    companyId: string,
    matchId: string,
    action: string,
    operator: string = "OP-01",
    draft?: string | null
  ): void {
    const sql = `
      INSERT INTO confirm_logs (company_id, match_id, action, operator, draft, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `;
    this.conn.execute(sql, [companyId, matchId, action, operator, draft || null]);
  }

  public recordRemind(companyId: string, channel: string, operator: string = "OP-01", note?: string): void {
    const sql = `
      INSERT INTO remind_logs (company_id, channel, operator, note, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `;
    this.conn.execute(sql, [companyId, channel, operator, note || null]);
  }

  public getRecentSopLogs(limit: number = 50): SopLog[] {
    const sql = "SELECT * FROM sop_logs ORDER BY id DESC LIMIT ?";
    const rows = this.conn.query<any>(sql, [limit]);
    return rows.map(r => ({
      id: r.id,
      ts: r.created_at,
      match_id: r.match_id,
      company_id: r.company_id,
      action: r.action,
      operator: r.operator,
      note: r.note
    }));
  }

  public getRecentConfirmLogs(limit: number = 50): ConfirmLog[] {
    const sql = "SELECT * FROM confirm_logs ORDER BY id DESC LIMIT ?";
    const rows = this.conn.query<any>(sql, [limit]);
    return rows.map(r => ({
      id: r.id,
      ts: r.created_at,
      company_id: r.company_id,
      match_id: r.match_id,
      action: r.action,
      operator: r.operator,
      draft: r.draft
    }));
  }
}
