# Factur-X Service

Micro-service FastAPI qui génère des PDF Factur-X BASIC (EN 16931) à partir des données de facturation.

## Déploiement sur VPS Hostinger

```bash
# 1. Copier les fichiers sur le VPS
scp -r services/facturx-service/ user@vps:/opt/facturx-service/

# 2. Sur le VPS
cd /opt/facturx-service
echo "FACTURX_API_KEY=une_cle_secrete_longue" > .env
docker compose up -d

# 3. Vérifier
curl http://localhost:8001/health
```

## Reverse proxy Nginx (recommandé)

Ajouter dans la config Nginx du VPS pour exposer en HTTPS :

```nginx
location /facturx/ {
    proxy_pass http://localhost:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Endpoint

### POST /generate

Reçoit les données de facture, retourne un PDF Factur-X binaire.

**Headers :**
- `X-Api-Key: <FACTURX_API_KEY>`
- `Content-Type: application/json`

**Body :** voir `InvoiceData` dans `main.py`

**Réponse :** `application/pdf` — le fichier PDF/A-3 avec XML CII embarqué

## Variables d'environnement

| Variable | Description |
|---|---|
| `FACTURX_API_KEY` | Clé d'authentification (transmise par n8n dans le header `X-Api-Key`) |
