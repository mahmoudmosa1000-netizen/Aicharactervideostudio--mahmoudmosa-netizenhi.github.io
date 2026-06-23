# Deployment-Runbook — AI Character Video Studio Pro

Produktionsreife Bereitstellung, vom lokalen Docker-Compose-Setup bis zum skalierenden Kubernetes-Cluster.

---

## 1. Lokale Entwicklung (Docker Compose)

```bash
cp .env.example .env          # Werte ausfüllen
docker compose up -d postgres redis qdrant
cd apps/backend && npx prisma migrate dev --name init && npx prisma db seed
cd ../..
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend / Swagger | http://localhost:3001/api/docs |
| AI Worker | http://localhost:8000/docs |
| Qdrant Dashboard | http://localhost:6333/dashboard |

**Optional — höherer LLM-Durchsatz:**
```bash
docker compose -f infrastructure/vllm/docker-compose-vllm.yaml up -d
# In .env: VLLM_URL=http://localhost:8001/v1 setzen
```

---

## 2. Produktions-Deployment (Kubernetes)

### Voraussetzungen
- Kubernetes-Cluster mit NVIDIA GPU Operator installiert
- Mindestens 1 GPU-Knotenpool (RTX 4090/5090/PRO 6000)
- RWX-fähige StorageClass (EFS, Filestore, oder NFS) für Modell-Cache
- [KEDA](https://keda.sh) für GPU-Queue-basiertes Autoscaling
- NGINX Ingress Controller + cert-manager

### Reihenfolge

```bash
# 1. Namespace, Config, Secrets
kubectl apply -f infrastructure/k8s/namespace.yaml
kubectl create secret generic ai-studio-secrets \
  --from-env-file=.env -n ai-studio --dry-run=client -o yaml | kubectl apply -f -

# 2. GPU-Knoten labeln (einmalig pro Knoten)
kubectl label node <node-name> gpu-type=rtx-pro-6000
kubectl get nodes -L gpu-type   # Prüfen

# 3. PriorityClasses & RuntimeClass
kubectl apply -f infrastructure/k8s/gpu-node-config.yaml

# 4. Datenbank-Layer (Postgres, Qdrant, Redis)
kubectl apply -f infrastructure/k8s/statefulsets/data-layer.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n ai-studio --timeout=120s

# 5. Anwendungs-Layer
kubectl apply -f infrastructure/k8s/deployments/app-layer.yaml
kubectl apply -f infrastructure/k8s/deployments/ai-worker.yaml

# 6. Migrations gegen die Produktions-DB laufen lassen
kubectl run prisma-migrate --rm -it --restart=Never \
  --image=ai-studio/backend:latest -n ai-studio \
  -- npx prisma migrate deploy

# 7. Ingress + Autoscaling
kubectl apply -f infrastructure/k8s/ingress.yaml
kubectl apply -f infrastructure/k8s/autoscaling.yaml
```

### Validierung
```bash
kubectl get pods -n ai-studio -o wide          # Laufen AI-Worker-Pods auf GPU-Knoten?
kubectl logs -f deployment/ai-worker -n ai-studio
kubectl get scaledobject -n ai-studio           # KEDA aktiv?
```

---

## 3. GPU-Performance-Optimierung (optional, empfohlen ab >50 Renderings/Tag)

| Maßnahme | Datei | Erwarteter Effekt |
|---|---|---|
| TensorRT für InsightFace/CLIP/DINOv2 | `infrastructure/tensorrt/optimize_models.py` | 2–4× schnellere Embedding-Extraktion |
| vLLM/SGLang statt direktem `transformers.generate()` | `infrastructure/vllm/` | 10–20× mehr parallele Story-Generierungen |
| ONNX Runtime für InsightFace (bereits Standard in `model_manager.py`) | — | Geringerer VRAM-Bedarf als reines PyTorch |

```bash
python infrastructure/tensorrt/optimize_models.py --model clip --precision fp16
docker compose -f infrastructure/vllm/docker-compose-vllm.yaml up -d
```

---

## 4. CI/CD

`.github/workflows/ci-cd.yml` automatisiert:
1. Lint + Test für Backend, Frontend, AI-Worker
2. Docker-Images bauen, in GitHub Container Registry pushen
3. Rolling-Update auf Kubernetes (`kubectl set image` + `rollout status`)
4. Automatischer Abbruch (kein Rollover) wenn `rollout status` fehlschlägt

Benötigte Repository-Secrets: `KUBE_CONFIG` (base64-kodierte kubeconfig).

---

## 5. Skalierungs-Faustregeln

| Last | Backend Replicas | AI-Worker (GPU) | Hinweis |
|---|---|---|---|
| <10 Videos/Tag | 1–2 | 1 (RTX 4090 reicht) | Docker Compose ausreichend |
| 10–100 Videos/Tag | 3 | 2–3 | Kubernetes + KEDA empfohlen |
| >100 Videos/Tag | 5+ | 4–8, gemischt RTX 5090/PRO 6000 | vLLM + TensorRT Pflicht |
| >1000 Videos/Tag | 10+ (HPA) | Dedizierter GPU-Pool, Queue-Priorisierung nach Auflösung | Multi-Region erwägen |

---

## 6. Monitoring-Hinweis

Nicht im Repository enthalten, aber empfohlen für Produktion:
- **Prometheus + Grafana**: Scraped `/health` (AI-Worker GPU-Metriken) und NestJS-Standard-Metriken
- **BullMQ Board** oder **Bull Dashboard**: Visualisiert die Render-Queue in Echtzeit
- **Sentry**: Fehler-Tracking für Backend und Frontend

---

## Zusammenfassung: Alle 6 Phasen

| Phase | Inhalt | Status |
|---|---|---|
| 1 — Fundament | Docker Compose, Prisma Schema (13 Tabellen), Qdrant Collections | ✅ |
| 2 — Backend + AI | NestJS (Auth, Characters, Stories, Render, Voice), Python FastAPI Worker | ✅ |
| 3 — Character Consistency | PuLID, InstantID, ConsisID, PhotoMaker V2, Qwen2.5-VL/InternVL | ✅ |
| 4 — Video-Pipeline | Story-Orchestrator, Prompt Builder, Export Center (TikTok/Reels/Shorts) | ✅ |
| 5 — Frontend | Next.js 15, 7 Seiten, "Tungsten Reel" Design-System, WebSocket-Live-Updates | ✅ |
| 6 — Infrastruktur | Kubernetes, GPU-Autoscaling (KEDA), TensorRT, vLLM, CI/CD | ✅ |
