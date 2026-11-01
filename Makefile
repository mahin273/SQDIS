# ==============================================================================
# SQDIS — Software Quality and Developer Intelligence System
# Docker Automation & Orchestration Makefile
# ==============================================================================

.DEFAULT_GOAL := help
SHELL         := /bin/bash
.SHELLFLAGS   := -eu -o pipefail -c

# Compose and Docker binaries
DC            ?= docker compose
DOCKER        ?= docker
ENV_FILE      ?= .env
ENV_EXAMPLE   ?= .env.example

# Terminal Colors
CYAN          := \033[36m
GREEN         := \033[32m
YELLOW        := \033[33m
RED           := \033[31m
BLUE          := \033[34m
MAGENTA       := \033[35m
BOLD          := \033[1m
RESET         := \033[0m

.PHONY: help env init info urls ps status top \
        up down down-v stop start restart \
        build build-nc up-build build-backend build-frontend build-ml \
        infra-up infra-down core-up core-down monitoring-up monitoring-down \
        logs logs-tail logs-backend logs-frontend logs-ml logs-db logs-redis logs-monitoring \
        db-seed db-migrate db-push db-studio db-shell redis-cli \
        shell-backend shell-frontend shell-ml shell-db shell-redis \
        test test-backend test-backend-cov test-ml lint-backend \
        clean clean-volumes clean-all reset fix-boot-mount

##@ General & Information

help: ## Display this help banner and target overview
	@echo ""
	@echo -e "$(BOLD)$(CYAN)  ███████╗ ██████╗ ██████╗ ██╗███████╗$(RESET)"
	@echo -e "$(BOLD)$(CYAN)  ██╔════╝██╔═══██╗██╔══██╗██║██╔════╝$(RESET)"
	@echo -e "$(BOLD)$(CYAN)  ███████╗██║   ██║██║  ██║██║███████╗$(RESET)"
	@echo -e "$(BOLD)$(CYAN)  ╚════██║██║▄▄ ██║██║  ██║██║╚════██║$(RESET)"
	@echo -e "$(BOLD)$(CYAN)  ███████║╚██████╔╝██████╔╝██║███████║$(RESET)"
	@echo -e "$(BOLD)$(CYAN)  ╚══════╝ ╚══▀▀═╝ ╚═════╝ ╚═╝╚══════╝$(RESET)"
	@echo -e "$(BOLD)  Software Quality & Developer Intelligence System$(RESET)"
	@echo ""
	@echo -e "$(BOLD)$(YELLOW)Usage:$(RESET) make $(GREEN)<target>$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "; section=""} \
	  /^##@/ { printf "\n$(BOLD)$(YELLOW)%s$(RESET)\n", substr($$0, 5); next } \
	  /^[a-zA-Z0-9_-]+:.*?## / { printf "  $(CYAN)%-22s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

env: ## Create .env from .env.example if missing
	@if [ ! -f "$(ENV_FILE)" ]; then \
	  echo -e "$(YELLOW)[+] Creating $(ENV_FILE) from $(ENV_EXAMPLE)...$(RESET)"; \
	  cp $(ENV_EXAMPLE) $(ENV_FILE); \
	  echo -e "$(GREEN)[✓] $(ENV_FILE) created. Update your credentials if needed.$(RESET)"; \
	else \
	  echo -e "$(BLUE)[i] $(ENV_FILE) already exists.$(RESET)"; \
	fi

info: ## Show accessible web URLs, service ports, and demo credentials
	@echo ""
	@echo -e "$(BOLD)$(CYAN)======================================================================$(RESET)"
	@echo -e "$(BOLD)$(CYAN)                     SQDIS PLATFORM DIRECTORY                         $(RESET)"
	@echo -e "$(BOLD)$(CYAN)======================================================================$(RESET)"
	@echo -e "  $(BOLD)Web Frontend:$(RESET)          $(GREEN)http://localhost:5173$(RESET)"
	@echo -e "  $(BOLD)Backend Gateway:$(RESET)       $(GREEN)http://localhost:3000$(RESET)"
	@echo -e "  $(BOLD)Swagger API Docs:$(RESET)      $(GREEN)http://localhost:3000/api/docs$(RESET)"
	@echo -e "  $(BOLD)ML & Compiler Engine:$(RESET)  $(GREEN)http://localhost:8000$(RESET) (Health: /api/ml/health)"
	@echo -e "  $(BOLD)Grafana Dashboards:$(RESET)    $(GREEN)http://localhost:3001$(RESET) (User: admin / Pass: admin)"
	@echo -e "  $(BOLD)Prometheus TSDB:$(RESET)       $(GREEN)http://localhost:9090$(RESET)"
	@echo -e "  $(BOLD)Loki Log Ingestion:$(RESET)    $(GREEN)http://localhost:3100$(RESET)"
	@echo -e "  $(BOLD)Tempo Tracing:$(RESET)         $(GREEN)http://localhost:3200$(RESET)"
	@echo -e "  $(BOLD)cAdvisor Metrics:$(RESET)      $(GREEN)http://localhost:8080$(RESET)"
	@echo -e "  $(BOLD)PostgreSQL Port:$(RESET)       $(GREEN)localhost:5435$(RESET)"
	@echo -e "  $(BOLD)Redis Port:$(RESET)            $(GREEN)localhost:6389$(RESET)"
	@echo -e "$(BOLD)$(CYAN)----------------------------------------------------------------------$(RESET)"
	@echo -e "$(BOLD)$(YELLOW)Demo Presentation Credentials (after 'make db-seed'):$(RESET)"
	@echo -e "  $(MAGENTA)Admin:$(RESET)      admin@sqdis.local  |  Admin123!"
	@echo -e "  $(MAGENTA)Team Lead:$(RESET)  lead@sqdis.local   |  Password123!"
	@echo -e "  $(MAGENTA)Developer:$(RESET)  dev1@sqdis.local   |  Password123!"
	@echo -e "$(BOLD)$(CYAN)======================================================================$(RESET)"
	@echo ""

urls: info ## Alias for 'info'

##@ Setup & Initialization

init: env build-up db-seed ## First-time setup: build, launch all services, and seed database
	@echo -e "$(GREEN)$(BOLD)[✓] SQDIS system initialization complete!$(RESET)"
	@$(MAKE) info

##@ Stack Lifecycle

up: ## Start all container services in background (detached)
	@echo -e "$(GREEN)[+] Starting SQDIS services...$(RESET)"
	@$(DC) up -d

down: ## Stop and remove all containers and networks
	@echo -e "$(YELLOW)[+] Stopping and removing SQDIS containers...$(RESET)"
	@$(DC) down

down-v: ## Stop containers and remove volumes (DESTRUCTIVE: database wiped)
	@echo -e "$(RED)[!] Stopping SQDIS and wiping volumes...$(RESET)"
	@$(DC) down -v

stop: ## Stop all running containers without removing them
	@echo -e "$(YELLOW)[+] Stopping containers...$(RESET)"
	@$(DC) stop

start: ## Start existing stopped containers
	@echo -e "$(GREEN)[+] Starting containers...$(RESET)"
	@$(DC) start

restart: ## Restart all containers
	@echo -e "$(YELLOW)[+] Restarting all services...$(RESET)"
	@$(DC) restart

ps: ## View running containers, status, and port bindings
	@$(DC) ps

status: ps ## Alias for 'ps'

top: ## Display active processes inside running containers
	@$(DC) top

##@ Sub-Stack Profiles

infra-up: ## Start core infrastructure only (PostgreSQL, Redis, Prometheus, Grafana)
	@echo -e "$(GREEN)[+] Starting infrastructure tier...$(RESET)"
	@$(DC) up -d db redis prometheus grafana

infra-down: ## Stop infrastructure services
	@echo -e "$(YELLOW)[+] Stopping infrastructure tier...$(RESET)"
	@$(DC) stop db redis prometheus grafana

core-up: ## Start core application stack only (DB, Redis, ML, Backend, Frontend)
	@echo -e "$(GREEN)[+] Starting core application stack...$(RESET)"
	@$(DC) up -d db redis ml-service backend frontend

core-down: ## Stop core application services
	@echo -e "$(YELLOW)[+] Stopping core application stack...$(RESET)"
	@$(DC) stop db redis ml-service backend frontend

monitoring-up: ## Start full observability mesh (Prometheus, Grafana, Loki, Promtail, Tempo, cAdvisor, Node Exporter)
	@echo -e "$(GREEN)[+] Starting observability mesh...$(RESET)"
	@$(DC) up -d prometheus grafana loki promtail tempo node-exporter cadvisor-compat cadvisor

monitoring-down: ## Stop observability mesh
	@echo -e "$(YELLOW)[+] Stopping observability mesh...$(RESET)"
	@$(DC) stop prometheus grafana loki promtail tempo node-exporter cadvisor-compat cadvisor

##@ Build & Compilation

build: ## Build all Docker images
	@echo -e "$(GREEN)[+] Building all container images...$(RESET)"
	@$(DC) build

build-nc: ## Build all Docker images without caching
	@echo -e "$(YELLOW)[+] Building all images without cache...$(RESET)"
	@$(DC) build --no-cache

up-build: ## Build images and launch all containers in detached mode
	@echo -e "$(GREEN)[+] Building and starting all containers...$(RESET)"
	@$(DC) up -d --build

build-backend: ## Build only the NestJS backend image
	@echo -e "$(GREEN)[+] Building backend image...$(RESET)"
	@$(DC) build backend

build-frontend: ## Build only the React + Vite frontend image
	@echo -e "$(GREEN)[+] Building frontend image...$(RESET)"
	@$(DC) build frontend

build-ml: ## Build only the FastAPI ML service image
	@echo -e "$(GREEN)[+] Building ML service image...$(RESET)"
	@$(DC) build ml-service

##@ Logs & Monitoring

logs: ## Tail output logs from all running containers
	@$(DC) logs -f

logs-tail: ## View last 100 lines and follow logs from all containers
	@$(DC) logs -f --tail=100

logs-backend: ## Tail NestJS backend logs
	@$(DC) logs -f backend

logs-frontend: ## Tail React/Nginx frontend logs
	@$(DC) logs -f frontend

logs-ml: ## Tail FastAPI ML service logs
	@$(DC) logs -f ml-service

logs-db: ## Tail PostgreSQL database logs
	@$(DC) logs -f db

logs-redis: ## Tail Redis cache & queue logs
	@$(DC) logs -f redis

logs-monitoring: ## Tail observability logs (Prometheus, Grafana, Loki, Promtail, Tempo)
	@$(DC) logs -f prometheus grafana loki promtail tempo

##@ Database & Migrations

db-seed: ## Seed database with demonstration and viva test data
	@echo -e "$(GREEN)[+] Seeding database with demo data...$(RESET)"
	@$(DC) exec backend npm run db:seed

db-migrate: ## Run pending Prisma database migrations
	@echo -e "$(GREEN)[+] Running Prisma migration deploy...$(RESET)"
	@$(DC) exec backend npx prisma migrate deploy

db-push: ## Synchronize Prisma schema with DB directly (without creating migration files)
	@echo -e "$(YELLOW)[+] Pushing Prisma schema to database...$(RESET)"
	@$(DC) exec backend npx prisma db push

db-studio: ## Start Prisma Studio inside backend container (available on :5555)
	@echo -e "$(GREEN)[+] Launching Prisma Studio...$(RESET)"
	@$(DC) exec backend npx prisma studio

db-shell: ## Open interactive psql PostgreSQL shell
	@$(DC) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

redis-cli: ## Open interactive Redis command-line interface
	@$(DC) exec redis redis-cli

##@ Interactive Shells

shell-backend: ## Open interactive shell in backend container
	@$(DC) exec backend /bin/sh

shell-frontend: ## Open interactive shell in frontend container
	@$(DC) exec frontend /bin/sh

shell-ml: ## Open interactive shell in ML service container
	@$(DC) exec ml-service /bin/bash

shell-db: ## Open interactive shell in PostgreSQL container
	@$(DC) exec db /bin/sh

shell-redis: ## Open interactive shell in Redis container
	@$(DC) exec redis /bin/sh

##@ Testing & Quality (Inside Containers)

test: test-ml test-backend ## Run both ML and Backend container test suites

test-backend: ## Run Jest unit and spec tests in backend container
	@echo -e "$(GREEN)[+] Running backend tests...$(RESET)"
	@$(DC) exec backend npm run test

test-backend-cov: ## Run Jest test coverage report in backend container
	@echo -e "$(GREEN)[+] Running backend test coverage...$(RESET)"
	@$(DC) exec backend npm run test:cov

test-ml: ## Run Pytest test suite in ML service container
	@echo -e "$(GREEN)[+] Running ML service tests...$(RESET)"
	@$(DC) exec ml-service pytest

lint-backend: ## Run ESLint in backend container
	@echo -e "$(GREEN)[+] Running backend linter...$(RESET)"
	@$(DC) exec backend npm run lint

##@ Maintenance & Cleanup

clean: ## Remove stopped containers and orphan networks
	@echo -e "$(YELLOW)[+] Cleaning stopped containers and networks...$(RESET)"
	@$(DC) down --remove-orphans

clean-volumes: ## Wipe all containers, networks, and named volumes
	@echo -e "$(RED)[!] Removing containers and volumes...$(RESET)"
	@$(DC) down -v --remove-orphans

clean-all: clean-volumes ## Deep clean: wipe containers, volumes, dangling images, and build cache
	@echo -e "$(RED)[!] Pruning dangling Docker system images and volumes...$(RESET)"
	@$(DOCKER) system prune -f

reset: ## Full teardown, rebuild, and re-seed (clean-volumes -> up-build -> db-seed)
	@echo -e "$(RED)$(BOLD)[!] Executing complete SQDIS system reset...$(RESET)"
	@$(DC) down -v --remove-orphans
	@$(DC) up -d --build
	@echo -e "$(BLUE)[+] Waiting for backend and database readiness...$(RESET)"
	@sleep 10
	@$(DC) exec backend npm run db:seed
	@echo -e "$(GREEN)$(BOLD)[✓] System reset completed successfully.$(RESET)"
	@$(MAKE) info

fix-boot-mount: ## Ensure Docker daemon waits for secondary storage mount on system boot
	@echo -e "$(YELLOW)[+] Configuring systemd secondary mount dependency...$(RESET)"
	@sudo ./scripts/fix-docker-boot-mount.sh
