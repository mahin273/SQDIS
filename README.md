# SQDIS - Software Quality & Developer Intelligence System

A comprehensive multi-tenant SaaS platform for software development quality assessment. SQDIS uses machine learning to compute Developer Quality Scores (DQS) and Software Quality Scores (SQS), providing actionable insights for engineering teams.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)



## Features

### Core Capabilities
- **Developer Quality Score (DQS)**: ML-powered scoring (0-100) using XGBoost with SHAP explanations
- **Software Quality Score (SQS)**: Project-level scoring using Random Forest with risk identification
- **GitHub Integration**: Automatic commit ingestion via webhooks and hourly polling
- **Code Review Tracking**: PR review metrics, turnaround classification, and review debt tracking
- **Technical Debt Tracking**: Automatic detection of TODO/FIXME/HACK/XXX markers
- **Commit Classification**: ML-based classification (bugfix, feature, refactor, test, docs)
- **Anomaly Detection**: Isolation Forest-based anomaly flagging for unusual commits

### Team & Organization
- **Multi-tenant Architecture**: Organization-based data isolation
- **Team Management**: Create teams, assign leads, track team metrics
- **Project Management**: Group repositories into projects with team assignments
- **Developer Onboarding**: 90-day onboarding tracking with milestones and checklists

### Reporting & Analytics
- **Sprint Reports**: Automated sprint report generation with metrics
- **Release Management**: Release readiness scoring and sprint associations
- **Quality Goals/OKRs**: Set and track quality improvement goals
- **Export Options**: PDF and CSV export for all reports
- **Real-time Dashboards**: WebSocket-powered live updates
- **Developer Profiles**: Comprehensive developer metrics with commit history, DQS trends, and review statistics
- **Leaderboard**: Advanced filtering, sorting, and team comparison with rank animations
- **Onboarding Tracking**: Progress visualization, milestone tracking, and mentor assignment

### Alerts & Notifications
- **Anomaly Alerts**: Configurable severity thresholds
- **Multi-channel Notifications**: Email, Slack, and in-app notifications
- **Notification Preferences**: Quiet hours and digest mode support


## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18, TypeScript, Vite | Web application |
| | Tailwind CSS, Shadcn/ui | Styling & components |
| | Zustand, TanStack Query | State management |
| | Recharts, Framer Motion | Charts & animations |
| | react-window | Virtual scrolling |
| | fast-check | Property-based testing |
| **Backend** | NestJS 10, TypeScript | API server |
| | Prisma 5 | Database ORM |
| | Passport.js | Authentication |
| | BullMQ | Job queue |
| | Socket.io | WebSocket |
| **ML Service** | FastAPI, Python 3.11+ | ML API |
| | scikit-learn, XGBoost | ML models |
| | SHAP | Model explainability |
| | MLflow | Model versioning |
| **Database** | PostgreSQL 15 | Primary data store |
| **Cache** | Redis 7 | Caching & pub/sub |
| **Monitoring** | Prometheus, Grafana | Metrics & dashboards |
