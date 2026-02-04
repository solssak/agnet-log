import type { Project } from "../types";
import { cn } from "../utils/cn";

type Props = {
  projects: Project[];
  selectedProject: Project | null;
  onProjectClick: (project: Project) => void;
};

export const ProjectList = ({
  projects,
  selectedProject,
  onProjectClick,
}: Props) => {
  return (
    <>
      <h2 className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 font-mono">
        Projects
      </h2>
      <div className="flex-1 overflow-y-auto">
        {projects.map((project) => (
          <div
            key={project.path}
            className={cn(
              "px-4 py-3 cursor-pointer flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800",
              selectedProject?.path === project.path && "bg-white dark:bg-zinc-800"
            )}
            onClick={() => onProjectClick(project)}
          >
            <span className="text-sm font-medium truncate flex-1">
              {project.name}
            </span>
            <span className="text-xs text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full ml-2">
              {project.session_count}
            </span>
          </div>
        ))}
      </div>
    </>
  );
};
