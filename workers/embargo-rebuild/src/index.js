export default {
  async scheduled(event, env, ctx) {
    if (!env.PAGES_DEPLOY_HOOK_URL) {
      console.error("PAGES_DEPLOY_HOOK_URL secret is not set");
      return;
    }

    const response = await fetch(env.PAGES_DEPLOY_HOOK_URL, { method: "POST" });

    if (!response.ok) {
      console.error(`Pages deploy hook returned ${response.status}: ${await response.text()}`);
    }
  },
};
