/**
 * AlphaFDE Studio — Match SQL Repository
 */
import { DatabaseConnection } from "../db/connection";
import { Match, MatchState, SopStatus } from "../types/schema";

export class MatchRepository {
  private conn: DatabaseConnection;

  constructor(conn?: DatabaseConnection) {
    this.conn = conn || DatabaseConnection.getInstance();
  }

  public findById(id: string): Match | null {
    const row = this.conn.queryOne<any>("SELECT * FROM matches WHERE id = ?", [id]);
    return row ? this.mapRowToMatch(row) : null;
  }

  public findByCompanyId(companyId: string): Match[] {
    const sql = `
      SELECT m.*, p.title as radar_title, p.channel as radar_channel, p.days_left as radar_days_left, p.urgency as radar_urgency
      FROM matches m
      LEFT JOIN policies p ON m.radar_id = p.id
      WHERE m.company_id = ?
      ORDER BY m.id ASC
    `;
    const rows = this.conn.query<any>(sql, [companyId]);
    return rows.map(this.mapRowToMatch);
  }

  public findByRadarId(radarId: string): Match[] {
    const sql = `
      SELECT m.*, c.code as company_code, c.display_name as company_name, c.direction as company_direction
      FROM matches m
      LEFT JOIN companies c ON m.company_id = c.id
      WHERE m.radar_id = ?
      ORDER BY m.id ASC
    `;
    const rows = this.conn.query<any>(sql, [radarId]);
    return rows.map(this.mapRowToMatch);
  }

  public findAll(state?: string): Match[] {
    let sql = `
      SELECT m.*, 
             c.display_name as company_name, c.code as company_code,
             p.title as radar_title, p.urgency as radar_urgency, p.days_left as radar_days_left
      FROM matches m
      LEFT JOIN companies c ON m.company_id = c.id
      LEFT JOIN policies p ON m.radar_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (state) {
      sql += " AND m.state = ?";
      params.push(state);
    }
    sql += " ORDER BY m.id ASC";

    const rows = this.conn.query<any>(sql, params);
    return rows.map(this.mapRowToMatch);
  }

  public updateSop(id: string, step: number, status: SopStatus, primaryAction: string): void {
    const sql = `
      UPDATE matches 
      SET sop_step = ?, sop_status = ?, primary_action = ?, updated_at = datetime('now')
      WHERE id = ?
    `;
    this.conn.execute(sql, [step, status, primaryAction, id]);
  }

  public updateStateAndDraft(id: string, state: MatchState, draft: string | null): void {
    const sql = `
      UPDATE matches 
      SET state = ?, draft = ?, updated_at = datetime('now')
      WHERE id = ?
    `;
    this.conn.execute(sql, [state, draft, id]);
  }

  public getStats(): { 符合: number; 排除: number; 待核验: number; 双益: number } {
    const confirmed = this.conn.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches WHERE state = '符合'")?.cnt || 0;
    const rejected = this.conn.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches WHERE state = '排除'")?.cnt || 0;
    const pending = this.conn.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches WHERE state = '待核验'")?.cnt || 0;
    const dual = this.conn.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM policies WHERE benefit = 'both'")?.cnt || 0;

    return {
      符合: confirmed,
      排除: rejected,
      待核验: pending,
      双益: dual
    };
  }

  private mapRowToMatch(r: any): Match {
    return {
      id: r.id,
      company_id: r.company_id,
      radar_id: r.radar_id,
      state: r.state as MatchState,
      label: r.label,
      gap: r.gap,
      sop_step: r.sop_step,
      current: r.sop_step,
      sop_status: r.sop_status as SopStatus,
      primary_action: r.primary_action,
      draft: r.draft,
      citation: r.citation,
      conflict: r.conflict === 1,
      conflicts: r.conflict_radar_id ? [{ radar_id: r.conflict_radar_id, title: "互斥政策项" }] : []
    };
  }
}
