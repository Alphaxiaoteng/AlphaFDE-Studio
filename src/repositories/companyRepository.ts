/**
 * AlphaFDE Studio — Company SQL Repository
 */
import { DatabaseConnection } from "../db/connection";
import { Company } from "../types/schema";

export interface CompanyFilter {
  size_band?: string;
  direction_tag?: string;
  keyword?: string;
}

export class CompanyRepository {
  private conn: DatabaseConnection;

  constructor(conn?: DatabaseConnection) {
    this.conn = conn || DatabaseConnection.getInstance();
  }

  public findAll(filter: CompanyFilter = {}): Company[] {
    let sql = `
      SELECT c.*, 
             (SELECT COUNT(*) FROM matches m WHERE m.company_id = c.id) as match_count
      FROM companies c 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filter.size_band) {
      sql += " AND c.size_band = ?";
      params.push(filter.size_band);
    }

    if (filter.direction_tag) {
      sql += " AND (c.direction_tag = ? OR c.direction LIKE ?)";
      params.push(filter.direction_tag, `%${filter.direction_tag}%`);
    }

    if (filter.keyword) {
      sql += " AND (c.code LIKE ? OR c.display_name LIKE ? OR c.direction LIKE ?)";
      const kw = `%${filter.keyword}%`;
      params.push(kw, kw, kw);
    }

    sql += " ORDER BY c.id ASC";

    const rows = this.conn.query<any>(sql, params);
    return rows.map(this.mapRowToCompany);
  }

  public findById(id: string): Company | null {
    const sql = `
      SELECT c.*, 
             (SELECT COUNT(*) FROM matches m WHERE m.company_id = c.id) as match_count
      FROM companies c 
      WHERE c.id = ?
    `;
    const row = this.conn.queryOne<any>(sql, [id]);
    return row ? this.mapRowToCompany(row) : null;
  }

  public countTotal(): number {
    const row = this.conn.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM companies");
    return row ? row.cnt : 0;
  }

  public insert(company: Company): void {
    const sql = `
      INSERT OR REPLACE INTO companies (
        id, code, display_name, alias, logo, direction, direction_tag, industry,
        size_band, headcount_range, funding_stage, address, contact_lead, contact_phone,
        service_needs, headcount_bands_json, fields_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    this.conn.execute(sql, [
      company.id,
      company.code,
      company.display_name || company.code,
      company.alias || company.display_name || company.code,
      company.logo || "",
      company.direction,
      company.direction_tag || "",
      company.industry || "",
      company.size_band || "sme",
      company.headcount_range || "",
      company.funding_stage || "",
      company.address || "",
      company.contact_lead || "",
      company.contact_phone || "",
      (company.service_needs || []).join(","),
      JSON.stringify(company.headcount_bands || {}),
      JSON.stringify(company.fields || {})
    ]);
  }

  private mapRowToCompany(r: any): Company {
    let headcountBands = { rd: 0, biz: 0, other: 0 };
    let fields = {};
    try { if (r.headcount_bands_json) headcountBands = JSON.parse(r.headcount_bands_json); } catch {}
    try { if (r.fields_json) fields = JSON.parse(r.fields_json); } catch {}

    return {
      id: r.id,
      code: r.code,
      display_name: r.display_name,
      alias: r.alias,
      logo: r.logo,
      direction: r.direction,
      direction_tag: r.direction_tag,
      industry: r.industry,
      size_band: r.size_band,
      headcount_range: r.headcount_range,
      funding_stage: r.funding_stage,
      address: r.address,
      contact_lead: r.contact_lead,
      phone: r.contact_phone,
      contact_phone: r.contact_phone,
      service_needs: r.service_needs ? r.service_needs.split(",").filter(Boolean) : [],
      headcount_bands: headcountBands,
      fields,
      match_count: r.match_count || 0
    };
  }
}
