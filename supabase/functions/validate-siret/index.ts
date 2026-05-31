import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { siret } = await req.json();

    if (!siret || !/^\d{14}$/.test(siret.replace(/\s/g, ""))) {
      return new Response(
        JSON.stringify({ valid: false, error: "SIRET invalide — 14 chiffres requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanSiret = siret.replace(/\s/g, "");
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}&page=1&per_page=1`,
      { headers: { "Accept": "application/json" } }
    );

    if (!res.ok) {
      throw new Error(`API entreprises erreur: ${res.status}`);
    }

    const data = await res.json();
    const result = data?.results?.[0];

    if (!result) {
      return new Response(
        JSON.stringify({ valid: false, error: "SIRET introuvable" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if matching SIRET (search may return approximate results)
    const matchingSiret = result.siege?.siret === cleanSiret || result.siren === cleanSiret.slice(0, 9);
    if (!matchingSiret) {
      return new Response(
        JSON.stringify({ valid: false, error: "SIRET introuvable" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result.etat_administratif === "F" || result.siege?.etat_administratif === "F") {
      return new Response(
        JSON.stringify({ valid: false, error: "Établissement fermé" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siege = result.siege ?? {};
    const company = {
      siret: cleanSiret,
      siren: cleanSiret.slice(0, 9),
      denomination: result.nom_raison_sociale ?? result.nom_complet ?? "",
      forme_juridique: result.libelle_nature_juridique_niveau2 ?? result.libelle_nature_juridique_niveau3 ?? "",
      adresse: siege.adresse ?? siege.libelle_voie ?? "",
      code_postal: siege.code_postal ?? "",
      ville: siege.libelle_commune ?? "",
      code_naf: siege.activite_principale ?? "",
      libelle_naf: siege.libelle_activite_principale ?? "",
    };

    return new Response(
      JSON.stringify({ valid: true, company }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("validate-siret error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Erreur lors de la validation du SIRET" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
