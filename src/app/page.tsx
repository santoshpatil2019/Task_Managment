"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Role = "Admin" | "Manager" | "Employee";
type TaskStatus = "Not started" | "In progress" | "Blocked" | "Complete";
type Modal = "user" | "project" | "task" | null;

type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  active: boolean;
};

type Project = {
  id: string;
  name: string;
  description: string;
};

type Task = {
  id: string;
  title: string;
  projectId: string;
  description: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  status: TaskStatus;
  progress: number;
  assigneeId: string;
  createdById: string;
  parentId: string | null;
  createdAt?: string;
};

type Note = {
  id: string;
  taskId: string;
  text: string;
  authorId: string;
  createdAt: string;
  readBy?: string[];
};

const STORAGE_KEY = "task-management-role-data-v1";
const SESSION_KEY = "task-management-current-user";

const demoUsers: User[] = [
  {
    id: "user-admin",
    name: "Asha Admin",
    email: "admin@task.local",
    password: "admin123",
    role: "Admin",
    active: true,
  },
  {
    id: "user-manager",
    name: "Rahul Manager",
    email: "manager@task.local",
    password: "manager123",
    role: "Manager",
    active: true,
  },
  {
    id: "user-employee",
    name: "Priya Employee",
    email: "employee@task.local",
    password: "employee123",
    role: "Employee",
    active: true,
  },
];

const demoProjects: Project[] = [
  {
    id: "project-website",
    name: "Website redesign",
    description: "Plan and deliver the new website experience.",
  },
  {
    id: "project-product",
    name: "Product planning",
    description: "Organize upcoming product work and requirements.",
  },
];

