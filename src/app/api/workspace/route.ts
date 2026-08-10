import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const roleSchema = z.enum(["Admin", "Manager", "Employee"]);
const statusSchema = z.enum(["Not started", "In progress", "Completed"]);
const prioritySchema = z.enum(["High", "Medium", "Low"]);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_user"), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), password: z.string().min(8).max(128), role: roleSchema }),
  z.object({ action: z.literal("update_user"), userId: z.string().uuid(), role: roleSchema.optional(), active: z.boolean().optional() }),
  z.object({ action: z.literal("update_profile"), name: z.string().trim().min(2).max(120) }),
  z.object({ action: z.literal("create_project"), name: z.string().trim().min(2).max(160), description: z.string().trim().max(1000).default("") }),
  z.object({ action: z.literal("create_task"), title: z.string().trim().min(2).max(200), description: z.string().trim().max(5000).default(""), projectId: z.string().min(1), assigneeId: z.string().uuid(), parentId: z.string().nullable().optional(), priority: prioritySchema, dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal("add_note"), taskId: z.string().min(1), text: z.string().trim().min(1).max(5000) }),
  z.object({ action: z.literal("mark_messages_read"), taskId: z.string().min(1) }),
  z.object({ action: z.literal("save_employee_update"), taskId: z.string().min(1), description: z.string().trim().max(5000), status: statusSchema, progress: z.number().int().min(0).max(100) }),
  z.object({ action: z.literal("archive_task"), taskId: z.string().min(1) }),
]);

type ProfileRow = { id: string; name: string; role: "Admin" | "Manager" | "Employee"; active: boolean };
type TaskStatus = "Not started" | "In progress" | "Completed";

function taskStatusFromRow(value: unknown): TaskStatus {
  if (value === "Completed" || value === "Complete") return "Completed";
  if (value === "In progress") return "In progress";
  return "Not started";
}

function isCompletedStatus(value: unknown) {
  return value === "Completed" || value === "Complete";
}

function isLegacyStatusError(error: { message?: string } | null) {
  return Boolean(error?.message && /task_status|invalid input value for enum/i.test(error.message));
}

