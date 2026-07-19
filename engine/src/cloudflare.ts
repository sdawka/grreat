import { DurableObject } from 'cloudflare:workers';

// Spike placeholder: proves an application-owned DO class can live in the
// Flue-managed Worker. Becomes the real WorkspaceStore in the next step.
export class WorkspaceStore extends DurableObject {
  async fetch(_request: Request): Promise<Response> {
    return Response.json({ ok: true, store: 'workspace' });
  }
}
