
// Comprehensive CORS configuration for all Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-debug-source, x-user-agent',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  'Content-Type': 'application/json'
};

export const createCorsResponse = (data: any, status: number = 200) => {
  return new Response(
    JSON.stringify(data),
    { 
      status, 
      headers: corsHeaders
    }
  );
};

export const handleCorsPrelight = () => {
  return new Response('ok', { 
    status: 200,
    headers: corsHeaders 
  });
};
