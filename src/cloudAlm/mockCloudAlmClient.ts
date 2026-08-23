import type { AddCommentInput, CloudAlmComment, CloudAlmTask, UpdateTaskInput } from "./cloudAlmTypes.js";
import type { CloudAlmClient } from "./cloudAlmClient.js";

const mockTask: CloudAlmTask = {
  id: "TASK-1001",
  title: "Mock Cloud ALM task",
  status: "OPEN",
  priority: "MEDIUM"
};

const mockComments: CloudAlmComment[] = [
  {
    id: "COMMENT-1",
    taskId: mockTask.id,
    author: "mock-user",
    text: "Mock comment from local skeleton mode.",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

export class MockCloudAlmClient implements CloudAlmClient {
  async getTask(taskId: string): Promise<CloudAlmTask> {
    return { ...mockTask, id: taskId };
  }

  async getComments(taskId: string): Promise<CloudAlmComment[]> {
    return mockComments.map((comment) => ({ ...comment, taskId }));
  }

  async addComment(input: AddCommentInput): Promise<CloudAlmComment> {
    return {
      id: "COMMENT-MOCK-CREATED",
      taskId: input.taskId,
      author: "mock-user",
      text: input.text,
      createdAt: new Date(0).toISOString()
    };
  }

  async updateTask(input: UpdateTaskInput): Promise<CloudAlmTask> {
    return {
      ...mockTask,
      id: input.taskId,
      title: input.title ?? mockTask.title,
      status: input.status ?? mockTask.status,
      priority: input.priority ?? mockTask.priority
    };
  }
}
