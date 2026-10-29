// server.ts
import express from "express";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import fs2 from "fs";
import crypto3 from "crypto";
import dotenv2 from "dotenv";
import cookieParser from "cookie-parser";

// src/server/db.ts
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
var DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL n\xE3o definida. Copie .env.example para .env e configure o banco (NeonDB)."
  );
}
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

// src/utils/taskAssignees.ts
function normalizeAssigneeIds(input, fallback = []) {
  const base = Array.isArray(input) ? input : fallback;
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const value of base) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
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
    active: true,
    passwordHash: "$2a$12$aJlOVNw1E1GbhxlXMc1lx..mmUgs3Yo5X2vni1uhH5iDFK5r37H2."
  },
  {
    id: "mem-2",
    name: "Juliana Ferreira",
    email: "juliana.ferreira@techcorp.com.br",
    avatar: "/bucket/avatars/juliana-ferreira.svg",
    role: "Engenheira Full Stack S\xEAnior",
    department: "Engenharia",
    weeklyCapacityHours: 40,
    active: true,
    passwordHash: "$2a$12$aJlOVNw1E1GbhxlXMc1lx..mmUgs3Yo5X2vni1uhH5iDFK5r37H2."
  },
  {
    id: "mem-3",
    name: "Rafael Lima",
    email: "rafael.lima@techcorp.com.br",
    avatar: "/bucket/avatars/rafael-lima.svg",
    role: "Engenheiro Frontend Pleno",
    department: "Engenharia",
    weeklyCapacityHours: 40,
    active: true,
    passwordHash: "$2a$12$aJlOVNw1E1GbhxlXMc1lx..mmUgs3Yo5X2vni1uhH5iDFK5r37H2."
  },
  {
    id: "mem-4",
    name: "Camila Duarte",
    email: "camila.duarte@techcorp.com.br",
    avatar: "/bucket/avatars/camila-duarte.svg",
    role: "Product Designer UX/UI",
    department: "Produto",
    weeklyCapacityHours: 40,
    active: true,
    passwordHash: "$2a$12$aJlOVNw1E1GbhxlXMc1lx..mmUgs3Yo5X2vni1uhH5iDFK5r37H2."
  },
  {
    id: "mem-5",
    name: "Matheus Rocha",
    email: "matheus.rocha@techcorp.com.br",
    avatar: "/bucket/avatars/matheus-rocha.svg",
    role: "DevOps & QA Engineer",
    department: "Infraestrutura",
    weeklyCapacityHours: 40,
    active: true,
    passwordHash: "$2a$12$aJlOVNw1E1GbhxlXMc1lx..mmUgs3Yo5X2vni1uhH5iDFK5r37H2."
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
      { id: "col-done", title: "Conclu\xEDdo", order: 4, accentColor: "#10b981", isDone: true }
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
      { id: "col-done", title: "Conclu\xEDdo", order: 4, accentColor: "#10b981", isDone: true }
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
    assigneeIds: ["mem-2"],
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
      { id: "sub-1", taskId: "task-1", title: "Modelar tabela de segredos MFA criptografados", completed: true, assigneeId: "mem-2", assigneeIds: ["mem-2"], estimatedHours: 3, loggedHours: 3 },
      { id: "sub-2", taskId: "task-1", title: "Endpoint para gerar seed e QR Code base64", completed: true, assigneeId: "mem-2", assigneeIds: ["mem-2"], estimatedHours: 4, loggedHours: 4.5 },
      { id: "sub-3", taskId: "task-1", title: "Endpoint de valida\xE7\xE3o e ativa\xE7\xE3o com token TOTP", completed: true, assigneeId: "mem-2", assigneeIds: ["mem-2"], estimatedHours: 3, loggedHours: 3 },
      { id: "sub-4", taskId: "task-1", title: "Gera\xE7\xE3o e download de 10 c\xF3digos de backup descart\xE1veis", completed: false, assigneeId: "mem-2", assigneeIds: ["mem-2"], estimatedHours: 3, loggedHours: 2 },
      { id: "sub-5", taskId: "task-1", title: "Testes unit\xE1rios e de integra\xE7\xE3o de expira\xE7\xE3o de token", completed: false, assigneeId: "mem-5", assigneeIds: ["mem-5"], estimatedHours: 3, loggedHours: 0 }
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
    assigneeIds: ["mem-3"],
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
      { id: "sub-201", taskId: "task-2", title: "C\xE1lculo de regress\xE3o linear para linha ideal", completed: true, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 3, loggedHours: 2.5 },
      { id: "sub-202", taskId: "task-2", title: "Renderiza\xE7\xE3o de caminhos SVG e pontos interativos", completed: true, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 5, loggedHours: 5.5 },
      { id: "sub-203", taskId: "task-2", title: "Tooltip com detalhes de horas no hover", completed: true, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 2, loggedHours: 2 },
      { id: "sub-204", taskId: "task-2", title: "Valida\xE7\xE3o de acessibilidade e cores WCAG", completed: true, assigneeId: "mem-4", assigneeIds: ["mem-4"], estimatedHours: 2, loggedHours: 1 }
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
    assigneeIds: ["mem-1"],
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
      { id: "sub-301", taskId: "task-3", title: "Assinatura HMAC SHA-256 no header x-flowpulse-signature", completed: true, assigneeId: "mem-1", assigneeIds: ["mem-1"], estimatedHours: 3, loggedHours: 3 },
      { id: "sub-302", taskId: "task-3", title: "Formatador de templates para Slack Block Kit", completed: true, assigneeId: "mem-1", assigneeIds: ["mem-1"], estimatedHours: 4, loggedHours: 3.5 },
      { id: "sub-303", taskId: "task-3", title: "Formatador de templates para Discord e Teams", completed: true, assigneeId: "mem-1", assigneeIds: ["mem-1"], estimatedHours: 4, loggedHours: 4 },
      { id: "sub-304", taskId: "task-3", title: "Tratamento de status HTTP 429 (Rate Limit)", completed: true, assigneeId: "mem-1", assigneeIds: ["mem-1"], estimatedHours: 3, loggedHours: 2.5 }
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
    assigneeIds: ["mem-3"],
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
      { id: "sub-401", taskId: "task-4", title: "Identificar uso de Math.floor na convers\xE3o de minutos", completed: true, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 1, loggedHours: 1.5 },
      { id: "sub-402", taskId: "task-4", title: "Normalizar n\xFAmeros para ponto flutuante com toFixed(1)", completed: true, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 1.5, loggedHours: 2 },
      { id: "sub-403", taskId: "task-4", title: "Adicionar testes de cobertura para 0.25h, 0.5h e 0.75h", completed: true, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 1.5, loggedHours: 2 }
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
    assigneeIds: ["mem-4"],
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
      { id: "sub-501", taskId: "task-5", title: "Benchmarking de ferramentas de aloca\xE7\xE3o de squads", completed: true, assigneeId: "mem-4", assigneeIds: ["mem-4"], estimatedHours: 2, loggedHours: 2 },
      { id: "sub-502", taskId: "task-5", title: "Defini\xE7\xE3o de hierarquia visual e escala de cinzas de alta legibilidade", completed: true, assigneeId: "mem-4", assigneeIds: ["mem-4"], estimatedHours: 3, loggedHours: 3 },
      { id: "sub-503", taskId: "task-5", title: "Componentes de cards de membros com barras de progresso", completed: false, assigneeId: "mem-4", assigneeIds: ["mem-4"], estimatedHours: 3, loggedHours: 2 },
      { id: "sub-504", taskId: "task-5", title: "Fluxo de filtros r\xE1pidos por departamento e cargo", completed: false, assigneeId: "mem-4", assigneeIds: ["mem-4"], estimatedHours: 2, loggedHours: 0 }
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
    assigneeIds: ["mem-5"],
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
      { id: "sub-601", taskId: "task-6", title: "Analisar plano de execu\xE7\xE3o com EXPLAIN ANALYZE", completed: false, assigneeId: "mem-5", assigneeIds: ["mem-5"], estimatedHours: 2, loggedHours: 0 },
      { id: "sub-602", taskId: "task-6", title: "Adicionar \xEDndices btree em colunas de agrega\xE7\xE3o", completed: false, assigneeId: "mem-5", assigneeIds: ["mem-5"], estimatedHours: 3, loggedHours: 0 },
      { id: "sub-603", taskId: "task-6", title: "Benchmark com carga de 50.000 tarefas simuladas", completed: false, assigneeId: "mem-5", assigneeIds: ["mem-5"], estimatedHours: 3, loggedHours: 0 }
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
    assigneeIds: ["mem-5"],
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
      { id: "sub-701", taskId: "task-7", title: "Workflow do GitHub Actions para npm audit", completed: true, assigneeId: "mem-5", assigneeIds: ["mem-5"], estimatedHours: 2, loggedHours: 1 },
      { id: "sub-702", taskId: "task-7", title: "Configurar thresholds de cobertura m\xEDnima (80%)", completed: false, assigneeId: "mem-5", assigneeIds: ["mem-5"], estimatedHours: 2, loggedHours: 0 },
      { id: "sub-703", taskId: "task-7", title: "Publica\xE7\xE3o de badges de qualidade no README", completed: false, assigneeId: "mem-5", assigneeIds: ["mem-5"], estimatedHours: 2, loggedHours: 0 }
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
    assigneeIds: ["mem-2"],
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
      { id: "sub-801", taskId: "task-8", title: "Configurar cliente ioredis com pool de conex\xF5es", completed: false, assigneeId: "mem-2", assigneeIds: ["mem-2"], estimatedHours: 4, loggedHours: 0 },
      { id: "sub-802", taskId: "task-8", title: "Implementar TTL autom\xE1tico para renova\xE7\xE3o de token", completed: false, assigneeId: "mem-2", assigneeIds: ["mem-2"], estimatedHours: 4, loggedHours: 0 },
      { id: "sub-803", taskId: "task-8", title: "Testes de failover sob queda de n\xF3 prim\xE1rio", completed: false, assigneeId: "mem-2", assigneeIds: ["mem-2"], estimatedHours: 4, loggedHours: 0 }
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
    assigneeIds: ["mem-3"],
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
      { id: "sub-901", taskId: "task-9", title: "Formatador RFC-4180 de CSV com cabe\xE7alhos amig\xE1veis", completed: false, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 3, loggedHours: 0 },
      { id: "sub-902", taskId: "task-9", title: "Trigger de download client-side via Blob API", completed: false, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 3, loggedHours: 0 }
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
    assigneeIds: ["mem-3"],
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
      { id: "sub-1001", taskId: "task-10", title: "Adicionar max-w-6xl e mx-auto no wrapper modal", completed: true, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 1.5, loggedHours: 1.5 },
      { id: "sub-1002", taskId: "task-10", title: "Testar em monitor 4K e resolu\xE7\xF5es padr\xE3o", completed: true, assigneeId: "mem-3", assigneeIds: ["mem-3"], estimatedHours: 1.5, loggedHours: 1 }
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
    status: "simulated",
    timestamp: "2026-10-12T16:00:02Z"
  },
  {
    id: "wh-2",
    platform: "slack",
    eventType: "worklog_logged",
    payloadSummary: "[Slack] Juliana Ferreira registrou 3h em ENG-101. Total acumulado: 12.5h / 16h",
    status: "simulated",
    timestamp: "2026-10-12T15:20:05Z"
  },
  {
    id: "wh-3",
    platform: "discord",
    eventType: "task_completed",
    payloadSummary: "[Discord] Notifica\xE7\xE3o enviada em #feed-devs: ENG-104 finalizada (Rafael Lima)",
    status: "simulated",
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
      email VARCHAR(255) NOT NULL UNIQUE,
      avatar TEXT,
      role VARCHAR(150),
      department VARCHAR(150),
      weekly_capacity_hours FLOAT DEFAULT 40,
      active BOOLEAN DEFAULT TRUE,
      password_hash VARCHAR(255),
      email_verified BOOLEAN DEFAULT FALSE,
      last_login_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(100) PRIMARY KEY,
      member_id VARCHAR(100) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
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
  await query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
  await query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE`);
  const defaultHash = "$2a$12$aJlOVNw1E1GbhxlXMc1lx..mmUgs3Yo5X2vni1uhH5iDFK5r37H2.";
  await query(`UPDATE members SET password_hash = $1 WHERE password_hash IS NULL`, [defaultHash]);
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
  const client2 = await pool.connect();
  try {
    await client2.query("BEGIN");
    await client2.query("DELETE FROM boards");
    await client2.query("DELETE FROM members");
    await client2.query("DELETE FROM tasks");
    await client2.query("DELETE FROM activity_logs");
    await client2.query("DELETE FROM integrations");
    await client2.query("DELETE FROM webhook_logs");
    await client2.query("DELETE FROM email_settings");
    await client2.query("DELETE FROM email_notifications");
    await client2.query("DELETE FROM app_settings");
    for (const b of INITIAL_BOARDS) {
      await client2.query(
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
      await client2.query(
        `INSERT INTO members (id, name, email, avatar, role, department, weekly_capacity_hours, active, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [m.id, m.name, m.email, m.avatar, m.role, m.department, m.weeklyCapacityHours, m.active, m.passwordHash || null]
      );
    }
    for (const t of INITIAL_TASKS) {
      await client2.query(
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
      await client2.query(
        `INSERT INTO activity_logs (id, type, task_id, task_key, task_title, member_id, member_name, details, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [a.id, a.type, a.taskId, a.taskKey, a.taskTitle, a.memberId, a.memberName, a.details, a.timestamp]
      );
    }
    for (const i of INITIAL_INTEGRATIONS) {
      await client2.query(
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
      await client2.query(
        `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [w.id, w.platform, w.eventType, w.payloadSummary, w.status, w.timestamp]
      );
    }
    await client2.query(
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
      await client2.query(
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
    await client2.query(
      `INSERT INTO app_settings (key, value) VALUES ('current_board_id', $1), ('current_user_id', $2)`,
      [JSON.stringify(INITIAL_BOARDS[0].id), JSON.stringify(INITIAL_MEMBERS[0].id)]
    );
    await client2.query("COMMIT");
  } catch (error) {
    await client2.query("ROLLBACK");
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    client2.release();
  }
}

// src/server/auth.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} n\xE3o definida. Copie .env.example para .env e configure.`
    );
  }
  return value;
}
var JWT_SECRET = requireEnv("JWT_SECRET");
var JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
var SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}
async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}
function generateToken(memberId) {
  return jwt.sign({ memberId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch {
    return null;
  }
}
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  const tokenFromCookie = req.cookies?.token;
  const token = tokenFromHeader || tokenFromCookie;
  if (!token) {
    return res.status(401).json({ error: "N\xE3o autenticado. Token ausente." });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(403).json({ error: "Token inv\xE1lido ou expirado." });
  }
  req.memberId = payload.memberId;
  next();
}
async function findMemberByEmail(email) {
  const res = await query("SELECT * FROM members WHERE email = $1", [email]);
  return res.rows.length > 0 ? res.rows[0] : null;
}
async function findMemberById(memberId) {
  const res = await query("SELECT * FROM members WHERE id = $1", [memberId]);
  return res.rows.length > 0 ? res.rows[0] : null;
}
async function updateLastLogin(memberId) {
  await query(
    "UPDATE members SET last_login_at = NOW() WHERE id = $1",
    [memberId]
  );
}

// src/server/validation.ts
import { z } from "zod";
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join(".") || "(body)",
        message: i.message
      }));
      return res.status(400).json({ error: "Dados inv\xE1lidos", details });
    }
    req.body = result.data;
    next();
  };
}
var idSchema = z.string().min(1).max(100);
var emailSchema = z.string().trim().toLowerCase().email().max(255);
var loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200)
});
var registerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  password: z.string().min(6).max(200),
  role: z.string().max(150).optional(),
  department: z.string().max(150).optional(),
  weeklyCapacityHours: z.number().min(0).max(168).optional()
});
var resetDatabaseSchema = z.object({
  confirm: z.literal("RESET")
});
var appSettingSchema = z.object({
  value: z.unknown()
});
var memberCreateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  avatar: z.string().max(1e4).optional(),
  role: z.string().max(150).optional(),
  department: z.string().max(150).optional(),
  weeklyCapacityHours: z.number().min(0).max(168).optional(),
  active: z.boolean().optional()
});
var memberUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  email: emailSchema.optional(),
  avatar: z.string().max(1e4).optional(),
  role: z.string().max(150).optional(),
  department: z.string().max(150).optional(),
  weeklyCapacityHours: z.number().min(0).max(168).optional(),
  active: z.boolean().optional()
}).passthrough();
var columnSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(100),
  order: z.number().int().min(0),
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
  accentColor: z.string().max(50).optional()
});
var epicSchema = z.object({
  id: idSchema,
  key: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(255),
  color: z.string().max(50).optional(),
  description: z.string().max(5e3).optional()
});
var boardCreateSchema = z.object({
  id: idSchema,
  key: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(5e3).optional(),
  sprintName: z.string().max(255).optional(),
  sprintGoal: z.string().max(5e3).optional(),
  sprintStartDate: z.string().max(50).optional(),
  sprintEndDate: z.string().max(50).optional(),
  columns: z.array(columnSchema).max(30).optional(),
  epics: z.array(epicSchema).max(100).optional()
});
var boardUpdateSchema = boardCreateSchema.partial().passthrough();
var columnCreateSchema = z.object({
  title: z.string().trim().min(1).max(100),
  accentColor: z.string().max(50).optional(),
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
  isDone: z.boolean().optional(),
  version: z.number().int().min(1)
});
var columnUpdateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  accentColor: z.string().max(50).optional(),
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
  isDone: z.boolean().optional(),
  version: z.number().int().min(1)
}).refine((v) => Object.keys(v).some((k) => k !== "version"), {
  message: "Nada para atualizar"
});
var columnReorderSchema = z.object({
  order: z.array(z.string().min(1).max(100)).min(1).max(30),
  version: z.number().int().min(1)
});
var taskCreateSchema = z.object({
  id: idSchema,
  key: z.string().trim().min(1).max(50),
  boardId: idSchema,
  title: z.string().trim().min(1).max(500),
  issueType: z.string().min(1).max(50),
  priority: z.string().min(1).max(50),
  statusId: z.string().min(1).max(100),
  assigneeIds: z.array(z.string().min(1).max(100)).max(100).optional(),
  parentId: z.string().trim().min(1).max(100).nullable().optional()
}).passthrough();
var taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  statusId: z.string().min(1).max(100).optional(),
  assigneeIds: z.array(z.string().min(1).max(100)).max(100).optional(),
  parentId: z.string().trim().min(1).max(100).nullable().optional()
}).passthrough();
var integrationUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  webhookUrl: z.union([z.string().trim().max(2048), z.literal("")]).optional(),
  channelName: z.string().trim().max(150).optional(),
  notifyOnTaskComplete: z.boolean().optional(),
  notifyOnWorklog: z.boolean().optional(),
  notifyOnTaskBlocked: z.boolean().optional(),
  notifyOnSprintStart: z.boolean().optional(),
  notifyOnMention: z.boolean().optional(),
  notifyOnAssignment: z.boolean().optional(),
  memberHandles: z.record(z.string().max(100), z.string().max(100)).optional()
}).passthrough();
var emailSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  senderEmail: z.string().max(255).optional(),
  senderName: z.string().max(255).optional(),
  notifyOnStatusChange: z.boolean().optional(),
  notifyOnMentions: z.boolean().optional(),
  notifyReporterOnDone: z.boolean().optional()
}).passthrough();
var emailTestSchema = z.object({
  to: emailSchema
});
var memberPreferencesSchema = z.object({
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  soundEvent: z.enum(["none", "soft", "digital"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional()
}).refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });
var attachmentUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().min(1)
});
var attachmentConfirmSchema = z.object({
  attachmentId: z.string().trim().min(1).max(100),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().min(1)
});
var boardRoleSchema = z.enum(["owner", "editor", "viewer"]);
var permissionsOverrideSchema = z.record(z.boolean());
var boardMemberInviteSchema = z.object({
  email: emailSchema,
  role: boardRoleSchema.optional(),
  permissions: permissionsOverrideSchema.optional()
});
var boardMemberPatchSchema = z.object({
  role: boardRoleSchema.optional(),
  permissions: permissionsOverrideSchema.optional()
}).refine((v) => v.role !== void 0 || v.permissions !== void 0, {
  message: "Informe role ou permissions"
});
var isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inv\xE1lida (use YYYY-MM-DD)").refine((v) => {
  const t = (/* @__PURE__ */ new Date(`${v}T00:00:00Z`)).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  const twoYears = 366 * 24 * 60 * 60 * 1e3 * 2;
  return t >= now - twoYears && t <= now + twoYears;
}, "Data fora do intervalo razo\xE1vel (\xB12 anos)");
var todoCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueDate: isoDate.optional(),
  boardId: idSchema.optional(),
  sourceTaskId: idSchema.optional()
});
var todoUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  done: z.boolean().optional(),
  dueDate: isoDate.optional(),
  position: z.number().int().min(0).max(1e4).optional()
}).refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });
var todoListQuerySchema = z.object({
  date: isoDate.optional()
});
var noteCreateSchema = z.object({
  boardId: idSchema,
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().max(5e4).optional()
});
var noteUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().max(5e4).optional(),
  pinned: z.boolean().optional()
}).refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });
var noteAiSchema = z.object({
  action: z.enum(["summarize", "expand", "action_items"])
});
var noteFromSprintSchema = z.object({
  boardId: idSchema
});
var shareCreateSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional()
});
var tagNameSchema = z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(60));
var tagColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inv\xE1lida (use #RRGGBB)");
var tagCreateSchema = z.object({
  name: tagNameSchema,
  color: tagColorSchema.optional()
});
var tagUpdateSchema = z.object({
  name: tagNameSchema.optional(),
  color: tagColorSchema.optional()
}).refine((v) => v.name !== void 0 || v.color !== void 0, {
  message: "Informe name ou color"
});

// src/server/permissions.ts
var ALL_FLAGS = [
  "canCreateTask",
  "canEditTask",
  "canChangeStatus",
  "canAddComment",
  "canLogWork",
  "canInviteMember",
  "canManageMembers",
  "canManageBoard",
  "canDeleteTask"
];
var OWNER_FLAGS = {
  canCreateTask: true,
  canEditTask: true,
  canChangeStatus: true,
  canAddComment: true,
  canLogWork: true,
  canInviteMember: true,
  canManageMembers: true,
  canManageBoard: true,
  canDeleteTask: true
};
var EDITOR_FLAGS = {
  canCreateTask: true,
  canEditTask: true,
  canChangeStatus: true,
  canAddComment: true,
  canLogWork: true,
  canInviteMember: false,
  canManageMembers: false,
  canManageBoard: false,
  canDeleteTask: false
};
var VIEWER_FLAGS = {
  canCreateTask: false,
  canEditTask: false,
  canChangeStatus: false,
  canAddComment: false,
  canLogWork: false,
  canInviteMember: false,
  canManageMembers: false,
  canManageBoard: false,
  canDeleteTask: false
};
var ROLE_FLAGS = {
  owner: OWNER_FLAGS,
  editor: EDITOR_FLAGS,
  viewer: VIEWER_FLAGS
};
function safeJson(val) {
  if (!val) return {};
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}
async function resolvePermissions(memberId, boardId) {
  const memberRes = await query("SELECT system_role FROM members WHERE id = $1", [memberId]);
  const systemRole = memberRes.rows[0]?.system_role;
  if (systemRole === "admin") {
    return { ...OWNER_FLAGS, role: "owner", isAdmin: true, hasBoardAccess: true };
  }
  const bm = await query(
    "SELECT role, permissions FROM board_members WHERE board_id = $1 AND member_id = $2",
    [boardId, memberId]
  );
  if (bm.rows.length === 0) return null;
  const role = bm.rows[0].role || "viewer";
  const base = ROLE_FLAGS[role] ?? VIEWER_FLAGS;
  const overrides = safeJson(bm.rows[0].permissions);
  const eff = { ...base };
  for (const flag of ALL_FLAGS) {
    if (typeof overrides[flag] === "boolean") eff[flag] = overrides[flag];
  }
  return { ...eff, role, isAdmin: false, hasBoardAccess: true };
}
function extractBoardId(req) {
  return req.params?.boardId || req.params?.id || req.body?.boardId || req.query?.boardId || void 0;
}
function requireBoardPermission(flag) {
  return async (req, res, next) => {
    try {
      const boardId = extractBoardId(req);
      if (!boardId) {
        return res.status(400).json({ error: "board_id ausente na requisi\xE7\xE3o" });
      }
      if (req.boardPermissions?.hasBoardAccess) {
        if (!req.boardPermissions[flag]) {
          return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: flag });
        }
        return next();
      }
      const eff = await resolvePermissions(req.memberId, boardId);
      if (!eff) {
        return res.status(403).json({ error: "Sem acesso a este quadro" });
      }
      req.boardPermissions = eff;
      if (!eff[flag]) {
        return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: flag });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
function requireBoardAccess() {
  return async (req, res, next) => {
    try {
      const boardId = extractBoardId(req);
      if (!boardId) {
        return res.status(400).json({ error: "board_id ausente na requisi\xE7\xE3o" });
      }
      if (req.boardPermissions?.hasBoardAccess) return next();
      const eff = await resolvePermissions(req.memberId, boardId);
      if (!eff) {
        return res.status(403).json({ error: "Sem acesso a este quadro" });
      }
      req.boardPermissions = eff;
      next();
    } catch (err) {
      next(err);
    }
  };
}
function requireAdmin() {
  return async (req, res, next) => {
    try {
      const memberRes = await query("SELECT system_role FROM members WHERE id = $1", [req.memberId]);
      if (memberRes.rows[0]?.system_role !== "admin") {
        return res.status(403).json({ error: "Requer perfil administrador" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// src/server/storage.ts
import { createClient } from "@supabase/supabase-js";
var client = null;
function getStorage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
function storageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "task-attachments";
}
var ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
var ATTACHMENT_MAX_PER_TASK = 20;
var SIGNED_GET_TTL_SEC = 900;
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "pdf",
  "csv",
  "txt",
  "zip",
  "md",
  "doc",
  "docx",
  "xls",
  "xlsx"
]);
function extensionOf(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx + 1).toLowerCase();
}
function isAllowedExtension(filename) {
  return ALLOWED_EXTENSIONS.has(extensionOf(filename));
}
async function statObject(path3) {
  const supabase = getStorage();
  if (!supabase) return null;
  const dir = path3.includes("/") ? path3.slice(0, path3.lastIndexOf("/")) : "";
  const base = path3.slice(path3.lastIndexOf("/") + 1);
  const { data, error } = await supabase.storage.from(storageBucket()).list(dir, {
    search: base,
    limit: 100
  });
  if (error || !data) return null;
  const found = data.find((f) => f.name === base);
  if (!found) return null;
  return {
    size: found.metadata?.size ?? 0,
    mimetype: found.metadata?.mimetype ?? "application/octet-stream"
  };
}
async function removeObject(path3) {
  const supabase = getStorage();
  if (!supabase) return false;
  const { error } = await supabase.storage.from(storageBucket()).remove([path3]);
  return !error;
}
async function listObjects(dir) {
  const supabase = getStorage();
  if (!supabase) return [];
  const { data, error } = await supabase.storage.from(storageBucket()).list(dir, { limit: 1e3 });
  if (error || !data) return [];
  return data.map((f) => ({
    name: f.name,
    id: f.id ?? null,
    created_at: f.created_at ?? void 0,
    size: f.metadata?.size
  }));
}

// src/server/email/sender.ts
import nodemailer from "nodemailer";
function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
function smtpHost() {
  return process.env.SMTP_HOST || null;
}
function getTransport() {
  if (!smtpConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    pool: true
  });
}
async function sendEmail(input) {
  const transport = getTransport();
  if (!transport) {
    throw new Error("SMTP n\xE3o configurado (SMTP_HOST / SMTP_USER / SMTP_PASS)");
  }
  const from = input.fromEmail || process.env.SMTP_USER || "no-reply@localhost";
  const info = await transport.sendMail({
    from: `"${input.fromName || "Brolabs Workflow"}" <${from}>`,
    to: input.to,
    subject: input.subject,
    html: input.html
  });
  return info.messageId || "";
}
var BACKOFF_MINUTES = [1, 5, 15, 60, 240];
var MAX_ATTEMPTS = 5;
function nextAttemptDate(attemptsSoFar) {
  const idx = Math.min(Math.max(attemptsSoFar, 0), BACKOFF_MINUTES.length - 1);
  return new Date(Date.now() + BACKOFF_MINUTES[idx] * 6e4);
}
var EXHAUSTED_DATE = /* @__PURE__ */ new Date("9999-12-31T23:59:59.000Z");
async function isRateLimited(recipientEmail) {
  const res = await query(
    `SELECT COUNT(*)::int AS n FROM email_notifications
     WHERE LOWER(recipient_email) = LOWER($1)
       AND sent_at IS NOT NULL
       AND sent_at > NOW() - INTERVAL '1 hour'`,
    [recipientEmail]
  );
  return res.rows[0].n >= 20;
}
function truncateError(msg) {
  return msg.slice(0, 500);
}
async function processOutbox(limit = 20) {
  const result = { sent: 0, failed: 0, skipped: 0 };
  if (!smtpConfigured()) return result;
  const rows = await query(
    `SELECT * FROM email_notifications
     WHERE status IN ('pending', 'failed')
       AND attempts < $2
       AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit, MAX_ATTEMPTS]
  );
  for (const row of rows.rows) {
    if (!row.member_id) {
      result.skipped++;
      continue;
    }
    if (!row.recipient_email) {
      result.skipped++;
      continue;
    }
    if (await isRateLimited(row.recipient_email)) {
      result.skipped++;
      continue;
    }
    try {
      const settingsRes = await query("SELECT * FROM email_settings LIMIT 1");
      const settings = settingsRes.rows[0];
      await sendEmail({
        to: row.recipient_email,
        subject: row.subject || "(sem assunto)",
        html: row.html_body || `<p>${row.content_preview || ""}</p>`,
        fromEmail: settings?.sender_email || void 0,
        fromName: settings?.sender_name || void 0
      });
      await query(
        `UPDATE email_notifications
         SET status = 'sent', sent_at = NOW(), attempts = attempts + 1, last_error = NULL
         WHERE id = $1`,
        [row.id]
      );
      result.sent++;
    } catch (err) {
      const attempts = (row.attempts || 0) + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      await query(
        `UPDATE email_notifications
         SET status = 'failed', attempts = $2, last_error = $3, next_attempt_at = $4
         WHERE id = $1`,
        [
          row.id,
          attempts,
          truncateError(err?.message || "erro desconhecido"),
          exhausted ? EXHAUSTED_DATE : nextAttemptDate(attempts)
        ]
      );
      result.failed++;
    }
  }
  return result;
}

// src/server/email/templates.ts
function renderEmail(options) {
  const linesHtml = options.lines.map((l) => `<p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6">${l}</p>`).join("\n");
  const taskHtml = options.taskKey || options.taskTitle ? `<div style="background:#f1f5f9;border-radius:8px;padding:12px 16px;margin:0 0 16px">
           ${options.taskKey ? `<p style="margin:0 0 4px;font-family:monospace;font-size:12px;color:#64748b">${options.taskKey}</p>` : ""}
           ${options.taskTitle ? `<p style="margin:0;font-weight:600;color:#0f172a;font-size:14px">${options.taskTitle}</p>` : ""}
         </div>` : "";
  const actionHtml = options.actionUrl && options.actionLabel ? `<p style="margin:20px 0 0"><a href="${options.actionUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600">${options.actionLabel}</a></p>` : "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <div style="background:#4f46e5;padding:18px 24px">
      <p style="margin:0;color:#fff;font-size:16px;font-weight:700">Brolabs Workflow</p>
    </div>
    <div style="padding:24px">
      <h1 style="margin:0 0 16px;font-size:18px;color:#0f172a">${options.title}</h1>
      ${taskHtml}
      ${linesHtml}
      ${actionHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;color:#94a3b8">Voc\xEA recebeu este e-mail porque tem permiss\xE3o de leitura no quadro relacionado.</p>
    </div>
  </div>
</body>
</html>`;
}
function renderTestEmail(toName) {
  return renderEmail({
    title: `Ol\xE1, ${toName || "usu\xE1rio"}!`,
    lines: [
      "Este \xE9 um e-mail de teste do Brolabs Workflow.",
      "Se voc\xEA recebeu esta mensagem, o SMTP est\xE1 configurado corretamente."
    ],
    actionLabel: "Abrir o Workflow",
    actionUrl: process.env.APP_URL || void 0
  });
}

// src/server/ai/provider.ts
import { GoogleGenAI } from "@google/genai";
var TIMEOUT_MS = 59e3;
var RATE_LIMIT_PER_HOUR = 20;
var GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
var OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini";
var SYSTEM = `Voc\xEA \xE9 o assistente de notas do Brolabs Workflow (pt-BR).
Responda apenas sobre o conte\xFAdo fornecido. N\xE3o invente dados de tarefas.
Devolva markdown limpo, sem pre\xE2mbulo.`;
function normalizeProvider(v) {
  const p = (v || "").trim().toLowerCase();
  if (p === "openrouter" || p === "gemini") return p;
  return null;
}
function geminiKey() {
  return process.env.GEMINI_API_KEY;
}
function openrouterKey() {
  return process.env.OPENROUTER_API_KEY;
}
function aiProvider() {
  const explicit = normalizeProvider(process.env.AI_PROVIDER);
  if (explicit === "openrouter" && openrouterKey()) return "openrouter";
  if (explicit === "gemini" && geminiKey()) return "gemini";
  if (explicit) return null;
  if (openrouterKey()) return "openrouter";
  if (geminiKey()) return "gemini";
  return null;
}
function aiConfigured() {
  return aiProvider() !== null;
}
function aiModel() {
  switch (aiProvider()) {
    case "openrouter":
      return process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL;
    case "gemini":
      return process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
    default:
      return "\u2014";
  }
}
async function checkAiRateLimit(memberId) {
  const r = await query(
    `SELECT COUNT(*)::int AS n FROM ai_usage
     WHERE member_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [memberId]
  );
  if ((r.rows[0]?.n ?? 0) < RATE_LIMIT_PER_HOUR) return null;
  const oldest = await query(
    `SELECT MIN(created_at) AS t FROM ai_usage
     WHERE member_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [memberId]
  );
  const t = oldest.rows[0]?.t ? new Date(oldest.rows[0].t) : /* @__PURE__ */ new Date();
  return new Date(t.getTime() + 60 * 60 * 1e3);
}
async function logAiUsage(memberId, action, inputChars, outputChars, status) {
  await query(
    `INSERT INTO ai_usage (member_id, action, input_chars, output_chars, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [memberId, action, inputChars, outputChars, status]
  );
}
var AiUnavailableError = class extends Error {
};
var AiFailedError = class extends Error {
};
async function runGeminiOnce(prompt) {
  const client2 = new GoogleGenAI({ apiKey: geminiKey() });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await client2.models.generateContent({
      model: aiModel(),
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        abortSignal: controller.signal
      }
    });
    const text = res.text;
    if (!text || !text.trim()) throw new AiFailedError("Resposta vazia do modelo!");
    return text;
  } finally {
    clearTimeout(timer);
  }
}
async function runOpenRouterOnce(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey()}`,
        "Content-Type": "application/json",
        // Atribuição opcional exibida em rankings do OpenRouter
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "Brolabs Workflow"
      },
      body: JSON.stringify({
        model: aiModel(),
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt }
        ]
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const detail = errBody?.error?.message ? `: ${errBody.error.message}` : "";
      throw new AiFailedError(`OpenRouter HTTP ${res.status}${detail}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || !text.trim()) throw new AiFailedError("Resposta vazia do modelo!");
    return text;
  } finally {
    clearTimeout(timer);
  }
}
async function runAi(prompt) {
  const provider = aiProvider();
  if (!provider) {
    throw new AiUnavailableError("IA n\xE3o configurada");
  }
  const attempt = async () => provider === "openrouter" ? runOpenRouterOnce(prompt) : runGeminiOnce(prompt);
  try {
    return await attempt();
  } catch (err) {
    const msg = String(err?.message || err);
    const retryable = err instanceof AiFailedError || /\b(5\d{2}|429)\b/.test(msg) || /overloaded|unavailable|quota/i.test(msg);
    if (!retryable) throw new AiFailedError(msg);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      return await attempt();
    } catch (err2) {
      throw new AiFailedError(String(err2?.message || err2));
    }
  }
}

