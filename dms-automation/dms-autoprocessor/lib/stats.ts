import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

export async function getProcessingStats(date?: string) {
  const client = await new Client().connect({
    hostname: Deno.env.get("MYSQL_HOST") || "mariadb",
    port: parseInt(Deno.env.get("MYSQL_PORT") || "3306"),
    username: Deno.env.get("MYSQL_USER") || "drupaluser",
    password: Deno.env.get("MYSQL_PASSWORD") || "",
    db: Deno.env.get("MYSQL_DATABASE") || "drupal",
  });
  
  // Count documents with "AUTOMATED" type
  const result = await client.query(
    `SELECT COUNT(*) as count 
     FROM field_data_field_type 
     WHERE field_type_value LIKE 'AUTOMATED%'`
  );
  
  const automatedCount = result[0]?.count || 0;
  
  await client.close();
  
  return {
    pendingReview: automatedCount,
    lastProcessed: new Date().toISOString(),
  };
}
