import {
  Workspace,
  WorkspaceLeftPanel,
  WorkspaceCenterPanel,
  WorkspaceRightPanel,
} from "@/components/workspace/Workspace"
import { ChatPanel } from "@/components/workspace/ChatPanel"
import { TaskPanel } from "@/components/tasks/TaskPanel"

export default function TasksSkill() {
  return (
    <Workspace>
      <WorkspaceLeftPanel className="w-80">
        <TaskPanel />
      </WorkspaceLeftPanel>
      <WorkspaceCenterPanel>
        <ChatPanel skillId="tasks" />
      </WorkspaceCenterPanel>
      <WorkspaceRightPanel />
    </Workspace>
  )
}
