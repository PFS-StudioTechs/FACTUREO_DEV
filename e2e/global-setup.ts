import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AUTH_FILE = path.resolve(__dirname, ".auth/user.json");

/**
 * Authentifie un compte de TEST dédié (jamais un compte de prod) et sauvegarde
 * la session dans un storageState réutilisé par tous les tests. Idempotent :
 * si le compte de test n'existe pas encore, il est créé.
 *
 * Credentials fournis par TEST_USER_EMAIL / TEST_USER_PASSWORD (env ou
 * .env.local, jamais committés — voir e2e/README.md).
 *
 * Création du compte : si SUPABASE_SERVICE_ROLE_KEY est fourni, on passe par
 * l'API admin (createUser + email_confirm: true) qui ne dépend pas du SMTP du
 * projet. Sinon on retombe sur signUp (client anon) — qui échoue si le projet
 * n'a pas de SMTP configuré pour l'email de confirmation.
 */
export default async function globalSetup() {
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const projectId = env.VITE_SUPABASE_PROJECT_ID;
  const email = env.TEST_USER_EMAIL;
  const password = env.TEST_USER_PASSWORD;
  const baseURL = env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

  if (!supabaseUrl || !supabaseKey || !projectId) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PROJECT_ID manquants (.env). Voir e2e/README.md.",
    );
  }
  if (!email || !password) {
    throw new Error(
      "TEST_USER_EMAIL / TEST_USER_PASSWORD manquants. Fournis-les via variables d'environnement ou .env.local (jamais un compte de prod). Voir e2e/README.md.",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Compte de test absent : on le crée proprement (idempotent — un second
    // run retombera directement sur signInWithPassword ci-dessus).
    if (serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) {
        throw new Error(`Échec création admin du compte de test (${email}) : ${createError.message}`);
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        throw new Error(
          `Échec création du compte de test (${email}) : ${signUpError.message}. ` +
            "Fournis SUPABASE_SERVICE_ROLE_KEY (.env.local) pour créer le compte via l'API admin " +
            "sans dépendre du SMTP du projet — voir e2e/README.md.",
        );
      }
    }
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
    if (error) {
      throw new Error(
        `Compte de test créé mais connexion impossible : ${error.message}. ` +
          "La confirmation email est probablement activée sur ce projet Supabase — " +
          "confirme le compte de test manuellement une fois (dashboard Supabase → Authentication), " +
          "ou fournis SUPABASE_SERVICE_ROLE_KEY pour créer le compte pré-confirmé.",
      );
    }
  }

  if (!data.session) {
    throw new Error("Connexion réussie mais aucune session retournée par Supabase.");
  }

  const storageKey = `sb-${projectId}-auth-token`;

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: storageKey, value: JSON.stringify(data.session) },
  );
  await page.reload();
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}
