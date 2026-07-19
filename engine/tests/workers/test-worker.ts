export { WorkspaceStore } from '../../src/store/workspace-store.ts';

export default {
  fetch(): Response {
    return new Response('test worker');
  },
};
