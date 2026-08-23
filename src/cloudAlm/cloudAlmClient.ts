import type { AddCommentInput, CloudAlmComment, CloudAlmTask, UpdateTaskInput } from "./cloudAlmTypes.js";

export interface CloudAlmClient {
  getTask(taskId: string): Promise<CloudAlmTask>;
  getComments(taskId: string): Promise<CloudAlmComment[]>;
  addComment(input: AddCommentInput): Promise<CloudAlmComment>;
  updateTask(input: UpdateTaskInput): Promise<CloudAlmTask>;
}