// src/server/webhooks/dispatcher.ts
import crypto from "crypto";
var FETCH_TIMEOUT_MS = 1e4;
var BACKOFF_MINUTES2 = [1, 5, 15, 60, 240];
var MAX_ATTEMPTS2 = 5;
var DEFAULT_ALLOWED_HOSTS = [
  "hooks.slack.com",
  "discord.com",
  "discordapp.com",
  "hooks.discord.com",
  "webhook.office.com"
];
function allowedHosts() {
  const extra = (process.env.WEBHOOK_ALLOWED_DOMAINS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [.../* @__PURE__ */ new Set([...DEFAULT_ALLOWED_HOSTS, ...extra])];
}
function isUrlAllowed(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL inv\xE1lida" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: `Protocolo n\xE3o permitido (${url.protocol})` };
  }
  const host = url.hostname.toLowerCase();
  const ok = allowedHosts().some((a) => host === a || host.endsWith("." + a));
  return ok ? { ok: true } : { ok: false, reason: `Host "${host}" fora da whitelist (WEBHOOK_ALLOWED_DOMAINS)` };
}
function buildPayload(platform, ctx, channelName) {
  const { eventType, message, details } = ctx;
  switch (platform) {
    case "slack":
      return {
        text: message,
        blocks: [{ type: "section", text: { type: "mrkdwn", text: message } }],
        ...channelName ? { channel: channelName } : {}
      };
    case "discord":
      return {
        content: message,
        embeds: [
          {
            description: message,
            color: 6514417,
            footer: { text: `Brolabs Workflow \xB7 ${eventType}` }
          }
        ],
        ...channelName ? { username: channelName } : {}
      };
    case "teams":
      return {
        "@type": "MessageCard",
        themeColor: "6366F1",
        title: "Brolabs Workflow",
        text: message,
        facts: [
          { name: "Evento", value: eventType },
          ...channelName ? [{ name: "Canal", value: channelName }] : []
        ]
      };
    default:
      return {
        app: "Brolabs Workflow",
        event: eventType,
        message,
        data: details,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
  }
}
function nextAttemptState(attempts) {
  if (attempts >= MAX_ATTEMPTS2) return { status: "failed", nextAttemptAt: null };
  const delayMin = BACKOFF_MINUTES2[Math.min(attempts - 1, BACKOFF_MINUTES2.length - 1)];
  return { status: "pending", nextAttemptAt: new Date(Date.now() + delayMin * 6e4) };
}
function verifyIncomingSignature(secret, timestamp, rawBody, signatureHeader, maxSkewSeconds = 300) {
  if (!signatureHeader || !timestamp) return { ok: false, reason: "Assinatura ausente" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "Timestamp inv\xE1lido" };
  const skew = Math.abs(Date.now() - (ts < 1e12 ? ts * 1e3 : ts)) / 1e3;
  if (skew > maxSkewSeconds) return { ok: false, reason: "Timestamp fora da janela (replay)" };
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  const expected = crypto.createHmac("sha256", secret).update(
    typeof rawBody === "string" ? `${timestamp}.${rawBody}` : Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])
  ).digest("hex");
  const a = Buffer.from(provided.toLowerCase(), "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "Assinatura inv\xE1lida" };
  }
  return { ok: true };
}
async function insertPendingLog(row) {
  await query(
    `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp, payload, attempts, created_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, 0, now())`,
    [row.id, row.platform, row.eventType, row.summary, (/* @__PURE__ */ new Date()).toISOString(), row.payload]
  );
}
async function attemptDelivery(logId) {
  try {
    const res = await query(
      `SELECT w.*, i.webhook_url, i.enabled AS int_enabled, i.name AS int_name
       FROM webhook_logs w LEFT JOIN integrations i ON i.id = w.platform
       WHERE w.id = $1`,
      [logId]
    );
    const log = res.rows[0];
    if (!log || log.status !== "pending") return;
    const attempts = (Number(log.attempts) || 0) + 1;
    const url = String(log.webhook_url || "");
    if (!log.int_enabled || !url.startsWith("http")) {
      await query(
        `UPDATE webhook_logs SET status = 'failed', attempts = $1,
           error = 'Integra\xE7\xE3o desabilitada ou URL removida' WHERE id = $2`,
        [attempts, logId]
      );
      return;
    }
    const check = isUrlAllowed(url);
    if (!check.ok) {
      await query(
        `UPDATE webhook_logs SET status = 'failed', attempts = $1, error = $2 WHERE id = $3`,
        [attempts, check.reason, logId]
      );
      return;
    }
    let responseStatus = null;
    let errMsg = null;
    let delivered = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: log.payload || "{}",
        signal: controller.signal,
        redirect: "error"
      }).finally(() => clearTimeout(timer));
      responseStatus = resp.status;
      delivered = resp.ok;
      if (!resp.ok) errMsg = `HTTP ${resp.status}`;
    } catch (e) {
      errMsg = e?.name === "AbortError" ? `timeout ${FETCH_TIMEOUT_MS}ms` : String(e?.message || e);
    }
    if (delivered) {
      await query(
        `UPDATE webhook_logs SET status = 'delivered', attempts = $1, response_status = $2,
           next_attempt_at = NULL, error = NULL WHERE id = $3`,
        [attempts, responseStatus, logId]
      );
      return;
    }
    const st = nextAttemptState(attempts);
    await query(
      `UPDATE webhook_logs SET status = $1, attempts = $2, response_status = $3,
         next_attempt_at = $4, error = $5 WHERE id = $6`,
      [
        st.status,
        attempts,
        responseStatus,
        st.nextAttemptAt ? st.nextAttemptAt.toISOString() : null,
        errMsg,
        logId
      ]
    );
  } catch (e) {
    console.error("webhook attemptDelivery falhou:", e?.message || e);
  }
}
var FLAG_BY_EVENT = {
  task_completed: "notify_on_task_complete",
  worklog_logged: "notify_on_worklog",
  task_blocked: "notify_on_task_blocked",
  sprint_started: "notify_on_sprint_start",
  mention: "notify_on_mention",
  task_assigned: "notify_on_assignment"
};
function dispatchEvent(eventType, summary, details, mentions) {
  void (async () => {
    try {
      const res = await query("SELECT * FROM integrations WHERE enabled = TRUE");
      const rows = res.rows;
      const flag = FLAG_BY_EVENT[eventType];
      for (const row of rows) {
        if (!row.webhook_url || !row.webhook_url.startsWith("http")) continue;
        if (flag && row[flag] !== true) continue;
        let message = summary;
        if (mentions?.length && summary.includes("{mentions}")) {
          const rendered = mentions.map((m) => {
            const h = row.member_handles?.[m.memberId];
            if (h) return String(h).startsWith("@") ? String(h) : `@${h}`;
            return `@${m.name.split(" ")[0]}`;
          }).join(" ");
          message = summary.replace("{mentions}", rendered);
        }
        const logId = `wh-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
        const check = isUrlAllowed(row.webhook_url);
        const payload = buildPayload(
          row.id,
          { eventType, message, details },
          row.channel_name || void 0
        );
        if (!check.ok) {
          await query(
            `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp, payload, attempts, error, created_at)
             VALUES ($1, $2, $3, $4, 'failed', $5, $6, 1, $7, now())`,
            [logId, row.id, eventType, `[${row.name}] ${summary}`, (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(payload), check.reason]
          );
          continue;
        }
        await insertPendingLog({
          id: logId,
          platform: row.id,
          eventType,
          summary: `[${row.name}] ${summary}`,
          payload: JSON.stringify(payload)
        });
        void attemptDelivery(logId);
      }
    } catch (e) {
      console.error("dispatchEvent falhou:", e?.message || e);
    }
  })();
}
async function processWebhookOutbox(limit = 20) {
  const res = await query(
    `SELECT id FROM webhook_logs WHERE status = 'pending'
       AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
     ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );
  for (const row of res.rows) {
    await attemptDelivery(row.id);
  }
  return { processed: res.rows.length };
}
async function testIntegration(integrationId) {
  const res = await query("SELECT * FROM integrations WHERE id = $1", [integrationId]);
  const row = res.rows[0];
  if (!row) throw new Error("Integra\xE7\xE3o n\xE3o encontrada");
  const logId = `wh-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const message = `Ping de teste do Brolabs Workflow (${row.name})`;
  const details = { test: true, integration: row.id };
  if (!row.enabled || !row.webhook_url || !row.webhook_url.startsWith("http")) {
    throw new Error("Integra\xE7\xE3o desabilitada ou sem URL v\xE1lida");
  }
  const check = isUrlAllowed(row.webhook_url);
  const payload = buildPayload(row.id, { eventType: "test_ping", message, details }, row.channel_name || void 0);
  if (!check.ok) {
    await query(
      `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp, payload, attempts, error, created_at)
       VALUES ($1, $2, 'test_ping', $3, 'failed', $4, $5, 1, $6, now())`,
      [logId, row.id, `[${row.name}] ${message}`, (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(payload), check.reason]
    );
    return { logId, status: "failed", responseStatus: null, error: check.reason || null };
  }
  await insertPendingLog({
    id: logId,
    platform: row.id,
    eventType: "test_ping",
    summary: `[${row.name}] ${message}`,
    payload: JSON.stringify(payload)
  });
  await attemptDelivery(logId);
  const after = await query("SELECT status, response_status, error FROM webhook_logs WHERE id = $1", [logId]);
  const log = after.rows[0];
  return {
    logId,
    status: log?.status === "delivered" ? "delivered" : "failed",
    responseStatus: log?.response_status ?? null,
    error: log?.error || null
  };
}

// src/server/logger.ts
function emit(level, msg, fields = {}) {
  const line = JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), level, msg, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}
var logger = {
  info: (msg, fields) => emit("info", msg, fields),
  warn: (msg, fields) => emit("warn", msg, fields),
  error: (msg, fields) => emit("error", msg, fields)
};

// src/server/migrate.ts
import fs from "fs";
import path from "path";
import crypto2 from "crypto";
import { fileURLToPath } from "url";
var MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");
function loadMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".up.sql")).sort();
  return files.map((file) => {
    const match = file.match(/^(\d+)_(.+)\.up\.sql$/);
    if (!match) {
      throw new Error(`Nome de migration inv\xE1lido: ${file} (esperado NNNN_nome.up.sql)`);
    }
    const [, version, name] = match;
    const upPath = path.join(MIGRATIONS_DIR, file);
    const downPath = path.join(MIGRATIONS_DIR, `${version}_${name}.down.sql`);
    const content = fs.readFileSync(upPath, "utf8");
    return {
      version,
      name,
      upPath,
      downPath: fs.existsSync(downPath) ? downPath : null,
      checksum: crypto2.createHash("sha256").update(content).digest("hex")
    };
  });
}
async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(20) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
async function getApplied() {
  const res = await query("SELECT version, checksum FROM schema_migrations ORDER BY version ASC");
  return new Map(res.rows.map((r) => [r.version, { checksum: r.checksum }]));
}
async function migrateUp() {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const migrations = loadMigrations();
  const executed = [];
  for (const m of migrations) {
    const already = applied.get(m.version);
    if (already) {
      if (already.checksum !== m.checksum) {
        console.warn(
          `\u26A0\uFE0F  Migration ${m.version}_${m.name} foi alterada ap\xF3s aplicada (checksum divergente).`
        );
      }
      continue;
    }
    const sql = fs.readFileSync(m.upPath, "utf8");
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");
      await client2.query(sql);
      await client2.query(
        "INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
        [m.version, m.name, m.checksum]
      );
      await client2.query("COMMIT");
      console.log(`\u2705 Applied ${m.version}_${m.name}`);
      executed.push(`${m.version}_${m.name}`);
    } catch (err) {
      await client2.query("ROLLBACK");
      console.error(`\u274C Failed ${m.version}_${m.name}: ${err.message}`);
      throw err;
    } finally {
      client2.release();
    }
  }
  if (executed.length === 0) {
    console.log("\u2139\uFE0F  Nenhuma migration pendente.");
  }
  return executed;
}
async function migrateDown(steps = 1) {
  await ensureMigrationsTable();
  const res = await query(
    "SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT $1",
    [steps]
  );
  const reverted = [];
  for (const row of res.rows) {
    const migration = loadMigrations().find((m) => m.version === row.version);
    if (!migration) {
      throw new Error(`Arquivos de migration n\xE3o encontrados para ${row.version}_${row.name}`);
    }
    if (!migration.downPath) {
      throw new Error(`Migration ${row.version}_${row.name} n\xE3o possui .down.sql`);
    }
    const sql = fs.readFileSync(migration.downPath, "utf8");
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");
      await client2.query(sql);
      await client2.query("DELETE FROM schema_migrations WHERE version = $1", [row.version]);
      await client2.query("COMMIT");
      console.log(`\u21A9\uFE0F  Reverted ${row.version}_${row.name}`);
      reverted.push(`${row.version}_${row.name}`);
    } catch (err) {
      await client2.query("ROLLBACK");
      console.error(`\u274C Rollback failed ${row.version}_${row.name}: ${err.message}`);
      throw err;
    } finally {
      client2.release();
    }
  }
  return reverted;
}
async function migrationsSummary() {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const pending = loadMigrations().filter((m) => !applied.has(m.version));
  return pending.length === 0 ? "up-to-date" : `pending:${pending.length}`;
}
async function migrateStatus() {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const migrations = loadMigrations();
  console.log("Version   Status    Name");
  console.log("------------------------------------------");
  for (const m of migrations) {
    const status = applied.has(m.version) ? "applied" : "pending";
    console.log(`${m.version.padEnd(9)} ${status.padEnd(9)} ${m.name}`);
  }
  for (const [version] of applied) {
    if (!migrations.find((m) => m.version === version)) {
      console.log(`${version.padEnd(9)} ${"applied".padEnd(9)} (arquivos ausentes)`);
    }
  }
}
async function main() {
  const cmd = process.argv[2] || "up";
  try {
    if (cmd === "up") {
      await migrateUp();
    } else if (cmd === "down") {
      const steps = parseInt(process.argv[3] || "1", 10);
      await migrateDown(steps);
    } else if (cmd === "status") {
      await migrateStatus();
    } else {
      console.error(`Comando desconhecido: ${cmd} (use up | down [n] | status)`);
      process.exitCode = 1;
    }
  } catch {
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
var invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}

// server.ts
dotenv2.config();
var __filename = fileURLToPath2(import.meta.url);
var __dirname = path2.dirname(__filename);
var app = express();
var PORT = 3e3;
var isProduction = process.env.NODE_ENV === "production";
var isVercel = Boolean(process.env.VERCEL);
app.use(express.json({ limit: "10mb", verify: (req, _res, buf) => {
  req.rawBody = buf;
} }));
app.use(cookieParser());
var bucketDir = path2.resolve(process.cwd(), "public", "bucket");
var avatarsDir = path2.resolve(bucketDir, "avatars");
if (!isVercel && !fs2.existsSync(avatarsDir)) {
  fs2.mkdirSync(avatarsDir, { recursive: true });
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
var allowedOrigin = process.env.APP_URL || (isProduction ? null : "*");
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigin === "*" || origin && origin === allowedOrigin) {
    res.header("Access-Control-Allow-Origin", allowedOrigin === "*" ? "*" : origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use((req, res, next) => {
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "SAMEORIGIN");
  res.header("Referrer-Policy", "same-origin");
  res.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  const requestId = String(req.headers["x-request-id"] || crypto3.randomUUID());
  const start = Date.now();
  res.header("X-Request-Id", requestId);
  res.on("finish", () => {
    const fields = {
      requestId,
      route: req.path,
      method: req.method,
      status: res.statusCode,
      durationMs: Date.now() - start,
      memberId: req.memberId || null
    };
    if (res.statusCode >= 500) logger.error("request", fields);
    else logger.info("request", fields);
  });
  next();
});
var trustedOrigins = new Set(
  [
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173"
  ].filter(Boolean).map((o) => String(o).replace(/\/+$/, ""))
);
app.use((req, res, next) => {
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
    const origin = req.headers.origin;
    if (origin && !trustedOrigins.has(origin.replace(/\/+$/, ""))) {
      return res.status(403).json({ error: "Origem n\xE3o permitida" });
    }
  }
  next();
});
function makeRateLimiter(max, windowMs) {
  const buckets = /* @__PURE__ */ new Map();
  return (key) => {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      if (buckets.size > 5e3) {
        for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      }
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    b.count += 1;
    return b.count <= max;
  };
}
var checkApiLimit = makeRateLimiter(300, 6e4);
var checkAuthLimit = makeRateLimiter(10, 6e4);
app.use((req, res, next) => {
  if (!req.path.startsWith("/api") || req.path.startsWith("/api/public")) return next();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkApiLimit(`api:${ip}`)) {
    return res.status(429).json({ error: "Muitas requisi\xE7\xF5es. Tente novamente em 1 minuto." });
  }
  const isCredential = req.path.endsWith("/login") || req.path.endsWith("/register");
  if (isCredential && !checkAuthLimit(`auth:${ip}`)) {
    return res.status(429).json({ error: "Muitas tentativas de autentica\xE7\xE3o. Tente novamente em 1 minuto." });
  }
  next();
});
function safeJson2(val, fallback = []) {
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
    columns: safeJson2(row.columns, []),
    epics: safeJson2(row.epics, []),
    version: parseInt(row.version, 10) || 1
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
  const assigneeIds = normalizeAssigneeIds(
    safeJson2(row.assignee_ids, []),
    row.assignee_id ? [row.assignee_id] : []
  );
  return {
    id: row.id,
    key: row.key,
    boardId: row.board_id,
    title: row.title,
    description: row.description || "",
    issueType: row.issue_type,
    priority: row.priority,
    statusId: row.status_id,
    assigneeId: assigneeIds[0] || "",
    assigneeIds,
    reporterId: row.reporter_id || "",
    epicId: row.epic_id || void 0,
    parentId: row.parent_id || void 0,
    estimatedHours: parseFloat(row.estimated_hours) || 0,
    loggedHours: parseFloat(row.logged_hours) || 0,
    storyPoints: parseInt(row.story_points, 10) || 0,
    dueDate: row.due_date || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    subtasks: safeJson2(row.subtasks, []),
    worklogs: safeJson2(row.worklogs, []),
    comments: safeJson2(row.comments, []),
    tags: safeJson2(row.tags, []),
    dependencies: safeJson2(row.dependencies, []),
    archivedAt: row.archived_at || null,
    archivedBy: row.archived_by || null
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
    notifyOnMention: Boolean(row.notify_on_mention),
    notifyOnAssignment: Boolean(row.notify_on_assignment),
    memberHandles: row.member_handles || {},
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
    timestamp: row.timestamp,
    attempts: Number(row.attempts) || 0,
    responseStatus: row.response_status ?? null,
    error: row.error || null
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
      totalBoards: parseInt(boardsCount.rows[0].count, 10),
      smtp: smtpConfigured() ? "configured" : "unconfigured",
      storage: getStorage() ? "ok" : "unconfigured",
      ai: aiConfigured() ? "configured" : "unconfigured",
      migrations: await migrationsSummary()
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
app.get("/api/initial-state", authenticateToken, async (req, res) => {
  try {
    const memberRes = await query("SELECT system_role, email, preferences FROM members WHERE id = $1", [req.memberId]);
    const isAdmin = memberRes.rows[0]?.system_role === "admin";
    const myEmail = memberRes.rows[0]?.email || "";
    const myPreferences = safeJsonOrRaw(memberRes.rows[0]?.preferences, {});
    let boardsQuery;
    let tasksQuery;
    if (isAdmin) {
      boardsQuery = query("SELECT * FROM boards ORDER BY created_at ASC");
      tasksQuery = query("SELECT * FROM tasks WHERE archived_at IS NULL ORDER BY created_at DESC");
    } else {
      boardsQuery = query(
        `SELECT b.* FROM boards b
         INNER JOIN board_members bm ON bm.board_id = b.id AND bm.member_id = $1
         ORDER BY b.created_at ASC`,
        [req.memberId]
      );
      tasksQuery = query(
        `SELECT t.* FROM tasks t
         INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.member_id = $1
         WHERE t.archived_at IS NULL
         ORDER BY t.created_at DESC`,
        [req.memberId]
      );
    }
    const [boardsRes, membersRes, tasksRes, activitiesRes, integrationsRes, webhooksRes, emailSettingsRes, emailNotificationsRes, appSettingsRes] = await Promise.all([
      boardsQuery,
      query("SELECT * FROM members ORDER BY name ASC"),
      tasksQuery,
      query("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100"),
      query("SELECT * FROM integrations ORDER BY id ASC"),
      query("SELECT * FROM webhook_logs ORDER BY timestamp DESC LIMIT 50"),
      query("SELECT * FROM email_settings LIMIT 1"),
      query(
        `SELECT * FROM email_notifications
           WHERE member_id = $1 OR LOWER(recipient_email) = LOWER($2)
           ORDER BY timestamp DESC LIMIT 50`,
        [req.memberId, myEmail]
      ),
      query("SELECT * FROM app_settings")
    ]);
    const boards = boardsRes.rows.map(mapDbBoard);
    const members = membersRes.rows.map(mapDbMember);
    const tasks = tasksRes.rows.map(mapDbTask);
    const activityLogs = activitiesRes.rows.map(mapDbActivity);
    const integrations = integrationsRes.rows.map(mapDbIntegration);
    const webhookLogs = webhooksRes.rows.map(mapDbWebhookLog);
    const emailNotifications = emailNotificationsRes.rows.map(mapDbEmailNotification);
    const myPermissions = {};
    for (const board of boards) {
      const eff = await resolvePermissions(req.memberId, board.id);
      if (eff) myPermissions[board.id] = eff;
    }
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
    const storedBoardId = appSettingsMap["current_board_id"];
    const currentBoardId = storedBoardId && myPermissions[storedBoardId] ? storedBoardId : boards[0] ? boards[0].id : "";
    const currentUserId = req.memberId || "";
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
      currentUserId,
      myPermissions,
      preferences: myPreferences
    });
  } catch (error) {
    console.error("Error fetching initial state:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post(
  "/api/reset-database",
  authenticateToken,
  requireAdmin(),
  validateBody(resetDatabaseSchema),
  async (req, res) => {
    try {
      if (isProduction) {
        return res.status(403).json({ error: "Reset do banco desabilitado em produ\xE7\xE3o" });
      }
      await seedDatabase();
      res.json({ success: true, message: "Database reset and re-seeded successfully in NeonDB" });
    } catch (error) {
      console.error("Reset database failed:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
app.put("/api/app-settings/:key", authenticateToken, validateBody(appSettingSchema), async (req, res) => {
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
app.post("/api/auth/register", validateBody(registerSchema), async (req, res) => {
  try {
    const { name, email, password, role, department, weeklyCapacityHours } = req.body;
    const existing = await findMemberByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "E-mail j\xE1 cadastrado" });
    }
    const passwordHash = await hashPassword(password);
    const id = `mem-${Date.now()}`;
    await query(
      `INSERT INTO members (id, name, email, avatar, role, department, weekly_capacity_hours, active, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        name,
        email,
        "",
        role || "",
        department || "",
        weeklyCapacityHours || 40,
        true,
        passwordHash
      ]
    );
    const memberRow = await findMemberById(id);
    const member = mapDbMember(memberRow);
    const token = generateToken(id);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1e3
    });
    res.status(201).json({ success: true, token, member });
  } catch (error) {
    console.error("Error registering member:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/auth/login", validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const memberRow = await findMemberByEmail(email);
    if (!memberRow) {
      return res.status(401).json({ error: "E-mail ou senha incorretos" });
    }
    const passwordValid = await comparePassword(password, memberRow.password_hash || "");
    if (!passwordValid) {
      return res.status(401).json({ error: "E-mail ou senha incorretos" });
    }
    await updateLastLogin(memberRow.id);
    const token = generateToken(memberRow.id);
    const member = mapDbMember(memberRow);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1e3
    });
    res.json({ success: true, token, member });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/auth/logout", async (req, res) => {
  try {
    res.clearCookie("token");
    res.json({ success: true, message: "Desconectado com sucesso" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const memberId = req.memberId;
    if (!memberId) {
      return res.status(401).json({ error: "N\xE3o autenticado" });
    }
    const memberRow = await findMemberById(memberId);
    if (!memberRow) {
      return res.status(404).json({ error: "Membro n\xE3o encontrado" });
    }
    res.json({ success: true, member: mapDbMember(memberRow) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
async function ensureTagsExist(tags, memberId) {
  if (!Array.isArray(tags)) return;
  const seen = /* @__PURE__ */ new Set();
  for (const raw of tags) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name || name.length > 60) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    await query(
      `INSERT INTO tags (id, name, color, created_by)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [`tag-${crypto3.randomUUID().slice(0, 8)}`, name, "#64748b", memberId]
    );
  }
}
function taskDeepLink(taskId) {
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  return `${base}/?task=${taskId}`;
}
function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
async function resolveMentionMembers(comments, authorId) {
  const texts = comments.map((c) => String(c.text || "")).join(" ");
  const raw = [
    ...new Set(
      (texts.match(/@([a-zA-Z0-9_\u00C0-\u00FF.-]+)/g) || []).map((s) => s.slice(1).toLowerCase())
    )
  ];
  if (!raw.length) return [];
  const memRes = await query("SELECT id, name, email FROM members");
  const members = memRes.rows;
  const groups = ["todos", "equipe", "time", "all", "squad"];
  if (raw.some((m) => groups.includes(m))) {
    return members.filter((m) => m.id !== authorId).map((m) => ({ memberId: m.id, name: m.name }));
  }
  const found = /* @__PURE__ */ new Map();
  for (const q of raw) {
    if (!q) continue;
    for (const mem of members) {
      const firstName = String(mem.name || "").split(" ")[0].toLowerCase();
      const fullName = String(mem.name || "").toLowerCase();
      const emailPrefix = String(mem.email || "").split("@")[0].toLowerCase();
      const match = firstName && (firstName.includes(q) || q.includes(firstName)) || fullName && (fullName.includes(q) || q.includes(fullName)) || emailPrefix && (emailPrefix.includes(q) || q.includes(emailPrefix));
      if (match) found.set(mem.id, { memberId: mem.id, name: mem.name });
    }
  }
  return [...found.values()];
}
async function notifyAssignment(task, newAssigneeIds) {
  try {
    const memRes = await query("SELECT id, name, email FROM members WHERE id = ANY($1)", [
      newAssigneeIds
    ]);
    const added = memRes.rows;
    if (!added.length) return;
    const link = taskDeepLink(task.id);
    dispatchEvent(
      "task_assigned",
      `\u{1F4CC} ${task.key}: {mentions} agora \xE9 respons\xE1vel pela tarefa "${task.title}" \u2014 ${link}`,
      { taskKey: task.key, title: task.title, assigned: added.map((m) => m.name).join(", "), link },
      added.map((m) => ({ memberId: m.id, name: m.name }))
    );
    const settingsRes = await query("SELECT * FROM email_settings LIMIT 1");
    const settings = settingsRes.rows[0];
    if (!settings?.enabled) return;
    for (const m of added) {
      if (!m.email) continue;
      try {
        const dup = await query(
          `SELECT 1 FROM email_notifications
           WHERE task_id = $1 AND trigger_type = 'assignment' AND recipient_email = $2
             AND created_at > NOW() - INTERVAL '5 minutes'`,
          [task.id, m.email]
        );
        if (dup.rowCount) continue;
        const subject = `Voc\xEA foi designado(a) \xE0 tarefa ${task.key}`;
        const preview = `${task.title} \u2014 abra a tarefa no Brolabs Workflow.`;
        const html = `<p>Ol\xE1 ${escHtml(m.name)},</p><p>Voc\xEA foi designado(a) \xE0 tarefa <strong>${escHtml(task.key)} \u2014 ${escHtml(task.title)}</strong>.</p>`;
        await query(
          `INSERT INTO email_notifications
             (id, trigger_type, task_id, task_key, task_title, recipient_email, recipient_name,
              sender_name, subject, content_preview, html_body, status, timestamp, read, member_id, created_at)
           VALUES ($1, 'assignment', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, false, $12, now())`,
          [
            `em-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            task.id,
            task.key,
            task.title,
            m.email,
            m.name,
            settings.sender_name || "Brolabs Workflow",
            subject,
            preview,
            html,
            (/* @__PURE__ */ new Date()).toISOString(),
            m.id
          ]
        );
      } catch (e) {
        console.error("assignment email enqueue falhou:", e?.message || e);
      }
    }
    if (smtpConfigured()) await processOutbox(5).catch(() => {
    });
  } catch (e) {
    console.error("notifyAssignment falhou:", e?.message || e);
  }
}
async function fireTaskUpdateEvents(current, merged, updates) {
  try {
    if (updates.statusId && updates.statusId !== current.statusId) {
      const boardRes = await query("SELECT columns FROM boards WHERE id = $1", [current.boardId]);
      const cols = safeJson2(boardRes.rows[0]?.columns, []);
      const doneColId = cols.find((c) => c.isDone)?.id ?? "col-done";
      if (merged.statusId === doneColId) {
        dispatchEvent(
          "task_completed",
          `\u2705 Tarefa ${merged.key} conclu\xEDda: ${merged.title} \u2014 ${taskDeepLink(merged.id)}`,
          {
            taskKey: merged.key,
            title: merged.title,
            link: taskDeepLink(merged.id)
          }
        );
      }
    }
    if ("worklogs" in updates) {
      const before = (current.worklogs || []).length;
      const after = (merged.worklogs || []).length;
      if (after > before) {
        dispatchEvent(
          "worklog_logged",
          `\u23F1 Novo apontamento em ${merged.key} (${merged.title}) \u2014 ${after - before} registro(s) \u2014 ${taskDeepLink(merged.id)}`,
          {
            taskKey: merged.key,
            title: merged.title,
            newLogs: after - before,
            link: taskDeepLink(merged.id)
          }
        );
      }
    }
    if ("dependencies" in updates) {
      const before = new Set(
        (current.dependencies || []).map((d) => `${d.type}:${d.targetTaskId}`)
      );
      const added = (merged.dependencies || []).filter(
        (d) => d.type === "is_blocked_by" && !before.has(`is_blocked_by:${d.targetTaskId}`)
      );
      if (added.length) {
        dispatchEvent(
          "task_blocked",
          `\u26D4 ${merged.key} marcada como bloqueada (${added.length} nova(s) depend\xEAncia(s)) \u2014 ${taskDeepLink(merged.id)}`,
          {
            taskKey: merged.key,
            title: merged.title,
            blockers: added.map((d) => d.targetTaskId),
            link: taskDeepLink(merged.id)
          }
        );
      }
    }
    if ("assigneeIds" in updates || "assigneeId" in updates) {
      const before = new Set(current.assigneeIds || []);
      const addedIds = (merged.assigneeIds || []).filter((id) => id && !before.has(id));
      if (addedIds.length) await notifyAssignment(merged, addedIds);
    }
    if ("comments" in updates) {
      const beforeIds = new Set((current.comments || []).map((c) => c.id));
      const newComments = (merged.comments || []).filter((c) => !beforeIds.has(c.id));
      if (newComments.length) {
        const mentioned = await resolveMentionMembers(
          newComments,
          newComments[0]?.authorId || ""
        );
        if (mentioned.length) {
          const list = mentioned.map((m) => m.name).join(", ");
          dispatchEvent(
            "mention",
            `\u{1F4AC} Em ${merged.key} ("${merged.title}"): {mentions} \u2014 ${taskDeepLink(merged.id)}`,
            {
              taskKey: merged.key,
              title: merged.title,
              mentioned: list,
              link: taskDeepLink(merged.id)
            },
            mentioned
          );
        }
      }
    }
  } catch (e) {
    console.error("fireTaskUpdateEvents falhou:", e?.message || e);
  }
}
async function handleTaskCreatedEvents(task) {
  try {
    const ids = task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [];
    if (ids.length) await notifyAssignment(task, ids);
  } catch (e) {
    console.error("handleTaskCreatedEvents falhou:", e?.message || e);
  }
}
app.post("/api/tasks", authenticateToken, requireBoardPermission("canCreateTask"), validateBody(taskCreateSchema), async (req, res) => {
  try {
    const t = req.body;
    const assigneeIds = normalizeAssigneeIds(t.assigneeIds, t.assigneeId ? [t.assigneeId] : []);
    await query(
      `INSERT INTO tasks (
        id, key, board_id, title, description, issue_type, priority, status_id,
        assignee_id, reporter_id, epic_id, estimated_hours, logged_hours, story_points,
        due_date, created_at, updated_at, subtasks, worklogs, comments, tags, dependencies,
        assignee_ids, parent_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24
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
        assigneeIds[0] || "",
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
        JSON.stringify(t.dependencies || []),
        JSON.stringify(assigneeIds),
        t.parentId || null
      ]
    );
    if (Array.isArray(t.tags) && t.tags.length) {
      await ensureTagsExist(t.tags, req.memberId).catch(() => {
      });
    }
    void handleTaskCreatedEvents(t);
    res.status(201).json({ success: true, task: t });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/tasks/:id", authenticateToken, validateBody(taskUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const existingRes = await query("SELECT * FROM tasks WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const current = mapDbTask(existingRes.rows[0]);
    const eff = await resolvePermissions(req.memberId, current.boardId);
    if (!eff) {
      return res.status(403).json({ error: "Sem acesso a este quadro" });
    }
    req.boardPermissions = eff;
    if (!eff.canEditTask) {
      return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canEditTask" });
    }
    if (updates.statusId && updates.statusId !== current.statusId && !eff.canChangeStatus) {
      return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canChangeStatus" });
    }
    if ("worklogs" in updates && !eff.canLogWork) {
      return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canLogWork" });
    }
    if ("comments" in updates && !eff.canAddComment) {
      return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canAddComment" });
    }
    const merged = { ...current, ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    let assigneeIds;
    if ("assigneeIds" in updates) {
      assigneeIds = normalizeAssigneeIds(updates.assigneeIds, current.assigneeIds);
    } else if ("assigneeId" in updates) {
      assigneeIds = normalizeAssigneeIds(void 0, updates.assigneeId ? [updates.assigneeId] : []);
    } else {
      assigneeIds = current.assigneeIds;
    }
    merged.assigneeIds = assigneeIds;
    merged.assigneeId = assigneeIds[0] || "";
    await query(
      `UPDATE tasks SET
        key = $1, board_id = $2, title = $3, description = $4, issue_type = $5,
        priority = $6, status_id = $7, assignee_id = $8, reporter_id = $9, epic_id = $10,
        estimated_hours = $11, logged_hours = $12, story_points = $13, due_date = $14,
        updated_at = $15, subtasks = $16, worklogs = $17, comments = $18, tags = $19,
        dependencies = $20, assignee_ids = $21, parent_id = $22
      WHERE id = $23`,
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
        JSON.stringify(assigneeIds),
        merged.parentId || null,
        id
      ]
    );
    if (Array.isArray(updates.tags)) {
      await ensureTagsExist(updates.tags, req.memberId).catch(() => {
      });
    }
    void fireTaskUpdateEvents(current, merged, updates);
    res.json({ success: true, task: merged });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/tasks/:id/analyze", authenticateToken, async (req, res) => {
  const memberId = req.memberId;
  let inputChars = 0;
  try {
    const taskRes = await query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    if (!taskRes.rows.length) return res.status(404).json({ error: "Tarefa n\xE3o encontrada" });
    const task = mapDbTask(taskRes.rows[0]);
    const eff = await resolvePermissions(memberId, task.boardId);
    if (!eff || !eff.canEditTask) {
      return res.status(403).json({ error: "Sem permiss\xE3o para analisar esta tarefa" });
    }
    if (!aiConfigured()) {
      await logAiUsage(memberId, "task_analyze", 0, 0, "error");
      return res.status(503).json({ error: "IA n\xE3o configurada", unavailable: true });
    }
    const retryAfter = await checkAiRateLimit(memberId);
    if (retryAfter) {
      await logAiUsage(memberId, "task_analyze", 0, 0, "rate_limited");
      const minutes = Math.max(1, Math.ceil((retryAfter.getTime() - Date.now()) / 6e4));
      return res.status(429).json({ error: `Limite de 20 usos/h atingido. Tente em ${minutes} min`, retryAfterMinutes: minutes });
    }
    const boardRes = await query("SELECT columns FROM boards WHERE id = $1", [task.boardId]);
    const cols = safeJson2(boardRes.rows[0]?.columns, []);
    const statusTitle = cols.find((c) => c.id === task.statusId)?.title || task.statusId;
    const memRes = await query("SELECT id, name FROM members");
    const nameOf = (id) => memRes.rows.find((m) => m.id === id)?.name || id || "(sem autor)";
    const comments = (task.comments || []).slice(-5).map((c) => `- ${nameOf(c.authorId)}: ${String(c.text || "").slice(0, 500)}`).join("\n") || "(sem coment\xE1rios)";
    const subtasks = (task.subtasks || []).map((s) => `- [${s.completed ? "x" : " "}] ${s.title}`).join("\n") || "(nenhuma)";
    const deps = (task.dependencies || []).map((d) => `- ${d.type} \u2192 ${d.targetTaskId}`).join("\n") || "(nenhuma)";
    const worklogs = (task.worklogs || []).map((w) => `- ${nameOf(w.memberId)}: ${w.hours}h em ${w.date}`).join("\n") || "(nenhum)";
    const assignees = (task.assigneeIds || []).filter(Boolean).map(nameOf).join(", ") || "nenhum";
    const context = `Tarefa: ${task.key} \u2014 ${task.title}
Status: ${statusTitle} | Prioridade: ${task.priority} | Tipo: ${task.issueType}
Prazo: ${task.dueDate || "sem prazo"} | Pontos: ${task.storyPoints || 0} | Estimado: ${task.estimatedHours || 0}h | Apontado: ${task.loggedHours || 0}h
Respons\xE1veis: ${assignees}
Descri\xE7\xE3o: ${task.description || "(vazia)"}
Sub-tarefas:
${subtasks}
Depend\xEAncias:
${deps}
Coment\xE1rios recentes:
${comments}
Worklogs:
${worklogs}`;
    inputChars = context.length;
    const prompt = `Analise a tarefa abaixo do ponto de vista de gest\xE3o de projeto (pt-BR, markdown limpo, sem pre\xE2mbulo).
Aponte: (1) erros de interpreta\xE7\xE3o ou ambiguidades na descri\xE7\xE3o; (2) informa\xE7\xF5es que faltam; (3) riscos e depend\xEAncias n\xE3o tratadas; (4) boas pr\xE1ticas e pr\xF3ximos passos concretos.
Se a descri\xE7\xE3o estiver vazia ou muito curta, APONTE a falta de contexto em vez de inventar conte\xFAdo. N\xE3o invente dados que n\xE3o estejam no contexto.

<<<TAREFA>>>
${context.slice(0, 2e4)}
<<<END>>>`;
    const output = await runAi(prompt);
    await logAiUsage(memberId, "task_analyze", inputChars, output.length, "ok");
    res.json({
      content: output,
      usage: {
        action: "task_analyze",
        inputChars,
        outputChars: output.length,
        provider: aiProvider(),
        model: aiModel()
      }
    });
  } catch (error) {
    const status = error instanceof AiUnavailableError ? 503 : 502;
    await logAiUsage(memberId, "task_analyze", inputChars, 0, "error").catch(() => {
    });
    console.error("Task analyze failed:", error);
    res.status(status).json({ error: error.message || "Falha na IA" });
  }
});
app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existingRes = await query("SELECT board_id FROM tasks WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const eff = await resolvePermissions(req.memberId, existingRes.rows[0].board_id);
    if (!eff) {
      return res.status(403).json({ error: "Sem acesso a este quadro" });
    }
    if (!eff.canDeleteTask) {
      return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canDeleteTask" });
    }
    await query("DELETE FROM tasks WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/tasks/:id/archive", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const force = Boolean(req.body?.force);
    const taskRes = await query("SELECT * FROM tasks WHERE id = $1", [id]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const task = mapDbTask(taskRes.rows[0]);
    if (task.archivedAt) {
      return res.json({ success: true, task });
    }
    const archiveEff = await resolvePermissions(req.memberId, task.boardId);
    if (!archiveEff) {
      return res.status(403).json({ error: "Sem acesso a este quadro" });
    }
    if (!archiveEff.canEditTask) {
      return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canEditTask" });
    }
    const boardRes = await query("SELECT * FROM boards WHERE id = $1", [task.boardId]);
    const board = boardRes.rows.length > 0 ? mapDbBoard(boardRes.rows[0]) : null;
    const doneColId = board?.columns?.find((c) => c.isDone)?.id ?? "col-done";
    const boardTasksRes = await query(
      "SELECT * FROM tasks WHERE board_id = $1 AND archived_at IS NULL",
      [task.boardId]
    );
    const blockingTaskIds = boardTasksRes.rows.map((r) => mapDbTask(r)).filter(
      (t) => t.id !== task.id && t.statusId !== doneColId && (t.dependencies || []).some(
        (d) => d.type === "is_blocked_by" && d.targetTaskId === task.id
      )
    ).map((t) => t.id);
    if (blockingTaskIds.length > 0 && !force) {
      return res.status(409).json({
        error: "Esta tarefa bloqueia outras tarefas ativas. Use force para arquivar removendo os bloqueios.",
        blockingTaskIds
      });
    }
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");
      if (force && blockingTaskIds.length > 0) {
        for (const blockerTaskId of blockingTaskIds) {
          const row = boardTasksRes.rows.find((r) => r.id === blockerTaskId);
          const deps = safeJson2(row?.dependencies, []).filter(
            (d) => !(d.type === "is_blocked_by" && d.targetTaskId === task.id)
          );
          await client2.query("UPDATE tasks SET dependencies = $1 WHERE id = $2", [
            JSON.stringify(deps),
            blockerTaskId
          ]);
        }
        const taskDeps = safeJson2(taskRes.rows[0].dependencies, []).filter(
          (d) => !(d.type === "blocks" && blockingTaskIds.some((bid) => bid === d.targetTaskId))
        );
        await client2.query(
          "UPDATE tasks SET archived_at = NOW(), archived_by = $1, dependencies = $2, updated_at = NOW() WHERE id = $3",
          [req.memberId, JSON.stringify(taskDeps), id]
        );
      } else {
        await client2.query(
          "UPDATE tasks SET archived_at = NOW(), archived_by = $1, updated_at = NOW() WHERE id = $2",
          [req.memberId, id]
        );
      }
      await client2.query("COMMIT");
    } catch (err) {
      await client2.query("ROLLBACK");
      throw err;
    } finally {
      client2.release();
    }
    const updated = await query("SELECT * FROM tasks WHERE id = $1", [id]);
    res.json({ success: true, task: mapDbTask(updated.rows[0]) });
  } catch (error) {
    console.error("Error archiving task:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/tasks/:id/unarchive", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const taskRes = await query("SELECT * FROM tasks WHERE id = $1", [id]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const task = mapDbTask(taskRes.rows[0]);
    if (!task.archivedAt) {
      return res.json({ success: true, task });
    }
    const unarchiveEff = await resolvePermissions(req.memberId, task.boardId);
    if (!unarchiveEff) {
      return res.status(403).json({ error: "Sem acesso a este quadro" });
    }
    if (!unarchiveEff.canEditTask) {
      return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canEditTask" });
    }
    const boardRes = await query("SELECT * FROM boards WHERE id = $1", [task.boardId]);
    const board = boardRes.rows.length > 0 ? mapDbBoard(boardRes.rows[0]) : null;
    const columnExists = board?.columns?.some((c) => c.id === task.statusId);
    const newStatusId = columnExists ? task.statusId : board?.columns?.[0]?.id ?? task.statusId;
    await query(
      "UPDATE tasks SET archived_at = NULL, archived_by = NULL, status_id = $1, updated_at = NOW() WHERE id = $2",
      [newStatusId, id]
    );
    const updated = await query("SELECT * FROM tasks WHERE id = $1", [id]);
    res.json({ success: true, task: mapDbTask(updated.rows[0]) });
  } catch (error) {
    console.error("Error unarchiving task:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/boards/:id/tasks", authenticateToken, requireBoardAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const archivedOnly = req.query.archived === "true";
    const condition = archivedOnly ? "archived_at IS NOT NULL" : "archived_at IS NULL";
    const tasksRes = await query(
      `SELECT * FROM tasks WHERE board_id = $1 AND ${condition} ORDER BY created_at DESC`,
      [id]
    );
    res.json({ tasks: tasksRes.rows.map(mapDbTask) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/boards", authenticateToken, validateBody(boardCreateSchema), async (req, res) => {
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
    await query(
      `INSERT INTO board_members (board_id, member_id, role, permissions)
       VALUES ($1, $2, 'owner', '{}') ON CONFLICT DO NOTHING`,
      [b.id, req.memberId]
    );
    res.status(201).json({ success: true, board: b });
  } catch (error) {
    console.error("Error creating board:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/boards/:id", authenticateToken, requireBoardPermission("canManageBoard"), validateBody(boardUpdateSchema), async (req, res) => {
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
app.delete("/api/boards/:id", authenticateToken, requireBoardPermission("canManageBoard"), async (req, res) => {
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
function shareUrlBase(req) {
  return (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
}
function isShareActive(row) {
  if (row.visibility !== "public" || !row.share_token) return false;
  if (row.share_token_expires_at && new Date(row.share_token_expires_at) < /* @__PURE__ */ new Date()) return false;
  return true;
}
app.get("/api/boards/:id/share", authenticateToken, requireBoardPermission("canManageBoard"), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      "SELECT visibility, share_token, share_token_expires_at FROM boards WHERE id = $1",
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Quadro n\xE3o encontrado" });
    const b = r.rows[0];
    const active = isShareActive(b);
    res.json({
      visibility: b.visibility === "public" ? "public" : "private",
      token: active ? b.share_token : null,
      url: active ? `${shareUrlBase(req)}/q/${b.share_token}` : null,
      expiresAt: active ? b.share_token_expires_at : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post(
  "/api/boards/:id/share",
  authenticateToken,
  requireBoardPermission("canManageBoard"),
  validateBody(shareCreateSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const expiresInDays = req.body.expiresInDays ?? 90;
      const token = crypto3.randomBytes(32).toString("hex");
      const r = await query(
        `UPDATE boards
         SET visibility = 'public', share_token = $1,
             share_token_expires_at = NOW() + make_interval(days => $2::int),
             share_token_created_by = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING share_token, share_token_expires_at`,
        [token, expiresInDays, req.memberId, id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Quadro n\xE3o encontrado" });
      res.status(201).json({
        token: r.rows[0].share_token,
        url: `${shareUrlBase(req)}/q/${r.rows[0].share_token}`,
        expiresAt: r.rows[0].share_token_expires_at
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);
app.delete("/api/boards/:id/share", authenticateToken, requireBoardPermission("canManageBoard"), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      `UPDATE boards
       SET visibility = 'private', share_token = NULL,
           share_token_expires_at = NULL, share_token_created_by = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Quadro n\xE3o encontrado" });
    res.json({ visibility: "private" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var publicRateBuckets = /* @__PURE__ */ new Map();
function publicRateLimit(key, max = 30, windowMs = 6e4) {
  const now = Date.now();
  const bucket = publicRateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    publicRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    if (publicRateBuckets.size > 5e3) {
      for (const [k, v] of publicRateBuckets) if (v.resetAt <= now) publicRateBuckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}
app.get("/api/public/boards/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!publicRateLimit(ip)) {
      return res.status(429).json({ error: "Muitas tentativas. Tente novamente em 1 minuto." });
    }
    const notFound = () => res.status(404).json({ error: "Link inv\xE1lido ou desativado" });
    if (!/^[a-f0-9]{64}$/.test(token)) return notFound();
    const r = await query(
      `SELECT id, key, name, description, sprint_name, sprint_goal, sprint_start_date, sprint_end_date,
              columns, epics, visibility, share_token_expires_at
       FROM boards WHERE share_token = $1`,
      [token]
    );
    if (r.rows.length === 0) return notFound();
    const b = r.rows[0];
    if (b.visibility !== "public") return notFound();
    if (b.share_token_expires_at && new Date(b.share_token_expires_at) < /* @__PURE__ */ new Date()) return notFound();
    const tasksRes = await query(
      `SELECT t.* FROM tasks t
       WHERE t.board_id = $1 AND t.archived_at IS NULL
       ORDER BY t.created_at DESC`,
      [b.id]
    );
    const rawWithIds = tasksRes.rows.map((t) => ({
      t,
      ids: normalizeAssigneeIds(safeJson2(t.assignee_ids, []), t.assignee_id ? [t.assignee_id] : [])
    }));
    const allAssigneeIds = [...new Set(rawWithIds.flatMap((x) => x.ids))];
    const nameById = /* @__PURE__ */ new Map();
    if (allAssigneeIds.length > 0) {
      const mRes = await query("SELECT id, name FROM members WHERE id = ANY($1)", [allAssigneeIds]);
      for (const r2 of mRes.rows) nameById.set(String(r2.id), String(r2.name));
    }
    const publicTasks = rawWithIds.map(({ t, ids }) => {
      const comments = safeJson2(t.comments, []);
      const subtasks = safeJson2(t.subtasks, []);
      const assigneeNames = ids.map((id) => nameById.get(id)).filter((n) => Boolean(n));
      return {
        id: t.id,
        key: t.key,
        title: t.title,
        statusId: t.status_id,
        priority: t.priority,
        issueType: t.issue_type,
        assigneeName: assigneeNames[0] || null,
        assigneeNames,
        dueDate: t.due_date || "",
        storyPoints: parseInt(t.story_points, 10) || 0,
        tags: safeJson2(t.tags, []),
        subtasks: (Array.isArray(subtasks) ? subtasks : []).map((s) => ({
          title: String(s?.title ?? ""),
          completed: Boolean(s?.completed)
        })),
        commentsCount: Array.isArray(comments) ? comments.length : 0
      };
    });
    res.set("Cache-Control", "public, max-age=60");
    res.set("X-Robots-Tag", "noindex");
    res.json({
      board: {
        id: b.id,
        key: b.key,
        name: b.name,
        description: b.description || "",
        sprintName: b.sprint_name || "",
        sprintGoal: b.sprint_goal || "",
        sprintStartDate: b.sprint_start_date || "",
        sprintEndDate: b.sprint_end_date || "",
        columns: safeJson2(b.columns, []),
        epics: safeJson2(b.epics, [])
      },
      tasks: publicTasks
    });
  } catch (error) {
    console.error("Public board failed:", error);
    res.status(500).json({ error: "Erro ao carregar quadro p\xFAblico" });
  }
});
async function updateBoardColumnsWithLock(boardId, newColumns, expectedVersion) {
  const res = await query(
    `UPDATE boards SET columns = $1, version = version + 1, updated_at = NOW()
     WHERE id = $2 AND version = $3
     RETURNING columns, version`,
    [JSON.stringify(newColumns), boardId, expectedVersion]
  );
  if (res.rowCount === 0) {
    const exists = await query("SELECT id FROM boards WHERE id = $1", [boardId]);
    if (exists.rows.length === 0) {
      return { ok: false, status: 404, error: "Quadro n\xE3o encontrado" };
    }
    return {
      ok: false,
      status: 409,
      error: "Quadro foi modificado por outro usu\xE1rio. Recarregue e tente novamente."
    };
  }
  return {
    ok: true,
    columns: safeJson2(res.rows[0].columns, []),
    version: parseInt(res.rows[0].version, 10)
  };
}
app.post(
  "/api/boards/:id/columns",
  authenticateToken,
  requireBoardPermission("canManageBoard"),
  validateBody(columnCreateSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, accentColor, wipLimit, isDone, version } = req.body;
      const boardRes = await query("SELECT * FROM boards WHERE id = $1", [id]);
      if (boardRes.rows.length === 0) {
        return res.status(404).json({ error: "Quadro n\xE3o encontrado" });
      }
      const board = mapDbBoard(boardRes.rows[0]);
      if (board.columns.length >= 30) {
        return res.status(422).json({ error: "Limite de 30 colunas por quadro atingido" });
      }
      const newColumn = {
        id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        order: board.columns.length > 0 ? Math.max(...board.columns.map((c) => c.order)) + 1 : 0,
        accentColor: accentColor || "#64748b",
        ...wipLimit != null ? { wipLimit } : {},
        ...isDone ? { isDone: true } : {}
      };
      let columns = [...board.columns, newColumn];
      if (isDone) {
        columns = columns.map((c) => c.id === newColumn.id ? c : { ...c, isDone: false });
      }
      const result = await updateBoardColumnsWithLock(id, columns, version);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.status(201).json({ success: true, columns: result.columns, version: result.version });
    } catch (error) {
      console.error("Error creating column:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
app.patch(
  "/api/boards/:id/columns/:columnId",
  authenticateToken,
  requireBoardPermission("canManageBoard"),
  validateBody(columnUpdateSchema),
  async (req, res) => {
    try {
      const { id, columnId } = req.params;
      const { title, accentColor, wipLimit, isDone, version } = req.body;
      const boardRes = await query("SELECT * FROM boards WHERE id = $1", [id]);
      if (boardRes.rows.length === 0) {
        return res.status(404).json({ error: "Quadro n\xE3o encontrado" });
      }
      const board = mapDbBoard(boardRes.rows[0]);
      const idx = board.columns.findIndex((c) => c.id === columnId);
      if (idx === -1) {
        return res.status(404).json({ error: "Coluna n\xE3o encontrada" });
      }
      let columns = board.columns.map((c) => {
        if (c.id !== columnId) return c;
        const updated = { ...c };
        if (title !== void 0) updated.title = title;
        if (accentColor !== void 0) updated.accentColor = accentColor;
        if (wipLimit !== void 0) {
          if (wipLimit === null) delete updated.wipLimit;
          else updated.wipLimit = wipLimit;
        }
        if (isDone === true) updated.isDone = true;
        if (isDone === false) delete updated.isDone;
        return updated;
      });
      if (isDone === true) {
        columns = columns.map((c) => {
          if (c.id === columnId) return { ...c, isDone: true };
          const { isDone: _ignored, ...rest } = c;
          return rest;
        });
      }
      const result = await updateBoardColumnsWithLock(id, columns, version);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json({ success: true, columns: result.columns, version: result.version });
    } catch (error) {
      console.error("Error updating column:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
app.put(
  "/api/boards/:id/columns/reorder",
  authenticateToken,
  requireBoardPermission("canManageBoard"),
  validateBody(columnReorderSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { order, version } = req.body;
      const boardRes = await query("SELECT * FROM boards WHERE id = $1", [id]);
      if (boardRes.rows.length === 0) {
        return res.status(404).json({ error: "Quadro n\xE3o encontrado" });
      }
      const board = mapDbBoard(boardRes.rows[0]);
      const currentIds = board.columns.map((c) => c.id).sort();
      const newIds = [...order].sort();
      if (currentIds.length !== newIds.length || currentIds.some((cid, i) => cid !== newIds[i])) {
        return res.status(422).json({ error: "A lista de ordena\xE7\xE3o n\xE3o corresponde \xE0s colunas do quadro" });
      }
      const columns = order.map((colId, i) => {
        const col = board.columns.find((c) => c.id === colId);
        return { ...col, order: i };
      });
      const result = await updateBoardColumnsWithLock(id, columns, version);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json({ success: true, columns: result.columns, version: result.version });
    } catch (error) {
      console.error("Error reordering columns:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
app.delete("/api/boards/:id/columns/:columnId", authenticateToken, requireBoardPermission("canManageBoard"), async (req, res) => {
  try {
    const { id, columnId } = req.params;
    const reassignTo = req.query.reassignTo;
    const version = parseInt(req.query.version, 10);
    if (!Number.isInteger(version) || version < 1) {
      return res.status(400).json({ error: "Par\xE2metro version \xE9 obrigat\xF3rio" });
    }
    const boardRes = await query("SELECT * FROM boards WHERE id = $1", [id]);
    if (boardRes.rows.length === 0) {
      return res.status(404).json({ error: "Quadro n\xE3o encontrado" });
    }
    const board = mapDbBoard(boardRes.rows[0]);
    const col = board.columns.find((c) => c.id === columnId);
    if (!col) {
      return res.status(404).json({ error: "Coluna n\xE3o encontrada" });
    }
    if (board.columns.length <= 1) {
      return res.status(409).json({ error: "N\xE3o \xE9 poss\xEDvel remover a \xFAltima coluna do quadro" });
    }
    const countRes = await query(
      "SELECT COUNT(*)::int AS count FROM tasks WHERE board_id = $1 AND status_id = $2",
      [id, columnId]
    );
    const taskCount = countRes.rows[0].count;
    if (taskCount > 0 && !reassignTo) {
      return res.status(409).json({ error: `A coluna possui ${taskCount} tarefa(s). Informe reassignTo para mov\xEA-las.`, taskCount });
    }
    if (reassignTo) {
      const target = board.columns.find((c) => c.id === reassignTo);
      if (!target || reassignTo === columnId) {
        return res.status(422).json({ error: "Coluna de destino inv\xE1lida" });
      }
    }
    let columns = board.columns.filter((c) => c.id !== columnId);
    if (reassignTo) {
      columns = columns.map((c) => c.id === reassignTo ? { ...c, order: col.order } : c);
      columns.sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }));
    } else {
      columns = columns.map((c, i) => ({ ...c, order: i }));
    }
    if (col.isDone) {
      const newDoneId = reassignTo || columns[columns.length - 1]?.id;
      columns = columns.map((c) => c.id === newDoneId ? { ...c, isDone: true } : c);
    }
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");
      if (reassignTo && taskCount > 0) {
        await client2.query(
          "UPDATE tasks SET status_id = $1, updated_at = NOW() WHERE board_id = $2 AND status_id = $3",
          [reassignTo, id, columnId]
        );
      }
      const upd = await client2.query(
        `UPDATE boards SET columns = $1, version = version + 1, updated_at = NOW()
         WHERE id = $2 AND version = $3 RETURNING version`,
        [JSON.stringify(columns), id, version]
      );
      if (upd.rowCount === 0) {
        await client2.query("ROLLBACK");
        return res.status(409).json({ error: "Quadro foi modificado por outro usu\xE1rio. Recarregue e tente novamente." });
      }
      await client2.query("COMMIT");
      res.json({ success: true, columns, version: parseInt(upd.rows[0].version, 10) });
    } catch (err) {
      await client2.query("ROLLBACK");
      throw err;
    } finally {
      client2.release();
    }
  } catch (error) {
    console.error("Error deleting column:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/members", authenticateToken, validateBody(memberCreateSchema), async (req, res) => {
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
app.put("/api/members/:id", authenticateToken, validateBody(memberUpdateSchema), async (req, res) => {
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
    if (!fs2.existsSync(avatarsDir)) {
      return res.json({ files: [] });
    }
    const files = fs2.readdirSync(avatarsDir).filter((f) => /\.(png|jpe?g|svg|webp|gif)$/i.test(f));
    const list = files.map((filename) => ({
      filename,
      url: `/bucket/avatars/${filename}`
    }));
    res.json({ files: list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/bucket/upload", authenticateToken, async (req, res) => {
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
      fs2.writeFileSync(path2.resolve(avatarsDir, finalFilename), buffer);
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
app.post("/api/activities", authenticateToken, async (req, res) => {
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
app.put("/api/integrations/:id", authenticateToken, requireAdmin(), validateBody(integrationUpdateSchema), async (req, res) => {
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
        notify_on_sprint_start = $8, last_tested_at = $9, last_test_status = $10,
        notify_on_mention = $11, notify_on_assignment = $12, member_handles = $13
      WHERE id = $14`,
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
        merged.notifyOnMention,
        merged.notifyOnAssignment,
        JSON.stringify(merged.memberHandles || {}),
        id
      ]
    );
    res.json({ success: true, integration: merged });
  } catch (error) {
    console.error("Error updating integration:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/webhooks", authenticateToken, requireAdmin(), async (req, res) => {
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
app.post("/api/webhooks/test/:id", authenticateToken, requireAdmin(), async (req, res) => {
  try {
    const id = req.params.id;
    const result = await testIntegration(id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const lastStatus = result.status === "delivered" ? "success" : "failed";
    await query(`UPDATE integrations SET last_tested_at = $1, last_test_status = $2 WHERE id = $3`, [
      now,
      lastStatus,
      id
    ]);
    const logRes = await query("SELECT * FROM webhook_logs WHERE id = $1", [result.logId]);
    res.json({
      success: result.status === "delivered",
      integration: { id, lastTestedAt: now, lastTestStatus: lastStatus },
      log: logRes.rows[0] ? mapDbWebhookLog(logRes.rows[0]) : null,
      error: result.error
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
var checkIncomingLimit = makeRateLimiter(20, 6e4);
app.post("/api/webhooks/incoming", async (req, res) => {
  try {
    const ip = req.ip || "unknown";
    if (!checkIncomingLimit(`incoming:${ip}`)) {
      return res.status(429).json({ error: "Muitas requisi\xE7\xF5es. Tente novamente em 1 minuto." });
    }
    const secret = process.env.WEBHOOK_INCOMING_SECRET;
    if (!secret) return res.status(503).json({ error: "WEBHOOK_INCOMING_SECRET n\xE3o configurado" });
    const tsHeader = String(req.headers["x-brolabs-timestamp"] || "");
    const sigHeader = req.headers["x-brolabs-signature"];
    const raw = req.rawBody;
    if (!raw) return res.status(400).json({ error: "Corpo bruto ausente (envie application/json)" });
    const ver = verifyIncomingSignature(secret, tsHeader, raw, sigHeader);
    if (!ver.ok) return res.status(401).json({ error: `Assinatura rejeitada: ${ver.reason}` });
    const body = req.body || {};
    const action = body.action || (body.text ? "create" : void 0);
    if (action === "create") {
      const boardId = String(body.boardId || "");
      if (!boardId) return res.status(400).json({ error: "boardId \xE9 obrigat\xF3rio" });
      const boardRes = await query("SELECT * FROM boards WHERE id = $1", [boardId]);
      if (!boardRes.rows.length) return res.status(400).json({ error: "Board n\xE3o encontrado" });
      const board = mapDbBoard(boardRes.rows[0]);
      let title = "";
      let description = "";
      if (body.task && body.task.title) {
        title = String(body.task.title).trim();
        description = String(body.task.description || "");
      } else if (body.text) {
        const t = String(body.text).trim().replace(/^(criar|create|nova tarefa|nova|task|tarefa)\s+/i, "");
        const parts = t.split(/\s+\u2014\s+|\s+--\s+|\s+::\s+/);
        title = (parts[0] || "").trim();
        description = parts.slice(1).join(" \u2014 ").trim();
      }
      if (!title) return res.status(400).json({ error: "T\xEDtulo ausente (informe task.title ou text)" });
      if (title.length > 500) title = title.slice(0, 500);
      const cols = board.columns || [];
      const statusId = String(body.task?.statusId || cols[0]?.id || "col-backlog");
      const issueType = String(body.task?.issueType || "task").slice(0, 50);
      const priority = String(body.task?.priority || "medium").slice(0, 50);
      let assigneeIds = [];
      if (Array.isArray(body.task?.assigneeIds) && body.task.assigneeIds.length) {
        const ids = body.task.assigneeIds.map(String).slice(0, 100);
        const v = await query("SELECT id FROM members WHERE id = ANY($1)", [ids]);
        assigneeIds = v.rows.map((r) => r.id);
      }
      const countRes = await query("SELECT COUNT(*)::int AS n FROM tasks WHERE board_id = $1", [boardId]);
      const prefix = String(board.key || "TSK").slice(0, 20);
      let key = "";
      for (let n = (countRes.rows[0]?.n || 0) + 1; n < 1e5; n++) {
        const cand = `${prefix}-${n}`;
        const ex = await query("SELECT 1 FROM tasks WHERE board_id = $1 AND key = $2", [boardId, cand]);
        if (!ex.rowCount) {
          key = cand;
          break;
        }
      }
      if (!key) key = `${prefix}-${Date.now()}`;
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const dueDate = body.task?.dueDate ? String(body.task.dueDate).slice(0, 50) : "";
      await query(
        `INSERT INTO tasks (
          id, key, board_id, title, description, issue_type, priority, status_id,
          assignee_id, reporter_id, epic_id, estimated_hours, logged_hours, story_points,
          due_date, created_at, updated_at, subtasks, worklogs, comments, tags, dependencies,
          assignee_ids, parent_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
        [
          taskId,
          key,
          boardId,
          title,
          description,
          issueType,
          priority,
          statusId,
          assigneeIds[0] || "",
          "",
          body.task?.epicId || null,
          Number(body.task?.estimatedHours) || 0,
          0,
          Number(body.task?.storyPoints) || 0,
          dueDate,
          nowIso,
          nowIso,
          "[]",
          "[]",
          "[]",
          "[]",
          "[]",
          JSON.stringify(assigneeIds),
          body.task?.parentId || null
        ]
      );
      const task = {
        id: taskId,
        key,
        boardId,
        title,
        description,
        issueType,
        priority,
        statusId,
        assigneeIds,
        dueDate
      };
      if (assigneeIds.length) await handleTaskCreatedEvents(task);
      logger.info("incoming task created", { taskId, key, boardId });
      res.status(201).json({ success: true, task });
      return;
    }
    if (action === "update") {
      const ref = String(body.taskId || body.taskKey || "");
      if (!ref) return res.status(400).json({ error: "taskId ou taskKey \xE9 obrigat\xF3rio" });
      const taskRes = await query("SELECT * FROM tasks WHERE id = $1 OR key = $2", [ref, ref]);
      if (!taskRes.rows.length) return res.status(404).json({ error: "Tarefa n\xE3o encontrada" });
      const current = mapDbTask(taskRes.rows[0]);
      const t = body.task || {};
      const fields = [];
      const params = [];
      const set = (col, val) => {
        params.push(val);
        fields.push(`${col} = $${params.length}`);
      };
      if (t.title != null) {
        const v = String(t.title).trim();
        if (!v || v.length > 500) return res.status(400).json({ error: "T\xEDtulo inv\xE1lido" });
        set("title", v);
      }
      if (t.description != null) set("description", String(t.description).slice(0, 2e4));
      if (t.statusId) {
        const boardRes = await query("SELECT columns FROM boards WHERE id = $1", [current.boardId]);
        const cols = safeJson2(boardRes.rows[0]?.columns, []);
        if (!cols.some((c) => c.id === String(t.statusId))) {
          return res.status(400).json({ error: "statusId inv\xE1lido para este board" });
        }
        set("status_id", String(t.statusId));
      }
      if (!fields.length) {
        return res.status(400).json({ error: "Nada para atualizar (task.title/description/statusId)" });
      }
      set("updated_at", (/* @__PURE__ */ new Date()).toISOString());
      params.push(current.id);
      await query(`UPDATE tasks SET ${fields.join(", ")} WHERE id = $${params.length}`, params);
      const after = await query("SELECT * FROM tasks WHERE id = $1", [current.id]);
      const merged = mapDbTask(after.rows[0]);
      if (t.statusId && merged.statusId !== current.statusId) {
        void fireTaskUpdateEvents(current, merged, { statusId: merged.statusId });
      }
      logger.info("incoming task updated", { taskId: current.id, fields: fields.length });
      res.json({ success: true, task: merged });
      return;
    }
    res.status(400).json({ error: 'A\xE7\xE3o n\xE3o reconhecida. Use action: "create" ou "update".' });
  } catch (error) {
    console.error("incoming webhook failed:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/email/settings", authenticateToken, validateBody(emailSettingsSchema), async (req, res) => {
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
async function resolveNotificationOwnerRow(id) {
  const res = await query("SELECT * FROM email_notifications WHERE id = $1", [id]);
  return res.rows.length > 0 ? res.rows[0] : null;
}
function notificationOwnedBy(row, memberId, memberEmail) {
  if (row.member_id && row.member_id === memberId) return true;
  if (row.recipient_email && memberEmail && row.recipient_email.toLowerCase() === memberEmail.toLowerCase()) return true;
  return false;
}
app.post("/api/email/notifications", authenticateToken, async (req, res) => {
  try {
    const e = req.body;
    const meRes = await query("SELECT id, email FROM members WHERE id = $1", [req.memberId]);
    const me = meRes.rows[0] || {};
    if (e.taskId && e.triggerType && e.recipientEmail) {
      const dup = await query(
        `SELECT 1 FROM email_notifications
         WHERE task_id = $1 AND trigger_type = $2 AND LOWER(recipient_email) = LOWER($3)
           AND created_at > NOW() - INTERVAL '5 minutes'`,
        [e.taskId, e.triggerType, e.recipientEmail]
      );
      if (dup.rows.length > 0) {
        return res.status(201).json({ success: true, emailNotification: e, duplicate: true });
      }
    }
    let ownerId = null;
    if (e.recipientEmail) {
      const ownerRes = await query("SELECT id FROM members WHERE LOWER(email) = LOWER($1)", [e.recipientEmail]);
      ownerId = ownerRes.rows.length > 0 ? ownerRes.rows[0].id : null;
    }
    await query(
      `INSERT INTO email_notifications (
        id, trigger_type, task_id, task_key, task_title, recipient_email,
        recipient_name, sender_name, subject, content_preview, html_body, status, timestamp, read,
        member_id, next_attempt_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
        "pending",
        e.timestamp,
        Boolean(e.read),
        ownerId,
        /* @__PURE__ */ new Date()
      ]
    );
    try {
      const settingsRes = await query("SELECT enabled FROM email_settings LIMIT 1");
      if (settingsRes.rows[0]?.enabled && smtpConfigured()) {
        await processOutbox(5);
      }
    } catch (flushErr) {
      console.error("Email outbox flush failed (non-fatal):", flushErr);
    }
    res.status(201).json({ success: true, emailNotification: e });
  } catch (error) {
    console.error("Error creating email notification:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/email/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const meRes = await query("SELECT email, system_role FROM members WHERE id = $1", [req.memberId]);
    const me = meRes.rows[0] || {};
    const upd = await query(
      `UPDATE email_notifications SET read = TRUE
       WHERE id = $1 AND ($3 OR member_id = $2 OR LOWER(recipient_email) = LOWER($4))`,
      [id, req.memberId, me.system_role === "admin", me.email || ""]
    );
    if (upd.rowCount === 0) return res.status(404).json({ error: "Notifica\xE7\xE3o n\xE3o encontrada" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/email/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    const meRes = await query("SELECT email FROM members WHERE id = $1", [req.memberId]);
    const myEmail = meRes.rows[0]?.email || "";
    const upd = await query(
      `UPDATE email_notifications SET read = TRUE
       WHERE member_id = $1 OR LOWER(recipient_email) = LOWER($2)`,
      [req.memberId, myEmail]
    );
    res.json({ success: true, updated: upd.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/email/notifications", authenticateToken, async (req, res) => {
  try {
    const meRes = await query("SELECT email FROM members WHERE id = $1", [req.memberId]);
    const myEmail = meRes.rows[0]?.email || "";
    const del = await query(
      `DELETE FROM email_notifications
       WHERE member_id = $1 OR LOWER(recipient_email) = LOWER($2)`,
      [req.memberId, myEmail]
    );
    res.json({ success: true, deleted: del.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/email/notifications/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const row = await resolveNotificationOwnerRow(id);
    const meRes = await query("SELECT email, system_role FROM members WHERE id = $1", [req.memberId]);
    const me = meRes.rows[0] || {};
    const isAdmin = me.system_role === "admin";
    if (!row || !isAdmin && !notificationOwnedBy(row, req.memberId, me.email || "")) {
      return res.status(404).json({ error: "Notifica\xE7\xE3o n\xE3o encontrada" });
    }
    await query("DELETE FROM email_notifications WHERE id = $1", [id]);
    res.json({ success: true, deleted: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/email/status", authenticateToken, async (req, res) => {
  try {
    res.json({
      configured: smtpConfigured(),
      provider: "smtp",
      host: smtpConfigured() ? smtpHost() : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/email/test", authenticateToken, requireAdmin(), validateBody(emailTestSchema), async (req, res) => {
  try {
    const { to } = req.body;
    const settingsRes = await query("SELECT * FROM email_settings LIMIT 1");
    const settings = settingsRes.rows[0];
    const messageId = await sendEmail({
      to,
      subject: "Teste de e-mail \u2014 Brolabs Workflow",
      html: renderTestEmail(to),
      fromEmail: settings?.sender_email || void 0,
      fromName: settings?.sender_name || void 0
    });
    res.json({ success: true, messageId });
  } catch (error) {
    console.error("Test email failed:", error);
    res.status(502).json({ error: error.message });
  }
});
app.post("/api/email/notifications/:id/retry", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === "true";
    const row = await resolveNotificationOwnerRow(id);
    const meRes = await query("SELECT email, system_role FROM members WHERE id = $1", [req.memberId]);
    const me = meRes.rows[0] || {};
    const isAdmin = me.system_role === "admin";
    if (!row || !isAdmin && !notificationOwnedBy(row, req.memberId, me.email || "")) {
      return res.status(404).json({ error: "Notifica\xE7\xE3o n\xE3o encontrada" });
    }
    if (row.status === "sent" && !force) {
      return res.status(409).json({ error: "Notifica\xE7\xE3o j\xE1 enviada. Use ?force=true para reenviar." });
    }
    await query(
      `UPDATE email_notifications SET status = 'pending', next_attempt_at = NOW() WHERE id = $1`,
      [id]
    );
    try {
      const settingsRes = await query("SELECT enabled FROM email_settings LIMIT 1");
      if (settingsRes.rows[0]?.enabled && smtpConfigured()) {
        await processOutbox(1);
      }
    } catch (flushErr) {
      console.error("Email retry flush failed (non-fatal):", flushErr);
    }
    res.status(202).json({ success: true, status: "pending" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/cron/process-emails", async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
    if (!secret) return res.status(503).json({ error: "CRON_SECRET n\xE3o configurado" });
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto3.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "Token inv\xE1lido" });
    }
    const result = await processOutbox(50);
    const webhooks = await processWebhookOutbox(50);
    res.json({ success: true, ...result, webhooks });
  } catch (error) {
    console.error("Process emails cron failed:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/members/me/preferences", authenticateToken, async (req, res) => {
  try {
    const r = await query("SELECT preferences FROM members WHERE id = $1", [req.memberId]);
    if (r.rows.length === 0) return res.status(404).json({ error: "Membro n\xE3o encontrado" });
    res.json({ preferences: safeJsonOrRaw(r.rows[0].preferences, {}) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/members/me/preferences", authenticateToken, validateBody(memberPreferencesSchema), async (req, res) => {
  try {
    const currentRes = await query("SELECT preferences FROM members WHERE id = $1", [req.memberId]);
    if (currentRes.rows.length === 0) return res.status(404).json({ error: "Membro n\xE3o encontrado" });
    const current = safeJsonOrRaw(currentRes.rows[0].preferences, {});
    const merged = { ...current, ...req.body };
    await query("UPDATE members SET preferences = $1 WHERE id = $2", [
      JSON.stringify(merged),
      req.memberId
    ]);
    res.json({ preferences: merged });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
function mapDbAttachment(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    boardId: row.board_id,
    uploaderId: row.uploader_id || "",
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at
  };
}
async function findTaskRowForAttachment(taskId) {
  const r = await query("SELECT * FROM tasks WHERE id = $1", [taskId]);
  return r.rows.length > 0 ? r.rows[0] : null;
}
function attachmentPath(boardId, taskId, attachmentId, filename) {
  return `${boardId}/${taskId}/${attachmentId}.${extensionOf(filename)}`;
}
app.post(
  "/api/tasks/:id/attachments/upload-url",
  authenticateToken,
  validateBody(attachmentUploadSchema),
  async (req, res) => {
    try {
      const taskRow = await findTaskRowForAttachment(req.params.id);
      if (!taskRow) return res.status(404).json({ error: "Task not found" });
      const eff = await resolvePermissions(req.memberId, taskRow.board_id);
      if (!eff) return res.status(403).json({ error: "Sem acesso a este quadro" });
      if (!eff.canEditTask) {
        return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canEditTask" });
      }
      const { filename, mimeType, sizeBytes } = req.body;
      if (sizeBytes > ATTACHMENT_MAX_BYTES) {
        return res.status(413).json({ error: "Arquivo excede o limite de 10 MB" });
      }
      if (!isAllowedExtension(filename)) {
        return res.status(415).json({
          error: "Tipo de arquivo n\xE3o permitido. Use: png, jpg, jpeg, gif, webp, pdf, csv, txt, zip, md, doc, docx, xls ou xlsx"
        });
      }
      if (mimeType === "image/svg+xml") {
        return res.status(415).json({ error: "SVG n\xE3o \xE9 permitido (risco de XSS)" });
      }
      const countRes = await query(
        "SELECT COUNT(*)::int AS n FROM task_attachments WHERE task_id = $1",
        [req.params.id]
      );
      if (countRes.rows[0].n >= ATTACHMENT_MAX_PER_TASK) {
        return res.status(409).json({ error: `Limite de ${ATTACHMENT_MAX_PER_TASK} anexos por tarefa` });
      }
      const supabase = getStorage();
      if (!supabase) {
        return res.status(503).json({
          error: "Storage n\xE3o configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente."
        });
      }
      const attachmentId = `att-${Date.now()}-${crypto3.randomBytes(4).toString("hex")}`;
      const storagePath = attachmentPath(taskRow.board_id, req.params.id, attachmentId, filename);
      const { data, error } = await supabase.storage.from(storageBucket()).createSignedUploadUrl(storagePath);
      if (error || !data) {
        return res.status(500).json({ error: error?.message || "Falha ao gerar URL de upload" });
      }
      res.status(201).json({
        attachmentId,
        uploadUrl: data.signedUrl,
        token: data.token
      });
    } catch (error) {
      console.error("Error creating upload url:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
app.post(
  "/api/tasks/:id/attachments/confirm",
  authenticateToken,
  validateBody(attachmentConfirmSchema),
  async (req, res) => {
    try {
      const taskRow = await findTaskRowForAttachment(req.params.id);
      if (!taskRow) return res.status(404).json({ error: "Task not found" });
      const eff = await resolvePermissions(req.memberId, taskRow.board_id);
      if (!eff) return res.status(403).json({ error: "Sem acesso a este quadro" });
      if (!eff.canEditTask) {
        return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canEditTask" });
      }
      const { attachmentId, filename, mimeType, sizeBytes } = req.body;
      if (sizeBytes > ATTACHMENT_MAX_BYTES) {
        return res.status(413).json({ error: "Arquivo excede o limite de 10 MB" });
      }
      if (!isAllowedExtension(filename) || mimeType === "image/svg+xml") {
        return res.status(415).json({ error: "Tipo de arquivo n\xE3o permitido" });
      }
      const supabase = getStorage();
      if (!supabase) {
        return res.status(503).json({ error: "Storage n\xE3o configurado" });
      }
      const storagePath = attachmentPath(taskRow.board_id, req.params.id, attachmentId, filename);
      const meta = await statObject(storagePath);
      if (!meta) {
        return res.status(422).json({ error: "Arquivo n\xE3o encontrado no storage" });
      }
      const insertRes = await query(
        `INSERT INTO task_attachments (id, task_id, board_id, uploader_id, original_name, storage_path, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [attachmentId, req.params.id, taskRow.board_id, req.memberId, filename, storagePath, mimeType, sizeBytes]
      );
      if (insertRes.rows.length === 0) {
        return res.status(409).json({ error: "Anexo j\xE1 confirmado" });
      }
      res.status(201).json({ success: true, attachment: mapDbAttachment(insertRes.rows[0]) });
    } catch (error) {
      console.error("Error confirming attachment:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
app.get("/api/tasks/:id/attachments", authenticateToken, async (req, res) => {
  try {
    const taskRow = await findTaskRowForAttachment(req.params.id);
    if (!taskRow) return res.status(404).json({ error: "Task not found" });
    const eff = await resolvePermissions(req.memberId, taskRow.board_id);
    if (!eff) return res.status(403).json({ error: "Sem acesso a este quadro" });
    const rows = await query(
      "SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at DESC",
      [req.params.id]
    );
    res.json({ attachments: rows.rows.map(mapDbAttachment) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/tasks/:id/attachments/:attId/url", authenticateToken, async (req, res) => {
  try {
    const taskRow = await findTaskRowForAttachment(req.params.id);
    if (!taskRow) return res.status(404).json({ error: "Task not found" });
    const eff = await resolvePermissions(req.memberId, taskRow.board_id);
    if (!eff) return res.status(403).json({ error: "Sem acesso a este quadro" });
    const attRes = await query(
      "SELECT * FROM task_attachments WHERE id = $1 AND task_id = $2",
      [req.params.attId, req.params.id]
    );
    if (attRes.rows.length === 0) return res.status(404).json({ error: "Anexo n\xE3o encontrado" });
    const supabase = getStorage();
    if (!supabase) return res.status(503).json({ error: "Storage n\xE3o configurado" });
    const { data, error } = await supabase.storage.from(storageBucket()).createSignedUrl(attRes.rows[0].storage_path, SIGNED_GET_TTL_SEC);
    if (error || !data) {
      return res.status(500).json({ error: error?.message || "Falha ao gerar URL de download" });
    }
    res.json({ url: data.signedUrl, expiresIn: SIGNED_GET_TTL_SEC });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/tasks/:id/attachments/:attId", authenticateToken, async (req, res) => {
  try {
    const taskRow = await findTaskRowForAttachment(req.params.id);
    if (!taskRow) return res.status(404).json({ error: "Task not found" });
    const eff = await resolvePermissions(req.memberId, taskRow.board_id);
    if (!eff) return res.status(403).json({ error: "Sem acesso a este quadro" });
    if (!eff.canEditTask) {
      return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canEditTask" });
    }
    const attRes = await query(
      "DELETE FROM task_attachments WHERE id = $1 AND task_id = $2 RETURNING storage_path",
      [req.params.attId, req.params.id]
    );
    if (attRes.rows.length === 0) return res.status(404).json({ error: "Anexo n\xE3o encontrado" });
    await removeObject(attRes.rows[0].storage_path);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/cron/cleanup-attachments", async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
    if (!secret) {
      return res.status(503).json({ error: "CRON_SECRET n\xE3o configurado" });
    }
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto3.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "Token inv\xE1lido" });
    }
    const supabase = getStorage();
    if (!supabase) return res.status(503).json({ error: "Storage n\xE3o configurado" });
    const cutoff = Date.now() - 24 * 60 * 60 * 1e3;
    const removed = [];
    let scanned = 0;
    const boardsRes = await query("SELECT id FROM boards");
    for (const board of boardsRes.rows) {
      const taskDirs = await listObjects(board.id);
      for (const dir of taskDirs) {
        if (dir.id !== null) continue;
        const files = await listObjects(`${board.id}/${dir.name}`);
        for (const file of files) {
          if (file.id === null) continue;
          const createdAt = file.created_at ? Date.parse(file.created_at) : NaN;
          if (Number.isNaN(createdAt) || createdAt > cutoff) continue;
          scanned++;
          const storagePath = `${board.id}/${dir.name}/${file.name}`;
          const rowRes = await query(
            "SELECT 1 FROM task_attachments WHERE storage_path = $1",
            [storagePath]
          );
          if (rowRes.rows.length === 0) {
            const ok = await removeObject(storagePath);
            if (ok) removed.push(storagePath);
          }
        }
      }
    }
    res.json({ success: true, scanned, removed });
  } catch (error) {
    console.error("Cleanup attachments failed:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/boards/:id/members", authenticateToken, requireBoardAccess(), async (req, res) => {
  try {
    const rows = await query(
      `SELECT bm.role, bm.permissions, bm.created_at AS joined_at,
              m.id, m.name, m.email, m.avatar, m.role AS job_title, m.active
       FROM board_members bm
       INNER JOIN members m ON m.id = bm.member_id
       WHERE bm.board_id = $1
       ORDER BY bm.created_at ASC, m.name ASC`,
      [req.params.id]
    );
    res.json({
      members: rows.rows.map((r) => ({
        memberId: r.id,
        name: r.name,
        email: r.email,
        avatar: r.avatar || "",
        jobTitle: r.job_title || "",
        active: Boolean(r.active),
        role: r.role,
        permissions: safeJsonOrRaw(r.permissions),
        joinedAt: r.joined_at
      })),
      myRole: req.boardPermissions?.role
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post(
  "/api/boards/:id/members",
  authenticateToken,
  requireBoardPermission("canInviteMember"),
  validateBody(boardMemberInviteSchema),
  async (req, res) => {
    try {
      const { email, role = "editor", permissions = {} } = req.body;
      const memberRes = await query("SELECT * FROM members WHERE email = $1", [email]);
      if (memberRes.rows.length === 0) {
        return res.status(404).json({ error: "Membro n\xE3o encontrado com esse email" });
      }
      const memberId = memberRes.rows[0].id;
      const exists = await query(
        "SELECT 1 FROM board_members WHERE board_id = $1 AND member_id = $2",
        [req.params.id, memberId]
      );
      if (exists.rows.length > 0) {
        return res.status(409).json({ error: "Este membro j\xE1 participa do quadro" });
      }
      await query(
        `INSERT INTO board_members (board_id, member_id, role, permissions, invited_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, memberId, role, JSON.stringify(permissions), req.memberId]
      );
      res.status(201).json({
        success: true,
        member: {
          memberId,
          name: memberRes.rows[0].name,
          email: memberRes.rows[0].email,
          avatar: memberRes.rows[0].avatar || "",
          jobTitle: memberRes.rows[0].role || "",
          active: Boolean(memberRes.rows[0].active),
          role,
          permissions,
          joinedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } catch (error) {
      console.error("Error inviting board member:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
app.patch(
  "/api/boards/:id/members/:memberId",
  authenticateToken,
  requireBoardPermission("canManageMembers"),
  validateBody(boardMemberPatchSchema),
  async (req, res) => {
    try {
      const { id: boardId, memberId } = req.params;
      const { role, permissions } = req.body;
      const currentRes = await query(
        "SELECT * FROM board_members WHERE board_id = $1 AND member_id = $2",
        [boardId, memberId]
      );
      if (currentRes.rows.length === 0) {
        return res.status(404).json({ error: "Membro n\xE3o encontrado neste quadro" });
      }
      if (role && role !== "owner" && currentRes.rows[0].role === "owner") {
        const ownersRes = await query(
          "SELECT COUNT(*)::int AS n FROM board_members WHERE board_id = $1 AND role = 'owner'",
          [boardId]
        );
        if (ownersRes.rows[0].n <= 1) {
          return res.status(409).json({ error: "N\xE3o \xE9 poss\xEDvel rebaixar o \xFAltimo owner do quadro" });
        }
      }
      const updated = await query(
        `UPDATE board_members
         SET role = COALESCE($1, role),
             permissions = COALESCE($2, permissions)
         WHERE board_id = $3 AND member_id = $4
         RETURNING *`,
        [role ?? null, permissions ? JSON.stringify(permissions) : null, boardId, memberId]
      );
      res.json({
        success: true,
        member: {
          memberId,
          role: updated.rows[0].role,
          permissions: safeJsonOrRaw(updated.rows[0].permissions)
        }
      });
    } catch (error) {
      console.error("Error updating board member:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
app.delete("/api/boards/:id/members/:memberId", authenticateToken, async (req, res) => {
  try {
    const { id: boardId, memberId } = req.params;
    const eff = await resolvePermissions(req.memberId, boardId);
    if (!eff) return res.status(403).json({ error: "Sem acesso a este quadro" });
    const isSelf = memberId === req.memberId;
    if (!eff.canManageMembers && !isSelf) {
      return res.status(403).json({ error: "Sem permiss\xE3o para esta a\xE7\xE3o", required: "canManageMembers" });
    }
    const currentRes = await query(
      "SELECT * FROM board_members WHERE board_id = $1 AND member_id = $2",
      [boardId, memberId]
    );
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: "Membro n\xE3o encontrado neste quadro" });
    }
    if (currentRes.rows[0].role === "owner") {
      const ownersRes = await query(
        "SELECT COUNT(*)::int AS n FROM board_members WHERE board_id = $1 AND role = 'owner'",
        [boardId]
      );
      if (ownersRes.rows[0].n <= 1) {
        return res.status(409).json({ error: "N\xE3o \xE9 poss\xEDvel remover o \xFAltimo owner do quadro" });
      }
    }
    await query("DELETE FROM board_members WHERE board_id = $1 AND member_id = $2", [
      boardId,
      memberId
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing board member:", error);
    res.status(500).json({ error: error.message });
  }
});
var TODO_MAX_PER_DAY = 200;
function mapDbTodo(row) {
  const d = row.due_date;
  return {
    id: row.id,
    memberId: row.member_id,
    boardId: row.board_id ?? null,
    title: row.title,
    done: row.done,
    dueDate: d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10),
    sourceTaskId: row.source_task_id ?? null,
    position: row.position,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null
  };
}
async function findOwnedTodo(id, memberId) {
  const r = await query("SELECT * FROM daily_todos WHERE id = $1 AND member_id = $2", [id, memberId]);
  return r.rows.length > 0 ? r.rows[0] : null;
}
async function buildTodoSuggestions(memberId, today) {
  const boardsRes = await query(
    `SELECT b.id, b.key, b.columns FROM boards b
     JOIN board_members bm ON bm.board_id = b.id AND bm.member_id = $1`,
    [memberId]
  );
  const boardIds = boardsRes.rows.map((b) => b.id);
  if (boardIds.length === 0) return [];
  const tasksRes = await query(
    `SELECT * FROM tasks
     WHERE archived_at IS NULL
       AND (assignee_id = $1
            OR $1 = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(assignee_ids, '[]'::jsonb)))))
       AND due_date IS NOT NULL AND due_date <> ''
       AND LEFT(due_date, 10) <= $2
     ORDER BY due_date ASC LIMIT 25`,
    [memberId, today]
  );
  if (tasksRes.rows.length === 0) return [];
  const linkedRes = await query(
    `SELECT source_task_id FROM daily_todos
     WHERE member_id = $1 AND source_task_id IS NOT NULL`,
    [memberId]
  );
  const linked = new Set(linkedRes.rows.map((r) => r.source_task_id));
  const boardMeta = /* @__PURE__ */ new Map();
  for (const b of boardsRes.rows) {
    const cols = safeJson2(b.columns, []);
    const doneIds = new Set(
      cols.filter((c) => c.isDone).map((c) => String(c.id))
    );
    const title = new Map(
      cols.map((c) => [String(c.id), String(c.title || "")])
    );
    boardMeta.set(b.id, { key: b.key, doneIds, title });
  }
  return tasksRes.rows.filter((t) => !linked.has(t.id)).map((t) => {
    const meta = boardMeta.get(t.board_id);
    const statusTitle = meta?.title.get(String(t.status_id)) || String(t.status_id || "");
    const due = String(t.due_date || "").slice(0, 10);
    return {
      id: t.id,
      key: t.key,
      title: t.title,
      boardId: t.board_id,
      boardKey: meta?.key || "",
      priority: t.priority,
      dueDate: due,
      statusId: t.status_id,
      statusTitle,
      isOverdue: due < today
    };
  }).filter((s) => !boardMeta.get(s.boardId)?.doneIds.has(s.statusId));
}
app.get("/api/todos", authenticateToken, async (req, res) => {
  try {
    const parsed = todoListQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Data inv\xE1lida" });
    const today = parsed.data.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const [todosRes, suggested] = await Promise.all([
      query(
        `SELECT * FROM daily_todos WHERE member_id = $1 AND due_date = $2::date
         ORDER BY done ASC, position ASC, created_at ASC LIMIT 500`,
        [req.memberId, today]
      ),
      buildTodoSuggestions(req.memberId, today)
    ]);
    res.json({ todos: todosRes.rows.map(mapDbTodo), suggested });
  } catch (error) {
    console.error("Error listing todos:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/todos", authenticateToken, validateBody(todoCreateSchema), async (req, res) => {
  try {
    const { title, dueDate, boardId, sourceTaskId } = req.body;
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const targetDate = dueDate || today;
    const countRes = await query(
      `SELECT COUNT(*)::int AS n FROM daily_todos WHERE member_id = $1 AND due_date = $2::date`,
      [req.memberId, targetDate]
    );
    if ((countRes.rows[0]?.n ?? 0) >= TODO_MAX_PER_DAY) {
      return res.status(429).json({ error: `Limite de ${TODO_MAX_PER_DAY} itens por dia atingido` });
    }
    const posRes = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM daily_todos WHERE member_id = $1 AND due_date = $2::date`,
      [req.memberId, targetDate]
    );
    const id = `todo-${crypto3.randomUUID().slice(0, 8)}`;
    const r = await query(
      `INSERT INTO daily_todos (id, member_id, board_id, title, due_date, source_task_id, position)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7) RETURNING *`,
      [id, req.memberId, boardId ?? null, title, targetDate, sourceTaskId ?? null, posRes.rows[0].p]
    );
    res.status(201).json({ todo: mapDbTodo(r.rows[0]) });
  } catch (error) {
    console.error("Error creating todo:", error);
    res.status(500).json({ error: error.message });
  }
});
app.patch("/api/todos/:id", authenticateToken, validateBody(todoUpdateSchema), async (req, res) => {
  try {
    const row = await findOwnedTodo(req.params.id, req.memberId);
    if (!row) return res.status(404).json({ error: "Item n\xE3o encontrado" });
    const sets = [];
    const vals = [];
    let i = 1;
    const b = req.body;
    if (b.title !== void 0) {
      sets.push(`title = $${i++}`);
      vals.push(b.title);
    }
    if (b.done !== void 0) {
      sets.push(`done = $${i++}`, `completed_at = $${i++}`);
      vals.push(b.done, b.done ? /* @__PURE__ */ new Date() : null);
    }
    if (b.dueDate !== void 0) {
      sets.push(`due_date = $${i++}::date`);
      vals.push(b.dueDate);
    }
    if (b.position !== void 0) {
      sets.push(`position = $${i++}`);
      vals.push(b.position);
    }
    vals.push(req.params.id, req.memberId);
    const r = await query(
      `UPDATE daily_todos SET ${sets.join(", ")} WHERE id = $${i++} AND member_id = $${i} RETURNING *`,
      vals
    );
    res.json({ todo: mapDbTodo(r.rows[0]) });
  } catch (error) {
    console.error("Error updating todo:", error);
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/todos/:id", authenticateToken, async (req, res) => {
  try {
    const r = await query("DELETE FROM daily_todos WHERE id = $1 AND member_id = $2", [
      req.params.id,
      req.memberId
    ]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Item n\xE3o encontrado" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting todo:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/todos/from-task/:taskId", authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const taskRes = await query(
      `SELECT t.* FROM tasks t
       JOIN board_members bm ON bm.board_id = t.board_id AND bm.member_id = $2
       WHERE t.id = $1`,
      [taskId, req.memberId]
    );
    if (taskRes.rows.length === 0) return res.status(404).json({ error: "Tarefa n\xE3o encontrada" });
    const t = taskRes.rows[0];
    const dup = await query(
      "SELECT 1 FROM daily_todos WHERE member_id = $1 AND source_task_id = $2",
      [req.memberId, taskId]
    );
    if (dup.rows.length > 0) return res.status(409).json({ error: "Tarefa j\xE1 est\xE1 na sua To-Do" });
    const countRes = await query(
      `SELECT COUNT(*)::int AS n FROM daily_todos WHERE member_id = $1 AND due_date = $2::date`,
      [req.memberId, today]
    );
    if ((countRes.rows[0]?.n ?? 0) >= TODO_MAX_PER_DAY) {
      return res.status(429).json({ error: `Limite de ${TODO_MAX_PER_DAY} itens por dia atingido` });
    }
    const posRes = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM daily_todos WHERE member_id = $1 AND due_date = $2::date`,
      [req.memberId, today]
    );
    const due = t.due_date ? String(t.due_date).slice(0, 10) : today;
    const id = `todo-${crypto3.randomUUID().slice(0, 8)}`;
    const r = await query(
      `INSERT INTO daily_todos (id, member_id, board_id, title, due_date, source_task_id, position)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7) RETURNING *`,
      [id, req.memberId, t.board_id, t.title, due, taskId, posRes.rows[0].p]
    );
    res.status(201).json({ todo: mapDbTodo(r.rows[0]) });
  } catch (error) {
    console.error("Error creating todo from task:", error);
    res.status(500).json({ error: error.message });
  }
});
function mapDbNote(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    memberId: row.member_id,
    authorName: row.author_name || "",
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    aiGenerated: row.ai_generated,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
async function loadNoteWithAccess(id, memberId) {
  const r = await query("SELECT * FROM notes WHERE id = $1", [id]);
  if (r.rows.length === 0) return null;
  const eff = await resolvePermissions(memberId, r.rows[0].board_id);
  return { note: r.rows[0], eff };
}
app.get("/api/notes", authenticateToken, async (req, res) => {
  try {
    const boardId = typeof req.query.boardId === "string" ? req.query.boardId : "";
    if (!boardId) return res.status(400).json({ error: "boardId obrigat\xF3rio" });
    const eff = await resolvePermissions(req.memberId, boardId);
    if (!eff) return res.status(403).json({ error: "Sem acesso a este quadro" });
    const r = await query(
      `SELECT n.*, m.name AS author_name FROM notes n
       LEFT JOIN members m ON m.id = n.member_id
       WHERE n.board_id = $1
       ORDER BY n.pinned DESC, n.updated_at DESC LIMIT 300`,
      [boardId]
    );
    res.json({ notes: r.rows.map(mapDbNote) });
  } catch (error) {
    console.error("Error listing notes:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/notes", authenticateToken, validateBody(noteCreateSchema), async (req, res) => {
  try {
    const { boardId, title, content } = req.body;
    const eff = await resolvePermissions(req.memberId, boardId);
    if (!eff) return res.status(403).json({ error: "Sem acesso a este quadro" });
    if (eff.role === "viewer") return res.status(403).json({ error: "Sem permiss\xE3o para criar notas" });
    const id = `note-${crypto3.randomUUID().slice(0, 8)}`;
    const r = await query(
      `INSERT INTO notes (id, board_id, member_id, title, content)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, boardId, req.memberId, title || "Sem t\xEDtulo", content || ""]
    );
    res.status(201).json({ note: mapDbNote(r.rows[0]) });
  } catch (error) {
    console.error("Error creating note:", error);
    res.status(500).json({ error: error.message });
  }
});
app.patch("/api/notes/:id", authenticateToken, validateBody(noteUpdateSchema), async (req, res) => {
  try {
    const loaded = await loadNoteWithAccess(req.params.id, req.memberId);
    if (!loaded || !loaded.eff) return res.status(404).json({ error: "Nota n\xE3o encontrada" });
    const { note, eff } = loaded;
    const isAuthor = note.member_id === req.memberId;
    if (!isAuthor && !eff.canManageBoard) {
      return res.status(403).json({ error: "Sem permiss\xE3o para editar esta nota" });
    }
    const sets = [];
    const vals = [];
    let i = 1;
    const b = req.body;
    if (b.title !== void 0) {
      sets.push(`title = $${i++}`);
      vals.push(b.title);
    }
    if (b.content !== void 0) {
      sets.push(`content = $${i++}`);
      vals.push(b.content);
    }
    if (b.pinned !== void 0) {
      sets.push(`pinned = $${i++}`);
      vals.push(b.pinned);
    }
    vals.push(req.params.id);
    const r = await query(
      `UPDATE notes SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i} RETURNING *`,
      vals
    );
    res.json({ note: mapDbNote(r.rows[0]) });
  } catch (error) {
    console.error("Error updating note:", error);
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/notes/:id", authenticateToken, async (req, res) => {
  try {
    const loaded = await loadNoteWithAccess(req.params.id, req.memberId);
    if (!loaded || !loaded.eff) return res.status(404).json({ error: "Nota n\xE3o encontrada" });
    const { note, eff } = loaded;
    if (note.member_id !== req.memberId && !eff.canManageBoard) {
      return res.status(403).json({ error: "Sem permiss\xE3o para excluir esta nota" });
    }
    await query("DELETE FROM notes WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/notes/:id/ai", authenticateToken, validateBody(noteAiSchema), async (req, res) => {
  const { action } = req.body;
  const memberId = req.memberId;
  let inputChars = 0;
  try {
    const loaded = await loadNoteWithAccess(req.params.id, memberId);
    if (!loaded || !loaded.eff) return res.status(404).json({ error: "Nota n\xE3o encontrada" });
    if (loaded.eff.role === "viewer") {
      return res.status(403).json({ error: "Sem permiss\xE3o para executar IA nesta nota" });
    }
    const note = loaded.note;
    if (!note.content.trim()) return res.status(400).json({ error: "Nota vazia" });
    if (!aiConfigured()) {
      await logAiUsage(memberId, action, note.content.length, 0, "error");
      return res.status(503).json({ error: "IA n\xE3o configurada", unavailable: true });
    }
    const retryAfter = await checkAiRateLimit(memberId);
    if (retryAfter) {
      await logAiUsage(memberId, action, note.content.length, 0, "rate_limited");
      const minutes = Math.max(1, Math.ceil((retryAfter.getTime() - Date.now()) / 6e4));
      return res.status(429).json({ error: `Limite de 20 usos/h atingido. Tente em ${minutes} min`, retryAfterMinutes: minutes });
    }
    const instructions = {
      summarize: "Resuma o conte\xFAdo abaixo em markdown conciso.",
      expand: "Expanda o conte\xFAdo abaixo mantendo o mesmo t\xF3pico e adicionando detalhes \xFAteis.",
      action_items: "Extraia itens de a\xE7\xE3o (checkboxes markdown) do conte\xFAdo abaixo, com respons\xE1vel quando mencionado."
    };
    inputChars = note.content.length;
    const prompt = `${instructions[action]}

<<<NOTA>>>
${note.content.slice(0, 2e4)}
<<<END>>>`;
    const output = await runAi(prompt);
    await logAiUsage(memberId, action, inputChars, output.length, "ok");
    res.json({
      content: output,
      usage: { action, inputChars, outputChars: output.length, provider: aiProvider(), model: aiModel() }
    });
  } catch (error) {
    const status = error instanceof AiUnavailableError ? 503 : 502;
    await logAiUsage(memberId, action, inputChars, 0, "error").catch(() => {
    });
    console.error("Note AI action failed:", error);
    res.status(status).json({ error: error.message || "Falha na IA" });
  }
});
app.post("/api/notes/ai/from-sprint", authenticateToken, validateBody(noteFromSprintSchema), async (req, res) => {
  const { boardId } = req.body;
  const memberId = req.memberId;
  let inputChars = 0;
  try {
    const eff = await resolvePermissions(memberId, boardId);
    if (!eff) return res.status(403).json({ error: "Sem acesso a este quadro" });
    if (eff.role === "viewer") {
      return res.status(403).json({ error: "Sem permiss\xE3o para criar notas" });
    }
    if (!aiConfigured()) {
      await logAiUsage(memberId, "from_sprint", 0, 0, "error");
      return res.status(503).json({ error: "IA n\xE3o configurada", unavailable: true });
    }
    const retryAfter = await checkAiRateLimit(memberId);
    if (retryAfter) {
      await logAiUsage(memberId, "from_sprint", 0, 0, "rate_limited");
      const minutes = Math.max(1, Math.ceil((retryAfter.getTime() - Date.now()) / 6e4));
      return res.status(429).json({ error: `Limite de 20 usos/h atingido. Tente em ${minutes} min`, retryAfterMinutes: minutes });
    }
    const boardRes = await query("SELECT * FROM boards WHERE id = $1", [boardId]);
    if (boardRes.rows.length === 0) return res.status(404).json({ error: "Quadro n\xE3o encontrado" });
    const board = boardRes.rows[0];
    const tasksRes = await query(
      `SELECT t.* FROM tasks t
       WHERE t.board_id = $1 AND t.archived_at IS NULL
       ORDER BY t.created_at DESC LIMIT 50`,
      [boardId]
    );
    const aiTaskRows = tasksRes.rows.map((t) => ({
      t,
      ids: normalizeAssigneeIds(safeJson2(t.assignee_ids, []), t.assignee_id ? [t.assignee_id] : [])
    }));
    const aiAssigneeIds = [...new Set(aiTaskRows.flatMap((x) => x.ids))];
    const aiNameById = /* @__PURE__ */ new Map();
    if (aiAssigneeIds.length > 0) {
      const mRes = await query("SELECT id, name FROM members WHERE id = ANY($1)", [aiAssigneeIds]);
      for (const r2 of mRes.rows) aiNameById.set(String(r2.id), String(r2.name));
    }
    const statusTitle = new Map(
      safeJson2(board.columns, []).map((c) => [String(c.id), String(c.title || "")])
    );
    const lines = aiTaskRows.map(({ t, ids }) => {
      const responsible = ids.map((id2) => aiNameById.get(id2)).filter(Boolean).join(", ");
      return `- ${t.key} | ${String(t.title).slice(0, 120)} | status: ${statusTitle.get(String(t.status_id)) || t.status_id} | prioridade: ${t.priority} | vence: ${t.due_date ? String(t.due_date).slice(0, 10) : "-"} | pontos: ${t.story_points ?? "-"} | respons\xE1vel: ${responsible || "-"}`;
    });
    const context = lines.join("\n");
    inputChars = context.length;
    const prompt = `Gere um resumo executivo da sprint em markdown (pt-BR) do quadro "${board.name}".
Inclua se\xE7\xF5es: Vis\xE3o geral, Em andamento, Atrasados/riscos, Conclu\xEDdos.
N\xE3o invente dados. Use apenas o contexto.

<<<CONTEXTO>>>
${context}
<<<END>>>`;
    const output = await runAi(prompt);
    const id = `note-${crypto3.randomUUID().slice(0, 8)}`;
    const r = await query(
      `INSERT INTO notes (id, board_id, member_id, title, content, ai_generated)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [id, boardId, memberId, `Resumo da sprint \u2014 ${board.name}`, output]
    );
    await logAiUsage(memberId, "from_sprint", inputChars, output.length, "ok");
    res.status(201).json({ note: mapDbNote(r.rows[0]) });
  } catch (error) {
    const status = error instanceof AiUnavailableError ? 503 : 502;
    await logAiUsage(memberId, "from_sprint", inputChars, 0, "error").catch(() => {
    });
    console.error("From-sprint note failed:", error);
    res.status(status).json({ error: error.message || "Falha na IA" });
  }
});
async function hasAnyBoardManage(memberId) {
  const m = await query("SELECT system_role FROM members WHERE id = $1", [memberId]);
  if (m.rows[0]?.system_role === "admin") return true;
  const r = await query(
    `SELECT 1 FROM board_members
     WHERE member_id = $1
       AND (role = 'owner' OR COALESCE((permissions ->> 'canManageBoard')::boolean, FALSE))
     LIMIT 1`,
    [memberId]
  );
  return r.rows.length > 0;
}
async function requireTagManage(req, res) {
  if (await hasAnyBoardManage(req.memberId)) return true;
  res.status(403).json({ error: "Sem permiss\xE3o para gerenciar etiquetas", required: "canManageBoard" });
  return false;
}
async function tagUsageCount(name) {
  const r = await query(
    `SELECT COUNT(*)::int AS n FROM tasks, jsonb_array_elements_text(tasks.tags) x
     WHERE lower(x) = lower($1)`,
    [name]
  );
  return r.rows[0]?.n ?? 0;
}
function mapTag(row, usageCount, orphan = false) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    usageCount,
    ...orphan ? { orphan: true } : {}
  };
}
app.get("/api/tags", authenticateToken, async (req, res) => {
  try {
    const [catalogRes, usageRes] = await Promise.all([
      query("SELECT * FROM tags ORDER BY lower(name)"),
      query(
        `SELECT lower(x) AS lname, MIN(x) AS name, COUNT(*)::int AS cnt
         FROM tasks, jsonb_array_elements_text(tasks.tags) x
         WHERE length(trim(x)) > 0
         GROUP BY lower(x)`
      )
    ]);
    const usage = new Map(
      usageRes.rows.map((r) => [r.lname, { name: r.name, cnt: r.cnt }])
    );
    const tags = catalogRes.rows.map(
      (row) => mapTag(row, usage.get(String(row.name).toLowerCase())?.cnt || 0)
    );
    const seen = new Set(tags.map((t) => t.name.toLowerCase()));
    for (const [lname, u] of usage) {
      if (!seen.has(lname)) {
        tags.push(mapTag({ id: `orphan-${lname}`.slice(0, 100), name: u.name, color: "#64748b" }, u.cnt, true));
      }
    }
    tags.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    res.json({ tags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/tags", authenticateToken, validateBody(tagCreateSchema), async (req, res) => {
  try {
    if (!await requireTagManage(req, res)) return;
    const { name, color } = req.body;
    const existing = await query("SELECT * FROM tags WHERE lower(name) = lower($1)", [name]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Etiqueta j\xE1 existe com esse nome", tag: mapTag(existing.rows[0], 0) });
    }
    const id = `tag-${crypto3.randomUUID().slice(0, 8)}`;
    const r = await query(
      "INSERT INTO tags (id, name, color, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
      [id, name, color || "#64748b", req.memberId]
    );
    res.status(201).json({ tag: mapTag(r.rows[0], await tagUsageCount(name)) });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Etiqueta j\xE1 existe com esse nome" });
    }
    res.status(500).json({ error: error.message });
  }
});
app.patch("/api/tags/:id", authenticateToken, validateBody(tagUpdateSchema), async (req, res) => {
  const client2 = await pool.connect();
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      client2.release();
    }
  };
  try {
    if (!await requireTagManage(req, res)) return release();
    const { id } = req.params;
    const cur = await query("SELECT * FROM tags WHERE id = $1", [id]);
    if (cur.rows.length === 0) {
      release();
      return res.status(404).json({ error: "Etiqueta n\xE3o encontrada" });
    }
    const oldName = cur.rows[0].name;
    const newName = req.body.name ?? oldName;
    const color = req.body.color ?? cur.rows[0].color;
    const renamed = newName !== oldName;
    if (renamed) {
      const dup = await query("SELECT id, name FROM tags WHERE lower(name) = lower($1) AND id <> $2", [newName, id]);
      if (dup.rows.length > 0) {
        release();
        return res.status(409).json({ error: "Etiqueta j\xE1 existe com esse nome", tag: dup.rows[0] });
      }
    }
    let tasksUpdated = 0;
    await client2.query("BEGIN");
    try {
      if (renamed) {
        const upd = await client2.query(
          `UPDATE tasks SET tags = (
             SELECT COALESCE(jsonb_agg(DISTINCT CASE WHEN lower(x) = lower($1) THEN $2 ELSE x END), '[]'::jsonb)
             FROM jsonb_array_elements_text(tasks.tags) x
           )
           WHERE EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(tasks.tags) x WHERE lower(x) = lower($1)
           )`,
          [oldName, newName]
        );
        tasksUpdated = upd.rowCount ?? 0;
        await client2.query("UPDATE tags SET name = $1, color = $2 WHERE id = $3", [newName, color, id]);
      } else {
        await client2.query("UPDATE tags SET color = $1 WHERE id = $2", [color, id]);
      }
      await client2.query("COMMIT");
    } catch (e) {
      await client2.query("ROLLBACK").catch(() => {
      });
      throw e;
    }
    release();
    const updated = await query("SELECT * FROM tags WHERE id = $1", [id]);
    const usage = await tagUsageCount(renamed ? newName : oldName);
    res.json({ tag: mapTag(updated.rows[0], usage), tasksUpdated });
  } catch (error) {
    if (!released) await client2.query("ROLLBACK").catch(() => {
    });
    release();
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Etiqueta j\xE1 existe com esse nome" });
    }
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/tags/:id", authenticateToken, async (req, res) => {
  const client2 = await pool.connect();
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      client2.release();
    }
  };
  try {
    if (!await requireTagManage(req, res)) return release();
    const { id } = req.params;
    const cur = await query("SELECT * FROM tags WHERE id = $1", [id]);
    if (cur.rows.length === 0) {
      release();
      return res.status(404).json({ error: "Etiqueta n\xE3o encontrada" });
    }
    const name = cur.rows[0].name;
    const removeFromTasks = req.query.removeFromTasks === "true";
    const usage = await tagUsageCount(name);
    if (usage > 0 && !removeFromTasks) {
      release();
      return res.status(409).json({
        error: `Etiqueta usada em ${usage} tarefa(s). Remover das tarefas?`,
        usageCount: usage
      });
    }
    let removedFromTasks = 0;
    await client2.query("BEGIN");
    try {
      if (usage > 0) {
        const upd = await client2.query(
          `UPDATE tasks SET tags = COALESCE((
             SELECT jsonb_agg(x) FROM jsonb_array_elements_text(tasks.tags) x WHERE lower(x) <> lower($1)
           ), '[]'::jsonb)
           WHERE EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(tasks.tags) x WHERE lower(x) = lower($1)
           )`,
          [name]
        );
        removedFromTasks = upd.rowCount ?? 0;
      }
      await client2.query("DELETE FROM tags WHERE id = $1", [id]);
      await client2.query("COMMIT");
    } catch (e) {
      await client2.query("ROLLBACK").catch(() => {
      });
      throw e;
    }
    release();
    res.json({ removedFromTasks });
  } catch (error) {
    if (!released) await client2.query("ROLLBACK").catch(() => {
    });
    release();
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
      const distPath = path2.resolve(__dirname, "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path2.resolve(distPath, "index.html"));
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
