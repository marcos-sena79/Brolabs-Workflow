// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv2 from "dotenv";

// src/server/db.ts
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
var DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_oQ6B2eKPpTvJ@ep-little-sun-b6r9taiu-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
var pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 1e4
});
pool.on("error", (err) => {
  console.error("Unexpected error on idle NeonDB client", err);
});
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  return res;
}

// src/data/initialData.ts
var INITIAL_MEMBERS = [
  {
    id: "mem-1",
    name: "Lucas Santos",
    email: "lucas.santos@techcorp.com.br",
    avatar: "/bucket/avatars/lucas-santos.svg",
    role: "Tech Lead & Arquiteto",
    department: "Engenharia",
    weeklyCapacityHours: 40,
    active: true
  },
  {
    id: "mem-2",
    name: "Juliana Ferreira",
    email: "juliana.ferreira@techcorp.com.br",
    avatar: "/bucket/avatars/juliana-ferreira.svg",
    role: "Engenheira Full Stack S\xEAnior",
    department: "Engenharia",
    weeklyCapacityHours: 40,
    active: true
  },
  {
    id: "mem-3",
    name: "Rafael Lima",
    email: "rafael.lima@techcorp.com.br",
    avatar: "/bucket/avatars/rafael-lima.svg",
    role: "Engenheiro Frontend Pleno",
    department: "Engenharia",
    weeklyCapacityHours: 40,
    active: true
  },
  {
    id: "mem-4",
    name: "Camila Duarte",
    email: "camila.duarte@techcorp.com.br",
    avatar: "/bucket/avatars/camila-duarte.svg",
    role: "Product Designer UX/UI",
    department: "Produto",
    weeklyCapacityHours: 40,
    active: true
  },
  {
    id: "mem-5",
    name: "Matheus Rocha",
    email: "matheus.rocha@techcorp.com.br",
    avatar: "/bucket/avatars/matheus-rocha.svg",
    role: "DevOps & QA Engineer",
    department: "Infraestrutura",
    weeklyCapacityHours: 40,
    active: true
  }
];
var INITIAL_BOARDS = [
  {
    id: "board-1",
    key: "ENG",
    name: "Sprint 24 - Plataforma & Core",
    description: "Desenvolvimento do n\xFAcleo de microsservi\xE7os, dashboards anal\xEDticos e seguran\xE7a.",
    sprintName: "Sprint 24 (Semana 41-42)",
    sprintGoal: "Finalizar m\xF3dulo de autentica\xE7\xE3o MFA, otimizar queries do dashboard e homologar webhooks.",
    sprintStartDate: "2026-10-06",
    sprintEndDate: "2026-10-20",
    columns: [
      { id: "col-backlog", title: "Backlog", order: 0, wipLimit: 15, accentColor: "#64748b" },
      { id: "col-todo", title: "A Fazer", order: 1, wipLimit: 8, accentColor: "#3b82f6" },
      { id: "col-inprogress", title: "Em Andamento", order: 2, wipLimit: 5, accentColor: "#eab308" },
      { id: "col-review", title: "Code Review / QA", order: 3, wipLimit: 4, accentColor: "#8b5cf6" },
      { id: "col-done", title: "Conclu\xEDdo", order: 4, accentColor: "#10b981" }
    ],
    epics: [
      { id: "epic-1", boardId: "board-1", key: "EP-1", name: "Autentica\xE7\xE3o & MFA", color: "#6366f1", description: "Seguran\xE7a e credenciais" },
      { id: "epic-2", boardId: "board-1", key: "EP-2", name: "Dashboard de Alta Performance", color: "#06b6d4", description: "Visualiza\xE7\xF5es e KPIs" },
      { id: "epic-3", boardId: "board-1", key: "EP-3", name: "Webhooks & Mensageria", color: "#f59e0b", description: "Integra\xE7\xE3o Slack/Teams/Discord" }
    ]
  },
  {
    id: "board-2",
    key: "MOB",
    name: "Mobile App - iOS & Android",
    description: "Aplicativo m\xF3vel para clientes finais com notifica\xE7\xF5es em push e sincroniza\xE7\xE3o offline.",
    sprintName: "Sprint 12 - Mobile Hub",
    sprintGoal: "Implementar biometria e tela de extrato de transa\xE7\xF5es com cache local.",
    sprintStartDate: "2026-10-08",
    sprintEndDate: "2026-10-22",
    columns: [
      { id: "col-backlog", title: "Backlog", order: 0, accentColor: "#64748b" },
      { id: "col-todo", title: "A Fazer", order: 1, accentColor: "#3b82f6" },
      { id: "col-inprogress", title: "Em Andamento", order: 2, accentColor: "#eab308" },
      { id: "col-review", title: "Code Review / QA", order: 3, accentColor: "#8b5cf6" },
      { id: "col-done", title: "Conclu\xEDdo", order: 4, accentColor: "#10b981" }
    ],
    epics: [
      { id: "epic-m1", boardId: "board-2", key: "MOB-EP1", name: "Autentica\xE7\xE3o Biom\xE9trica", color: "#ec4899", description: "FaceID e Fingerprint" },
      { id: "epic-m2", boardId: "board-2", key: "MOB-EP2", name: "Notifica\xE7\xF5es Push", color: "#10b981", description: "APNs & FCM" }
    ]
  }
];
var INITIAL_TASKS = [
  {
    id: "task-1",
    key: "ENG-101",
    boardId: "board-1",
    title: "Implementar autentica\xE7\xE3o de dois fatores (TOTP / Authenticator)",
    description: "Configurar fluxo de gera\xE7\xE3o de QR Code para Google Authenticator / 1Password, valida\xE7\xE3o de tokens TOTP de 6 d\xEDgitos e gera\xE7\xE3o de c\xF3digos de recupera\xE7\xE3o de emerg\xEAncia.",
    issueType: "story",
    priority: "urgent",
    statusId: "col-inprogress",
    assigneeId: "mem-2",
    // Juliana
    reporterId: "mem-1",
    epicId: "epic-1",
    estimatedHours: 16,
    loggedHours: 12.5,
    storyPoints: 8,
    dueDate: "2026-10-15",
    createdAt: "2026-10-07T08:30:00Z",
    updatedAt: "2026-10-13T09:00:00Z",
    tags: ["Seguran\xE7a", "Backend", "Auth"],
    subtasks: [
      { id: "sub-1", taskId: "task-1", title: "Modelar tabela de segredos MFA criptografados", completed: true, assigneeId: "mem-2", estimatedHours: 3, loggedHours: 3 },
      { id: "sub-2", taskId: "task-1", title: "Endpoint para gerar seed e QR Code base64", completed: true, assigneeId: "mem-2", estimatedHours: 4, loggedHours: 4.5 },
      { id: "sub-3", taskId: "task-1", title: "Endpoint de valida\xE7\xE3o e ativa\xE7\xE3o com token TOTP", completed: true, assigneeId: "mem-2", estimatedHours: 3, loggedHours: 3 },
      { id: "sub-4", taskId: "task-1", title: "Gera\xE7\xE3o e download de 10 c\xF3digos de backup descart\xE1veis", completed: false, assigneeId: "mem-2", estimatedHours: 3, loggedHours: 2 },
      { id: "sub-5", taskId: "task-1", title: "Testes unit\xE1rios e de integra\xE7\xE3o de expira\xE7\xE3o de token", completed: false, assigneeId: "mem-5", estimatedHours: 3, loggedHours: 0 }
    ],
    worklogs: [
      { id: "wl-1", taskId: "task-1", memberId: "mem-2", hours: 4.5, date: "2026-10-09", comment: "Modelagem do esquema e gera\xE7\xE3o do QR Code TOTP", createdAt: "2026-10-09T17:00:00Z" },
      { id: "wl-2", taskId: "task-1", memberId: "mem-2", hours: 5, date: "2026-10-10", comment: "Valida\xE7\xE3o de tokens e testes de deriva\xE7\xE3o de chave", createdAt: "2026-10-10T16:30:00Z" },
      { id: "wl-3", taskId: "task-1", memberId: "mem-2", hours: 3, date: "2026-10-12", comment: "Rotas de c\xF3digos de emerg\xEAncia e criptografia sim\xE9trica", createdAt: "2026-10-12T15:20:00Z" }
    ],
    comments: [
      { id: "c-1", taskId: "task-1", authorId: "mem-1", text: "Juliana, lembre-se de invalidar os c\xF3digos de recupera\xE7\xE3o uma vez utilizados.", createdAt: "2026-10-10T10:15:00Z" },
      { id: "c-2", taskId: "task-1", authorId: "mem-2", text: "Perfeito Lucas! J\xE1 implementei como tokens de uso \xFAnico com flag consumed_at.", createdAt: "2026-10-10T11:45:00Z" }
    ],
    dependencies: [
      { id: "dep-101-7", targetTaskId: "task-7", type: "blocks", createdAt: "2026-10-11T10:00:00Z" }
    ]
  },
  {
    id: "task-2",
    key: "ENG-102",
    boardId: "board-1",
    title: "Desenvolver componente de visualiza\xE7\xE3o gr\xE1fica de Burnup/Burndown",
    description: "Criar visualizador vetorial em SVG responsivo com linha ideal vs linha realizada, tooltip detalhado com horas restantes e pontos entregues por dia.",
    issueType: "task",
    priority: "high",
    statusId: "col-review",
    assigneeId: "mem-3",
    // Rafael
    reporterId: "mem-4",
    epicId: "epic-2",
    estimatedHours: 12,
    loggedHours: 11,
    storyPoints: 5,
    dueDate: "2026-10-14",
    createdAt: "2026-10-08T10:00:00Z",
    updatedAt: "2026-10-13T08:15:00Z",
    tags: ["Frontend", "Gr\xE1ficos", "UX"],
    subtasks: [
      { id: "sub-201", taskId: "task-2", title: "C\xE1lculo de regress\xE3o linear para linha ideal", completed: true, assigneeId: "mem-3", estimatedHours: 3, loggedHours: 2.5 },
      { id: "sub-202", taskId: "task-2", title: "Renderiza\xE7\xE3o de caminhos SVG e pontos interativos", completed: true, assigneeId: "mem-3", estimatedHours: 5, loggedHours: 5.5 },
      { id: "sub-203", taskId: "task-2", title: "Tooltip com detalhes de horas no hover", completed: true, assigneeId: "mem-3", estimatedHours: 2, loggedHours: 2 },
      { id: "sub-204", taskId: "task-2", title: "Valida\xE7\xE3o de acessibilidade e cores WCAG", completed: true, assigneeId: "mem-4", estimatedHours: 2, loggedHours: 1 }
    ],
    worklogs: [
      { id: "wl-201", taskId: "task-2", memberId: "mem-3", hours: 6, date: "2026-10-11", comment: "Constru\xE7\xE3o da l\xF3gica matem\xE1tica e proje\xE7\xE3o de dias \xFAteis", createdAt: "2026-10-11T18:00:00Z" },
      { id: "wl-202", taskId: "task-2", memberId: "mem-3", hours: 4, date: "2026-10-12", comment: "Renderiza\xE7\xE3o do SVG e suporte a dark mode", createdAt: "2026-10-12T17:30:00Z" },
      { id: "wl-203", taskId: "task-2", memberId: "mem-4", hours: 1, date: "2026-10-12", comment: "Revis\xE3o de design de contraste e espa\xE7amentos", createdAt: "2026-10-12T18:15:00Z" }
    ],
    comments: [
      { id: "c-201", taskId: "task-2", authorId: "mem-5", text: "PR #142 aberto para valida\xE7\xE3o de regress\xE3o e performance com 10.000 pontos.", createdAt: "2026-10-12T19:00:00Z" }
    ],
    dependencies: [
      { id: "dep-102-3", targetTaskId: "task-3", type: "is_blocked_by", createdAt: "2026-10-10T14:00:00Z" }
    ]
  },
  {
    id: "task-3",
    key: "ENG-103",
    boardId: "board-1",
    title: "Webhook dispatcher com re-tentativa exponencial e assinatura HMAC",
    description: "Implementar servi\xE7o em background para enviar eventos do Jira-like para Slack, Discord e Microsoft Teams com timeout de 3s e fallback.",
    issueType: "story",
    priority: "high",
    statusId: "col-done",
    assigneeId: "mem-1",
    // Lucas
    reporterId: "mem-1",
    epicId: "epic-3",
    estimatedHours: 14,
    loggedHours: 13,
    storyPoints: 5,
    dueDate: "2026-10-12",
    createdAt: "2026-10-06T09:00:00Z",
    updatedAt: "2026-10-12T16:00:00Z",
    tags: ["Backend", "Webhooks", "Integra\xE7\xF5es"],
    subtasks: [
      { id: "sub-301", taskId: "task-3", title: "Assinatura HMAC SHA-256 no header x-flowpulse-signature", completed: true, assigneeId: "mem-1", estimatedHours: 3, loggedHours: 3 },
      { id: "sub-302", taskId: "task-3", title: "Formatador de templates para Slack Block Kit", completed: true, assigneeId: "mem-1", estimatedHours: 4, loggedHours: 3.5 },
      { id: "sub-303", taskId: "task-3", title: "Formatador de templates para Discord e Teams", completed: true, assigneeId: "mem-1", estimatedHours: 4, loggedHours: 4 },
      { id: "sub-304", taskId: "task-3", title: "Tratamento de status HTTP 429 (Rate Limit)", completed: true, assigneeId: "mem-1", estimatedHours: 3, loggedHours: 2.5 }
    ],
    worklogs: [
      { id: "wl-301", taskId: "task-3", memberId: "mem-1", hours: 7, date: "2026-10-08", comment: "Configura\xE7\xE3o do queue dispatcher e algoritmos de backoff", createdAt: "2026-10-08T18:00:00Z" },
      { id: "wl-302", taskId: "task-3", memberId: "mem-1", hours: 6, date: "2026-10-11", comment: "Formatadores Slack e Teams + testes de homologa\xE7\xE3o", createdAt: "2026-10-11T16:45:00Z" }
    ],
    comments: [
      { id: "c-301", taskId: "task-3", authorId: "mem-2", text: "Testado com canal de alertas do time, payload recebido em 120ms!", createdAt: "2026-10-12T14:30:00Z" }
    ],
    dependencies: [
      { id: "dep-103-2", targetTaskId: "task-2", type: "blocks", createdAt: "2026-10-10T14:00:00Z" }
    ]
  },
  {
    id: "task-4",
    key: "ENG-104",
    boardId: "board-1",
    title: "Corrigir desalinhamento de horas no c\xE1lculo de desvio acumulado",
    description: "Quando o colaborador registra fra\xE7\xF5es de 0.25h (15min), o arredondamento na exibi\xE7\xE3o de horas totais do card truncava para inteiro.",
    issueType: "bug",
    priority: "urgent",
    statusId: "col-done",
    assigneeId: "mem-3",
    // Rafael
    reporterId: "mem-2",
    epicId: "epic-2",
    estimatedHours: 4,
    loggedHours: 5.5,
    // Note: Overrun! Shows variance management
    storyPoints: 2,
    dueDate: "2026-10-11",
    createdAt: "2026-10-10T11:00:00Z",
    updatedAt: "2026-10-11T17:20:00Z",
    tags: ["Bug", "C\xE1lculos", "Horas"],
    subtasks: [
      { id: "sub-401", taskId: "task-4", title: "Identificar uso de Math.floor na convers\xE3o de minutos", completed: true, assigneeId: "mem-3", estimatedHours: 1, loggedHours: 1.5 },
      { id: "sub-402", taskId: "task-4", title: "Normalizar n\xFAmeros para ponto flutuante com toFixed(1)", completed: true, assigneeId: "mem-3", estimatedHours: 1.5, loggedHours: 2 },
      { id: "sub-403", taskId: "task-4", title: "Adicionar testes de cobertura para 0.25h, 0.5h e 0.75h", completed: true, assigneeId: "mem-3", estimatedHours: 1.5, loggedHours: 2 }
    ],
    worklogs: [
      { id: "wl-401", taskId: "task-4", memberId: "mem-3", hours: 3.5, date: "2026-10-10", comment: "Depura\xE7\xE3o na suite de testes e ajuste na fun\xE7\xE3o formatHours", createdAt: "2026-10-10T16:00:00Z" },
      { id: "wl-402", taskId: "task-4", memberId: "mem-3", hours: 2, date: "2026-10-11", comment: "Ajuste nos snapshots de regress\xE3o do relat\xF3rio semanal", createdAt: "2026-10-11T15:00:00Z" }
    ],
    comments: []
  },
  {
    id: "task-5",
    key: "ENG-105",
    boardId: "board-1",
    title: "Criar prot\xF3tipos de alta fidelidade para tela de Gest\xE3o de Carga da Equipe",
    description: "Projetar matriz de capacidade individual vs horas alocadas, vis\xE3o semanal por sprint e indicadores visuais de sobrecarga (> 100%).",
    issueType: "story",
    priority: "medium",
    statusId: "col-inprogress",
    assigneeId: "mem-4",
    // Camila
    reporterId: "mem-1",
    epicId: "epic-2",
    estimatedHours: 10,
    loggedHours: 7,
    storyPoints: 5,
    dueDate: "2026-10-16",
    createdAt: "2026-10-09T14:00:00Z",
    updatedAt: "2026-10-13T07:45:00Z",
    tags: ["Design", "UI/UX", "Figma"],
    subtasks: [
      { id: "sub-501", taskId: "task-5", title: "Benchmarking de ferramentas de aloca\xE7\xE3o de squads", completed: true, assigneeId: "mem-4", estimatedHours: 2, loggedHours: 2 },
      { id: "sub-502", taskId: "task-5", title: "Defini\xE7\xE3o de hierarquia visual e escala de cinzas de alta legibilidade", completed: true, assigneeId: "mem-4", estimatedHours: 3, loggedHours: 3 },
      { id: "sub-503", taskId: "task-5", title: "Componentes de cards de membros com barras de progresso", completed: false, assigneeId: "mem-4", estimatedHours: 3, loggedHours: 2 },
      { id: "sub-504", taskId: "task-5", title: "Fluxo de filtros r\xE1pidos por departamento e cargo", completed: false, assigneeId: "mem-4", estimatedHours: 2, loggedHours: 0 }
    ],
    worklogs: [
      { id: "wl-501", taskId: "task-5", memberId: "mem-4", hours: 4, date: "2026-10-11", comment: "Wireframes e fluxo de navega\xE7\xE3o no Figma", createdAt: "2026-10-11T17:00:00Z" },
      { id: "wl-502", taskId: "task-5", memberId: "mem-4", hours: 3, date: "2026-10-12", comment: "Componentiza\xE7\xE3o de avatares, m\xE9tricas e tags funcionais", createdAt: "2026-10-12T16:00:00Z" }
    ],
    comments: []
  },
  {
    id: "task-6",
    key: "ENG-106",
    boardId: "board-1",
    title: "Otimizar queries PostgreSQL do relat\xF3rio de produtividade",
    description: "Criar \xEDndices compostos nas colunas (board_id, status_id, updated_at) e views materializadas para c\xE1lculo de ciclo m\xE9dio em menos de 50ms.",
    issueType: "task",
    priority: "medium",
    statusId: "col-todo",
    assigneeId: "mem-5",
    // Matheus
    reporterId: "mem-1",
    epicId: "epic-2",
    estimatedHours: 8,
    loggedHours: 0,
    storyPoints: 3,
    dueDate: "2026-10-18",
    createdAt: "2026-10-10T08:00:00Z",
    updatedAt: "2026-10-10T08:00:00Z",
    tags: ["Banco de Dados", "Performance", "DevOps"],
    subtasks: [
      { id: "sub-601", taskId: "task-6", title: "Analisar plano de execu\xE7\xE3o com EXPLAIN ANALYZE", completed: false, assigneeId: "mem-5", estimatedHours: 2, loggedHours: 0 },
      { id: "sub-602", taskId: "task-6", title: "Adicionar \xEDndices btree em colunas de agrega\xE7\xE3o", completed: false, assigneeId: "mem-5", estimatedHours: 3, loggedHours: 0 },
      { id: "sub-603", taskId: "task-6", title: "Benchmark com carga de 50.000 tarefas simuladas", completed: false, assigneeId: "mem-5", estimatedHours: 3, loggedHours: 0 }
    ],
    worklogs: [],
    comments: []
  },
  {
    id: "task-7",
    key: "ENG-107",
    boardId: "board-1",
    title: "Configurar pipeline de CI/CD para automa\xE7\xE3o de testes de seguran\xE7a",
    description: "Adicionar checagens SAST e DAST com SonarQube e auditoria de vulnerabilidades de pacotes npm no pull request.",
    issueType: "task",
    priority: "low",
    statusId: "col-todo",
    assigneeId: "mem-5",
    // Matheus
    reporterId: "mem-1",
    epicId: "epic-1",
    estimatedHours: 6,
    loggedHours: 1,
    storyPoints: 2,
    dueDate: "2026-10-19",
    createdAt: "2026-10-11T09:00:00Z",
    updatedAt: "2026-10-12T11:00:00Z",
    tags: ["DevOps", "CI/CD", "Seguran\xE7a"],
    subtasks: [
      { id: "sub-701", taskId: "task-7", title: "Workflow do GitHub Actions para npm audit", completed: true, assigneeId: "mem-5", estimatedHours: 2, loggedHours: 1 },
      { id: "sub-702", taskId: "task-7", title: "Configurar thresholds de cobertura m\xEDnima (80%)", completed: false, assigneeId: "mem-5", estimatedHours: 2, loggedHours: 0 },
      { id: "sub-703", taskId: "task-7", title: "Publica\xE7\xE3o de badges de qualidade no README", completed: false, assigneeId: "mem-5", estimatedHours: 2, loggedHours: 0 }
    ],
    worklogs: [
      { id: "wl-701", taskId: "task-7", memberId: "mem-5", hours: 1, date: "2026-10-12", comment: "Configura\xE7\xE3o do arquivo action.yml b\xE1sico", createdAt: "2026-10-12T11:30:00Z" }
    ],
    comments: [],
    dependencies: [
      { id: "dep-107-1", targetTaskId: "task-1", type: "is_blocked_by", createdAt: "2026-10-11T10:00:00Z" }
    ]
  },
  {
    id: "task-8",
    key: "ENG-108",
    boardId: "board-1",
    title: "Refatora\xE7\xE3o da camada de cache Redis para sess\xF5es distribu\xEDdas",
    description: "Substituir sess\xF5es locais em mem\xF3ria por store de sess\xE3o Redis com suporte a clustering e alta disponibilidade.",
    issueType: "story",
    priority: "medium",
    statusId: "col-backlog",
    assigneeId: "mem-2",
    // Juliana
    reporterId: "mem-1",
    epicId: "epic-1",
    estimatedHours: 12,
    loggedHours: 0,
    storyPoints: 5,
    dueDate: "2026-10-25",
    createdAt: "2026-10-12T10:00:00Z",
    updatedAt: "2026-10-12T10:00:00Z",
    tags: ["Arquitetura", "Cache", "Redis"],
    subtasks: [
      { id: "sub-801", taskId: "task-8", title: "Configurar cliente ioredis com pool de conex\xF5es", completed: false, assigneeId: "mem-2", estimatedHours: 4, loggedHours: 0 },
      { id: "sub-802", taskId: "task-8", title: "Implementar TTL autom\xE1tico para renova\xE7\xE3o de token", completed: false, assigneeId: "mem-2", estimatedHours: 4, loggedHours: 0 },
      { id: "sub-803", taskId: "task-8", title: "Testes de failover sob queda de n\xF3 prim\xE1rio", completed: false, assigneeId: "mem-2", estimatedHours: 4, loggedHours: 0 }
    ],
    worklogs: [],
    comments: []
  },
  {
    id: "task-9",
    key: "ENG-109",
    boardId: "board-1",
    title: "Exporta\xE7\xE3o de relat\xF3rios de produtividade em CSV e JSON estruturado",
    description: "Permitir que gerentes de projeto fa\xE7am download instant\xE2neo de timesheet consolidada, \xEDndice de velocidade e m\xE9tricas de horas estimadas vs realizadas.",
    issueType: "task",
    priority: "low",
    statusId: "col-backlog",
    assigneeId: "mem-3",
    // Rafael
    reporterId: "mem-4",
    epicId: "epic-2",
    estimatedHours: 6,
    loggedHours: 0,
    storyPoints: 3,
    dueDate: "2026-10-24",
    createdAt: "2026-10-12T14:00:00Z",
    updatedAt: "2026-10-12T14:00:00Z",
    tags: ["Relat\xF3rios", "Exporta\xE7\xE3o", "Produtividade"],
    subtasks: [
      { id: "sub-901", taskId: "task-9", title: "Formatador RFC-4180 de CSV com cabe\xE7alhos amig\xE1veis", completed: false, assigneeId: "mem-3", estimatedHours: 3, loggedHours: 0 },
      { id: "sub-902", taskId: "task-9", title: "Trigger de download client-side via Blob API", completed: false, assigneeId: "mem-3", estimatedHours: 3, loggedHours: 0 }
    ],
    worklogs: [],
    comments: []
  },
  {
    id: "task-10",
    key: "ENG-110",
    boardId: "board-1",
    title: "Falha de renderiza\xE7\xE3o no modal de subtarefas em resolu\xE7\xF5es ultra-wide",
    description: "Ao abrir o modal de detalhes da tarefa em telas superiores a 2560px, o painel lateral de apontamento de horas sofria deslocamento vertical de 24px.",
    issueType: "bug",
    priority: "low",
    statusId: "col-done",
    assigneeId: "mem-3",
    // Rafael
    reporterId: "mem-5",
    epicId: "epic-2",
    estimatedHours: 3,
    loggedHours: 2.5,
    storyPoints: 1,
    dueDate: "2026-10-09",
    createdAt: "2026-10-08T15:00:00Z",
    updatedAt: "2026-10-09T16:00:00Z",
    tags: ["Bug", "CSS", "Responsividade"],
    subtasks: [
      { id: "sub-1001", taskId: "task-10", title: "Adicionar max-w-6xl e mx-auto no wrapper modal", completed: true, assigneeId: "mem-3", estimatedHours: 1.5, loggedHours: 1.5 },
      { id: "sub-1002", taskId: "task-10", title: "Testar em monitor 4K e resolu\xE7\xF5es padr\xE3o", completed: true, assigneeId: "mem-3", estimatedHours: 1.5, loggedHours: 1 }
    ],
    worklogs: [
      { id: "wl-1001", taskId: "task-10", memberId: "mem-3", hours: 2.5, date: "2026-10-09", comment: "Corre\xE7\xE3o de classes de posicionamento e verifica\xE7\xE3o em m\xFAltiplos viewports", createdAt: "2026-10-09T15:45:00Z" }
    ],
    comments: []
  }
];
var INITIAL_INTEGRATIONS = [
  {
    id: "slack",
    name: "Slack",
    enabled: true,
    webhookUrl: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
    channelName: "#sprint-eng-notificacoes",
    notifyOnTaskComplete: true,
    notifyOnWorklog: true,
    notifyOnTaskBlocked: true,
    notifyOnSprintStart: true,
    lastTestedAt: "2026-10-13T08:30:00Z",
    lastTestStatus: "success"
  },
  {
    id: "discord",
    name: "Discord",
    enabled: true,
    webhookUrl: "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwx",
    channelName: "#feed-devs",
    notifyOnTaskComplete: true,
    notifyOnWorklog: false,
    notifyOnTaskBlocked: true,
    notifyOnSprintStart: false,
    lastTestedAt: "2026-10-12T17:10:00Z",
    lastTestStatus: "success"
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    enabled: false,
    webhookUrl: "https://outlook.office.com/webhook/xxxx/IncomingWebhook/yyyy",
    channelName: "Geral - Engenharia",
    notifyOnTaskComplete: true,
    notifyOnWorklog: true,
    notifyOnTaskBlocked: true,
    notifyOnSprintStart: true
  },
  {
    id: "custom",
    name: "Webhook Customizado (API Externa)",
    enabled: false,
    webhookUrl: "https://api.empresa.com.br/v1/eventos-agil",
    channelName: "Servi\xE7o de M\xE9tricas Corporativo",
    notifyOnTaskComplete: true,
    notifyOnWorklog: true,
    notifyOnTaskBlocked: true,
    notifyOnSprintStart: true
  }
];
var INITIAL_ACTIVITY_LOGS = [
  {
    id: "act-1",
    type: "status_change",
    taskId: "task-3",
    taskKey: "ENG-103",
    taskTitle: "Webhook dispatcher com re-tentativa exponencial e assinatura HMAC",
    memberId: "mem-1",
    memberName: "Lucas Santos",
    details: 'Moveu a tarefa de "Code Review / QA" para "Conclu\xEDdo"',
    timestamp: "2026-10-12T16:00:00Z"
  },
  {
    id: "act-2",
    type: "worklog_added",
    taskId: "task-1",
    taskKey: "ENG-101",
    taskTitle: "Implementar autentica\xE7\xE3o de dois fatores (TOTP / Authenticator)",
    memberId: "mem-2",
    memberName: "Juliana Ferreira",
    details: 'Registrou 3.0 horas com nota "Rotas de c\xF3digos de emerg\xEAncia"',
    timestamp: "2026-10-12T15:20:00Z"
  },
  {
    id: "act-3",
    type: "status_change",
    taskId: "task-2",
    taskKey: "ENG-102",
    taskTitle: "Desenvolver componente de visualiza\xE7\xE3o gr\xE1fica de Burnup/Burndown",
    memberId: "mem-3",
    memberName: "Rafael Lima",
    details: 'Moveu a tarefa para "Code Review / QA"',
    timestamp: "2026-10-12T14:45:00Z"
  },
  {
    id: "act-4",
    type: "webhook_dispatched",
    taskId: "task-3",
    taskKey: "ENG-103",
    taskTitle: "Webhook dispatcher com re-tentativa exponencial e assinatura HMAC",
    memberId: "mem-1",
    memberName: "Lucas Santos",
    details: "Disparo de notifica\xE7\xE3o enviado com sucesso para #sprint-eng-notificacoes (Slack)",
    timestamp: "2026-10-12T16:00:02Z"
  },
  {
    id: "act-5",
    type: "subtask_toggled",
    taskId: "task-1",
    taskKey: "ENG-101",
    taskTitle: "Implementar autentica\xE7\xE3o de dois fatores (TOTP / Authenticator)",
    memberId: "mem-2",
    memberName: "Juliana Ferreira",
    details: 'Concluiu a sub-tarefa "Endpoint de valida\xE7\xE3o e ativa\xE7\xE3o com token TOTP"',
    timestamp: "2026-10-12T11:00:00Z"
  }
];
var INITIAL_WEBHOOK_LOGS = [
  {
    id: "wh-1",
    platform: "slack",
    eventType: "task_completed",
    payloadSummary: "[Slack] Tarefa ENG-103 (Webhook dispatcher) movida para Conclu\xEDdo por Lucas Santos",
    status: "delivered",
    timestamp: "2026-10-12T16:00:02Z"
  },
  {
    id: "wh-2",
    platform: "slack",
    eventType: "worklog_logged",
    payloadSummary: "[Slack] Juliana Ferreira registrou 3h em ENG-101. Total acumulado: 12.5h / 16h",
    status: "delivered",
    timestamp: "2026-10-12T15:20:05Z"
  },
  {
    id: "wh-3",
    platform: "discord",
    eventType: "task_completed",
    payloadSummary: "[Discord] Notifica\xE7\xE3o enviada em #feed-devs: ENG-104 finalizada (Rafael Lima)",
    status: "delivered",
    timestamp: "2026-10-11T17:20:10Z"
  }
];
var INITIAL_EMAIL_SETTINGS = {
  enabled: true,
  senderEmail: "notificacoes@brolabs.com.br",
  senderName: "Brolabs Workflow",
  notifyOnStatusChange: true,
  notifyOnMentions: true,
  notifyReporterOnDone: true
};
var INITIAL_EMAIL_NOTIFICATIONS = [
  {
    id: "em-1",
    triggerType: "status_change",
    taskId: "task-3",
    taskKey: "ENG-103",
    taskTitle: "Webhook dispatcher com re-tentativa exponencial e assinatura HMAC",
    recipientEmail: "lucas.santos@techcorp.com.br",
    recipientName: "Lucas Santos",
    senderName: "Lucas Santos",
    subject: '[Brolabs Workflow] Status alterado: ENG-103 para "Conclu\xEDdo"',
    contentPreview: "A tarefa ENG-103 foi movida para Conclu\xEDdo.",
    htmlBody: "<p>Ol\xE1 <strong>Lucas Santos</strong>,</p><p>A tarefa <strong>ENG-103 - Webhook dispatcher</strong> foi movida para o status <strong>Conclu\xEDdo</strong>.</p>",
    status: "delivered",
    timestamp: "2026-10-12T16:00:03Z",
    read: true
  },
  {
    id: "em-2",
    triggerType: "mention",
    taskId: "task-1",
    taskKey: "ENG-101",
    taskTitle: "Implementar autentica\xE7\xE3o de dois fatores (TOTP / Authenticator)",
    recipientEmail: "juliana.ferreira@techcorp.com.br",
    recipientName: "Juliana Ferreira",
    senderName: "Lucas Santos",
    subject: "[Brolabs Workflow] Lucas Santos mencionou voc\xEA na tarefa ENG-101",
    contentPreview: 'Lucas Santos mencionou voc\xEA em um coment\xE1rio: "@Juliana, lembre-se de invalidar os c\xF3digos de recupera\xE7\xE3o..."',
    htmlBody: '<p>Ol\xE1 <strong>Juliana Ferreira</strong>,</p><p><strong>Lucas Santos</strong> mencionou voc\xEA na tarefa <strong>ENG-101</strong>:</p><blockquote>"@Juliana, lembre-se de invalidar os c\xF3digos de recupera\xE7\xE3o uma vez utilizados."</blockquote>',
    status: "delivered",
    timestamp: "2026-10-10T10:15:05Z",
    read: true
  }
];

