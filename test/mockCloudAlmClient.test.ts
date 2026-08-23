import { describe, expect, it } from "vitest";
import {
  CloudAlmOperationNotSupportedError,
  CloudAlmTaskNotFoundError,
  CloudAlmValidationError
} from "../src/cloudAlm/cloudAlmErrors.js";
import { MockCloudAlmClient } from "../src/cloudAlm/mockCloudAlmClient.js";

describe("MockCloudAlmClient", () => {
  it("returns a known task", async () => {
    const client = new MockCloudAlmClient();

    await expect(client.getTask("TASK-1001")).resolves.toEqual({
      id: "TASK-1001",
      title: "Mock Cloud ALM task",
      status: "OPEN",
      priority: "MEDIUM"
    });
  });

  it("rejects unknown tasks", async () => {
    const client = new MockCloudAlmClient();

    await expect(client.getTask("TASK-404")).rejects.toBeInstanceOf(CloudAlmTaskNotFoundError);
  });

  it("returns comments for a known task and an empty array when none exist", async () => {
    const client = new MockCloudAlmClient();

    await expect(client.getComments("TASK-1001")).resolves.toEqual([
      {
        id: "COMMENT-1001",
        taskId: "TASK-1001",
        author: "mock-user",
        text: "Mock comment from local skeleton mode.",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    await expect(client.getComments("TASK-1002")).resolves.toEqual([]);
  });

  it("rejects comments for unknown tasks", async () => {
    const client = new MockCloudAlmClient();

    await expect(client.getComments("TASK-404")).rejects.toBeInstanceOf(CloudAlmTaskNotFoundError);
  });

  it("adds one deterministic comment that can be read back", async () => {
    const client = new MockCloudAlmClient();

    await expect(client.addComment({ taskId: "TASK-1002", text: "Added in mock mode." })).resolves.toEqual({
      id: "COMMENT-1002",
      taskId: "TASK-1002",
      author: "mock-user",
      text: "Added in mock mode.",
      createdAt: "2026-01-01T00:01:00.000Z"
    });
    await expect(client.getComments("TASK-1002")).resolves.toEqual([
      {
        id: "COMMENT-1002",
        taskId: "TASK-1002",
        author: "mock-user",
        text: "Added in mock mode.",
        createdAt: "2026-01-01T00:01:00.000Z"
      }
    ]);
  });

  it("rejects comment creation for unknown tasks and empty text", async () => {
    const client = new MockCloudAlmClient();

    await expect(client.addComment({ taskId: "TASK-404", text: "No task." })).rejects.toBeInstanceOf(
      CloudAlmTaskNotFoundError
    );
    await expect(client.addComment({ taskId: "TASK-1001", text: "   " })).rejects.toBeInstanceOf(CloudAlmValidationError);
  });

  it("updates allowlisted task fields", async () => {
    const client = new MockCloudAlmClient();

    await expect(client.updateTask({ taskId: "TASK-1001", title: "Updated title", status: "DONE" })).resolves.toEqual({
      id: "TASK-1001",
      title: "Updated title",
      status: "DONE",
      priority: "MEDIUM"
    });
    await expect(client.getTask("TASK-1001")).resolves.toMatchObject({
      title: "Updated title",
      status: "DONE"
    });
  });

  it("rejects updates for unknown tasks", async () => {
    const client = new MockCloudAlmClient();

    await expect(client.updateTask({ taskId: "TASK-404", status: "DONE" })).rejects.toBeInstanceOf(
      CloudAlmTaskNotFoundError
    );
  });

  it("rejects empty, no-op, and unknown-field updates", async () => {
    const client = new MockCloudAlmClient();

    await expect(client.updateTask({ taskId: "TASK-1001" })).rejects.toBeInstanceOf(CloudAlmValidationError);
    await expect(client.updateTask({ taskId: "TASK-1001", status: "OPEN" })).rejects.toBeInstanceOf(
      CloudAlmValidationError
    );
    await expect(
      client.updateTask({ taskId: "TASK-1001", status: "DONE", externalPayload: true } as never)
    ).rejects.toBeInstanceOf(CloudAlmOperationNotSupportedError);
  });
});
