# Food Suggest Monitoring

This stack monitors the Node API and the YOLO inference service with
Prometheus, Grafana, and Alertmanager. W&B remains responsible for training
runs and model artifacts.

## Services

| Service | Local URL | Purpose |
| --- | --- | --- |
| Grafana | http://localhost:3001 | Dashboards |
| Prometheus | http://localhost:9090 | Metrics and alert evaluation |
| Alertmanager | http://localhost:9093 | Active alerts and notifications |
| Node metrics | http://localhost:3000/metrics | API/process metrics |
| YOLO metrics | http://localhost:8000/metrics | Model/inference metrics |

## Start locally

1. Start the Node backend on port `3000` and YOLO service on port `8000`.
2. Install Docker Desktop.
3. Create the monitoring environment file:

```powershell
Copy-Item monitoring/.env.example monitoring/.env
```

4. Change `GRAFANA_ADMIN_PASSWORD`, then start the stack:

```powershell
docker compose --env-file monitoring/.env `
  -f monitoring/docker-compose.monitoring.yml up -d
```

Grafana automatically provisions the Prometheus datasource and the
`Food Suggest MLOps` dashboard.

## Verify

```powershell
Invoke-WebRequest http://localhost:3000/metrics
Invoke-WebRequest http://localhost:8000/metrics
Invoke-WebRequest http://localhost:9090/-/ready
```

Prometheus targets should be `UP` at http://localhost:9090/targets.

## Production security

Set a strong `METRICS_TOKEN` on both application services. Configure the
production collector with the corresponding bearer token and do not expose
`/metrics`, Prometheus, or Alertmanager directly to the public internet.
Use a private network, firewall allow-list, or Grafana Alloy running beside
the services.

Set the backend variable below so the Admin MLOps page links to Grafana:

```text
GRAFANA_URL=https://grafana.example.com/d/food-suggest-mlops
```

The bundled Prometheus configuration targets `host.docker.internal`, which is
intended for local Docker Desktop. In production, replace those targets with
private service DNS names or use service discovery.

## Notifications

The default Alertmanager receiver keeps alerts visible in its UI without
sending messages. Add Slack, email, or another receiver in
`monitoring/alertmanager/alertmanager.yml`. Store credentials in a secret
manager and mount a rendered config; never commit webhook URLs or passwords.

Configured alerts:

- Node backend unavailable for 2 minutes.
- YOLO service unavailable or model not loaded.
- Backend 5xx rate above 5% for 5 minutes.
- YOLO p95 inference latency above 3 seconds.
- Empty detection rate above 30% for 15 minutes.

## Retention

Prometheus retains 15 days locally. For longer production retention, use
Grafana Cloud, Thanos, Mimir, or another Prometheus-compatible remote-write
backend.
