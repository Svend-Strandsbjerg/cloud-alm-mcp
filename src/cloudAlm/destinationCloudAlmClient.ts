import type { AddCommentInput, CloudAlmComment, CloudAlmTask, UpdateTaskInput } from "./cloudAlmTypes.js";
import type { CloudAlmClient } from "./cloudAlmClient.js";

export class DestinationCloudAlmClient implements CloudAlmClient {
  async getTask(_taskId: string): Promise<CloudAlmTask> {
    throw destinationNotImplemented();
  }

  async getComments(_taskId: string): Promise<CloudAlmComment[]> {
    throw destinationNotImplemented();
  }

  async addComment(_input: AddCommentInput): Promise<CloudAlmComment> {
    throw destinationNotImplemented();
  }

  async updateTask(_input: UpdateTaskInput): Promise<CloudAlmTask> {
    throw destinationNotImplemented();
  }
}

function destinationNotImplemented(): Error {
  return new Error("Destination-based Cloud ALM connectivity is not implemented in STR-158.");
}