// src/server/initDb.ts
async function initializeDatabase() {
  console.log("\u{1F504} Initializing NeonDB tables...");
  await query(`
    CREATE TABLE IF NOT EXISTS boards (
      id VARCHAR(100) PRIMARY KEY,
      key VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      sprint_name VARCHAR(255),
      sprint_goal TEXT,
      sprint_start_date VARCHAR(50),
      sprint_end_date VARCHAR(50),
      columns JSONB NOT NULL DEFAULT '[]'::jsonb,
      epics JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS members (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      avatar TEXT,
      role VARCHAR(150),
      department VARCHAR(150),
      weekly_capacity_hours FLOAT DEFAULT 40,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(100) PRIMARY KEY,
      key VARCHAR(50) NOT NULL,
      board_id VARCHAR(100) NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      issue_type VARCHAR(50) NOT NULL,
      priority VARCHAR(50) NOT NULL,
      status_id VARCHAR(100) NOT NULL,
      assignee_id VARCHAR(100),
      reporter_id VARCHAR(100),
      epic_id VARCHAR(100),
      estimated_hours FLOAT DEFAULT 0,
      logged_hours FLOAT DEFAULT 0,
      story_points INT DEFAULT 0,
      due_date VARCHAR(50),
      created_at VARCHAR(50),
      updated_at VARCHAR(50),
      subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
      worklogs JSONB NOT NULL DEFAULT '[]'::jsonb,
      comments JSONB NOT NULL DEFAULT '[]'::jsonb,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      dependencies JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(100) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      task_id VARCHAR(100),
      task_key VARCHAR(50),
      task_title VARCHAR(500),
      member_id VARCHAR(100),
      member_name VARCHAR(255),
      details TEXT,
      timestamp VARCHAR(50) NOT NULL
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS integrations (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      enabled BOOLEAN DEFAULT FALSE,
      webhook_url TEXT,
      channel_name VARCHAR(150),
      notify_on_task_complete BOOLEAN DEFAULT TRUE,
      notify_on_worklog BOOLEAN DEFAULT FALSE,
      notify_on_task_blocked BOOLEAN DEFAULT TRUE,
      notify_on_sprint_start BOOLEAN DEFAULT TRUE,
      last_tested_at VARCHAR(50),
      last_test_status VARCHAR(50)
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id VARCHAR(100) PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      payload_summary TEXT,
      status VARCHAR(50) NOT NULL,
      timestamp VARCHAR(50) NOT NULL
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id VARCHAR(50) PRIMARY KEY,
      enabled BOOLEAN DEFAULT TRUE,
      sender_email VARCHAR(255),
      sender_name VARCHAR(255),
      notify_on_status_change BOOLEAN DEFAULT TRUE,
      notify_on_mentions BOOLEAN DEFAULT TRUE,
      notify_reporter_on_done BOOLEAN DEFAULT TRUE
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS email_notifications (
      id VARCHAR(100) PRIMARY KEY,
      trigger_type VARCHAR(50) NOT NULL,
      task_id VARCHAR(100),
      task_key VARCHAR(50),
      task_title VARCHAR(500),
      recipient_email VARCHAR(255),
      recipient_name VARCHAR(255),
      sender_name VARCHAR(255),
      subject VARCHAR(500),
      content_preview TEXT,
      html_body TEXT,
      status VARCHAR(50) DEFAULT 'sent',
      timestamp VARCHAR(50) NOT NULL,
      read BOOLEAN DEFAULT FALSE
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL
    );
  `);
  console.log("\u2705 NeonDB tables ready.");
  const boardCount = await query("SELECT COUNT(*) FROM boards");
  if (parseInt(boardCount.rows[0].count, 10) === 0) {
    console.log("\u{1F331} Seeding initial real records into NeonDB...");
    await seedDatabase();
    console.log("\u2705 Seed completed successfully in NeonDB.");
  } else {
    console.log(`\u2139\uFE0F NeonDB already contains ${boardCount.rows[0].count} boards. Skipping seed.`);
  }
}
async function seedDatabase() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM boards");
    await client.query("DELETE FROM members");
    await client.query("DELETE FROM tasks");
    await client.query("DELETE FROM activity_logs");
    await client.query("DELETE FROM integrations");
    await client.query("DELETE FROM webhook_logs");
    await client.query("DELETE FROM email_settings");
    await client.query("DELETE FROM email_notifications");
    await client.query("DELETE FROM app_settings");
    for (const b of INITIAL_BOARDS) {
      await client.query(
        `INSERT INTO boards (id, key, name, description, sprint_name, sprint_goal, sprint_start_date, sprint_end_date, columns, epics)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          b.id,
          b.key,
          b.name,
          b.description,
          b.sprintName,
          b.sprintGoal,
          b.sprintStartDate,
          b.sprintEndDate,
          JSON.stringify(b.columns),
          JSON.stringify(b.epics)
        ]
      );
    }
    for (const m of INITIAL_MEMBERS) {
      await client.query(
        `INSERT INTO members (id, name, email, avatar, role, department, weekly_capacity_hours, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [m.id, m.name, m.email, m.avatar, m.role, m.department, m.weeklyCapacityHours, m.active]
      );
    }
    for (const t of INITIAL_TASKS) {
      await client.query(
        `INSERT INTO tasks (
          id, key, board_id, title, description, issue_type, priority, status_id,
          assignee_id, reporter_id, epic_id, estimated_hours, logged_hours, story_points,
          due_date, created_at, updated_at, subtasks, worklogs, comments, tags, dependencies
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22
        )`,
        [
          t.id,
          t.key,
          t.boardId,
          t.title,
          t.description,
          t.issueType,
          t.priority,
          t.statusId,
          t.assigneeId,
          t.reporterId,
          t.epicId || null,
          t.estimatedHours || 0,
          t.loggedHours || 0,
          t.storyPoints || 0,
          t.dueDate,
          t.createdAt,
          t.updatedAt,
          JSON.stringify(t.subtasks || []),
          JSON.stringify(t.worklogs || []),
          JSON.stringify(t.comments || []),
          JSON.stringify(t.tags || []),
          JSON.stringify(t.dependencies || [])
        ]
      );
    }
    for (const a of INITIAL_ACTIVITY_LOGS) {
      await client.query(
        `INSERT INTO activity_logs (id, type, task_id, task_key, task_title, member_id, member_name, details, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [a.id, a.type, a.taskId, a.taskKey, a.taskTitle, a.memberId, a.memberName, a.details, a.timestamp]
      );
    }
    for (const i of INITIAL_INTEGRATIONS) {
      await client.query(
        `INSERT INTO integrations (
          id, name, enabled, webhook_url, channel_name, notify_on_task_complete,
          notify_on_worklog, notify_on_task_blocked, notify_on_sprint_start, last_tested_at, last_test_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          i.id,
          i.name,
          i.enabled,
          i.webhookUrl,
          i.channelName,
          i.notifyOnTaskComplete,
          i.notifyOnWorklog,
          i.notifyOnTaskBlocked,
          i.notifyOnSprintStart,
          i.lastTestedAt || null,
          i.lastTestStatus || null
        ]
      );
    }
    for (const w of INITIAL_WEBHOOK_LOGS) {
      await client.query(
        `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [w.id, w.platform, w.eventType, w.payloadSummary, w.status, w.timestamp]
      );
    }
    await client.query(
      `INSERT INTO email_settings (id, enabled, sender_email, sender_name, notify_on_status_change, notify_on_mentions, notify_reporter_on_done)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        "default",
        INITIAL_EMAIL_SETTINGS.enabled,
        INITIAL_EMAIL_SETTINGS.senderEmail,
        INITIAL_EMAIL_SETTINGS.senderName,
        INITIAL_EMAIL_SETTINGS.notifyOnStatusChange,
        INITIAL_EMAIL_SETTINGS.notifyOnMentions,
        INITIAL_EMAIL_SETTINGS.notifyReporterOnDone
      ]
    );
    for (const e of INITIAL_EMAIL_NOTIFICATIONS) {
      await client.query(
        `INSERT INTO email_notifications (
          id, trigger_type, task_id, task_key, task_title, recipient_email,
          recipient_name, sender_name, subject, content_preview, html_body, status, timestamp, read
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          e.id,
          e.triggerType,
          e.taskId,
          e.taskKey,
          e.taskTitle,
          e.recipientEmail,
          e.recipientName,
          e.senderName,
          e.subject,
          e.contentPreview,
          e.htmlBody,
          e.status,
          e.timestamp,
          e.read
        ]
      );
    }
    await client.query(
      `INSERT INTO app_settings (key, value) VALUES ('current_board_id', $1), ('current_user_id', $2)`,
      [JSON.stringify(INITIAL_BOARDS[0].id), JSON.stringify(INITIAL_MEMBERS[0].id)]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    client.release();
  }
}

// server.ts
dotenv2.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = 3e3;
var isProduction = process.env.NODE_ENV === "production";
var isVercel = Boolean(process.env.VERCEL);
app.use(express.json({ limit: "10mb" }));
var bucketDir = path.resolve(process.cwd(), "public", "bucket");
var avatarsDir = path.resolve(bucketDir, "avatars");
if (!isVercel && !fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
app.use("/bucket", express.static(bucketDir));
var dbReady = null;
if (isVercel) {
  app.use("/api", async (req, res, next) => {
    try {
      dbReady ??= initializeDatabase().catch((err) => {
        dbReady = null;
        throw err;
      });
      await dbReady;
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
function safeJson(val, fallback = []) {
  if (val === null || val === void 0) return fallback;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}
function safeJsonOrRaw(val, fallback = "") {
  if (val === null || val === void 0) return fallback;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}
function mapDbBoard(row) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description || "",
    sprintName: row.sprint_name || "",
    sprintGoal: row.sprint_goal || "",
    sprintStartDate: row.sprint_start_date || "",
    sprintEndDate: row.sprint_end_date || "",
    columns: safeJson(row.columns, []),
    epics: safeJson(row.epics, [])
  };
}
function mapDbMember(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar || "",
    role: row.role || "",
    department: row.department || "",
    weeklyCapacityHours: parseFloat(row.weekly_capacity_hours) || 40,
    active: Boolean(row.active)
  };
}
function mapDbTask(row) {
  return {
    id: row.id,
    key: row.key,
    boardId: row.board_id,
    title: row.title,
    description: row.description || "",
    issueType: row.issue_type,
    priority: row.priority,
    statusId: row.status_id,
    assigneeId: row.assignee_id || "",
    reporterId: row.reporter_id || "",
    epicId: row.epic_id || void 0,
    estimatedHours: parseFloat(row.estimated_hours) || 0,
    loggedHours: parseFloat(row.logged_hours) || 0,
    storyPoints: parseInt(row.story_points, 10) || 0,
    dueDate: row.due_date || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    subtasks: safeJson(row.subtasks, []),
    worklogs: safeJson(row.worklogs, []),
    comments: safeJson(row.comments, []),
    tags: safeJson(row.tags, []),
    dependencies: safeJson(row.dependencies, [])
  };
}
function mapDbActivity(row) {
  return {
    id: row.id,
    type: row.type,
    taskId: row.task_id || "",
    taskKey: row.task_key || "",
    taskTitle: row.task_title || "",
    memberId: row.member_id || "",
    memberName: row.member_name || "",
    details: row.details || "",
    timestamp: row.timestamp
  };
}
function mapDbIntegration(row) {
  return {
    id: row.id,
    name: row.name,
    enabled: Boolean(row.enabled),
    webhookUrl: row.webhook_url || "",
    channelName: row.channel_name || "",
    notifyOnTaskComplete: Boolean(row.notify_on_task_complete),
    notifyOnWorklog: Boolean(row.notify_on_worklog),
    notifyOnTaskBlocked: Boolean(row.notify_on_task_blocked),
    notifyOnSprintStart: Boolean(row.notify_on_sprint_start),
    lastTestedAt: row.last_tested_at || void 0,
    lastTestStatus: row.last_test_status || void 0
  };
}
function mapDbWebhookLog(row) {
  return {
    id: row.id,
    platform: row.platform,
    eventType: row.event_type,
    payloadSummary: row.payload_summary,
    status: row.status,
    timestamp: row.timestamp
  };
}
function mapDbEmailNotification(row) {
  return {
    id: row.id,
    triggerType: row.trigger_type,
    taskId: row.task_id || "",
    taskKey: row.task_key || "",
    taskTitle: row.task_title || "",
    recipientEmail: row.recipient_email || "",
    recipientName: row.recipient_name || "",
    senderName: row.sender_name || "",
    subject: row.subject || "",
    contentPreview: row.content_preview || "",
    htmlBody: row.html_body || "",
    status: row.status || "sent",
    timestamp: row.timestamp,
    read: Boolean(row.read)
  };
}
app.get("/api/health", async (req, res) => {
  try {
    const timeRes = await query("SELECT NOW() as current_time, current_database() as db_name, version()");
    const tablesRes = await query("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public'");
    const tasksCount = await query("SELECT COUNT(*) as count FROM tasks");
    const boardsCount = await query("SELECT COUNT(*) as count FROM boards");
    res.json({
      status: "ok",
      database: "connected",
      provider: "NeonDB PostgreSQL (AWS sa-east-1)",
      serverTime: timeRes.rows[0].current_time,
      databaseName: timeRes.rows[0].db_name,
      pgVersion: timeRes.rows[0].version,
      publicTables: parseInt(tablesRes.rows[0].count, 10),
      totalTasks: parseInt(tasksCount.rows[0].count, 10),
      totalBoards: parseInt(boardsCount.rows[0].count, 10)
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: error.message
    });
  }
});
app.get("/api/initial-state", async (req, res) => {
  try {
    const [boardsRes, membersRes, tasksRes, activitiesRes, integrationsRes, webhooksRes, emailSettingsRes, emailNotificationsRes, appSettingsRes] = await Promise.all([
      query("SELECT * FROM boards ORDER BY created_at ASC"),
      query("SELECT * FROM members ORDER BY name ASC"),
      query("SELECT * FROM tasks ORDER BY created_at DESC"),
      query("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100"),
      query("SELECT * FROM integrations ORDER BY id ASC"),
      query("SELECT * FROM webhook_logs ORDER BY timestamp DESC LIMIT 50"),
      query("SELECT * FROM email_settings LIMIT 1"),
      query("SELECT * FROM email_notifications ORDER BY timestamp DESC LIMIT 50"),
      query("SELECT * FROM app_settings")
    ]);
    const boards = boardsRes.rows.map(mapDbBoard);
    const members = membersRes.rows.map(mapDbMember);
    const tasks = tasksRes.rows.map(mapDbTask);
    const activityLogs = activitiesRes.rows.map(mapDbActivity);
    const integrations = integrationsRes.rows.map(mapDbIntegration);
    const webhookLogs = webhooksRes.rows.map(mapDbWebhookLog);
    const emailNotifications = emailNotificationsRes.rows.map(mapDbEmailNotification);
    let emailSettings = {
      enabled: true,
      senderEmail: "flowpulse-agile@techcorp.com.br",
      senderName: "FlowPulse Notification Hub",
      notifyOnStatusChange: true,
      notifyOnMentions: true,
      notifyReporterOnDone: true
    };
    if (emailSettingsRes.rows.length > 0) {
      const row = emailSettingsRes.rows[0];
      emailSettings = {
        enabled: Boolean(row.enabled),
        senderEmail: row.sender_email,
        senderName: row.sender_name,
        notifyOnStatusChange: Boolean(row.notify_on_status_change),
        notifyOnMentions: Boolean(row.notify_on_mentions),
        notifyReporterOnDone: Boolean(row.notify_reporter_on_done)
      };
    }
    const appSettingsMap = {};
    for (const row of appSettingsRes.rows) {
      appSettingsMap[row.key] = safeJsonOrRaw(row.value);
    }
    const currentBoardId = appSettingsMap["current_board_id"] || (boards[0] ? boards[0].id : "");
    const currentUserId = appSettingsMap["current_user_id"] || (members[0] ? members[0].id : "");
    res.json({
      boards,
      members,
      tasks,
      activityLogs,
      integrations,
      webhookLogs,
      emailSettings,
      emailNotifications,
      currentBoardId,
      currentUserId
    });
  } catch (error) {
    console.error("Error fetching initial state:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/reset-database", async (req, res) => {
  try {
    await seedDatabase();
    res.json({ success: true, message: "Database reset and re-seeded successfully in NeonDB" });
  } catch (error) {
    console.error("Reset database failed:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/app-settings/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/tasks", async (req, res) => {
  try {
    const t = req.body;
    await query(
      `INSERT INTO tasks (
        id, key, board_id, title, description, issue_type, priority, status_id,
        assignee_id, reporter_id, epic_id, estimated_hours, logged_hours, story_points,
        due_date, created_at, updated_at, subtasks, worklogs, comments, tags, dependencies
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22
      )`,
      [
        t.id,
        t.key,
        t.boardId,
        t.title,
        t.description || "",
        t.issueType,
        t.priority,
        t.statusId,
        t.assigneeId || "",
        t.reporterId || "",
        t.epicId || null,
        t.estimatedHours || 0,
        t.loggedHours || 0,
        t.storyPoints || 0,
        t.dueDate || "",
        t.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        t.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
        JSON.stringify(t.subtasks || []),
        JSON.stringify(t.worklogs || []),
        JSON.stringify(t.comments || []),
        JSON.stringify(t.tags || []),
        JSON.stringify(t.dependencies || [])
      ]
    );
    res.status(201).json({ success: true, task: t });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const existingRes = await query("SELECT * FROM tasks WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const current = mapDbTask(existingRes.rows[0]);
    const merged = { ...current, ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await query(
      `UPDATE tasks SET
        key = $1, board_id = $2, title = $3, description = $4, issue_type = $5,
        priority = $6, status_id = $7, assignee_id = $8, reporter_id = $9, epic_id = $10,
        estimated_hours = $11, logged_hours = $12, story_points = $13, due_date = $14,
        updated_at = $15, subtasks = $16, worklogs = $17, comments = $18, tags = $19,
        dependencies = $20
      WHERE id = $21`,
      [
        merged.key,
        merged.boardId,
        merged.title,
        merged.description,
        merged.issueType,
        merged.priority,
        merged.statusId,
        merged.assigneeId,
        merged.reporterId,
        merged.epicId || null,
        merged.estimatedHours,
        merged.loggedHours,
        merged.storyPoints,
        merged.dueDate,
        merged.updatedAt,
        JSON.stringify(merged.subtasks || []),
        JSON.stringify(merged.worklogs || []),
        JSON.stringify(merged.comments || []),
        JSON.stringify(merged.tags || []),
        JSON.stringify(merged.dependencies || []),
        id
      ]
    );
    res.json({ success: true, task: merged });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM tasks WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/boards", async (req, res) => {
  try {
    const b = req.body;
    await query(
      `INSERT INTO boards (id, key, name, description, sprint_name, sprint_goal, sprint_start_date, sprint_end_date, columns, epics)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        b.id,
        b.key,
        b.name,
        b.description || "",
        b.sprintName || "",
        b.sprintGoal || "",
        b.sprintStartDate || "",
        b.sprintEndDate || "",
        JSON.stringify(b.columns || []),
        JSON.stringify(b.epics || [])
      ]
    );
    res.status(201).json({ success: true, board: b });
  } catch (error) {
    console.error("Error creating board:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/boards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const existingRes = await query("SELECT * FROM boards WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Board not found" });
    }
    const current = mapDbBoard(existingRes.rows[0]);
    const merged = { ...current, ...updates };
    await query(
      `UPDATE boards SET
        key = $1, name = $2, description = $3, sprint_name = $4, sprint_goal = $5,
        sprint_start_date = $6, sprint_end_date = $7, columns = $8, epics = $9,
        updated_at = NOW()
      WHERE id = $10`,
      [
        merged.key,
        merged.name,
        merged.description,
        merged.sprintName,
        merged.sprintGoal,
        merged.sprintStartDate,
        merged.sprintEndDate,
        JSON.stringify(merged.columns || []),
        JSON.stringify(merged.epics || []),
        id
      ]
    );
    res.json({ success: true, board: merged });
  } catch (error) {
    console.error("Error updating board:", error);
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/boards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM tasks WHERE board_id = $1", [id]);
    await query("DELETE FROM boards WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting board:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/members", async (req, res) => {
  try {
    const m = req.body;
    await query(
      `INSERT INTO members (id, name, email, avatar, role, department, weekly_capacity_hours, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [m.id, m.name, m.email, m.avatar || "", m.role || "", m.department || "", m.weeklyCapacityHours || 40, m.active !== false]
    );
    res.status(201).json({ success: true, member: m });
  } catch (error) {
    console.error("Error creating member:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/members/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const existingRes = await query("SELECT * FROM members WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }
    const current = mapDbMember(existingRes.rows[0]);
    const merged = { ...current, ...updates };
    await query(
      `UPDATE members SET
        name = $1, email = $2, avatar = $3, role = $4, department = $5,
        weekly_capacity_hours = $6, active = $7
      WHERE id = $8`,
      [merged.name, merged.email, merged.avatar, merged.role, merged.department, merged.weeklyCapacityHours, merged.active, id]
    );
    res.json({ success: true, member: merged });
  } catch (error) {
    console.error("Error updating member:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/bucket/avatars", (req, res) => {
  try {
    if (!fs.existsSync(avatarsDir)) {
      return res.json({ files: [] });
    }
    const files = fs.readdirSync(avatarsDir).filter((f) => /\.(png|jpe?g|svg|webp|gif)$/i.test(f));
    const list = files.map((filename) => ({
      filename,
      url: `/bucket/avatars/${filename}`
    }));
    res.json({ files: list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/bucket/upload", async (req, res) => {
  try {
    const { memberId, filename, imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 \xE9 obrigat\xF3rio" });
    }
    let ext = "png";
    let base64Data = imageBase64;
    if (imageBase64.includes(";base64,")) {
      const parts = imageBase64.split(";base64,");
      const mimeMatch = parts[0].match(/:(.*?)$/);
      if (mimeMatch) {
        const mime = mimeMatch[1];
        if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
        else if (mime.includes("svg")) ext = "svg";
        else if (mime.includes("webp")) ext = "webp";
        else if (mime.includes("gif")) ext = "gif";
        else ext = "png";
      }
      base64Data = parts[1];
    }
    const cleanMemberId = (memberId || "upload").replace(/[^a-zA-Z0-9_-]/g, "_");
    const finalFilename = `${cleanMemberId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(base64Data, "base64");
    let publicUrl;
    if (isVercel) {
      const mimeType = ext === "jpg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
      publicUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    } else {
      fs.writeFileSync(path.resolve(avatarsDir, finalFilename), buffer);
      publicUrl = `/bucket/avatars/${finalFilename}`;
    }
    if (memberId) {
      await query("UPDATE members SET avatar = $1 WHERE id = $2", [publicUrl, memberId]);
    }
    res.json({
      success: true,
      url: publicUrl,
      filename: finalFilename,
      sizeBytes: buffer.length
    });
  } catch (error) {
    console.error("Error uploading to bucket:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/activities", async (req, res) => {
  try {
    const a = req.body;
    await query(
      `INSERT INTO activity_logs (id, type, task_id, task_key, task_title, member_id, member_name, details, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [a.id, a.type, a.taskId || "", a.taskKey || "", a.taskTitle || "", a.memberId || "", a.memberName || "", a.details || "", a.timestamp]
    );
    res.status(201).json({ success: true, activity: a });
  } catch (error) {
    console.error("Error saving activity:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/integrations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const existingRes = await query("SELECT * FROM integrations WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Integration not found" });
    }
    const current = mapDbIntegration(existingRes.rows[0]);
    const merged = { ...current, ...updates };
    await query(
      `UPDATE integrations SET
        name = $1, enabled = $2, webhook_url = $3, channel_name = $4,
        notify_on_task_complete = $5, notify_on_worklog = $6, notify_on_task_blocked = $7,
        notify_on_sprint_start = $8, last_tested_at = $9, last_test_status = $10
      WHERE id = $11`,
      [
        merged.name,
        merged.enabled,
        merged.webhookUrl,
        merged.channelName,
        merged.notifyOnTaskComplete,
        merged.notifyOnWorklog,
        merged.notifyOnTaskBlocked,
        merged.notifyOnSprintStart,
        merged.lastTestedAt || null,
        merged.lastTestStatus || null,
        id
      ]
    );
    res.json({ success: true, integration: merged });
  } catch (error) {
    console.error("Error updating integration:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/webhooks", async (req, res) => {
  try {
    const w = req.body;
    await query(
      `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [w.id, w.platform, w.eventType, w.payloadSummary, w.status, w.timestamp]
    );
    res.status(201).json({ success: true, webhookLog: w });
  } catch (error) {
    console.error("Error creating webhook log:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/email/settings", async (req, res) => {
  try {
    const updates = req.body;
    await query(
      `INSERT INTO email_settings (id, enabled, sender_email, sender_name, notify_on_status_change, notify_on_mentions, notify_reporter_on_done)
       VALUES ('default', $1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         sender_email = EXCLUDED.sender_email,
         sender_name = EXCLUDED.sender_name,
         notify_on_status_change = EXCLUDED.notify_on_status_change,
         notify_on_mentions = EXCLUDED.notify_on_mentions,
         notify_reporter_on_done = EXCLUDED.notify_reporter_on_done`,
      [
        Boolean(updates.enabled),
        updates.senderEmail || "",
        updates.senderName || "",
        Boolean(updates.notifyOnStatusChange),
        Boolean(updates.notifyOnMentions),
        Boolean(updates.notifyReporterOnDone)
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating email settings:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/email/notifications", async (req, res) => {
  try {
    const e = req.body;
    await query(
      `INSERT INTO email_notifications (
        id, trigger_type, task_id, task_key, task_title, recipient_email,
        recipient_name, sender_name, subject, content_preview, html_body, status, timestamp, read
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        e.id,
        e.triggerType,
        e.taskId || "",
        e.taskKey || "",
        e.taskTitle || "",
        e.recipientEmail || "",
        e.recipientName || "",
        e.senderName || "",
        e.subject || "",
        e.contentPreview || "",
        e.htmlBody || "",
        e.status || "sent",
        e.timestamp,
        Boolean(e.read)
      ]
    );
    res.status(201).json({ success: true, emailNotification: e });
  } catch (error) {
    console.error("Error creating email notification:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/email/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    await query("UPDATE email_notifications SET read = TRUE WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/email/notifications/read-all", async (req, res) => {
  try {
    await query("UPDATE email_notifications SET read = TRUE");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/email/notifications", async (req, res) => {
  try {
    await query("DELETE FROM email_notifications");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
async function startServer() {
  try {
    await initializeDatabase();
    if (!isProduction) {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
      console.log("\u26A1 Vite development middlewares mounted");
    } else {
      const distPath = path.resolve(__dirname, "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
      console.log(`\u{1F4E6} Serving production build from ${distPath}`);
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\u{1F680} Server running on http://0.0.0.0:${PORT}`);
      console.log(`\u{1F4E1} Connected to NeonDB: sa-east-1`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}
if (!isVercel) {
  startServer();
}
var server_default = app;

// api/_entry.ts
var entry_default = server_default;
export {
  entry_default as default
};
