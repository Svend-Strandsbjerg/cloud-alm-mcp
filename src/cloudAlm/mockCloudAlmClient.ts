import type { AddCommentInput, CloudAlmComment, CloudAlmTask, UpdateTaskInput } from "./cloudAlmTypes.js";
import type { CloudAlmClient } from "./cloudAlmClient.js";
import {
  CloudAlmOperationNotSupportedError,
  CloudAlmTaskNotFoundError,
  CloudAlmValidationError
} from "./cloudAlmErrors.js";

const allowedUpdateFields = new Set(["taskId", "title", "status", "priority"]);

const initialTasks: CloudAlmTask[] = [
  {
    id: "TASK-1001",
    title: "Mock Cloud ALM task",
    status: "OPEN",
    priority: "MEDIUM"
  },
  {
    id: "TASK-1002",
    title: "Mock Cloud ALM task without comments",
    status: "IN_PROGRESS",
    priority: "LOW"
  }
];

const initialComments: CloudAlmComment[] = [
  {
    id: "COMMENT-1001",
    taskId: "TASK-1001",
    author: "mock-user",
    text: "Mock comment from local skeleton mode.",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

export class MockCloudAlmClient implements CloudAlmClient {
  private readonly tasks = new Map<string, CloudAlmTask>();
  private readonly comments = new Map<string, CloudAlmComment[]>();
  private nextCommentNumber = 1002;

  constructor() {
    for (const task of initialTasks) {
      this.tasks.set(task.id, cloneTask(task));
    }

    for (const comment of initialComments) {
      const commentsForTask = this.comments.get(comment.taskId) ?? [];
      commentsForTask.push(cloneComment(comment));
      this.comments.set(comment.taskId, commentsForTask);
    }
  }

  async getTask(taskId: string): Promise<CloudAlmTask> {
    return cloneTask(this.requireTask(taskId));
  }

  async getComments(taskId: string): Promise<CloudAlmComment[]> {
    this.requireTask(taskId);
    return (this.comments.get(taskId) ?? []).map(cloneComment);
  }

  async addComment(input: AddCommentInput): Promise<CloudAlmComment> {
    this.requireTask(input.taskId);

    if (input.text.trim().length === 0) {
      throw new CloudAlmValidationError("Comment text must not be empty.");
    }

    const comment: CloudAlmComment = {
      id: `COMMENT-${this.nextCommentNumber}`,
      taskId: input.taskId,
      author: "mock-user",
      text: input.text,
      createdAt: deterministicTimestamp(this.nextCommentNumber)
    };
    this.nextCommentNumber += 1;

    const commentsForTask = this.comments.get(input.taskId) ?? [];
    commentsForTask.push(cloneComment(comment));
    this.comments.set(input.taskId, commentsForTask);

    return cloneComment(comment);
  }

  async updateTask(input: UpdateTaskInput): Promise<CloudAlmTask> {
    const task = this.requireTask(input.taskId);
    const unknownField = Object.keys(input).find((field) => !allowedUpdateFields.has(field));

    if (unknownField) {
      throw new CloudAlmOperationNotSupportedError(`Unsupported mock task update field: ${unknownField}`);
    }

    const updates = {
      title: input.title,
      status: input.status,
      priority: input.priority
    };
    const providedUpdateEntries = Object.entries(updates).filter((entry): entry is [keyof typeof updates, string] => {
      const [, value] = entry;
      return value !== undefined;
    });

    if (providedUpdateEntries.length === 0) {
      throw new CloudAlmValidationError("At least one mock task update field must be provided.");
    }

    for (const [field, value] of providedUpdateEntries) {
      if (value.trim().length === 0) {
        throw new CloudAlmValidationError(`Mock task update field must not be empty: ${field}`);
      }
    }

    const hasChange = providedUpdateEntries.some(([field, value]) => task[field] !== value);
    if (!hasChange) {
      throw new CloudAlmValidationError("Mock task update must change at least one field.");
    }

    const updatedTask: CloudAlmTask = {
      ...task,
      ...Object.fromEntries(providedUpdateEntries)
    };
    this.tasks.set(input.taskId, cloneTask(updatedTask));

    return cloneTask(updatedTask);
  }

  private requireTask(taskId: string): CloudAlmTask {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new CloudAlmTaskNotFoundError(taskId);
    }

    return task;
  }
}

function cloneTask(task: CloudAlmTask): CloudAlmTask {
  return { ...task };
}

function cloneComment(comment: CloudAlmComment): CloudAlmComment {
  return { ...comment };
}

function deterministicTimestamp(commentNumber: number): string {
  const base = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
  const offsetMinutes = commentNumber - 1001;
  return new Date(base + offsetMinutes * 60_000).toISOString();
}
