"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

type Task = {
  id: number;
  title: string;
  project: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  completed: boolean;
};

type Project = {
  id: number;
  name: string;
  description: string;
};

const startingTasks: Task[] = [
  {
    id: 1,
    title: "Prepare project kickoff",
    project: "Website redesign",
    due: "Today",
    priority: "High",
    completed: false,
  },
  {
    id: 2,
    title: "Review task requirements",
    project: "Product planning",
    due: "Tomorrow",
    priority: "Medium",
    completed: false,
  },
  {
    id: 3,
    title: "Update documentation",
    project: "Internal operations",
    due: "Friday",
    priority: "Low",
    completed: true,
  },
];

const startingProjects: Project[] = [
  {
    id: 1,
    name: "Website redesign",
    description: "Plan and deliver the new website experience.",
  },
  {
    id: 2,
    name: "Product planning",
    description: "Organize upcoming product work and requirements.",
  },
  {
    id: 3,
    name: "Internal operations",
    description: "Keep recurring operational work on track.",
  },
];

export default function Home() {
  const [tasks, setTasks] = useState(startingTasks);
  const [projects, setProjects] = useState(startingProjects);
  const [newTask, setNewTask] = useState("");
  const [selectedProject, setSelectedProject] = useState(
    startingProjects[0].name,
  );
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [filter, setFilter] = useState("All");

  const filteredTasks = useMemo(() => {
    if (filter === "Completed") {
      return tasks.filter((task) => task.completed);
    }

    if (filter === "Pending") {
      return tasks.filter((task) => !task.completed);
    }

    return tasks;
  }, [tasks, filter]);

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newTask.trim()) return;

    setTasks([
      {
        id: Date.now(),
        title: newTask,
        project: selectedProject,
        due: "Today",
        priority: "Medium",
        completed: false,
      },
      ...tasks,
    ]);

    setNewTask("");
  };

  const addProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = newProjectName.trim();
    if (!name) return;

    const project = {
      id: Date.now(),
      name,
      description:
        newProjectDescription.trim() || "A new project for your team.",
    };

    setProjects((currentProjects) => [project, ...currentProjects]);
    setSelectedProject(project.name);
    setNewProjectName("");
    setNewProjectDescription("");
    setIsProjectModalOpen(false);
  };

  const toggleTask = (id: number) => {
    setTasks(
      tasks.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed }
          : task,
      ),
    );
  };

  const completedCount = tasks.filter((task) => task.completed).length;
  const pendingCount = tasks.length - completedCount;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r bg-white p-6 md:block">
          <h1 className="text-2xl font-bold text-indigo-600">
            Task Management
          </h1>

          <nav className="mt-10 space-y-2">
            {["Dashboard", "My Tasks", "Projects", "Reports", "Settings"].map(
              (item) => (
                <button
                  key={item}
                  className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600"
                >
                  {item}
                </button>
              ),
            )}
          </nav>
        </aside>

        <section className="flex-1 p-6 md:p-10">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm text-slate-500">Monday, August 9</p>
                <h2 className="mt-1 text-3xl font-bold">Good morning 👋</h2>
                <p className="mt-2 text-slate-500">
                  Here is an overview of your work.
                </p>
              </div>

              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
              >
                + Create project
              </button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total tasks</p>
                <p className="mt-2 text-3xl font-bold">{tasks.length}</p>
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Pending tasks</p>
                <p className="mt-2 text-3xl font-bold text-orange-500">
                  {pendingCount}
                </p>
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Completed tasks</p>
                <p className="mt-2 text-3xl font-bold text-green-600">
                  {completedCount}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Your projects</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Organize tasks by project.
                  </p>
                </div>
                <button
                  onClick={() => setIsProjectModalOpen(true)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  + Add project
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProject(project.name)}
                    className={`rounded-lg border p-4 text-left transition hover:border-indigo-400 hover:bg-indigo-50 ${
                      selectedProject === project.name
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200"
                    }`}
                  >
                    <p className="font-semibold">{project.name}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {project.description}
                    </p>
                    <p className="mt-3 text-xs font-medium text-indigo-600">
                      {tasks.filter((task) => task.project === project.name).length} tasks
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <h3 className="text-xl font-bold">My tasks</h3>

                <div className="flex gap-2">
                  {["All", "Pending", "Completed"].map((item) => (
                    <button
                      key={item}
                      onClick={() => setFilter(item)}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        filter === item
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={addTask} className="mt-6 flex gap-3">
                <input
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  placeholder="Add a new task..."
                  className="flex-1 rounded-lg border px-4 py-3 outline-none focus:border-indigo-500"
                />

                <button className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white">
                  Add task
                </button>
              </form>

              <label className="mt-3 block text-sm text-slate-500">
                Add task to
                <select
                  value={selectedProject}
                  onChange={(event) => setSelectedProject(event.target.value)}
                  className="ml-2 rounded-lg border px-3 py-2 text-slate-700"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-6 space-y-3">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 rounded-lg border p-4"
                  >
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      className="h-5 w-5 accent-indigo-600"
                    />

                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          task.completed
                            ? "text-slate-400 line-through"
                            : ""
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {task.project} · Due {task.due}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {isProjectModalOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Create a new project</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Give your work a clear home.
                </p>
              </div>
              <button
                onClick={() => setIsProjectModalOpen(false)}
                className="text-xl text-slate-400 hover:text-slate-700"
                aria-label="Close project dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={addProject} className="mt-6 space-y-4">
              <label className="block text-sm font-medium">
                Project name
                <input
                  autoFocus
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="e.g. Mobile app launch"
                  className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="block text-sm font-medium">
                Description
                <textarea
                  value={newProjectDescription}
                  onChange={(event) =>
                    setNewProjectDescription(event.target.value)
                  }
                  placeholder="What is this project about?"
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg border px-4 py-3 outline-none focus:border-indigo-500"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Create project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
