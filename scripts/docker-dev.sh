#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/infra/docker/docker-compose.yml"
PROJECT_NAME="wealthnest"

usage() {
  echo "Usage: $0 {up|up-d|down|logs|rebuild|status}"
  echo "  up       : Start containers in foreground"
  echo "  up-d     : Start containers in background (detached)"
  echo "  down     : Stop containers (WITHOUT deleting volumes)"
  echo "  logs     : Follow container logs"
  echo "  rebuild  : Rebuild images and start containers"
  echo "  status   : Show container health and status"
  exit 1
}

CMD="${1:-up-d}"

case "$CMD" in
  up)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up
    ;;
  up-d)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build
    echo "Containers started! Access WealthNest at http://wealthnest.local or http://localhost:5173"
    ;;
  down)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down
    ;;
  logs)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" logs -f
    ;;
  rebuild)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build --force-recreate
    ;;
  status)
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" ps
    ;;
  *)
    usage
    ;;
esac