const demoTasks: Task[] = [
  {
    id: "task-kickoff",
    title: "Prepare project kickoff",
    projectId: "project-website",
    description: "Prepare the agenda, milestones, and kickoff notes.",
    due: "Today",
    priority: "High",
    status: "In progress",
    progress: 40,
    assigneeId: "user-employee",
    createdById: "user-manager",
    parentId: null,
  },
  {
    id: "task-requirements",
    title: "Review task requirements",
    projectId: "project-product",
    description: "Review the acceptance criteria and identify open questions.",
    due: "Tomorrow",
    priority: "Medium",
    status: "Not started",
    progress: 0,
    assigneeId: "user-employee",
    createdById: "user-manager",
    parentId: null,
  },
  {
    id: "task-docs",
    title: "Update documentation",
    projectId: "project-website",
    description: "Refresh the internal documentation for the project.",
    due: "Friday",
    priority: "Low",
    status: "Complete",
    progress: 100,
    assigneeId: "user-employee",
    createdById: "user-manager",
    parentId: null,
  },
];

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");

  const [loginEmail, setLoginEmail] = useState("admin@task.local");
  const [loginPassword, setLoginPassword] = useState("admin123");
  const [loginError, setLoginError] = useState("");

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("welcome123");
  const [newUserRole, setNewUserRole] = useState<Role>("Employee");

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("Today");
  const [newTaskPriority, setNewTaskPriority] = useState<Task["priority"]>(
    "Medium",
  );
  const [newTaskParentId, setNewTaskParentId] = useState("");

  const [noteTaskId, setNoteTaskId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [employeeEdits, setEmployeeEdits] = useState<
    Record<string, { description: string; status: TaskStatus; progress: number }>
  >({});

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const session = window.localStorage.getItem(SESSION_KEY);

    if (saved) {
      try {
        const data = JSON.parse(saved);
        setUsers(data.users ?? demoUsers);
        setProjects(data.projects ?? demoProjects);
        setTasks(data.tasks ?? demoTasks);
        setNotes(data.notes ?? []);
      } catch {
        setUsers(demoUsers);
        setProjects(demoProjects);
        setTasks(demoTasks);
        setNotes([]);
      }
    } else {
      setUsers(demoUsers);
      setProjects(demoProjects);
      setTasks(demoTasks);
      setNotes([]);
    }

    setCurrentUserId(session);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ users, projects, tasks, notes }),
    );

    if (currentUserId) {
      window.localStorage.setItem(SESSION_KEY, currentUserId);
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, [currentUserId, hydrated, notes, projects, tasks, users]);

  const currentUser = users.find((user) => user.id === currentUserId) ?? null;
  const employees = users.filter((user) => user.role === "Employee" && user.active);
  const visibleTasks = useMemo(() => {
    if (!currentUser || currentUser.role !== "Employee") return tasks;

    const visibleIds = new Set(
      tasks
        .filter((task) => task.assigneeId === currentUser.id)
        .map((task) => task.id),
    );

    let addedParent = true;
    while (addedParent) {
      addedParent = false;
      tasks.forEach((task) => {
        if (visibleIds.has(task.id) && task.parentId && !visibleIds.has(task.parentId)) {
          visibleIds.add(task.parentId);
          addedParent = true;
        }
      });
    }

    return tasks.filter((task) => visibleIds.has(task.id));
  }, [currentUser, tasks]);
  const completedCount = visibleTasks.filter((task) => task.status === "Complete").length;
  const pendingCount = visibleTasks.length - completedCount;
  const averageProgress = visibleTasks.length
    ? Math.round(visibleTasks.reduce((sum, task) => sum + task.progress, 0) / visibleTasks.length)
    : 0;

  const getUserName = (id: string) =>
    users.find((user) => user.id === id)?.name ?? "Unassigned";
  const getProjectName = (id: string) =>
    projects.find((project) => project.id === id)?.name ?? "Unknown project";

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return "Not recorded";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const isNewMessage = (note: Note) => {
    if (!currentUser || note.authorId === currentUser.id) return false;
    if (note.readBy?.includes(currentUser.id)) return false;
    const createdAt = Date.parse(note.createdAt);
    return !Number.isNaN(createdAt) && Date.now() - createdAt < 24 * 60 * 60 * 1000;
  };

  const markMessagesRead = (taskId: string) => {
    if (!currentUser) return;
    setNotes((current) => current.map((note) => note.taskId === taskId
      ? { ...note, readBy: Array.from(new Set([...(note.readBy ?? []), currentUser.id])) }
      : note));
  };

  const toggleMessages = (taskId: string) => {
    if (noteTaskId !== taskId) markMessagesRead(taskId);
    setNoteTaskId(noteTaskId === taskId ? null : taskId);
  };

  const showMessageDetails = (note: Note) => {
    setSelectedMessageId(note.id);
    markMessagesRead(note.taskId);
  };

  const sortTasksAscending = (items: Task[]) =>
    [...items].sort((first, second) => {
      const timeDifference = (first.createdAt ?? "").localeCompare(second.createdAt ?? "");
      return timeDifference || first.title.localeCompare(second.title);
    });

  const sortNotesNewestFirst = (items: Note[]) =>
    [...items].sort((first, second) => {
      const firstTime = Date.parse(first.createdAt);
      const secondTime = Date.parse(second.createdAt);
      if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) {
        return second.createdAt.localeCompare(first.createdAt);
      }
      return secondTime - firstTime;
    });

  const sectionTarget = (item: string) => {
    const targets: Record<string, string> = {
      Dashboard: "dashboard",
      "User management": "user-management",
      "Team tasks": "tasks",
      "My daily updates": "tasks",
      Projects: "projects",
    };
    return targets[item] ?? "dashboard";
  };

  const navigateTo = (item: string) => {
    document.getElementById(sectionTarget(item))?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = users.find(
      (candidate) =>
        candidate.email.toLowerCase() === loginEmail.toLowerCase() &&
        candidate.password === loginPassword &&
        candidate.active,
    );

    if (!user) {
      setLoginError("Invalid credentials or inactive user.");
      return;
    }

    setLoginError("");
    setCurrentUserId(user.id);
  };

  const createUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) return;

    const alreadyExists = users.some(
      (user) => user.email.toLowerCase() === newUserEmail.trim().toLowerCase(),
    );
    if (alreadyExists) {
      setNotice("A user with that email already exists.");
      return;
    }

    setUsers((current) => [
      {
        id: makeId("user"),
        name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        password: newUserPassword,
        role: newUserRole,
        active: true,
      },
      ...current,
    ]);
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("welcome123");
    setNewUserRole("Employee");
    setModal(null);
    setNotice("User created successfully.");
  };

  const updateUserRole = (userId: string, role: Role) => {
    setUsers((current) =>
      current.map((user) => (user.id === userId ? { ...user, role } : user)),
    );
    setNotice("User role updated.");
  };

  const toggleUser = (userId: string) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, active: !user.active } : user,
      ),
    );
  };

  const createProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newProjectName.trim()) return;

    setProjects((current) => [
      {
        id: makeId("project"),
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || "A new project for your team.",
      },
      ...current,
    ]);
    setNewProjectName("");
    setNewProjectDescription("");
    setModal(null);
    setNotice("Project created successfully.");
  };

  const createTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || currentUser.role !== "Manager" || !newTaskTitle.trim()) return;

    const projectId = newTaskProjectId || projects[0]?.id;
    const assigneeId = newTaskAssigneeId || employees[0]?.id;
    if (!projectId || !assigneeId) {
      setNotice("Create an employee and project before adding a task.");
      return;
    }

    const parentTask = tasks.find((task) => task.id === newTaskParentId);
    const parentId = parentTask?.projectId === projectId ? parentTask.id : null;

    setTasks((current) => [
      {
        id: makeId("task"),
        title: newTaskTitle.trim(),
        projectId,
        description: newTaskDescription.trim() || "No description yet.",
        due: newTaskDue,
        priority: newTaskPriority,
        status: "Not started",
        progress: 0,
        assigneeId,
        createdById: currentUser.id,
        parentId,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskParentId("");
    setModal(null);
    setNotice("Task created and assigned.");
  };

  const addNote = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    const canAddNote = currentUser?.role === "Manager" ||
      (currentUser?.role === "Employee" && task?.assigneeId === currentUser.id);
    if (!currentUser || !canAddNote || !noteText.trim()) return;
    setNotes((current) => [
      {
        id: makeId("note"),
        taskId,
        text: noteText.trim(),
        authorId: currentUser.id,
        createdAt: new Date().toISOString(),
        readBy: [currentUser.id],
      },
      ...current,
    ]);
    setNoteTaskId(null);
    setNoteText("");
    setNotice("Message sent.");
  };

  const getEmployeeEdit = (task: Task) =>
    employeeEdits[task.id] ?? {
      description: task.description,
      status: task.status,
      progress: task.progress,
    };

  const updateEmployeeEdit = (
    task: Task,
    changes: Partial<{ description: string; status: TaskStatus; progress: number }>,
  ) => {
    setEmployeeEdits((current) => ({
      ...current,
      [task.id]: { ...getEmployeeEdit(task), ...changes },
    }));
  };

  const saveEmployeeUpdate = (task: Task) => {
    const edit = getEmployeeEdit(task);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, ...edit, progress: Math.min(100, Math.max(0, edit.progress)) }
          : item,
      ),
    );
    setNotice("Daily task update saved.");
  };

  const renderTask = (task: Task, depth = 0): React.ReactNode => {
    const children = visibleTasks.filter((child) => child.parentId === task.id);
    const canEditTask = currentUser?.role === "Employee" && task.assigneeId === currentUser.id;
    const edit = canEditTask ? getEmployeeEdit(task) : null;
    const taskNotes = notes.filter((note) => note.taskId === task.id);

    return (
      <div key={task.id} className={depth ? "ml-6 border-l-2 border-indigo-100 pl-4" : ""}>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold">{task.title}</h4>
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                  {task.status}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {task.priority}
                </span>
                <span className="rounded-full bg-violet-50 px-2 py-1 text-xs text-violet-700">
                  {task.parentId ? "Subtask" : "Task"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{task.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>Project: {getProjectName(task.projectId)}</span>
                <span>Due: {task.due}</span>
                <span>Assigned to: <strong className="font-semibold text-slate-600">{getUserName(task.assigneeId)}</strong></span>
                <span>Assigned by: <strong className="font-semibold text-slate-600">{getUserName(task.createdById)}</strong></span>
              </div>
            </div>
            <div className="w-full lg:min-w-32 lg:text-right">
              <p className="text-sm font-semibold text-indigo-600">{task.progress}%</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-indigo-600"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
          </div>

          {currentUser?.role === "Manager" && (
            <div className="mt-4 border-t pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setNoteTaskId(noteTaskId === task.id ? null : task.id)}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Add note
                </button>
                <span className="text-xs text-slate-500">{taskNotes.length} notes</span>
              </div>
              {noteTaskId === task.id && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Write a message..."
                    className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => addNote(task.id)}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Save
                  </button>
                </div>
              )}
              {taskNotes.length > 0 && (
                <div className="mt-3 space-y-2">
                  {taskNotes.slice(0, 2).map((note) => (
                    <p key={note.id} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      {note.text} <span className="text-xs text-amber-700">— {getUserName(note.authorId)}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {canEditTask && edit && (
            <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-3">
              <textarea
                value={edit.description}
                onChange={(event) => updateEmployeeEdit(task, { description: event.target.value })}
                rows={2}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 md:col-span-2"
                placeholder="Add your daily status update in the description..."
              />
              <div className="space-y-2">
                <select
                  value={edit.status}
                  onChange={(event) => updateEmployeeEdit(task, { status: event.target.value as TaskStatus })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option>Not started</option>
                  <option>In progress</option>
                  <option>Blocked</option>
                  <option>Complete</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={edit.progress}
                    onChange={(event) => updateEmployeeEdit(task, { progress: Number(event.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                  <span className="w-10 text-right text-sm font-semibold">{edit.progress}%</span>
                </div>
                <button
                  onClick={() => saveEmployeeUpdate(task)}
                  className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Save daily update
                </button>
              </div>
            </div>
          )}
        </div>
        {children.length > 0 && <div className="mt-3 space-y-3">{children.map((child) => renderTask(child, depth + 1))}</div>}
      </div>
    );
  };

  const renderTaskRow = (task: Task, depth = 0): React.ReactNode[] => {
    const children = sortTasksAscending(
      visibleTasks.filter((child) => child.parentId === task.id),
    );
    const taskNotes = sortNotesNewestFirst(notes.filter((note) => note.taskId === task.id));
    const canEditTask = currentUser?.role === "Employee" && task.assigneeId === currentUser.id;
    const canAddNote = currentUser?.role === "Manager" || canEditTask;
    const hasNewMessages = taskNotes.some(isNewMessage);
    const edit = canEditTask ? getEmployeeEdit(task) : null;
    const rows: React.ReactNode[] = [
      <tr key={task.id} className="border-t border-slate-200 align-top hover:bg-slate-50">
        <td className="px-3 py-4" style={{ paddingLeft: `${12 + depth * 24}px` }}>
          <div className="flex min-w-0 items-start gap-2">
            {depth > 0 && <span className="pt-0.5 text-indigo-400">↳</span>}
            <div>
              <p className="font-semibold text-slate-900">{task.title}</p>
              <p className="mt-1 text-xs font-medium text-violet-700">{task.parentId ? "Subtask" : "Task"}</p>
              <p className="mt-1 max-w-sm whitespace-normal text-xs text-slate-500">{task.description}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-4 break-words">
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{task.status}</span>
        </td>
        <td className="px-3 py-4 break-words text-xs text-slate-600">{task.priority}</td>
        <td className="px-3 py-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-12 rounded-full bg-slate-100 sm:w-20">
              <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${task.progress}%` }} />
            </div>
            <span className="text-xs font-semibold text-indigo-600">{task.progress}%</span>
          </div>
        </td>
        <td className="px-3 py-4 break-words text-xs text-slate-600">{task.due}</td>
        <td className="px-3 py-4 break-words text-xs font-semibold text-slate-700">{getUserName(task.assigneeId)}</td>
        <td className="px-3 py-4 break-words text-xs font-semibold text-slate-700">{getUserName(task.createdById)}</td>
        <td className="px-3 py-4 break-words text-xs text-slate-500">{formatTimestamp(task.createdAt)}</td>
        <td className="px-3 py-4">
          {canAddNote && (
            <button
              onClick={() => toggleMessages(task.id)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold ${hasNewMessages ? "animate-pulse bg-yellow-300 text-orange-900 shadow-[inset_0_0_0_2px_rgb(245_158_11)]" : "bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"}`}
            >
              {hasNewMessages ? "NEW message" : taskNotes.length ? `${taskNotes.length} messages` : "Add message"}
            </button>
          )}
        </td>
      </tr>,
    ];

    if (canAddNote && noteTaskId === task.id) {
      rows.push(
        <tr key={`${task.id}-notes`} className="border-t border-slate-100 bg-amber-50/40">
          <td colSpan={9} className="px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Write a message..."
                className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <button onClick={() => addNote(task.id)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
                Send message
              </button>
            </div>
            {taskNotes.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-lg border border-amber-100 bg-white">
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="bg-amber-50 text-amber-700">
                    <tr>
                      <th className="w-[55%] px-3 py-2 font-semibold">Message</th>
                      <th className="w-[20%] px-3 py-2 font-semibold">Sent by</th>
                      <th className="w-[25%] px-3 py-2 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskNotes.map((note) => (
                      <Fragment key={note.id}>
                      <tr onClick={() => showMessageDetails(note)} className={`cursor-pointer border-t border-amber-100 align-top text-amber-900 hover:bg-amber-50 ${isNewMessage(note) ? "animate-pulse bg-yellow-200 font-semibold shadow-[inset_0_0_0_2px_rgb(245_158_11)]" : ""}`}>
                        <td className="break-words px-3 py-2">
                          {isNewMessage(note) && <span className="mr-2 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">NEW</span>}
                          {note.text}
                        </td>
                        <td className="break-words px-3 py-2">{getUserName(note.authorId)}</td>
                        <td className="break-words px-3 py-2 text-amber-700">{formatTimestamp(note.createdAt)}</td>
                      </tr>
                      {selectedMessageId === note.id && (
                        <tr key={`${note.id}-details`}>
                          <td colSpan={3} className="px-3 py-3">
                            <div className="relative rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950 shadow-sm">
                              <span className="absolute -top-2 left-6 h-4 w-4 rotate-45 border-l border-t border-indigo-200 bg-indigo-50" />
                              <button
                                type="button"
                                onClick={() => setSelectedMessageId(null)}
                                aria-label="Close message details"
                                className="absolute right-3 top-3 rounded-full px-2 py-1 text-lg leading-none text-indigo-500 hover:bg-indigo-200 hover:text-indigo-900"
                              >
                                ×
                              </button>
                              <p className="relative pr-8 text-xs font-bold uppercase tracking-wide text-indigo-600">Message details</p>
                              <p className="relative mt-2 whitespace-pre-wrap text-sm">{note.text}</p>
                              <p className="relative mt-3 text-xs text-indigo-700">Sent by {getUserName(note.authorId)} · {formatTimestamp(note.createdAt)} · {getProjectName(task.projectId)} · {task.title}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>,
      );
    }

    if (canEditTask && edit) {
      rows.push(
        <tr key={`${task.id}-update`} className="border-t border-slate-100 bg-indigo-50/30">
          <td colSpan={9} className="px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
              <textarea
                value={edit.description}
                onChange={(event) => updateEmployeeEdit(task, { description: event.target.value })}
                rows={2}
                className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                placeholder="Add your daily status update in the description..."
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={edit.progress}
                    onChange={(event) => updateEmployeeEdit(task, { progress: Number(event.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                  <span className="w-10 text-right text-sm font-semibold">{edit.progress}%</span>
                </div>
                <button onClick={() => saveEmployeeUpdate(task)} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  Save daily update
                </button>
              </div>
            </div>
          </td>
        </tr>,
      );
    }

    children.forEach((child) => rows.push(...renderTaskRow(child, depth + 1)));
    return rows;
  };

  if (!hydrated) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading Task Management...</main>;
  }

  if (!currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Task Management</p>
          <h1 className="mt-2 text-3xl font-bold">Sign in to your workspace</h1>
          <p className="mt-2 text-sm text-slate-500">Use a demo account to try each role.</p>
          <form onSubmit={login} className="mt-6 space-y-4">
            <input
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              type="email"
              placeholder="Email"
              className="w-full rounded-lg border px-4 py-3 outline-none focus:border-indigo-500"
            />
            <input
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              type="password"
              placeholder="Password"
              className="w-full rounded-lg border px-4 py-3 outline-none focus:border-indigo-500"
            />
            {loginError && <p className="text-sm text-red-600">{loginError}</p>}
            <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">Sign in</button>
          </form>
          <div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
            <p><b>Admin:</b> admin@task.local / admin123</p>
            <p><b>Manager:</b> manager@task.local / manager123</p>
            <p><b>Employee:</b> employee@task.local / employee123</p>
          </div>
        </div>
      </main>
    );
  }

  const rootTasks = visibleTasks.filter((task) => !task.parentId);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen flex-col xl:flex-row">
        <aside className="hidden w-72 shrink-0 border-r bg-white p-6 xl:block">
          <h1 className="text-2xl font-bold text-indigo-600">Task Management</h1>
          <div className="mt-8 rounded-xl bg-indigo-50 p-4">
            <p className="font-semibold">{currentUser.name}</p>
            <p className="mt-1 text-sm text-indigo-700">{currentUser.role}</p>
          </div>
          <nav className="mt-8 space-y-2">
            {[
              "Dashboard",
              currentUser.role === "Admin" ? "User management" : currentUser.role === "Manager" ? "Team tasks" : "My daily updates",
              "Projects",
            ].map((item) => (
              <a key={item} href={`#${sectionTarget(item)}`} onClick={(event) => { event.preventDefault(); navigateTo(item); }} className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600">{item}</a>
            ))}
          </nav>
          <button
            onClick={() => setCurrentUserId(null)}
            className="mt-8 w-full rounded-lg border px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </aside>

        <div className="border-b bg-white p-4 xl:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-indigo-600">Task Management</h1>
              <p className="mt-1 text-sm text-slate-500">{currentUser.name} · {currentUser.role}</p>
            </div>
            <button
              onClick={() => setCurrentUserId(null)}
              className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-600"
            >
              Sign out
            </button>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2">
            {["Dashboard", currentUser.role === "Admin" ? "User management" : currentUser.role === "Manager" ? "Team tasks" : "My daily updates", "Projects"].map((item) => (
              <a key={item} href={`#${sectionTarget(item)}`} onClick={(event) => { event.preventDefault(); navigateTo(item); }} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
                {item}
              </a>
            ))}
          </nav>
        </div>

        <section className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 md:p-10">
          <div id="dashboard" className="mx-auto w-full max-w-7xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm text-slate-500">Monday, August 9</p>
                <h2 className="mt-1 text-3xl font-bold">Good morning, {currentUser.name.split(" ")[0]} 👋</h2>
                <p className="mt-2 text-slate-500">Manage work based on your role and responsibilities.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentUser.role === "Admin" && (
                  <>
                    <button onClick={() => setModal("user")} className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white">+ New user</button>
                    <button onClick={() => setModal("project")} className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">+ Create project</button>
                  </>
                )}
                {currentUser.role === "Manager" && (
                  <button onClick={() => setModal("task")} className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">+ Create task</button>
                )}
              </div>
            </div>

            {notice && (
              <button onClick={() => setNotice("")} className="mt-6 w-full rounded-lg bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-800">{notice} <span className="float-right">×</span></button>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Visible tasks</p><p className="mt-2 text-3xl font-bold">{visibleTasks.length}</p></div>
              <div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Pending</p><p className="mt-2 text-3xl font-bold text-orange-500">{pendingCount}</p></div>
              <div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Completed</p><p className="mt-2 text-3xl font-bold text-green-600">{completedCount}</p></div>
              <div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Average progress</p><p className="mt-2 text-3xl font-bold text-indigo-600">{averageProgress}%</p></div>
            </div>

            {currentUser.role === "Admin" && (
              <div id="user-management" className="mt-8 rounded-xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between"><div><h3 className="text-xl font-bold">User management</h3><p className="mt-1 text-sm text-slate-500">Create users and manage access roles.</p></div><button onClick={() => setModal("user")} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-indigo-600">+ Add user</button></div>
                <div className="mt-5 hidden overflow-x-auto xl:block"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">User</th><th className="pb-3">Email</th><th className="pb-3">Role</th><th className="pb-3">Status</th><th className="pb-3">Action</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b last:border-0"><td className="py-4 font-semibold">{user.name}</td><td className="py-4 text-slate-500">{user.email}</td><td className="py-4"><select value={user.role} onChange={(event) => updateUserRole(user.id, event.target.value as Role)} className="rounded-lg border px-3 py-2"><option>Admin</option><option>Manager</option><option>Employee</option></select></td><td className="py-4"><span className={`rounded-full px-2 py-1 text-xs ${user.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{user.active ? "Active" : "Inactive"}</span></td><td className="py-4"><button onClick={() => toggleUser(user.id)} className="text-sm font-semibold text-indigo-600">{user.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>
                <div className="mt-5 space-y-3 xl:hidden">{users.map((user) => <div key={user.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{user.name}</p><p className="mt-1 break-all text-sm text-slate-500">{user.email}</p></div><span className={`rounded-full px-2 py-1 text-xs ${user.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{user.active ? "Active" : "Inactive"}</span></div><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-medium text-slate-500">Role<select value={user.role} onChange={(event) => updateUserRole(user.id, event.target.value as Role)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-700"><option>Admin</option><option>Manager</option><option>Employee</option></select></label><button onClick={() => toggleUser(user.id)} className="self-end rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-indigo-600">{user.active ? "Deactivate" : "Activate"}</button></div></div>)}</div>
              </div>
            )}

            <div id="projects" className="mt-8 rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between"><div><h3 className="text-xl font-bold">Projects</h3><p className="mt-1 text-sm text-slate-500">{currentUser.role === "Admin" ? "Admin controls project creation." : "Projects connected to your tasks."}</p></div>{currentUser.role === "Admin" && <button onClick={() => setModal("project")} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-indigo-600">+ Add project</button>}</div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{projects.map((project) => { const projectTasks = tasks.filter((task) => task.projectId === project.id); const subtaskCount = projectTasks.filter((task) => task.parentId).length; return <div key={project.id} className="rounded-lg border border-slate-200 p-4"><p className="break-words font-semibold">{project.name}</p><p className="mt-2 text-sm text-slate-500">{project.description}</p><p className="mt-3 text-xs text-indigo-600">{projectTasks.length} tasks · {subtaskCount} subtasks</p></div>; })}</div>
            </div>

            <div id="tasks" className="mt-8 rounded-xl bg-slate-100 p-6">
              <div className="flex items-center justify-between"><div><h3 className="text-xl font-bold">{currentUser.role === "Employee" ? "My daily updates" : "Team task board"}</h3><p className="mt-1 text-sm text-slate-500">{currentUser.role === "Manager" ? "Create tasks, subtasks, messages, and assignments for employees." : currentUser.role === "Employee" ? "Update your daily description, progress, and messages." : "View all work across the workspace."}</p></div>{currentUser.role === "Manager" && <button onClick={() => setModal("task")} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">+ New task</button>}</div>
              <div className="mt-5 rounded-xl border border-slate-200 bg-white">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Task / Subtask</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Priority</th>
                      <th className="px-3 py-3">Progress</th>
                      <th className="px-3 py-3">Due</th>
                      <th className="px-3 py-3">Assigned to</th>
                      <th className="px-3 py-3">Assigned by</th>
                      <th className="px-3 py-3">Created</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  {projects.map((project) => {
                    const projectRootTasks = sortTasksAscending(rootTasks.filter((task) => task.projectId === project.id));
                    const projectTaskCount = visibleTasks.filter((task) => task.projectId === project.id).length;
                    return (
                      <tbody key={project.id}>
                        <tr className="border-t border-slate-200 bg-indigo-50/60">
                          <td colSpan={9} className="px-3 py-3">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span className="font-bold text-indigo-900">Project: {project.name}</span>
                              <span className="text-xs text-indigo-700">{projectTaskCount} items · sorted oldest first</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{project.description}</p>
                          </td>
                        </tr>
                        {projectRootTasks.length ? projectRootTasks.flatMap((task) => renderTaskRow(task)) : (
                          <tr>
                            <td colSpan={9} className="px-3 py-5 text-center text-sm text-slate-500">No tasks in this project yet.</td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                  {projects.length === 0 && (
                    <tbody><tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">No projects available.</td></tr></tbody>
                  )}
                </table>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">Demo mode: data is stored in this browser. Production authentication and database persistence should be added before real users are invited.</p>
          </div>
        </section>
      </div>

      {modal === "user" && currentUser.role === "Admin" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Create new user</h2><p className="mt-1 text-sm text-slate-500">Assign a role and login credentials.</p></div><button onClick={() => setModal(null)} className="text-xl text-slate-400">×</button></div><form onSubmit={createUser} className="mt-6 space-y-4"><input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} placeholder="Full name" className="w-full rounded-lg border px-4 py-3" /><input value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} type="email" placeholder="Email address" className="w-full rounded-lg border px-4 py-3" /><input value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} type="text" placeholder="Temporary password" className="w-full rounded-lg border px-4 py-3" /><select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as Role)} className="w-full rounded-lg border px-4 py-3"><option>Admin</option><option>Manager</option><option>Employee</option></select><button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white">Create user</button></form></div></div>
      )}

      {modal === "project" && currentUser.role === "Admin" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Create new project</h2><p className="mt-1 text-sm text-slate-500">Admin-only project creation.</p></div><button onClick={() => setModal(null)} className="text-xl text-slate-400">×</button></div><form onSubmit={createProject} className="mt-6 space-y-4"><input autoFocus value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Project name" className="w-full rounded-lg border px-4 py-3" /><textarea value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} placeholder="Project description" rows={3} className="w-full resize-none rounded-lg border px-4 py-3" /><button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white">Create project</button></form></div></div>
      )}

      {modal === "task" && currentUser.role === "Manager" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Create task or subtask</h2><p className="mt-1 text-sm text-slate-500">Managers can assign work to employees.</p></div><button onClick={() => setModal(null)} className="text-xl text-slate-400">×</button></div><form onSubmit={createTask} className="mt-6 space-y-4"><input autoFocus value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="Task title" className="w-full rounded-lg border px-4 py-3" /><textarea value={newTaskDescription} onChange={(event) => setNewTaskDescription(event.target.value)} placeholder="Task description" rows={3} className="w-full resize-none rounded-lg border px-4 py-3" /><div className="grid gap-4 md:grid-cols-2"><select value={newTaskProjectId || projects[0]?.id} onChange={(event) => setNewTaskProjectId(event.target.value)} className="rounded-lg border px-4 py-3">{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select value={newTaskAssigneeId || employees[0]?.id} onChange={(event) => setNewTaskAssigneeId(event.target.value)} className="rounded-lg border px-4 py-3">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><select value={newTaskParentId} onChange={(event) => setNewTaskParentId(event.target.value)} className="rounded-lg border px-4 py-3"><option value="">Top-level task</option>{tasks.filter((task) => !task.parentId).map((task) => <option key={task.id} value={task.id}>Subtask of: {task.title}</option>)}</select><select value={newTaskPriority} onChange={(event) => setNewTaskPriority(event.target.value as Task["priority"])} className="rounded-lg border px-4 py-3"><option>High</option><option>Medium</option><option>Low</option></select></div><input value={newTaskDue} onChange={(event) => setNewTaskDue(event.target.value)} placeholder="Due date or label" className="w-full rounded-lg border px-4 py-3" /><button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white">Create and assign task</button></form></div></div>
      )}
    </main>
  );
}
