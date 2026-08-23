export type CloudAlmOperationName =
  | "alm_get_task"
  | "alm_get_comments"
  | "alm_add_comment"
  | "alm_update_task";

export type CloudAlmCapability = "read" | "write";

export interface CloudAlmTask {
  id: string;
  title: string;
  status: string;
  priority: string;
}

export interface CloudAlmComment {
  id: string;
  taskId: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface AddCommentInput {
  taskId: string;
  text: string;
}

export interface UpdateTaskInput {
  taskId: string;
  title?: string;
  status?: string;
  priority?: string;
}
