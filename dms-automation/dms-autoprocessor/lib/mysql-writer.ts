import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

interface DocumentData {
  filename: string;
  policyNumber: string;
  documentType: string;
  suggestedType: string;
  confidence: number;
  client: string;
  thumbnailPath: string;
  filePath: string;
}

let mysqlClient: Client | null = null;

async function getMysqlClient(): Promise<Client> {
  if (mysqlClient) return mysqlClient;
  
  mysqlClient = await new Client().connect({
    hostname: Deno.env.get("MYSQL_HOST") || "docman-mariadb",
    port: parseInt(Deno.env.get("MYSQL_PORT") || "3306"),
    username: Deno.env.get("MYSQL_USER") || "drupaluser",
    password: Deno.env.get("MYSQL_PASSWORD") || "",
    db: Deno.env.get("MYSQL_DATABASE") || "drupal",
  });
  
  return mysqlClient;
}

/**
 * Look up the client/company name from existing records that share the same policy number.
 * This does a self-referential lookup: find any prior document with this policy and grab the client.
 */
export async function lookupClientByPolicy(policyNumber: string): Promise<string | null> {
  const client = await getMysqlClient();

  try {
    const result = await client.execute(
      `SELECT c.field_client_value AS client
       FROM field_data_field_policy p
       INNER JOIN field_data_field_client c
         ON c.entity_id = p.entity_id
         AND c.entity_type = p.entity_type
       WHERE p.field_policy_value = ?
         AND c.field_client_value IS NOT NULL
         AND c.field_client_value != ''
         AND c.field_client_value != 'Unknown'
       LIMIT 1`,
      [policyNumber]
    );

    const rows = result.rows;
    if (rows && rows.length > 0) {
      return (rows[0] as any).client;
    }
  } catch (error) {
    console.error("     Client lookup failed:", error);
  }

  return null;
}

export async function insertDrupalRecord(data: DocumentData): Promise<number> {
  const client = await getMysqlClient();
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Get file size
  let filesize = 0;
  try {
    const stat = await Deno.stat(data.filePath);
    filesize = stat.size;
  } catch {
    filesize = 0;
  }
  
  // Convert file path to Drupal URI format
  const uri = data.filePath.replace("/data/documents/drupal-files/", "public://");
  
  // Insert into file_managed
  const fileResult = await client.execute(
    `INSERT INTO file_managed (uid, filename, uri, filemime, filesize, status, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [1, data.filename, uri, "application/pdf", filesize, 1, timestamp]
  );
  
  const fid = fileResult.lastInsertId;
  if (!fid) throw new Error("Failed to insert file_managed record");
  
  // Insert into field_data_field_policy
  await client.execute(
    `INSERT INTO field_data_field_policy
     (entity_type, bundle, deleted, entity_id, revision_id, language, delta, field_policy_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["node", "docman", 0, fid, fid, "und", 0, data.policyNumber]
  );
  
  // Insert into field_data_field_type
  await client.execute(
    `INSERT INTO field_data_field_type
     (entity_type, bundle, deleted, entity_id, revision_id, language, delta, field_type_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["node", "docman", 0, fid, fid, "und", 0, data.documentType]
  );
  
  // Insert into field_data_field_client
  await client.execute(
    `INSERT INTO field_data_field_client
     (entity_type, bundle, deleted, entity_id, revision_id, language, delta, field_client_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["node", "docman", 0, fid, fid, "und", 0, data.client]
  );
  
  // Insert AI suggestion
  try {
    await client.execute(
      `INSERT INTO field_data_field_ai_suggestion
       (entity_type, bundle, deleted, entity_id, revision_id, language, delta, 
        field_ai_suggestion_value, field_ai_suggestion_confidence, field_ai_thumbnail_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["node", "docman", 0, fid, fid, "und", 0, data.suggestedType, data.confidence, data.thumbnailPath]
    );
  } catch {
    // Table might not exist
  }
  
  console.log("     Database FID:", fid);
  return fid;
}
