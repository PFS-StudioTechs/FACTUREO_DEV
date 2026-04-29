# Workflows n8n — Facturéo

## Import

Dans n8n : **Settings → Workflows → Import from file** → sélectionner le JSON voulu.

---

## Workflow 1 — Génération Factur-X (`workflow_invoice_facturx.json`)

### Déclencheur
POST webhook depuis l'app React quand l'utilisateur finalise une facture.

### Étapes
1. **Webhook** — reçoit `{ invoice_id, user_id }`
2. **Fetch Invoice** — récupère facture + company + client via Supabase REST
3. **Build Factur-X Payload** — structure les données pour le micro-service
4. **Generate Factur-X PDF** — appel micro-service Python → PDF/A-3 binaire
5. **Prepare Storage Path** — construit le chemin `{user_id}/{numero_facture}.pdf`
6. **Upload PDF to Supabase** — stocke dans le bucket `invoices`
7. **Update Invoice Status** — PATCH `status: "générée"` + `facturx_url`
8. **Respond to Webhook** — retourne `{ success, invoice_id, facturx_url }`

### URL du webhook (à configurer dans l'app)
```
https://ton-n8n.hostinger.com/webhook/invoice-facturx
```

---

## Workflow 2 — Traitement Notes de Frais (`workflow_expense_processing.json`)

### Déclencheur
POST webhook depuis l'app React après upload d'une photo de ticket.

### Étapes
1. **Webhook** — reçoit `{ record_id, user_id, image_path }`
2. **Get Image Signed URL** — signed URL Supabase pour l'image (1h)
3. **Download Image** — télécharge le fichier binaire
4. **Claude OCR** — extrait merchant, amount, expense_date, category, description
5. **Parse OCR Result** — structure les données extraites
6. **Generate PDF (Gotenberg)** — génère un PDF propre depuis HTML
7. **Upload PDF to Supabase** — stocke dans `expense-scans/{user_id}/pdfs/`
8. **Extract PDF Path** — récupère le chemin de stockage
9. **Update Expense Scan** — PATCH `status: "à revoir"` + toutes les métadonnées

### URL du webhook (à configurer dans l'app)
```
https://ton-n8n.hostinger.com/webhook/expense-scan
```

---

## Workflow 3 — Envoi Hebdo Notes de Frais (`workflow_expense_weekly.json`)

### Déclencheur
Cron automatique : **chaque vendredi à 17h00** (`0 17 * * 5`).

### Étapes
1. **Schedule Trigger** — vendredi 17h
2. **Fetch Pending Scans** — toutes les notes `status = "à revoir"`
3. **Des notes existent ?** — branche IF
   - **OUI** → Build Email Content → Send Email (Resend) → Mark as Transmis
   - **NON** → log silencieux, rien à faire

---

## Variables d'environnement n8n

Configurer dans **Settings → Environment Variables** de ton instance n8n :

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL de ton projet Supabase (ex: `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Clé `service_role` Supabase (bypass RLS) |
| `FACTURX_SERVICE_URL` | URL du micro-service Python (ex: `http://localhost:8001`) |
| `FACTURX_API_KEY` | Clé d'auth du micro-service |
| `ANTHROPIC_API_KEY` | Clé API Claude (pour OCR des tickets) |
| `GOTENBERG_URL` | URL de Gotenberg (ex: `http://localhost:3000`) |
| `RESEND_API_KEY` | Clé API Resend pour les emails |
| `FROM_EMAIL` | Email expéditeur (ex: `notes@tondomaine.fr`) |
| `ACCOUNTANT_EMAIL` | Email du comptable |

---

## Gotenberg (génération PDF notes de frais)

Gotenberg est un service Docker de conversion HTML → PDF. À déployer sur le VPS :

```bash
docker run --rm -d \
  -p 3000:3000 \
  --name gotenberg \
  gotenberg/gotenberg:8
```

Ou ajouter au `docker-compose.yml` du VPS :

```yaml
services:
  gotenberg:
    image: gotenberg/gotenberg:8
    restart: unless-stopped
    ports:
      - "3000:3000"
```

---

## Architecture complète sur le VPS

```
VPS Hostinger
├── n8n          (port 5678, reverse proxy Nginx)
├── facturx      (port 8001, micro-service Python)
└── gotenberg    (port 3000, PDF generation)
```