function userFromProfile(profile: ProfileRow) {
  return { id: profile.id, name: profile.name, email: "", role: profile.role, active: profile.active };
}
function projectFromRow(project: Record<string, unknown>) {
  return { id: project.id, name: project.name, description: project.description };
}
function taskFromRow(task: Record<string, unknown>) {
  return { id: task.id, title: task.title, projectId: task.project_id, description: task.description, due: task.due, priority: task.priority, status: taskStatusFromRow(task.status), progress: task.progress, assigneeId: task.assignee_id, createdById: task.created_by_id, parentId: task.parent_id, createdAt: task.created_at, assignedAt: task.assigned_at, dueDate: task.due_date, completedAt: task.completed_at, archivedAt: task.archived_at };
}
function noteFromRow(note: Record<string, unknown>) {
  return { id: note.id, taskId: note.task_id, text: note.text, authorId: note.author_id, createdAt: note.created_at, readBy: note.read_by ?? [] };
}
function progressFromRow(log: Record<string, unknown>) {
  return { id: log.id, taskId: log.task_id, employeeId: log.employee_id, description: log.description, status: taskStatusFromRow(log.status), progress: log.progress, createdAt: log.created_at };
}
async function getContext() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Supabase is not configured.");
  const client = await createSupabaseServerClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error("Authentication required.");
  const { data: profile, error: profileError } = await client.from("profiles").select("id, name, role, active").eq("id", authData.user.id).single<ProfileRow>();
  if (profileError || !profile || !profile.active) throw new Error("Active profile required.");
  return { client, user: authData.user, profile };
}
function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const { client, user, profile } = await getContext();
    const [profiles, projects, tasks, notes, progressLogs] = await Promise.all([
      client.from("profiles").select("id, name, role, active").order("name"),
      client.from("projects").select("*").order("created_at", { ascending: false }),
      client.from("tasks").select("*").order("created_at", { ascending: true }),
      client.from("notes").select("*").order("created_at", { ascending: false }),
      client.from("progress_logs").select("*").order("created_at", { ascending: false }),
    ]);
    const queryError = [profiles, projects, tasks, notes, progressLogs].find((result) => result.error)?.error;
    if (queryError) return fail(queryError.message, 500);
    const emailById = new Map<string, string>();
    if (profile.role === "Admin" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createSupabaseAdminClient();
      const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      (authUsers?.users ?? []).forEach((authUser) => {
        if (authUser.email) emailById.set(authUser.id, authUser.email);
      });
    }
    const users = (profiles.data ?? []).map((item) => ({ ...userFromProfile(item as ProfileRow), email: emailById.get(item.id) ?? (item.id === user.id ? user.email ?? "" : "") }));
    const activeTasks = (tasks.data ?? []).filter((task) => !task.archived_at);
    const archivedTasks = (tasks.data ?? []).filter((task) => Boolean(task.archived_at));
    return NextResponse.json({ currentUser: { ...userFromProfile(profile), email: user.email ?? "" }, users, projects: (projects.data ?? []).map(projectFromRow), tasks: activeTasks.map(taskFromRow), archivedTasks: archivedTasks.map(taskFromRow), notes: (notes.data ?? []).map(noteFromRow), progressLogs: (progressLogs.data ?? []).map(progressFromRow) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load workspace.", 401);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getContext();
    const body = actionSchema.safeParse(await request.json());
    if (!body.success) return fail("The submitted data is invalid.");
    const input = body.data;

    if (input.action === "create_user") {
      if (context.profile.role !== "Admin") return fail("Only admins can create users.", 403);
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail("The server service key is not configured.", 500);
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.auth.admin.createUser({ email: input.email.toLowerCase(), password: input.password, email_confirm: true, user_metadata: { name: input.name } });
      if (error || !data.user) return fail(error?.message ?? "Unable to create user.");
      const { data: profile, error: profileError } = await admin.from("profiles").update({ name: input.name, role: input.role, active: true }).eq("id", data.user.id).select("id, name, role, active").single();
      if (profileError || !profile) {
        await admin.auth.admin.deleteUser(data.user.id);
        return fail(profileError?.message ?? "Unable to create profile.", 500);
      }
      return NextResponse.json({ user: { ...userFromProfile(profile as ProfileRow), email: input.email.toLowerCase() } });
    }

    if (input.action === "update_user") {
      if (context.profile.role !== "Admin") return fail("Only admins can update users.", 403);
      const changes = { ...(input.role ? { role: input.role } : {}), ...(typeof input.active === "boolean" ? { active: input.active } : {}) };
      const { error } = await context.client.from("profiles").update(changes).eq("id", input.userId);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "update_profile") {
      const { error } = await context.client.from("profiles").update({ name: input.name }).eq("id", context.user.id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "create_project") {
      if (context.profile.role !== "Admin") return fail("Only admins can create projects.", 403);
      const { error } = await context.client.from("projects").insert({ id: `project-${crypto.randomUUID()}`, name: input.name, description: input.description || "A new project for your team." });
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "create_task") {
      if (context.profile.role !== "Manager") return fail("Only managers can create tasks.", 403);
      const { error } = await context.client.from("tasks").insert({ id: `task-${crypto.randomUUID()}`, title: input.title, description: input.description || "No description yet.", project_id: input.projectId, assignee_id: input.assigneeId, created_by_id: context.user.id, parent_id: input.parentId || null, priority: input.priority, due: input.dueDate, due_date: input.dueDate, status: "Not started", progress: 0 });
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "add_note") {
      const { data: task, error: taskError } = await context.client.from("tasks").select("assignee_id").eq("id", input.taskId).single();
      if (taskError || !task) return fail("Task not found.", 404);
      if (context.profile.role !== "Manager" && task.assignee_id !== context.user.id) return fail("You cannot message this task.", 403);
      const { error } = await context.client.from("notes").insert({ id: `note-${crypto.randomUUID()}`, task_id: input.taskId, text: input.text, author_id: context.user.id, read_by: [context.user.id] });
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "mark_messages_read") {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail("The server service key is not configured.", 500);
      const { data: task } = await context.client.from("tasks").select("assignee_id").eq("id", input.taskId).single();
      if (!task || (context.profile.role === "Employee" && task.assignee_id !== context.user.id)) return fail("Task not found.", 404);
      const admin = createSupabaseAdminClient();
      const { data: taskNotes, error } = await admin.from("notes").select("id, read_by").eq("task_id", input.taskId);
      if (error) return fail(error.message, 500);
      for (const note of taskNotes ?? []) await admin.from("notes").update({ read_by: Array.from(new Set([...(note.read_by ?? []), context.user.id])) }).eq("id", note.id);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "save_employee_update") {
      if (context.profile.role !== "Employee") return fail("Only employees can save daily updates.", 403);
      const { data: task, error: taskError } = await context.client.from("tasks").select("assignee_id, completed_at").eq("id", input.taskId).single();
      if (taskError || !task || task.assignee_id !== context.user.id) return fail("Task not found.", 404);
      const createdAt = new Date().toISOString();
      const completedAt = input.status === "Completed" ? task.completed_at ?? createdAt : null;
      const update = { description: input.description, status: input.status, progress: input.progress, completed_at: completedAt };
      let { error: updateError } = await context.client.from("tasks").update(update).eq("id", input.taskId);
      if (isLegacyStatusError(updateError) && input.status === "Completed") {
        ({ error: updateError } = await context.client.from("tasks").update({ ...update, status: "Complete" }).eq("id", input.taskId));
      }
      if (updateError) return fail(updateError.message);
      const log = { id: `progress-${crypto.randomUUID()}`, task_id: input.taskId, employee_id: context.user.id, description: input.description, status: input.status, progress: input.progress, created_at: createdAt };
      let { error: logError } = await context.client.from("progress_logs").insert(log);
      if (isLegacyStatusError(logError) && input.status === "Completed") {
        ({ error: logError } = await context.client.from("progress_logs").insert({ ...log, status: "Complete" }));
      }
      if (logError) return fail(logError.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "archive_task") {
      if (context.profile.role !== "Admin" && context.profile.role !== "Manager") return fail("Only admins and managers can archive tasks.", 403);
      const { data: taskRows, error: tasksError } = await context.client.from("tasks").select("id, parent_id, status, archived_at");
      if (tasksError) return fail(tasksError.message, 500);
      const rows = (taskRows ?? []) as Array<{ id: string; parent_id: string | null; status: string; archived_at: string | null }>;
      const task = rows.find((row) => row.id === input.taskId);
      if (!task || task.archived_at) return fail("Task not found.", 404);
      const descendants: typeof rows = [];
      const collectDescendants = (parentId: string) => {
        rows.filter((row) => row.parent_id === parentId).forEach((child) => {
          descendants.push(child);
          collectDescendants(child.id);
        });
      };
      collectDescendants(task.id);
      if (!isCompletedStatus(task.status)) return fail("Only completed tasks can be archived.");
      if (descendants.some((child) => !isCompletedStatus(child.status))) return fail("Complete all subtasks before archiving this task.");
      const archiveIds = [task.id, ...descendants.map((child) => child.id)];
      const { error: archiveError } = await context.client.from("tasks").update({ archived_at: new Date().toISOString() }).in("id", archiveIds);
      if (archiveError) return fail(archiveError.message);
      return NextResponse.json({ ok: true, archivedTaskIds: archiveIds });
    }

    return fail("Unsupported action.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Request failed.", 500);
  }
}
