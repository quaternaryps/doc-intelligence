// Example Deno TypeScript Application
// This is a template - replace with your actual application code

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const PORT = 8000;

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  
  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ 
      status: "healthy", 
      service: "deno-app",
      environment: Deno.env.get("ENV") || "development"
    }), {
      headers: { "content-type": "application/json" },
    });
  }
  
  if (url.pathname === "/") {
    return new Response(JSON.stringify({ 
      message: "Doc Intelligence Deno App",
      version: "1.0.0",
      environment: Deno.env.get("ENV") || "development"
    }), {
      headers: { "content-type": "application/json" },
    });
  }
  
  return new Response("Not Found", { status: 404 });
};

console.log(`Deno app listening on http://localhost:${PORT}`);
await serve(handler, { port: PORT });
