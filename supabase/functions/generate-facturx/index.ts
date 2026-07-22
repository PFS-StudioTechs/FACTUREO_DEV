import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveCallerId, checkOwnership, errorToResponse, jsonResponse, type CreateAnonClient } from "../_shared/ownership.ts";

export interface Deps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  facturxApiKey: string | undefined;
  facturxApiUrl: string;
  createAnonClient: CreateAnonClient;
  createServiceClient: (url: string, key: string) => ReturnType<typeof createClient>;
  fetchImpl: typeof fetch;
}

function defaultDeps(): Deps {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    facturxApiKey: Deno.env.get("FACTURX_API_KEY"),
    facturxApiUrl: Deno.env.get("FACTURX_API_URL") ?? "http://148.230.124.131:8001",
    createAnonClient: (authHeader: string) =>
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      }),
    createServiceClient: (url, key) => createClient(url, key),
    fetchImpl: fetch,
  };
}

export async function handle(req: Request, corsHeaders: Record<string, string>, deps: Deps): Promise<Response> {
  if (!deps.facturxApiKey) throw new Error("FACTURX_API_KEY not configured");

  const { invoice_id } = await req.json();
  if (!invoice_id) throw new Error("invoice_id requis");

  const callerResult = await resolveCallerId(req, deps.supabaseUrl, deps.supabaseAnonKey, deps.createAnonClient);
  if ("error" in callerResult) return errorToResponse(callerResult.error, corsHeaders);
  const { userId } = callerResult;

  const supabase = deps.createServiceClient(deps.supabaseUrl, deps.supabaseServiceRoleKey);

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoice_id)
    .single();
  if (invError || !invoice) throw new Error(`Facture introuvable: ${invError?.message}`);

  const ownership = checkOwnership(invoice as { user_id: string }, userId);
  if (!ownership.ok) return errorToResponse(ownership.error, corsHeaders);

  const { data: company, error: compError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", invoice.company_id)
    .single();
  if (compError || !company) throw new Error(`Entreprise introuvable: ${compError?.message}`);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", invoice.client_id)
    .single();
  if (clientError || !client) throw new Error(`Client introuvable: ${clientError?.message}`);

  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", invoice_id)
    .order("position");

  const firstLine = lines?.[0];
  const nombreJours = invoice.nombre_jours || firstLine?.quantite || null;
  const tjm = invoice.tjm || firstLine?.prix_unitaire_ht || null;

  const payload = {
    invoice_id: invoice.id,
    user_id: invoice.user_id,
    numero_facture: invoice.numero_facture,
    date_facturation: invoice.date_facturation,
    date_limite_paiement: invoice.date_limite_paiement,
    emetteur: {
      denomination: company.denomination,
      adresse: company.adresse,
      code_postal: company.code_postal,
      ville: company.ville,
      pays: "FR",
      siret: company.siret,
      tva_intracommunautaire: company.tva_intracommunautaire,
      code_iban: company.code_iban,
      bic_swift: company.bic_swift,
      mail: company.mail ?? "",
      telephone: company.telephone ?? "",
    },
    client: {
      nom: client.nom,
      adresse: client.adresse,
      code_postal: client.code_postal,
      ville: client.ville,
      pays: "FR",
      siret: "",
      tva_intracommunautaire: "",
      email: "",
    },
    designation: invoice.designation,
    descriptif_mission: invoice.descriptif_mission,
    nombre_jours: nombreJours,
    tjm: tjm,
    montant_ht: invoice.montant_ht,
    taux_tva: invoice.taux_tva,
    montant_tva: invoice.montant_tva,
    montant_ttc: invoice.montant_ttc,
    mode_paiement: invoice.mode_paiement ?? "VIREMENT",
    conditions_paiement: invoice.conditions_paiement ?? 30,
    numero_bon_commande: invoice.numero_bon_commande ?? "",
    lines: lines && lines.length > 0 ? lines.map(l => ({
      designation: l.designation,
      quantite: l.quantite,
      unite: l.unite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      remise: l.remise,
      taux_tva: l.taux_tva,
      motif_exoneration: l.motif_exoneration,
      montant_ht: l.montant_ht,
      montant_tva: l.montant_tva,
      montant_ttc: l.montant_ttc,
    })) : null,
  };

  const fastApiRes = await deps.fetchImpl(`${deps.facturxApiUrl}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": deps.facturxApiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!fastApiRes.ok) {
    const errText = await fastApiRes.text();
    throw new Error(`FastAPI error (${fastApiRes.status}): ${errText}`);
  }

  const pdfBytes = await fastApiRes.arrayBuffer();

  return new Response(pdfBytes, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.numero_facture}.pdf"`,
    },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    return await handle(req, corsHeaders, defaultDeps());
  } catch (e) {
    console.error("generate-facturx error:", e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : "Erreur inconnue" }, corsHeaders);
  }
});
